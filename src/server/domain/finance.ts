import { Prisma } from "@prisma/client";

export const DEFAULT_OVERDUE_INTEREST_RATE_PCT = 28.5;

export function toDec(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value.toString());
}

export function addDays(from: Date, days: number) {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

export function effectiveInterestRate(
  value: number | string | Prisma.Decimal | null | undefined,
) {
  const rate = Number(value ?? 0);
  return rate > 0 ? rate : DEFAULT_OVERDUE_INTEREST_RATE_PCT;
}

/** Simple overdue interest: principal * rate% * daysOverdue / 365 */
export function calcInterest(params: {
  principal: number | string | Prisma.Decimal;
  annualRatePct: number | string | Prisma.Decimal;
  daysOverdue: number;
}) {
  if (params.daysOverdue <= 0) return toDec(0);
  return toDec(params.principal)
    .mul(toDec(params.annualRatePct))
    .mul(params.daysOverdue)
    .div(100)
    .div(365);
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function formatPaymentReminderBody(input: {
  partyName: string;
  billNo: string;
  outstanding: number | string | Prisma.Decimal;
  dueDate: Date;
  paymentTermsDays: number;
  interestRatePct: number | string | Prisma.Decimal;
  reminderKind: "PRE_DUE_10" | "DUE_TODAY" | "MANUAL";
}) {
  const amount = Number(input.outstanding).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const rate = effectiveInterestRate(input.interestRatePct);
  const heading =
    input.reminderKind === "PRE_DUE_10"
      ? "Advance payment reminder"
      : input.reminderKind === "DUE_TODAY"
        ? "Payment due today"
        : "Payment reminder";

  return [
    `Mapps Creation — ${heading}`,
    `Party: ${input.partyName}`,
    `Bill: ${input.billNo}`,
    `Outstanding: ₹${amount}`,
    `Due date: ${input.dueDate.toLocaleDateString("en-IN")}`,
    `Credit terms: ${input.paymentTermsDays} days from dispatch`,
    `Please arrange payment by the due date. Interest at ${rate}% per annum will be charged on the outstanding amount after the due date.`,
  ].join("\n");
}

export function calcCommission(params: {
  baseAmount: number | string | Prisma.Decimal;
  ratePct: number | string | Prisma.Decimal;
}) {
  return toDec(params.baseAmount).mul(toDec(params.ratePct)).div(100);
}

export function calcTds(params: {
  amount: number | string | Prisma.Decimal;
  tdsPct: number | string | Prisma.Decimal;
}) {
  const tdsAmount = toDec(params.amount).mul(toDec(params.tdsPct)).div(100);
  return { tdsAmount, net: toDec(params.amount).minus(tdsAmount) };
}
