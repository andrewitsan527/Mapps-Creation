import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type GreyDocumentKind = "BILL" | "CHALLAN";

const MAX_BYTES = 6 * 1024 * 1024;
const LOCAL_ROOT = path.join(process.cwd(), "storage", "grey-documents");
const STORAGE_KEY =
  /^grey-bills\/[A-Za-z0-9_-]+\/(BILL|CHALLAN)\/[a-f0-9]{32}\.(pdf|jpg|png)$/;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function newAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function documentMime(fileName: string, browserType: string) {
  const declared = browserType.trim().toLowerCase();
  if (
    declared === "application/pdf" ||
    declared === "image/jpeg" ||
    declared === "image/png"
  ) {
    return declared;
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) throw new Error("Document must be a PDF, JPG, or PNG.");
  return mime;
}

function extensionFor(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

function assertStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) {
    throw new Error("Invalid document storage key.");
  }
}

function localPath(storageKey: string) {
  assertStorageKey(storageKey);
  const absolute = path.resolve(LOCAL_ROOT, ...storageKey.split("/"));
  const root = path.resolve(LOCAL_ROOT);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid document storage key.");
  }
  return absolute;
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

export function assertDocumentFile(file: File) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a PDF or image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Document must be 6 MB or smaller.");
  }
  return documentMime(file.name, file.type);
}

export async function writeGreyDocument(input: {
  greyBillId: string;
  kind: GreyDocumentKind;
  mimeType: string;
  bytes: Buffer;
}) {
  const storageKey = `grey-bills/${input.greyBillId}/${input.kind}/${randomBytes(16).toString("hex")}.${extensionFor(input.mimeType)}`;
  const token = blobToken();
  if (token) {
    const { put } = await import("@vercel/blob");
    await put(storageKey, input.bytes, {
      access: "private",
      token,
      contentType: input.mimeType,
      addRandomSuffix: false,
    });
    return storageKey;
  }

  const absolute = localPath(storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, input.bytes);
  return storageKey;
}

export async function readGreyDocument(storageKey: string) {
  const token = blobToken();
  if (token) {
    const { get } = await import("@vercel/blob");
    const result = await get(storageKey, { access: "private", token });
    if (!result) throw new Error("Document file is missing.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  return readFile(localPath(storageKey));
}

export async function removeGreyDocument(storageKey: string) {
  const token = blobToken();
  if (token) {
    const { del } = await import("@vercel/blob");
    await del(storageKey, { token });
    return;
  }
  await rm(localPath(storageKey), { force: true });
}
