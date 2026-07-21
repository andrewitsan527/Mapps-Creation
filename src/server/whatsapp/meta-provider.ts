import type {
  SendWhatsAppInput,
  SendWhatsAppResult,
  WhatsAppProvider,
  WhatsAppTemplate,
} from "./types";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function messageBody(input: SendWhatsAppInput): string {
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
        v.mill ? `Mill: ${v.mill}` : null,
        v.fabric ? `Fabric: ${v.fabric}` : null,
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

function templateName(template: WhatsAppTemplate): string {
  const map: Record<WhatsAppTemplate, string | undefined> = {
    grey_purchase_order:
      process.env.WHATSAPP_TEMPLATE_GREY_PURCHASE_ORDER,
    mill_program: process.env.WHATSAPP_TEMPLATE_MILL_PROGRAM,
    sale_bill: process.env.WHATSAPP_TEMPLATE_SALE_BILL,
    provisional_bill: process.env.WHATSAPP_TEMPLATE_PROVISIONAL_BILL,
    qc_return: process.env.WHATSAPP_TEMPLATE_QC_RETURN,
    payment_reminder: process.env.WHATSAPP_TEMPLATE_PAYMENT_REMINDER,
  };
  return map[template] || template;
}

/**
 * Meta Cloud API WhatsApp provider.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Env:
 * - WHATSAPP_API_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 * - WHATSAPP_API_VERSION (default v21.0)
 * - WHATSAPP_SEND_MODE = text | template (default text)
 * - WHATSAPP_TEMPLATE_* optional approved template name overrides
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  async send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    const token = process.env.WHATSAPP_API_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
    const mode = (process.env.WHATSAPP_SEND_MODE || "text").toLowerCase();

    if (!token || !phoneNumberId) {
      return {
        ok: false,
        status: "FAILED",
        error:
          "Meta WhatsApp missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
      };
    }

    const to = normalizePhone(input.to);
    if (!to || to.length < 10) {
      return {
        ok: false,
        status: "FAILED",
        error: `Invalid WhatsApp number: ${input.to}`,
      };
    }

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    const body =
      mode === "template"
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: templateName(input.template),
              language: {
                code: process.env.WHATSAPP_TEMPLATE_LANG || "en",
              },
              components: buildTemplateComponents(input),
            },
          }
        : {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
              preview_url: Boolean(input.mediaUrl),
              body: messageBody(input).slice(0, 4096),
            },
          };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          ok: false,
          status: "FAILED",
          error:
            json.error?.message ||
            `Meta WhatsApp HTTP ${response.status}`,
        };
      }

      return {
        ok: true,
        status: "SENT",
        providerId: json.messages?.[0]?.id ?? `meta_${Date.now()}`,
      };
    } catch (error) {
      return {
        ok: false,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Meta WhatsApp request failed",
      };
    }
  }
}

function buildTemplateComponents(input: SendWhatsAppInput) {
  const params = Object.entries(input.variables ?? {})
    .filter(([key]) => key !== "body")
    .slice(0, 8)
    .map(([, value]) => ({
      type: "text",
      text: String(value).slice(0, 1024),
    }));

  if (params.length === 0) return undefined;
  return [
    {
      type: "body",
      parameters: params,
    },
  ];
}
