import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const SOUTH_AFRICA_TIME_ZONE = "Africa/Johannesburg";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayName(user?: { firstName?: string | null; lastName?: string | null; username: string } | null) {
  if (!user) return "Unknown";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username;
}

function zonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function todayStart() {
  const { year, month, day } = zonedParts();
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+02:00`);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(`2000-01-01T${value}:00+02:00`));
}

export function containsTime(startsAt: string, endsAt: string, date = new Date()) {
  const { hour, minute } = zonedParts(date);
  const now = hour * 60 + minute;
  const start = minutesFromTime(startsAt);
  const end = minutesFromTime(endsAt);

  if (start <= end) {
    return now >= start && now <= end;
  }

  return now >= start || now <= end;
}

export function mealWindowState(startsAt: string, endsAt: string, date = new Date()) {
  const { hour, minute } = zonedParts(date);
  const now = hour * 60 + minute;
  const start = minutesFromTime(startsAt);
  const end = minutesFromTime(endsAt);

  if (containsTime(startsAt, endsAt, date)) {
    return "open";
  }

  if (start <= end) {
    return now < start ? "upcoming" : "closed";
  }

  return now < start && now > end ? "upcoming" : "closed";
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

export function formatClockTime(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function trendLabel(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0% vs yesterday" : "New vs yesterday";
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}% vs yesterday`;
}
