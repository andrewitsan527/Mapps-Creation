import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Old-flow pages. The files stay in the project; a direct link no longer opens them.
 * /sales itself is the new Sales desk and stays open.
 */
const CLOSED_EXACT = new Set(["/grey", "/inward", "/programs", "/p", "/qc", "/stock"]);

function isClosedOldPage(pathname: string) {
  if (CLOSED_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/programs/")) return true;
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/stock/")) return true;
  if (pathname.startsWith("/sales/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  if (!isClosedOldPage(request.nextUrl.pathname)) return NextResponse.next();
  return new NextResponse("This page is closed.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    "/grey",
    "/inward",
    "/programs",
    "/programs/:path*",
    "/p",
    "/p/:path*",
    "/qc",
    "/stock",
    "/stock/:path*",
    "/sales/:path*",
  ],
};
