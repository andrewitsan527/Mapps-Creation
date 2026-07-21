import { prisma } from "@/lib/db";
import { StubWhatsAppProvider } from "./stub-provider";
import { MetaWhatsAppProvider } from "./meta-provider";
import type { SendWhatsAppInput, WhatsAppProvider } from "./types";

export function getWhatsAppProviderName(): "meta" | "stub" {
  const name = (process.env.WHATSAPP_PROVIDER || "stub").toLowerCase();
  if (name === "meta") {
    if (
      process.env.WHATSAPP_API_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    ) {
      return "meta";
    }
  }
  return "stub";
}

function getProvider(): WhatsAppProvider {
  if (getWhatsAppProviderName() === "meta") {
    return new MetaWhatsAppProvider();
  }
  return new StubWhatsAppProvider();
}

export async function sendWhatsApp(input: SendWhatsAppInput) {
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
        provider: getWhatsAppProviderName(),
        variables: input.variables ?? {},
        mediaUrl: input.mediaUrl ?? null,
        mode: process.env.WHATSAPP_SEND_MODE || "text",
      },
      status: result.status,
      providerId: result.providerId,
      error: result.error,
    },
  });

  return { result, log };
}

export type { SendWhatsAppInput, WhatsAppTemplate } from "./types";
