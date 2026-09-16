/** Fasting sessions. Mirrors `FastingSession.swift` / `FastingStore.swift`. */

export const fastingSettings = {
  enabledKey: 'fastingTrackingEnabled',
  defaultGoalMinutesKey: 'fastingDefaultGoalMinutes',
  notificationEnabledKey: 'fastingGoalNotificationEnabled',
  sessionsKey: 'fastingSessions',
  defaultGoalMinutes: 16 * 60,
  minimumGoalMinutes: 60,
  maximumGoalMinutes: 7 * 24 * 60,
  commonGoalHours: [12, 14, 16, 18, 20, 24] as readonly number[],
} as const;

export interface FastingSession {
  id: string;
  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601; undefined while the fast is active. */
  endedAt?: string;
  goalMinutes: number;
}

export function clampGoalMinutes(goalMinutes: number): number {
  return Math.min(Math.max(goalMinutes, fastingSettings.minimumGoalMinutes), fastingSettings.maximumGoalMinutes);
}

export function isFastActive(session: FastingSession): boolean {
  return session.endedAt === undefined;
}

export function fastGoalDate(session: FastingSession): Date {
  return new Date(new Date(session.startedAt).getTime() + session.goalMinutes * 60_000);
}

/** Elapsed seconds (completed fasts use their end time). */
export function fastDurationSeconds(session: FastingSession, now: Date = new Date()): number {
  const end = session.endedAt ? new Date(session.endedAt) : now;
  return Math.max(0, (end.getTime() - new Date(session.startedAt).getTime()) / 1000);
}

/** Diary date of a fast: the day it ended. Active fasts belong to today only. */
export function fastDiaryDate(session: FastingSession): Date {
  return new Date(session.endedAt ?? session.startedAt);
}

export function fastsOverlap(a: FastingSession, b: FastingSession): boolean {
  const aStart = new Date(a.startedAt).getTime();
  const bStart = new Date(b.startedAt).getTime();
  const aEnd = a.endedAt ? new Date(a.endedAt).getTime() : Number.POSITIVE_INFINITY;
  const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : Number.POSITIVE_INFINITY;
  return aStart < bEnd && bStart < aEnd;
}

/** `FastingDurationFormatter.compact` — "16h 20m", "45m", "0m". */
export function formatFastDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatFastGoal(goalMinutes: number): string {
  return formatFastDuration(goalMinutes * 60);
}
