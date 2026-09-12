import { prisma } from "@/lib/db";
import { ClickWhatsAppProvider } from "./click-provider";
import { StubWhatsAppProvider } from "./stub-provider";
import { MetaWhatsAppProvider } from "./meta-provider";
import type { SendWhatsAppInput, WhatsAppProvider } from "./types";

export type WhatsAppProviderName = "meta" | "click" | "stub";

/**
 * - click (default): opens normal WhatsApp (wa.me) — no Business API needed
 * - meta: live Cloud API when token + phone id are set
 * - stub: log only
 */
export function getWhatsAppProviderName(): WhatsAppProviderName {
  const name = (process.env.WHATSAPP_PROVIDER || "click").toLowerCase();
  if (name === "meta") {
    if (
      process.env.WHATSAPP_API_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    ) {
      return "meta";
    }
    return "click";
  }
  if (name === "stub") return "stub";
  return "click";
}

function getProvider(): WhatsAppProvider {
  const name = getWhatsAppProviderName();
  if (name === "meta") return new MetaWhatsAppProvider();
  if (name === "stub") return new StubWhatsAppProvider();
  return new ClickWhatsAppProvider();
}

export async function sendWhatsApp(input: SendWhatsAppInput) {
  const providerName = getWhatsAppProviderName();
  const provider = getProvider();
  const result = await provider.send({
    ...input,
    to: input.to.trim(),
  });

  const log = await prisma.whatsAppMessageLog.create({
    data: {
      to: input.to,
      template: input.template,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: {
        provider: providerName,
        variables: input.variables ?? {},
        mediaUrl: input.mediaUrl ?? null,
        mode: process.env.WHATSAPP_SEND_MODE || "text",
        shareUrl: result.shareUrl ?? null,
      },
      status: result.status,
      providerId: result.providerId,
      error: result.error,
    },
  });

  return { result, log, shareUrl: result.shareUrl };
}

export type { SendWhatsAppInput, WhatsAppTemplate } from "./types";
