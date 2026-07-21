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
