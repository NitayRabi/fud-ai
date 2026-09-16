/**
 * Strength workout log. Ported from `StrengthWorkoutSession.swift` (sessions, completed
 * exercises/sets, `StrengthWorkoutBurnEstimator`, `StrengthExerciseLiftHistory`) and the
 * persistence shape of `StrengthWorkoutStore.swift`, as one reducer-backed state.
 * Set fields stay strings like the native `StrengthCompletedSet` so partially typed sets
 * round-trip; a set counts as performed once `reps` is non-empty.
 */

import { dayKey, isSameDay } from '../dates';
import type { WeightUnit } from '../prefs/preferences';

export const rpeScales = ['strength', 'cr10', 'borg'] as const;
export type RPEScale = (typeof rpeScales)[number];

export function rpeScaleTitle(scale: RPEScale): string {
  switch (scale) {
    case 'strength':
      return 'Strength 1–10';
    case 'cr10':
      return 'CR10 0–10';
    case 'borg':
      return 'Borg 6–20';
  }
}

export const workoutSplits = ['fullBody', 'upperLower', 'pushPullLegs', 'broSplit', 'custom'] as const;
export type WorkoutSplit = (typeof workoutSplits)[number];

export function workoutSplitTitle(split: WorkoutSplit): string {
  switch (split) {
    case 'fullBody':
      return 'Full Body';
    case 'upperLower':
      return 'Upper / Lower';
    case 'pushPullLegs':
      return 'Push / Pull / Legs';
    case 'broSplit':
      return 'Body Part';
    case 'custom':
      return 'Custom';
  }
}

export interface WorkoutPreferences {
  split: WorkoutSplit;
  rpeScale: RPEScale;
  weightUnit: WeightUnit;
}

export const defaultWorkoutPreferences: WorkoutPreferences = { split: 'fullBody', rpeScale: 'strength', weightUnit: 'lbs' };

export interface CompletedSet {
  id: string;
  setNumber: number;
  weight: string;
  weightUnit: WeightUnit;
  reps: string;
  rpe: string;
  rpeScale?: RPEScale;
}

export interface CompletedExercise {
  id: string;
  itemID: string;
  name: string;
  targetMuscles: string[];
  equipment: string;
  sets: CompletedSet[];
}

export interface WorkoutSession {
  id: string;
  /** ISO-8601 of the diary day. */
  diaryDate: string;
  /** Stable `yyyy-MM-dd` so the day never moves with the time zone. */
  diaryDateKey: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  exercises: CompletedExercise[];
  caloriesBurned?: number;
}

export function isSetPerformed(set: Pick<CompletedSet, 'reps'>): boolean {
  return set.reps.trim().length > 0;
}

export function performedSetCount(session: WorkoutSession): number {
  return session.exercises.flatMap((e) => e.sets).filter(isSetPerformed).length;
}

export function repCount(session: WorkoutSession): number {
  return session.exercises.flatMap((e) => e.sets).reduce((sum, set) => sum + (Number.parseInt(set.reps, 10) || 0), 0);
}

export function durationMinutes(session: WorkoutSession): number {
  return Math.max(0, Math.ceil(session.durationSeconds / 60));
}

// MARK: - Draft (the in-progress log for a day)

export interface DraftSet {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
}

export interface DraftExercise {
  id: string;
  itemID: string;
  name: string;
  targetMuscles: string[];
  equipment: string;
  category: string;
  sets: DraftSet[];
}

export interface WorkoutDraft {
  dayKey: string;
  startedAt: string;
  exercises: DraftExercise[];
}

export interface WorkoutsState {
  sessions: readonly WorkoutSession[];
  drafts: Readonly<Record<string, WorkoutDraft>>;
  preferences: WorkoutPreferences;
  revision: number;
}

export const initialWorkoutsState: WorkoutsState = { sessions: [], drafts: {}, preferences: defaultWorkoutPreferences, revision: 0 };

export type WorkoutsAction =
  | { type: 'hydrate'; state: Partial<Omit<WorkoutsState, 'revision'>> }
  | { type: 'preferences/update'; patch: Partial<WorkoutPreferences> }
  | { type: 'draft/addExercise'; dayKey: string; exercise: DraftExercise; startedAt: string }
  | { type: 'draft/removeExercise'; dayKey: string; exerciseId: string }
  | { type: 'draft/addSet'; dayKey: string; exerciseId: string; set: DraftSet }
  | { type: 'draft/updateSet'; dayKey: string; exerciseId: string; set: DraftSet }
  | { type: 'draft/removeSet'; dayKey: string; exerciseId: string; setId: string }
  | { type: 'draft/discard'; dayKey: string }
  | { type: 'session/finish'; dayKey: string; session: WorkoutSession }
  | { type: 'session/delete'; id: string }
  | { type: 'clearAll' };

function bump(state: WorkoutsState, patch: Partial<WorkoutsState>): WorkoutsState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function updateDraft(state: WorkoutsState, key: string, update: (draft: WorkoutDraft) => WorkoutDraft | undefined, startedAt?: string): WorkoutsState {
  const existing = state.drafts[key] ?? { dayKey: key, startedAt: startedAt ?? new Date().toISOString(), exercises: [] };
  const next = update(existing);
  const drafts = { ...state.drafts };
  if (next) drafts[key] = next;
  else delete drafts[key];
  return bump(state, { drafts });
}

export function workoutsReducer(state: WorkoutsState, action: WorkoutsAction): WorkoutsState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        sessions: [...(action.state.sessions ?? state.sessions)].sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
        drafts: action.state.drafts ?? state.drafts,
        preferences: { ...defaultWorkoutPreferences, ...(action.state.preferences ?? state.preferences) },
      };
    case 'preferences/update':
      return bump(state, { preferences: { ...state.preferences, ...action.patch } });
    case 'draft/addExercise':
      return updateDraft(
        state,
        action.dayKey,
        (draft) => (draft.exercises.some((e) => e.id === action.exercise.id) ? draft : { ...draft, exercises: [...draft.exercises, action.exercise] }),
        action.startedAt,
      );
    case 'draft/removeExercise':
      return updateDraft(state, action.dayKey, (draft) => ({ ...draft, exercises: draft.exercises.filter((e) => e.id !== action.exerciseId) }));
    case 'draft/addSet':
      return updateDraft(state, action.dayKey, (draft) => ({
        ...draft,
        exercises: draft.exercises.map((e) => (e.id === action.exerciseId ? { ...e, sets: [...e.sets, action.set] } : e)),
      }));
    case 'draft/updateSet':
      return updateDraft(state, action.dayKey, (draft) => ({
        ...draft,
        exercises: draft.exercises.map((e) => (e.id === action.exerciseId ? { ...e, sets: e.sets.map((s) => (s.id === action.set.id ? action.set : s)) } : e)),
      }));
    case 'draft/removeSet':
      return updateDraft(state, action.dayKey, (draft) => ({
        ...draft,
        exercises: draft.exercises.map((e) => (e.id === action.exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== action.setId) } : e)),
      }));
    case 'draft/discard':
      if (!state.drafts[action.dayKey]) return state;
      return updateDraft(state, action.dayKey, () => undefined);
    case 'session/finish': {
      if (state.sessions.some((s) => s.id === action.session.id)) return state;
      const drafts = { ...state.drafts };
      delete drafts[action.dayKey];
      return bump(state, { sessions: [...state.sessions, action.session].sort((a, b) => a.completedAt.localeCompare(b.completedAt)), drafts });
    }
    case 'session/delete':
      if (!state.sessions.some((s) => s.id === action.id)) return state;
      return bump(state, { sessions: state.sessions.filter((s) => s.id !== action.id) });
    case 'clearAll':
      return bump(state, { sessions: [], drafts: {} });
  }
}

/** Build the immutable session from a draft when the user taps Finish. */
export function finishDraft(draft: WorkoutDraft, makeId: () => string, now: Date, preferences: WorkoutPreferences, bodyWeightKg: number): WorkoutSession {
  const started = new Date(draft.startedAt);
  const exercises: CompletedExercise[] = draft.exercises
    .map((exercise) => ({
      id: exercise.id,
      itemID: exercise.itemID,
      name: exercise.name,
      targetMuscles: exercise.targetMuscles,
      equipment: exercise.equipment,
      sets: exercise.sets
        .filter(isSetPerformed)
        .map((set, index) => ({ id: set.id, setNumber: index + 1, weight: set.weight, weightUnit: preferences.weightUnit, reps: set.reps, rpe: set.rpe, rpeScale: preferences.rpeScale })),
    }))
    .filter((exercise) => exercise.sets.length > 0);
  const estimate = estimateBurn(exercises, bodyWeightKg, preferences.rpeScale);
  const diaryDate = new Date(`${draft.dayKey}T12:00:00`);
  return {
    id: makeId(),
    diaryDate: diaryDate.toISOString(),
    diaryDateKey: draft.dayKey,
    startedAt: draft.startedAt,
    completedAt: now.toISOString(),
    durationSeconds: Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000)),
    exercises,
    ...(estimate ? { caloriesBurned: estimate.calories } : {}),
  };
}

// MARK: - Selectors

export function sessionsOn(state: WorkoutsState, day: Date): WorkoutSession[] {
  const key = dayKey(day);
  return state.sessions.filter((s) => s.diaryDateKey === key || isSameDay(new Date(s.diaryDate), day));
}

export function completedSessions(state: WorkoutsState): WorkoutSession[] {
  return [...state.sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/** `WorkoutBurnAggregation.isReliable` — 1…5000 kcal. */
export function isReliableBurn(calories: number | undefined): calories is number {
  return calories !== undefined && calories >= 1 && calories <= 5_000;
}

export function burnSessions(state: WorkoutsState): WorkoutSession[] {
  return state.sessions.filter((s) => isReliableBurn(s.caloriesBurned));
}

export interface WorkoutBurnDay {
  day: string;
  calories: number;
}

/** One estimate per diary day; duplicates keep the newest record rather than summing. */
export function dailyBurn(sessions: readonly WorkoutSession[]): WorkoutBurnDay[] {
  const byDay = new Map<string, WorkoutSession>();
  for (const session of sessions) {
    if (!isReliableBurn(session.caloriesBurned)) continue;
    const existing = byDay.get(session.diaryDateKey);
    if (!existing || existing.completedAt < session.completedAt) byDay.set(session.diaryDateKey, session);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, session]) => ({ day, calories: session.caloriesBurned ?? 0 }));
}

export interface LiftDay {
  day: string;
  bestWeightKg: number;
  totalReps: number;
  sets: number;
}

const KG_PER_LB = 1 / 2.204_622_621_8;

export function setWeightKg(set: Pick<CompletedSet, 'weight' | 'weightUnit'>): number {
  const value = Number.parseFloat(set.weight.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return set.weightUnit === 'kg' ? value : value * KG_PER_LB;
}

/** `StrengthExerciseLiftHistory` — per-day best load / reps for one exercise, newest first. */
export function liftHistory(sessions: readonly WorkoutSession[], itemID: string): LiftDay[] {
  const days = new Map<string, LiftDay>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.itemID !== itemID) continue;
      const day = days.get(session.diaryDateKey) ?? { day: session.diaryDateKey, bestWeightKg: 0, totalReps: 0, sets: 0 };
      for (const set of exercise.sets) {
        if (!isSetPerformed(set)) continue;
        day.sets += 1;
        day.totalReps += Number.parseInt(set.reps, 10) || 0;
        day.bestWeightKg = Math.max(day.bestWeightKg, setWeightKg(set));
      }
      days.set(session.diaryDateKey, day);
    }
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// MARK: - Burn estimate (`StrengthWorkoutBurnEstimator`, untimed sets)

export interface BurnEstimate {
  calories: number;
  performedSetCount: number;
  repCount: number;
}

function normalizedEffort(text: string, scale: RPEScale): number {
  const value = Number.parseFloat(text.replace(',', '.'));
  if (!Number.isFinite(value)) return 0.6;
  const normalized = scale === 'strength' ? (value - 1) / 9 : scale === 'cr10' ? value / 10 : (value - 6) / 14;
  return Math.min(Math.max(normalized, 0), 1);
}

function relativeLoad(set: Pick<CompletedSet, 'weight' | 'weightUnit'>, bodyWeightKg: number): number {
  const kg = setWeightKg(set);
  return kg > 0 ? Math.min(Math.max(kg / bodyWeightKg, 0), 2) : 0;
}

/**
 * MET-based estimate: ~2.75 s per rep of active time plus 1.6 min recovery per set and a
 * 0.75 min transition per exercise, MET 3.5–8 from effort and relative load. Timed cardio
 * (exercise timers) is not logged in the shared app yet, so only the set path is ported.
 */
export function estimateBurn(exercises: readonly CompletedExercise[], bodyWeightKg: number, defaultScale: RPEScale): BurnEstimate | undefined {
  const safeBodyWeight = Number.isFinite(bodyWeightKg) ? Math.min(Math.max(bodyWeightKg, 35), 300) : 70;
  let performed = 0;
  let reps = 0;
  let activeMinutes = 0;
  let recoveryMinutes = 0;
  let effortTotal = 0;
  let loadTotal = 0;
  let exercisesWithWork = 0;
  for (const exercise of exercises) {
    let inExercise = 0;
    for (const set of exercise.sets) {
      const rawReps = Number.parseInt(set.reps, 10);
      if (!Number.isFinite(rawReps) || rawReps <= 0) continue;
      const setReps = Math.min(rawReps, 100);
      performed += 1;
      reps += setReps;
      inExercise += 1;
      activeMinutes += Math.min(Math.max((setReps * 2.75) / 60, 0.3), 1.5);
      recoveryMinutes += 1.6;
      effortTotal += normalizedEffort(set.rpe, set.rpeScale ?? defaultScale);
      loadTotal += relativeLoad(set, safeBodyWeight);
    }
    if (inExercise > 0) exercisesWithWork += 1;
  }
  if (performed === 0) return undefined;
  recoveryMinutes = Math.max(0, recoveryMinutes - 1.6);
  const estimatedMinutes = Math.max(4, activeMinutes + recoveryMinutes + exercisesWithWork * 0.75);
  const averageEffort = effortTotal / performed;
  const averageLoad = loadTotal / performed;
  const met = Math.min(Math.max(3.8 + 2.4 * averageEffort + 0.5 * averageLoad, 3.5), 8);
  const calories = ((met * 3.5 * safeBodyWeight) / 200) * estimatedMinutes;
  return { calories: Math.min(Math.max(Math.round(calories), 1), 5_000), performedSetCount: performed, repCount: reps };
}
