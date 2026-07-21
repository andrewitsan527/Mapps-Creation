import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Saves a validated evidence image under public/uploads. */
export async function saveReturnMarkaPhoto(file: File): Promise<string> {
  if (!file.size) throw new Error("Marka photo is required");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Marka photo must be 5 MB or smaller");
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Marka photo must be JPG, PNG, or WebP");
  }

  const relativeDirectory = path.join("uploads", "goods-returns");
  const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);
  await mkdir(absoluteDirectory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(
    path.join(absoluteDirectory, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  return `/${relativeDirectory.replaceAll("\\", "/")}/${filename}`;
}
