import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("de-DE").format(n);
}

export function formatPercent(num: number, den: number, digits = 1): string {
  if (!den) return "0%";
  return `${((num / den) * 100).toFixed(digits)}%`;
}

export function unixToISO(ts: number): string {
  return new Date(ts * (ts < 1e12 ? 1000 : 1)).toISOString();
}
