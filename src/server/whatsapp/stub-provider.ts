import type { SendWhatsAppInput, SendWhatsAppResult, WhatsAppProvider } from "./types";

/** Dev stub — logs and marks messages as STUB until Meta/BSP credentials are wired. */
export class StubWhatsAppProvider implements WhatsAppProvider {
  async send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    console.info("[whatsapp:stub]", {
      to: input.to,
      template: input.template,
      entityType: input.entityType,
      entityId: input.entityId,
      variables: input.variables,
    });

    return {
      ok: true,
      status: "STUB",
      providerId: `stub_${Date.now()}`,
    };
  }
}
