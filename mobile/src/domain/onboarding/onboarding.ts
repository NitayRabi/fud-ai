/**
 * Onboarding draft and plan math. Ported from the `@State` in `OnboardingView.swift`
 * (steps 0–13), including the desired-weight seeding, goal-speed table, estimated days and
 * the Plan Ready editing rules (carbs are the residual so calories stay consistent).
 */

import { POUNDS_PER_KILOGRAM } from '../body/bodyState';
import { activityMultiplier, carbsGoal, dailyCalories, fatGoal, kcalPerGram, proteinGoal, type ActivityLevel, type Gender, type UserProfile, type WeightGoal } from '../profile/userProfile';

export const onboardingSteps = [
  'welcome',
  'gender',
  'birthday',
  'heightWeight',
  'bodyFat',
  'activity',
  'goal',
  'desiredWeight',
  'goalSpeed',
  'notifications',
  'health',
  'aiSetup',
  'buildingPlan',
  'planReady',
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

export const TOTAL_ONBOARDING_STEPS = onboardingSteps.length;

export function stepIndex(step: OnboardingStep): number {
  return onboardingSteps.indexOf(step);
}

/** `step / (totalSteps - 1)` — the header progress bar fill. */
export function onboardingProgress(step: OnboardingStep): number {
  return stepIndex(step) / (TOTAL_ONBOARDING_STEPS - 1);
}

/** Steps 1…12 show the back chevron + progress header; welcome and plan-ready do not. */
export function showsOnboardingHeader(step: OnboardingStep): boolean {
  const index = stepIndex(step);
  return index > 0 && index < TOTAL_ONBOARDING_STEPS - 1;
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  return onboardingSteps[Math.min(stepIndex(step) + 1, TOTAL_ONBOARDING_STEPS - 1)] ?? step;
}

export function previousOnboardingStep(step: OnboardingStep): OnboardingStep {
  return onboardingSteps[Math.max(stepIndex(step) - 1, 0)] ?? step;
}

export type GoalSpeed = 0 | 1 | 2;

export const CM_PER_FOOT = 30.48;
export const CM_PER_INCH = 2.54;

export interface OnboardingDraft {
  gender: Gender;
  /** ISO-8601 date. */
  birthday: string;
  isMetric: boolean;
  heightFeet: number;
  heightInches: number;
  heightCm: number;
  /** Stored in the unit the user is editing, one decimal. */
  weightLbs: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  targetWeightLbs: number;
  targetWeightKg: number;
  goalSpeed: GoalSpeed;
  knowsBodyFat: boolean;
  bodyFatPercent: number;
  goalBodyFatPercent?: number;
  notificationsEnabled: boolean;
  healthEnabled: boolean;
}

export function defaultOnboardingDraft(now: Date = new Date()): OnboardingDraft {
  const birthday = new Date(now);
  birthday.setFullYear(birthday.getFullYear() - 25);
  return {
    gender: 'male',
    birthday: birthday.toISOString(),
    isMetric: false,
    heightFeet: 5,
    heightInches: 9,
    heightCm: 175,
    weightLbs: 154,
    weightKg: 70,
    activityLevel: 'moderate',
    goal: 'maintain',
    targetWeightLbs: 154,
    targetWeightKg: 70,
    goalSpeed: 1,
    knowsBodyFat: false,
    bodyFatPercent: 20,
    notificationsEnabled: false,
    healthEnabled: false,
  };
}

export const heightLimits = { cm: { min: 100, max: 250 }, feet: { min: 3, max: 8 }, inches: { min: 0, max: 11 } } as const;
export const weightLimits = { kg: { min: 30, max: 250 }, lbs: { min: 60, max: 500 } } as const;
export const bodyFatPercentLimits = { min: 3, max: 60 } as const;

export function draftHeightCm(draft: OnboardingDraft): number {
  return draft.isMetric ? draft.heightCm : draft.heightFeet * CM_PER_FOOT + draft.heightInches * CM_PER_INCH;
}

export function draftWeightKg(draft: OnboardingDraft): number {
  return draft.isMetric ? draft.weightKg : draft.weightLbs / POUNDS_PER_KILOGRAM;
}

export function draftTargetWeightKg(draft: OnboardingDraft): number | undefined {
  if (draft.goal === 'maintain') return undefined;
  return draft.isMetric ? draft.targetWeightKg : draft.targetWeightLbs / POUNDS_PER_KILOGRAM;
}

/** `weeklyChangeKg` — slow / recommended / fast. */
export function weeklyChangeKg(speed: GoalSpeed): number {
  switch (speed) {
    case 0:
      return 0.25;
    case 1:
      return 0.5;
    case 2:
      return 1.0;
  }
}

export function goalSpeedTitle(speed: GoalSpeed): string {
  return speed === 0 ? 'Slow' : speed === 1 ? 'Recommended' : 'Fast';
}

export function goalSpeedDescription(speed: GoalSpeed): string {
  switch (speed) {
    case 1:
      return 'The most balanced pace, motivating and sustainable.';
    case 0:
      return 'Gentle and sustainable. Great for long-term habits.';
    case 2:
      return 'Aggressive but doable. Requires strong discipline.';
  }
}

export function weightDiffKg(draft: OnboardingDraft): number {
  const target = draftTargetWeightKg(draft);
  return target === undefined ? 0 : Math.abs(target - draftWeightKg(draft));
}

/** Days to reach the desired weight at the chosen weekly pace. */
export function estimatedDays(draft: OnboardingDraft): number {
  const diff = weightDiffKg(draft);
  if (diff <= 0) return 0;
  return Math.trunc((diff / weeklyChangeKg(draft.goalSpeed)) * 7);
}

/** Seed the desired weight from the current weight ±10 lbs / ±5 kg when the goal is chosen. */
export function seedTargetWeight(draft: OnboardingDraft): OnboardingDraft {
  const lbsDelta = draft.goal === 'lose' ? -10 : draft.goal === 'gain' ? 10 : 0;
  const kgDelta = draft.goal === 'lose' ? -5 : draft.goal === 'gain' ? 5 : 0;
  return {
    ...draft,
    targetWeightLbs: clamp(roundTenth(draft.weightLbs + lbsDelta), weightLimits.lbs.min, weightLimits.lbs.max),
    targetWeightKg: clamp(roundTenth(draft.weightKg + kgDelta), weightLimits.kg.min, weightLimits.kg.max),
  };
}

export type TargetWeightProblem = 'outOfRange' | 'notBelowCurrent' | 'notAboveCurrent';

/**
 * Why a desired weight cannot be continued with, in the unit being edited: outside the bounds,
 * or pointing the wrong way for the chosen goal (a "lose" target at or above the current
 * weight would make `weightDiffKg` / the pace math describe a gain). `maintain` has no target.
 */
export function targetWeightProblem(draft: OnboardingDraft, target: number): TargetWeightProblem | undefined {
  const limits = draft.isMetric ? weightLimits.kg : weightLimits.lbs;
  if (!Number.isFinite(target) || target < limits.min || target > limits.max) return 'outOfRange';
  const current = draft.isMetric ? draft.weightKg : draft.weightLbs;
  if (draft.goal === 'lose' && target >= current) return 'notBelowCurrent';
  if (draft.goal === 'gain' && target <= current) return 'notAboveCurrent';
  return undefined;
}

/** Toggle Imperial ↔ Metric, converting the values being edited so nothing is lost. */
export function setDraftMetric(draft: OnboardingDraft, isMetric: boolean): OnboardingDraft {
  if (draft.isMetric === isMetric) return draft;
  if (isMetric) {
    const cm = clamp(Math.round(draft.heightFeet * CM_PER_FOOT + draft.heightInches * CM_PER_INCH), heightLimits.cm.min, heightLimits.cm.max);
    return {
      ...draft,
      isMetric,
      heightCm: cm,
      weightKg: clamp(roundTenth(draft.weightLbs / POUNDS_PER_KILOGRAM), weightLimits.kg.min, weightLimits.kg.max),
      targetWeightKg: clamp(roundTenth(draft.targetWeightLbs / POUNDS_PER_KILOGRAM), weightLimits.kg.min, weightLimits.kg.max),
    };
  }
  const totalInches = Math.round(draft.heightCm / CM_PER_INCH);
  return {
    ...draft,
    isMetric,
    heightFeet: clamp(Math.floor(totalInches / 12), heightLimits.feet.min, heightLimits.feet.max),
    heightInches: clamp(totalInches % 12, heightLimits.inches.min, heightLimits.inches.max),
    weightLbs: clamp(roundTenth(draft.weightKg * POUNDS_PER_KILOGRAM), weightLimits.lbs.min, weightLimits.lbs.max),
    targetWeightLbs: clamp(roundTenth(draft.targetWeightKg * POUNDS_PER_KILOGRAM), weightLimits.lbs.min, weightLimits.lbs.max),
  };
}

export function profileFromDraft(draft: OnboardingDraft): UserProfile {
  const target = draftTargetWeightKg(draft);
  return {
    gender: draft.gender,
    birthday: draft.birthday,
    heightCm: draftHeightCm(draft),
    weightKg: draftWeightKg(draft),
    activityLevel: draft.activityLevel,
    goal: draft.goal,
    ...(draft.knowsBodyFat ? { bodyFatPercentage: draft.bodyFatPercent / 100 } : {}),
    ...(draft.knowsBodyFat && draft.goalBodyFatPercent !== undefined ? { goalBodyFatPercentage: draft.goalBodyFatPercent / 100 } : {}),
    ...(draft.goal !== 'maintain' ? { weeklyChangeKg: weeklyChangeKg(draft.goalSpeed) } : {}),
    ...(target !== undefined ? { goalWeightKg: target } : {}),
  };
}

// MARK: - Plan Ready

export interface NutritionPlan {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const planLimits = {
  calories: { min: 800, max: 5000, step: 10 },
  protein: { min: 20, max: 300 },
  fat: { min: 10, max: 200 },
  carbs: { min: 0, max: 500 },
} as const;

export const MINIMUM_RECOMMENDED_CALORIES = 1200;

/** The raw formula (`profile.dailyCalories` etc.) — what the profile computes when no custom targets are stored. */
export function formulaPlan(profile: UserProfile, now: Date = new Date()): NutritionPlan {
  return { calories: dailyCalories(profile, now), protein: proteinGoal(profile), fat: fatGoal(profile), carbs: carbsGoal(profile, now) };
}

/**
 * The plan the Building Plan step lands on: the formula, held within `planLimits` so an
 * aggressive pace on a small frame can never present (or persist) a zero or negative target.
 * When clamping changes anything, `customTargetsForPlan` stores the result as custom targets
 * because the profile's own formula would otherwise reproduce the unclamped numbers.
 */
export function planFromProfile(profile: UserProfile, now: Date = new Date()): NutritionPlan {
  return normalizePlan(formulaPlan(profile, now));
}

function residualCarbs(calories: number, protein: number, fat: number): number {
  return Math.max(0, Math.trunc((calories - protein * kcalPerGram.protein - fat * kcalPerGram.fat) / kcalPerGram.carbs));
}

/**
 * Invariants every plan keeps after any edit: protein and fat inside their limits, calories
 * inside `planLimits.calories` and never below the energy protein + fat already account for,
 * carbs the residual. So calories, protein, fat and carbs always agree.
 */
export function normalizePlan(plan: NutritionPlan): NutritionPlan {
  const protein = clamp(Math.round(plan.protein), planLimits.protein.min, planLimits.protein.max);
  const fat = clamp(Math.round(plan.fat), planLimits.fat.min, planLimits.fat.max);
  const macroFloor = protein * kcalPerGram.protein + fat * kcalPerGram.fat;
  const calories = Math.max(clamp(Math.round(plan.calories), planLimits.calories.min, planLimits.calories.max), macroFloor);
  const carbs = residualCarbs(calories, protein, fat);
  return plan.calories === calories && plan.protein === protein && plan.fat === fat && plan.carbs === carbs ? plan : { calories, protein, fat, carbs };
}

/** Editing calories keeps protein/fat and re-derives carbs. */
export function editPlanCalories(plan: NutritionPlan, calories: number): NutritionPlan {
  const value = clamp(Math.round(calories / planLimits.calories.step) * planLimits.calories.step, planLimits.calories.min, planLimits.calories.max);
  return normalizePlan({ ...plan, calories: value });
}

export function editPlanProtein(plan: NutritionPlan, protein: number): NutritionPlan {
  return normalizePlan({ ...plan, protein });
}

export function editPlanFat(plan: NutritionPlan, fat: number): NutritionPlan {
  return normalizePlan({ ...plan, fat });
}

/**
 * Editing carbs recomputes calories so the three macros always add up; if that total would
 * leave the calorie limits, calories stop at the limit and carbs become the residual again.
 */
export function editPlanCarbs(plan: NutritionPlan, carbs: number): NutritionPlan {
  const value = clamp(Math.round(carbs), planLimits.carbs.min, planLimits.carbs.max);
  return normalizePlan({ ...plan, carbs: value, calories: value * kcalPerGram.carbs + plan.protein * kcalPerGram.protein + plan.fat * kcalPerGram.fat });
}

/**
 * Custom targets to store for the finished plan; `{}` keeps the profile on its formula. The
 * comparison is against the raw formula, so a plan that only differs because of clamping is
 * still pinned.
 */
export function customTargetsForPlan(profile: UserProfile, plan: NutritionPlan, now: Date = new Date()): Partial<UserProfile> {
  const formula = formulaPlan(profile, now);
  if (formula.calories === plan.calories && formula.protein === plan.protein && formula.fat === plan.fat && formula.carbs === plan.carbs) return {};
  return { customCalories: plan.calories, customProtein: plan.protein, customFat: plan.fat, customCarbs: plan.carbs };
}

export function bmrFormulaName(profile: UserProfile): string {
  return profile.bodyFatPercentage !== undefined ? 'Katch-McArdle' : 'Mifflin-St Jeor';
}

/** `CalculationMethodsView` summary — the sources behind the numbers (App Review 1.4.1). */
export function calculationMethodsSummary(profile: UserProfile): string {
  return [
    `BMR: ${bmrFormulaName(profile)}${profile.bodyFatPercentage !== undefined ? ' (370 + 21.6 × lean mass kg)' : ' (10 × kg + 6.25 × cm − 5 × age ± sex constant)'}.`,
    `TDEE: BMR × ${activityMultiplier[profile.activityLevel]} for your activity level.`,
    'Rate of change: 7,700 kcal per kilogram of body weight, spread over the week.',
    'Protein: 0.8–2.2 g per kg of bodyweight by activity, +0.2 g/kg while cutting. Fat: 0.6 g per kg. Carbs fill the remaining calories.',
    'Sources: Mifflin et al. 1990; Katch & McArdle; the 2024 Adult Compendium of Physical Activities; ISSN position stands on protein and diets.',
  ].join('\n\n');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
