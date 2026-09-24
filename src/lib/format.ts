/**
 * Date helpers shared by server and client components.
 *
 * Deadlines are stored as timezone-free `YYYY-MM-DD` strings, so dates are
 * always parsed at local noon to avoid off-by-one rendering bugs.
 */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function todayIso(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function prettyDate(iso: string): string {
  const date = toDate(iso);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortDate(iso: string): string {
  const date = toDate(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function longDate(iso: string): string {
  const date = toDate(iso);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function prettyTime(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function daysUntil(iso: string, today = todayIso()): number {
  const target = toDate(iso).getTime();
  const start = toDate(today).getTime();
  return Math.round((target - start) / 86_400_000);
}

export function countdownLabel(iso: string, today = todayIso()): string {
  const days = daysUntil(iso, today);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export type MonthCell = {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

/** Six-week grid starting on Sunday, always covering the whole month. */
export function buildMonthGrid(
  year: number,
  month: number,
  today = todayIso(),
): MonthCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const cells: MonthCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, 1 - startOffset + index);
    const iso = isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
    cells.push({
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === today,
    });
  }

  return cells;
}

export function groupByDate<T extends { dueDate: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(item.dueDate);
    if (bucket) bucket.push(item);
    else map.set(item.dueDate, [item]);
  }
  return map;
}
