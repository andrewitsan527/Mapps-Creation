import { prisma } from "@/lib/db";
import { readGreyDocument } from "@/server/grey-documents";

export const dynamic = "force-dynamic";

function contentDisposition(download: boolean, fileName: string) {
  const ascii = fileName.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "document";
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) {
    return new Response("Document not found.", { status: 404 });
  }

  const document = await prisma.greyBillDocument.findUnique({
    where: { accessToken: token },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
    },
  });
  if (!document) return new Response("Document not found.", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readGreyDocument(document.storageKey);
  } catch {
    return new Response("Document not found.", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(download, document.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
