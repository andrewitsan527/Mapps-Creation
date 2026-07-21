export type WhatsAppTemplate =
  | "grey_purchase_order"
  | "mill_program"
  | "sale_bill"
  | "provisional_bill"
  | "qc_return"
  | "payment_reminder";

export type SendWhatsAppInput = {
  to: string;
  template: WhatsAppTemplate;
  entityType?: string;
  entityId?: string;
  variables?: Record<string, string>;
  mediaUrl?: string;
};

export type SendWhatsAppResult = {
  ok: boolean;
  providerId?: string;
  status: "SENT" | "FAILED" | "STUB";
  error?: string;
};

export interface WhatsAppProvider {
  send(input: SendWhatsAppInput): Promise<SendWhatsAppResult>;
}
