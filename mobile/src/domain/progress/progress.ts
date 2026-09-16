/**
 * Progress tab domain. Ported from `ProgressComponents.swift` (`TimeRange`, trend
 * downsampling, `TrendXAxis`, `ProgressFoodRangeStats`) and `ProgressMetricViews.swift`
 * (`ProgressMetric`) plus `ProgressOverviewMode` in `WeeklyChallenge.swift`.
 */

import { addDays, dateFromDayKey, dayKey, startOfDay } from '../dates';
import { homeNutrients, homeNutrientGoal, type OptionalNutrientGoals } from '../diary/homeNutrients';
import { foodEntryDate, type FoodEntry } from '../food/food';
import { homeTopNutrientIds, type HomeTopNutrientId } from '../prefs/preferences';
import type { DailyTargets } from '../profile/userProfile';

// MARK: - Overview mode & metric

export const progressOverviewModes = ['myProgress', 'weeklyChallenge'] as const;
export type ProgressOverviewMode = (typeof progressOverviewModes)[number];

export function progressOverviewModeTitle(mode: ProgressOverviewMode): string {
  return mode === 'myProgress' ? 'My Progress' : 'Weekly Challenge';
}

export const progressMetrics = ['weight', 'bodyFat', 'workouts'] as const;
export type ProgressMetric = (typeof progressMetrics)[number];

export function progressMetricTitle(metric: ProgressMetric): string {
  switch (metric) {
    case 'weight':
      return 'Weight';
    case 'bodyFat':
      return 'Body Fat';
    case 'workouts':
      return 'Workouts';
  }
}

/** `ProgressMetric.available` — Weight always; Body Fat and Workouts only with data. */
export function availableProgressMetrics(input: { bodyFatAvailable: boolean; workoutBurnAvailable: boolean }): ProgressMetric[] {
  const metrics: ProgressMetric[] = ['weight'];
  if (input.bodyFatAvailable) metrics.push('bodyFat');
  if (input.workoutBurnAvailable) metrics.push('workouts');
  return metrics;
}

// MARK: - Time range

export const timeRanges = ['1W', '1M', '3M', '6M', '1Y', 'All'] as const;
export type TimeRange = (typeof timeRanges)[number];

export function timeRangeDays(range: TimeRange): number {
  switch (range) {
    case '1W':
      return 7;
    case '1M':
      return 30;
    case '3M':
      return 90;
    case '6M':
      return 180;
    case '1Y':
      return 365;
    case 'All':
      return 3650;
  }
}

/** Inclusive local-day range ending today, `days` long. */
export function timeRangeDates(range: TimeRange, now: Date = new Date()): { start: Date; end: Date } {
  const end = startOfDay(now);
  return { start: addDays(end, -(timeRangeDays(range) - 1)), end };
}

// MARK: - Day axis (bar charts)

export interface DayAxis {
  /** Calendar days from the first to the last plotted day, inclusive (≥ 1). */
  dayCount: number;
  /** Zero-based calendar offset of a day key from the first plotted day. */
  offset: (day: string) => number;
  /** Day keys that get an x-axis label (~`desiredTicks`, calendar-spaced). */
  ticks: string[];
}

/**
 * The x-axis Swift Charts derives from `BarMark(x: .value("Date", date, unit: .day))`: bars sit
 * at their calendar position between the first and last plotted day, so two logs a month apart
 * are a month apart on screen, not neighbours. Labels are spaced like `AxisMarks(desiredCount:)`.
 */
export function dayAxis(days: readonly string[], desiredTicks = 5): DayAxis {
  const sorted = [...days].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return { dayCount: 1, offset: () => 0, ticks: [] };
  const origin = startOfDay(dateFromDayKey(first)).getTime();
  const offset = (day: string) => Math.max(0, Math.round((startOfDay(dateFromDayKey(day)).getTime() - origin) / 86_400_000));
  const dayCount = offset(last) + 1;
  const step = dayCount <= 7 ? 1 : Math.ceil(dayCount / desiredTicks);
  const ticks: string[] = [];
  for (let i = 0; i < dayCount; i += step) ticks.push(dayKey(addDays(dateFromDayKey(first), i)));
  return { dayCount, offset, ticks };
}

// MARK: - Trend points

export interface TrendPoint {
  /** Epoch milliseconds. */
  time: number;
  value: number;
}

function spanDaysOf(points: readonly TrendPoint[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 1;
  return Math.max(1, Math.round((last.time - first.time) / 86_400_000));
}

/**
 * Average a date-sorted series into equal buckets once it outgrows the adaptive limit, so
 * hundreds of readings keep a readable line. Sparse series pass through untouched.
 */
export function downsampleTrend(points: readonly TrendPoint[], maxPoints = 60): TrendPoint[] {
  const first = points[0];
  if (!first) return [];
  const spanDays = spanDaysOf(points);
  const rangeLimit = spanDays <= 45 ? 60 : spanDays <= 100 ? 48 : spanDays <= 200 ? 36 : spanDays <= 400 ? 30 : 24;
  const limit = Math.min(maxPoints, rangeLimit);
  if (points.length <= limit) return [...points];
  const bucketDays = Math.max(1, Math.ceil(spanDays / limit));
  const buckets = new Map<number, { timeSum: number; valueSum: number; count: number }>();
  for (const point of points) {
    const day = Math.floor((point.time - first.time) / 86_400_000);
    const key = Math.floor(day / bucketDays);
    const bucket = buckets.get(key) ?? { timeSum: 0, valueSum: 0, count: 0 };
    bucket.timeSum += point.time;
    bucket.valueSum += point.value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((key) => {
      const bucket = buckets.get(key)!;
      return { time: bucket.timeSum / bucket.count, value: bucket.valueSum / bucket.count };
    });
}

export interface TrendAxis {
  strideDays: number;
  showsYear: boolean;
}

/** `TrendXAxis` — strides derive from the plotted date span, not the entry count. */
export function trendAxis(points: readonly TrendPoint[]): TrendAxis {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { strideDays: 1, showsYear: false };
  const spanDays = spanDaysOf(points);
  const showsYear = spanDays > 150 && new Date(first.time).getFullYear() !== new Date(last.time).getFullYear();
  if (showsYear) return { strideDays: Math.max(75, Math.floor(spanDays / 4)), showsYear };
  const strideDays = spanDays <= 8 ? 1 : spanDays <= 35 ? 5 : spanDays <= 100 ? 14 : spanDays <= 200 ? 30 : 60;
  return { strideDays, showsYear };
}

/** Y-domain with 15% (min 2 units) padding, including the goal line when present. */
export function trendDomain(values: readonly number[], goal: number | undefined, fallback: [number, number]): [number, number] {
  const all = goal === undefined ? [...values] : [...values, goal];
  if (all.length === 0) return fallback;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const padding = Math.max((max - min) * 0.15, 2);
  return [min - padding, max + padding];
}

export function netChange(points: readonly TrendPoint[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  return first && last ? last.value - first.value : 0;
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function formatSigned(value: number, unit: string, fractionDigits = 1): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(fractionDigits)} ${unit}`;
}

// MARK: - Food range stats

export interface DailyCalories {
  /** `yyyy-MM-dd` local day key. */
  day: string;
  calories: number;
}

export interface NutrientAverageItem {
  id: HomeTopNutrientId;
  label: string;
  current: number;
  goal: number;
  unit: string;
}

export interface ProgressFoodRangeStats {
  dailyCalories: DailyCalories[];
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  loggedDays: number;
  nutrientItems: NutrientAverageItem[];
}

export const emptyFoodRangeStats: ProgressFoodRangeStats = { dailyCalories: [], avgProtein: 0, avgCarbs: 0, avgFat: 0, loggedDays: 0, nutrientItems: [] };

const macroIds: readonly HomeTopNutrientId[] = ['protein', 'carbs', 'fat'];

/** `ProgressFoodRangeStats.compute` — one pass over the entries in the window. */
export function computeFoodRangeStats(
  entries: readonly FoodEntry[],
  dayCount: number,
  targets: DailyTargets,
  optionalGoals: OptionalNutrientGoals = {},
  now: Date = new Date(),
): ProgressFoodRangeStats {
  const today = startOfDay(now);
  const rangeStart = addDays(today, -(dayCount - 1)).getTime();
  const todayTime = today.getTime();

  const buckets = new Map<string, FoodEntry[]>();
  for (const entry of entries) {
    const day = startOfDay(foodEntryDate(entry));
    const time = day.getTime();
    if (time < rangeStart || time > todayTime) continue;
    const key = dayKey(day);
    const list = buckets.get(key);
    if (list) list.push(entry);
    else buckets.set(key, [entry]);
  }

  const nutrients = homeTopNutrientIds.filter((id) => !macroIds.includes(id));
  const dailyCalories: DailyCalories[] = [];
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;
  let loggedDays = 0;
  const nutrientTotals = new Map<HomeTopNutrientId, number>();

  for (const key of [...buckets.keys()].sort()) {
    const dayEntries = buckets.get(key) ?? [];
    if (dayEntries.length === 0) continue;
    const calories = dayEntries.reduce((sum, e) => sum + e.calories, 0);
    if (calories > 0) dailyCalories.push({ day: key, calories });
    totalP += dayEntries.reduce((sum, e) => sum + e.protein, 0);
    totalC += dayEntries.reduce((sum, e) => sum + e.carbs, 0);
    totalF += dayEntries.reduce((sum, e) => sum + e.fat, 0);
    loggedDays += 1;
    for (const id of nutrients) nutrientTotals.set(id, (nutrientTotals.get(id) ?? 0) + homeNutrients[id].total(dayEntries));
  }

  if (loggedDays === 0) return { ...emptyFoodRangeStats, dailyCalories };
  const divisor = loggedDays;
  const nutrientItems = nutrients.flatMap((id) => {
    const current = (nutrientTotals.get(id) ?? 0) / divisor;
    const goal = Math.round(homeNutrientGoal(id, targets, optionalGoals));
    if (current < 0.05 && goal === 0) return [];
    return [{ id, label: homeNutrients[id].displayName, current, goal, unit: homeNutrients[id].unit }];
  });
  return { dailyCalories, avgProtein: totalP / divisor, avgCarbs: totalC / divisor, avgFat: totalF / divisor, loggedDays, nutrientItems };
}

// MARK: - Streaks (`StatsSection`)

export interface LoggingStats {
  currentStreak: number;
  bestStreak: number;
  daysOnTarget: number;
  totalEntries: number;
}

/** Consecutive logged days ending today (or yesterday, if today has nothing yet). */
export function loggingStats(entries: readonly FoodEntry[], calorieGoal: number, now: Date = new Date()): LoggingStats {
  const perDay = new Map<string, number>();
  for (const entry of entries) {
    const key = dayKey(foodEntryDate(entry));
    perDay.set(key, (perDay.get(key) ?? 0) + entry.calories);
  }
  const days = [...perDay.keys()].sort();
  let bestStreak = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const key of days) {
    const date = new Date(`${key}T00:00:00`);
    run = previous && Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }
  let currentStreak = 0;
  let cursor = startOfDay(now);
  if (!perDay.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (perDay.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }
  const daysOnTarget = calorieGoal > 0 ? [...perDay.values()].filter((kcal) => kcal > 0 && kcal <= calorieGoal).length : 0;
  return { currentStreak, bestStreak, daysOnTarget, totalEntries: entries.length };
}
