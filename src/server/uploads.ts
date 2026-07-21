import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function validateImage(file: File): string {
  if (!file.size) throw new Error("Marka photo is required");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Marka photo must be 5 MB or smaller");
  }
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Marka photo must be JPG, PNG, or WebP");
  }
  return extension;
}

/**
 * Saves a validated evidence image.
 * - On Vercel (or when BLOB_READ_WRITE_TOKEN is set) uses Vercel Blob storage,
 *   because the serverless filesystem is read-only / ephemeral.
 * - Locally falls back to writing under public/uploads.
 */
export async function saveReturnMarkaPhoto(file: File): Promise<string> {
  const extension = validateImage(file);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const key = `goods-returns/${filename}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });
    return blob.url;
  }

  const relativeDirectory = path.join("uploads", "goods-returns");
  const absoluteDirectory = path.join(
    process.cwd(),
    "public",
    relativeDirectory,
  );
  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(
    path.join(absoluteDirectory, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  return `/${relativeDirectory.replaceAll("\\", "/")}/${filename}`;
}
