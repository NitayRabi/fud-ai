/**
 * User profile and goal math. Ported from `UserProfile.swift` (BMR / TDEE / macro split) so the
 * Home targets match the native apps to the kcal.
 */

export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive' | 'extraActive';

export type WeightGoal = 'lose' | 'maintain' | 'gain';

export type Macro = 'protein' | 'carbs' | 'fat';

export const KILOCALORIES_PER_KILOGRAM = 7_700;

export const activityMultiplier: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.465,
  active: 1.55,
  veryActive: 1.725,
  extraActive: 1.9,
};

/** Grams of protein per kilogram of full bodyweight. */
export const proteinPerKg: Record<ActivityLevel, number> = {
  sedentary: 0.8,
  light: 1.2,
  moderate: 1.6,
  active: 1.8,
  veryActive: 2.0,
  extraActive: 2.2,
};

export const kcalPerGram: Record<Macro, number> = { protein: 4, carbs: 4, fat: 9 };

export interface UserProfile {
  name?: string;
  gender: Gender;
  /** ISO-8601 date. */
  birthday: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  /** 0.0–1.0 */
  bodyFatPercentage?: number;
  goalBodyFatPercentage?: number;
  weeklyChangeKg?: number;
  goalWeightKg?: number;
  customCalories?: number;
  customProtein?: number;
  customFat?: number;
  customCarbs?: number;
  allergenSensitivities?: string[];
}

export const defaultUserProfile: UserProfile = {
  gender: 'other',
  birthday: new Date(Date.UTC(1996, 0, 1)).toISOString(),
  heightCm: 170,
  weightKg: 70,
  activityLevel: 'moderate',
  goal: 'maintain',
};

export function ageYears(profile: UserProfile, now: Date = new Date()): number {
  const birthday = new Date(profile.birthday);
  let age = now.getFullYear() - birthday.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthday.getMonth() || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate());
  if (beforeBirthday) age -= 1;
  return Number.isFinite(age) ? age : 25;
}

/** Katch-McArdle whenever body fat is known, otherwise Mifflin-St Jeor. */
export function bmr(profile: UserProfile, now: Date = new Date()): number {
  if (profile.bodyFatPercentage !== undefined) {
    return 370 + 21.6 * (1 - profile.bodyFatPercentage) * profile.weightKg;
  }
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * ageYears(profile, now) - 161;
  return profile.gender === 'male' ? base + 166 : base;
}

export function tdee(profile: UserProfile, now: Date = new Date()): number {
  return bmr(profile, now) * activityMultiplier[profile.activityLevel];
}

export function calorieAdjustment(profile: UserProfile): number {
  const rate = profile.weeklyChangeKg ?? 0.5;
  const perDay = Math.trunc((rate * KILOCALORIES_PER_KILOGRAM) / 7);
  switch (profile.goal) {
    case 'maintain':
      return 0;
    case 'lose':
      return -perDay;
    case 'gain':
      return perDay;
  }
}

export function dailyCalories(profile: UserProfile, now: Date = new Date()): number {
  return Math.trunc(tdee(profile, now)) + calorieAdjustment(profile);
}

export function proteinGoal(profile: UserProfile): number {
  const cuttingBoost = profile.goal === 'lose' ? 0.2 : 0;
  return Math.trunc((proteinPerKg[profile.activityLevel] + cuttingBoost) * profile.weightKg);
}

export function fatGoal(profile: UserProfile): number {
  return Math.trunc(0.6 * profile.weightKg);
}

export function carbsGoal(profile: UserProfile, now: Date = new Date()): number {
  return Math.max(0, Math.trunc((dailyCalories(profile, now) - proteinGoal(profile) * 4 - fatGoal(profile) * 9) / 4));
}

export function effectiveCalories(profile: UserProfile, now: Date = new Date()): number {
  return profile.customCalories ?? dailyCalories(profile, now);
}

function customValue(profile: UserProfile, macro: Macro): number | undefined {
  switch (macro) {
    case 'protein':
      return profile.customProtein;
    case 'carbs':
      return profile.customCarbs;
    case 'fat':
      return profile.customFat;
  }
}

function formulaValue(profile: UserProfile, macro: Macro, now: Date): number {
  switch (macro) {
    case 'protein':
      return proteinGoal(profile);
    case 'carbs':
      return carbsGoal(profile, now);
    case 'fat':
      return fatGoal(profile);
  }
}

const allMacros: readonly Macro[] = ['protein', 'carbs', 'fat'];

/** Auto (unpinned) macros split the remaining calories using their formula values as weights. */
function autoMacroValue(profile: UserProfile, macro: Macro, now: Date): number {
  const pinnedKcal = allMacros.reduce((sum, m) => sum + (customValue(profile, m) ?? 0) * kcalPerGram[m], 0);
  const remaining = Math.max(0, effectiveCalories(profile, now) - pinnedKcal);
  const autoMacros = allMacros.filter((m) => customValue(profile, m) === undefined);
  if (!autoMacros.includes(macro)) return 0;
  if (autoMacros.length === 1) return Math.trunc(remaining / kcalPerGram[macro]);
  const totalFormulaKcal = autoMacros.reduce((sum, m) => sum + formulaValue(profile, m, now) * kcalPerGram[m], 0);
  if (totalFormulaKcal <= 0) return formulaValue(profile, macro, now);
  const sharedKcal = Math.trunc((remaining * formulaValue(profile, macro, now) * kcalPerGram[macro]) / totalFormulaKcal);
  return Math.trunc(sharedKcal / kcalPerGram[macro]);
}

export function effectiveMacro(profile: UserProfile, macro: Macro, now: Date = new Date()): number {
  return customValue(profile, macro) ?? autoMacroValue(profile, macro, now);
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function dailyTargets(profile: UserProfile, now: Date = new Date()): DailyTargets {
  return {
    calories: effectiveCalories(profile, now),
    protein: effectiveMacro(profile, 'protein', now),
    carbs: effectiveMacro(profile, 'carbs', now),
    fat: effectiveMacro(profile, 'fat', now),
  };
}
