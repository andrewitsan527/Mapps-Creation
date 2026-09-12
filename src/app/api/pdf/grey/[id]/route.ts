import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderGreyPoPdf } from "@/server/pdf/grey-po-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await prisma.greyPurchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          name: true,
          whatsapp: true,
          phone: true,
          gstin: true,
          address: true,
        },
      },
      bills: {
        select: { billNo: true, amount: true, notes: true },
        orderBy: { billDate: "asc" },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  const buffer = await renderGreyPoPdf({
    id: order.id,
    poNumber: order.poNumber,
    orderDate: order.orderDate,
    quantity: order.quantity?.toString() ?? null,
    unit: order.unit,
    fabricNotes: order.fabricNotes,
    whatsappNote: order.whatsappNote,
    status: order.status,
    supplier: order.supplier,
    bills: order.bills.map((b) => ({
      billNo: b.billNo,
      amount: b.amount.toString(),
      notes: b.notes,
    })),
  });

  const filename = `${order.poNumber.replace(/[^\w.-]+/g, "_")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
