import { prisma } from "@/lib/db";
import { StubWhatsAppProvider } from "./stub-provider";
import type { SendWhatsAppInput, WhatsAppProvider } from "./types";

function getProvider(): WhatsAppProvider {
  // Later: switch on WHATSAPP_PROVIDER === "meta" | "interakt"
  return new StubWhatsAppProvider();
}

export async function sendWhatsApp(input: SendWhatsAppInput) {
  const provider = getProvider();
  const result = await provider.send(input);

  const log = await prisma.whatsAppMessageLog.create({
    data: {
      to: input.to,
      template: input.template,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: {
        variables: input.variables ?? {},
        mediaUrl: input.mediaUrl ?? null,
      },
      status: result.status,
      providerId: result.providerId,
      error: result.error,
    },
  });

  return { result, log };
}

export type { SendWhatsAppInput, WhatsAppTemplate } from "./types";
