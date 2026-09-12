import { buildWhatsAppClickUrl, composeWhatsAppBody } from "./compose";
import type {
  SendWhatsAppInput,
  SendWhatsAppResult,
  WhatsAppProvider,
} from "./types";

/**
 * Normal WhatsApp (no Business API): returns a wa.me link.
 * The UI opens it; the user taps Send in WhatsApp.
 */
export class ClickWhatsAppProvider implements WhatsAppProvider {
  async send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    const body = composeWhatsAppBody(input);
    const shareUrl = buildWhatsAppClickUrl(input.to, body);

    console.info("[whatsapp:click]", {
      to: input.to,
      template: input.template,
    });

    return {
      ok: true,
      status: "STUB",
      providerId: `click_${Date.now()}`,
      shareUrl,
    };
  }
}
