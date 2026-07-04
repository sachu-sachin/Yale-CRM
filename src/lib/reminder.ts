// Per-user (per-browser) target reminder configuration, stored in localStorage.
export const REMINDER_KEY = "crm.reminderIntervalMin";
export const REMINDER_EVENT = "crm:reminder-config";

export const REMINDER_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5, label: "Every 5 min" },
  { value: 10, label: "Every 10 min" },
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
];

export const DEFAULT_REMINDER_MIN = 10;

export function getReminderIntervalMin(): number {
  if (typeof window === "undefined") return DEFAULT_REMINDER_MIN;
  const v = window.localStorage.getItem(REMINDER_KEY);
  if (v == null) return DEFAULT_REMINDER_MIN;
  const n = parseInt(v, 10);
  return isNaN(n) ? DEFAULT_REMINDER_MIN : n;
}

export function setReminderIntervalMin(min: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDER_KEY, String(min));
  window.dispatchEvent(new CustomEvent(REMINDER_EVENT));
}
