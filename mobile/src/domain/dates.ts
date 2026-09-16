/** Local-calendar date helpers (the diary is keyed by the device's local day, like iOS/Android). */

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** `yyyy-MM-dd` in local time; used as a stable key for a diary day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * Start of the week containing `date`. `firstWeekday` follows the iOS convention:
 * 1 = Sunday, 2 = Monday.
 */
export function startOfWeek(date: Date, weekStartsOnMonday: boolean): Date {
  const day = startOfDay(date);
  const weekday = day.getDay(); // 0 = Sunday
  const firstWeekday = weekStartsOnMonday ? 1 : 0;
  const daysBack = (weekday - firstWeekday + 7) % 7;
  return addDays(day, -daysBack);
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
