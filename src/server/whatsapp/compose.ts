import type { SendWhatsAppInput } from "./types";

/** Shared message composer for click-to-chat and Meta text mode. */
export function composeWhatsAppBody(input: SendWhatsAppInput): string {
  if (input.variables?.body?.trim()) return input.variables.body.trim();

  const v = input.variables ?? {};
  switch (input.template) {
    case "grey_purchase_order":
      return [
        "Mapps Creation — Grey purchase order",
        v.poNumber ? `PO: ${v.poNumber}` : null,
        v.supplier ? `Supplier: ${v.supplier}` : null,
        v.quantity ? `Quantity: ${v.quantity}` : null,
        v.note ?? null,
      ]
        .filter(Boolean)
        .join("\n");
    case "mill_program":
      return [
        "Mapps Creation — Mill program",
        v.programNo ? `Program: ${v.programNo}` : null,
        v.fabric ? `Fabric: ${v.fabric}` : null,
        v.color ? `Colour: ${v.color}` : null,
        v.details ?? null,
      ]
        .filter(Boolean)
        .join("\n");
    case "sale_bill":
    case "provisional_bill":
      return [
        `Mapps Creation — ${input.template === "provisional_bill" ? "Provisional" : "Sale"} bill`,
        v.billNo ? `Bill: ${v.billNo}` : null,
        v.total ? `Total: ₹${v.total}` : null,
        v.body ?? null,
      ]
        .filter(Boolean)
        .join("\n");
    case "qc_return":
      return [
        "Mapps Creation — Mill RF / QC return",
        v.rfNo ? `RF: ${v.rfNo}` : null,
        v.lotNumber ? `Lot: ${v.lotNumber}` : null,
        v.defectType ? `Defect: ${v.defectType}` : null,
        v.body ?? v.remarks ?? null,
      ]
        .filter(Boolean)
        .join("\n");
    case "payment_reminder":
      return [
        "Mapps Creation — Payment reminder",
        v.billNo ? `Bill: ${v.billNo}` : null,
        v.due ? `Outstanding: ₹${v.due}` : null,
        v.dueDate ? `Due: ${v.dueDate}` : null,
        v.body ?? null,
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return Object.entries(v)
        .map(([k, val]) => `${k}: ${val}`)
        .join("\n");
  }
}

/** Indian 10-digit numbers get +91. */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Normal WhatsApp link — opens app/Web with message ready; user taps Send. */
export function buildWhatsAppClickUrl(phone: string, text: string): string {
  const to = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${to}?text=${encodeURIComponent(text.slice(0, 3500))}`;
}
