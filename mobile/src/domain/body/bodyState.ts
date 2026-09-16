/**
 * Weight and body-fat history. Mirrors `WeightStore.swift` / `BodyFatStore.swift`
 * (`WeightEntry`, `BodyFatEntry`) as one immutable state with a pure reducer, like the diary.
 * Field names match the native `Codable` shapes; `bodyFatFraction` is 0–1 like
 * `UserProfile.bodyFatPercentage`.
 */

import { startOfDay } from '../dates';

export interface WeightEntry {
  id: string;
  /** ISO-8601 timestamp. */
  date: string;
  weightKg: number;
}

export interface BodyFatEntry {
  id: string;
  date: string;
  bodyFatFraction: number;
}

export interface BodyState {
  weightEntries: readonly WeightEntry[];
  bodyFatEntries: readonly BodyFatEntry[];
  revision: number;
}

export const initialBodyState: BodyState = { weightEntries: [], bodyFatEntries: [], revision: 0 };

export type BodyAction =
  | { type: 'hydrate'; state: Partial<Omit<BodyState, 'revision'>> }
  | { type: 'weight/add'; entry: WeightEntry }
  | { type: 'weight/delete'; id: string }
  | { type: 'weight/seedIfEmpty'; entry: WeightEntry }
  | { type: 'bodyFat/add'; entry: BodyFatEntry }
  | { type: 'bodyFat/delete'; id: string }
  | { type: 'clearAll' };

export const POUNDS_PER_KILOGRAM = 2.20462;

export const weightLimitsKg = { min: 20, max: 250 } as const;
export const bodyFatLimits = { min: 0.03, max: 0.6 } as const;

function bump(state: BodyState, patch: Partial<BodyState>): BodyState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

export function isValidWeightKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= weightLimitsKg.min && kg <= weightLimitsKg.max;
}

export function isValidBodyFatFraction(fraction: number): boolean {
  return Number.isFinite(fraction) && fraction >= bodyFatLimits.min && fraction <= bodyFatLimits.max;
}

function hasRecordShape(value: unknown): value is Record<string, unknown> & { id: string; date: string } {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.date === 'string';
}

/** Persisted records are untrusted: sorting or rendering a `null` / dateless entry must never throw. */
export function isWeightEntry(value: unknown): value is WeightEntry {
  return hasRecordShape(value) && typeof value.weightKg === 'number' && isValidWeightKg(value.weightKg);
}

export function isBodyFatEntry(value: unknown): value is BodyFatEntry {
  return hasRecordShape(value) && typeof value.bodyFatFraction === 'number' && isValidBodyFatFraction(value.bodyFatFraction);
}

function validEntries<T>(value: unknown, guard: (item: unknown) => item is T): T[] | undefined {
  return Array.isArray(value) ? value.filter(guard) : undefined;
}

export function bodyReducer(state: BodyState, action: BodyAction): BodyState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        weightEntries: [...(validEntries(action.state.weightEntries, isWeightEntry) ?? state.weightEntries)].sort(byDate),
        bodyFatEntries: [...(validEntries(action.state.bodyFatEntries, isBodyFatEntry) ?? state.bodyFatEntries)].sort(byDate),
      };
    case 'weight/add':
      if (!isValidWeightKg(action.entry.weightKg)) return state;
      if (state.weightEntries.some((e) => e.id === action.entry.id)) return state;
      return bump(state, { weightEntries: [...state.weightEntries, action.entry].sort(byDate) });
    case 'weight/seedIfEmpty':
      // `seedInitialWeightFromProfileIfEmpty`: onboarding's first weigh-in, never duplicated.
      if (state.weightEntries.length > 0) return state;
      return bodyReducer(state, { type: 'weight/add', entry: action.entry });
    case 'weight/delete':
      if (!state.weightEntries.some((e) => e.id === action.id)) return state;
      return bump(state, { weightEntries: state.weightEntries.filter((e) => e.id !== action.id) });
    case 'bodyFat/add':
      if (!isValidBodyFatFraction(action.entry.bodyFatFraction)) return state;
      if (state.bodyFatEntries.some((e) => e.id === action.entry.id)) return state;
      return bump(state, { bodyFatEntries: [...state.bodyFatEntries, action.entry].sort(byDate) });
    case 'bodyFat/delete':
      if (!state.bodyFatEntries.some((e) => e.id === action.id)) return state;
      return bump(state, { bodyFatEntries: state.bodyFatEntries.filter((e) => e.id !== action.id) });
    case 'clearAll':
      return bump(state, { weightEntries: [], bodyFatEntries: [] });
  }
}

// MARK: - Selectors

export function latestWeight(state: BodyState): WeightEntry | undefined {
  return state.weightEntries[state.weightEntries.length - 1];
}

export function latestBodyFat(state: BodyState): BodyFatEntry | undefined {
  return state.bodyFatEntries[state.bodyFatEntries.length - 1];
}

/** Entries whose calendar day falls within `[start, end]` (inclusive, local days). */
export function entriesInRange<T extends { date: string }>(entries: readonly T[], start: Date, end: Date): T[] {
  const from = startOfDay(start).getTime();
  const to = startOfDay(end).getTime();
  return entries.filter((e) => {
    const day = startOfDay(new Date(e.date)).getTime();
    return day >= from && day <= to;
  });
}

// MARK: - Unit helpers (`weightUnit` preference: "kg" | "lbs")

export function displayWeight(kg: number, useMetric: boolean): number {
  return useMetric ? kg : kg * POUNDS_PER_KILOGRAM;
}

export function weightKgFromDisplay(value: number, useMetric: boolean): number {
  return useMetric ? value : value / POUNDS_PER_KILOGRAM;
}

export function formatWeight(kg: number, useMetric: boolean, fractionDigits = 1): string {
  return `${displayWeight(kg, useMetric).toFixed(fractionDigits)} ${useMetric ? 'kg' : 'lbs'}`;
}

export function formatBodyFat(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
