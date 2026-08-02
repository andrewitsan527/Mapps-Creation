import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQty(value: number | string | { toString(): string }, digits = 2) {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function availableQty(onHand: number | string, reserved: number | string) {
  return Number(onHand) - Number(reserved);
}

export function formatMoney(value: number | string | { toString(): string }) {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Compact money for dense KPI tiles: ₹1.2L, ₹3.4Cr. */
export function formatMoneyShort(
  value: number | string | { toString(): string },
) {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "in 3d" / "2d late" — relative to now, day granularity. */
export function relativeDays(target: Date, now = new Date()) {
  const diff = Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "today";
  if (diff > 0) return `in ${diff}d`;
  return `${Math.abs(diff)}d late`;
}
