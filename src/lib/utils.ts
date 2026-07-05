import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const leadSourceLabels: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WALKIN: "Walk-in",
  REFERRAL: "Referral",
  GOOGLE_ADS: "Google Ads",
  OTHER: "Other",
};

// ---- Ads / phases ----
export const adPhaseLabels: Record<string, string> = {
  CLOSED: "Closed",
  RENEWAL: "Renewal",
  REGULAR: "Regular Client",
};

export const adPhaseColors: Record<string, string> = {
  CLOSED: "bg-emerald-100 text-emerald-700",
  RENEWAL: "bg-amber-100 text-amber-700",
  REGULAR: "bg-indigo-100 text-indigo-700",
};

// ---- Deal status (replaces lead status + payment status) ----
export const dealStatusLabels: Record<string, string> = {
  PAID: "Conversion / Paid",
  PENDING: "Waiting for Payment",
  FOLLOW_UP: "Follow-up",
  NOT_CLOSED: "Not Closed",
  REPEATED: "Repeated Lead",
  IRRELEVANT: "Irrelevant",
};

export const dealStatusColors: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  FOLLOW_UP: "bg-cyan-100 text-cyan-700",
  NOT_CLOSED: "bg-blue-100 text-blue-700",
  REPEATED: "bg-indigo-100 text-indigo-700",
  IRRELEVANT: "bg-slate-100 text-slate-600",
};

/**
 * A PAID deal whose end date has passed (and hasn't been renewed) is shown as
 * "waiting for payment" (renewal due) — display only, the stored status stays PAID.
 */
export function isRenewalDue(
  status: string,
  endDate: string | Date | null,
  renewedAt?: string | Date | null
): boolean {
  if (status !== "PAID" || !endDate || renewedAt) return false;
  return new Date(endDate).getTime() < Date.now();
}

// ---- Pipeline stage machine (forward-only for telecallers; admins override) ----
// REPEATED is intentionally omitted from the pipeline UI (dormant enum value).
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NOT_CLOSED: ["FOLLOW_UP", "PENDING", "PAID", "IRRELEVANT"],
  FOLLOW_UP: ["PENDING", "PAID"], // no Irrelevant from Follow-up
  PENDING: ["PAID"], // admin also allows IRRELEVANT (via override)
  PAID: [], // renew (↻) only
  IRRELEVANT: [], // terminal
  REPEATED: [],
};

// Statuses an admin may pick when overriding (dormant REPEATED excluded).
const OVERRIDE_STATUSES = ["NOT_CLOSED", "FOLLOW_UP", "PENDING", "PAID", "IRRELEVANT"];

/** Statuses selectable from `current` (excludes current itself). */
export function allowedNextStatuses(current: string, isAdmin: boolean): string[] {
  if (isAdmin) return OVERRIDE_STATUSES.filter((s) => s !== current);
  return ALLOWED_TRANSITIONS[current] || [];
}

/** Server-side guard: is moving from→to permitted for this role? */
export function isTransitionAllowed(from: string, to: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// ---- Telecaller incentive (monthly, on PAID revenue) ----
// First ₹2.5L = base salary (₹0 incentive). First full lakh above → ₹4,500.
// Each further full lakh → ₹3,500. Partial lakhs do not count.
export const INCENTIVE_BASE = 250000;
export const INCENTIVE_FIRST_LAKH = 4500;
export const INCENTIVE_NEXT_LAKH = 3500;

export function calcIncentive(revenue: number): number {
  const above = (revenue || 0) - INCENTIVE_BASE;
  if (above < 100000) return 0;
  const fullLakhs = Math.floor(above / 100000);
  return INCENTIVE_FIRST_LAKH + (fullLakhs - 1) * INCENTIVE_NEXT_LAKH;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/** Whole days remaining until `end` (can be negative if past). */
export function daysLeft(end: Date | string): number {
  const e = new Date(end);
  const now = new Date();
  // normalise to start of day so "today" reads as 0
  e.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - now.getTime()) / 86_400_000);
}

/** Human countdown label, e.g. "3 days to go", "Last day", "Overdue 2 days". */
export function countdownLabel(end: Date | string): string {
  const d = daysLeft(end);
  if (d > 1) return `${d} days to go`;
  if (d === 1) return "1 day to go";
  if (d === 0) return "Last day";
  if (d === -1) return "Overdue 1 day";
  return `Overdue ${Math.abs(d)} days`;
}

/** Tailwind classes for a countdown chip based on urgency. */
export function countdownColor(end: Date | string): string {
  const d = daysLeft(end);
  if (d < 0) return "bg-red-100 text-red-700";
  if (d <= 3) return "bg-amber-100 text-amber-700";
  if (d <= 7) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}
