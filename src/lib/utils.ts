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

export const leadStatusColors: Record<string, string> = {
  NEW_ENQUIRY: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-purple-100 text-purple-700",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  PROPOSAL_SENT: "bg-pink-100 text-pink-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
};

export const leadStatusLabels: Record<string, string> = {
  NEW_ENQUIRY: "New Enquiry",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow Up",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

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

export const paymentStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  PAID: "Paid",
};

export const paymentStatusColors: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

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
