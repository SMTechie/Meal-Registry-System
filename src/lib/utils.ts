import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayName(user?: { firstName?: string | null; lastName?: string | null; username: string } | null) {
  if (!user) return "Unknown";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username;
}

export function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-ZA", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function containsTime(startsAt: string, endsAt: string, date = new Date()) {
  const now = date.getHours() * 60 + date.getMinutes();
  const [startHour, startMinute] = startsAt.split(":").map(Number);
  const [endHour, endMinute] = endsAt.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (start <= end) {
    return now >= start && now <= end;
  }

  return now >= start || now <= end;
}

export function trendLabel(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0% vs yesterday" : "New vs yesterday";
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}% vs yesterday`;
}
