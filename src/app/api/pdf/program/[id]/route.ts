import { NextResponse } from "next/server";
import { getProgramCardData } from "@/server/domain/program-card";
import { renderProgramCardPdf } from "@/server/pdf/program-card-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getProgramCardData(id);
  if (!data) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const buffer = await renderProgramCardPdf(data);
  const filename = `${data.programNo.replace(/[^\w.-]+/g, "_")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
