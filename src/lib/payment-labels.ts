import type { PaymentCategory } from "@prisma/client";

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  CUSTOMER_RECEIPT: "Customer receipt",
  MILL_PAYMENT: "Mill payment",
  WEAVER_PAYMENT: "Weaver payment",
  GREY_SUPPLIER_PAYMENT: "Grey supplier payment",
  AGENT_COMMISSION: "Agent commission",
  OTHER: "Other payment",
};
