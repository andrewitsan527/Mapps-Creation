import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type SentDocumentKind = "MILL_INWARD" | "MILL_PROGRAM";

const LOCAL_ROOT = path.join(process.cwd(), "storage", "sent-documents");
const STORAGE_KEY = /^(mill-inward|mill-program)\/[A-Za-z0-9_-]+\/[a-f0-9]{32}\.pdf$/;

const FOLDER: Record<SentDocumentKind, string> = {
  MILL_INWARD: "mill-inward",
  MILL_PROGRAM: "mill-program",
};

export function newSentDocumentToken() {
  return randomBytes(24).toString("base64url");
}

export function sentDocumentUrl(accessToken: string) {
  return `/api/sent-documents/${accessToken}`;
}

function localPath(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) {
    throw new Error("Invalid document storage key.");
  }
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

export async function writeSentDocument(input: {
  kind: SentDocumentKind;
  entityId: string;
  bytes: Buffer;
}) {
  const storageKey = `${FOLDER[input.kind]}/${input.entityId}/${randomBytes(16).toString("hex")}.pdf`;
  const token = blobToken();
  if (token) {
    const { put } = await import("@vercel/blob");
    await put(storageKey, input.bytes, {
      access: "private",
      token,
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    return storageKey;
  }

  const absolute = localPath(storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, input.bytes);
  return storageKey;
}

export async function readSentDocument(storageKey: string) {
  const token = blobToken();
  if (token) {
    const { get } = await import("@vercel/blob");
    const result = await get(storageKey, { access: "private", token });
    if (!result) throw new Error("Document file is missing.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  return readFile(localPath(storageKey));
}

export async function removeSentDocument(storageKey: string) {
  const token = blobToken();
  if (token) {
    const { del } = await import("@vercel/blob");
    await del(storageKey, { token });
    return;
  }
  await rm(localPath(storageKey), { force: true });
}
