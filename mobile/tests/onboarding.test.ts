import { describe, expect, it } from 'vitest';

import {
  customTargetsForPlan,
  defaultOnboardingDraft,
  draftHeightCm,
  draftWeightKg,
  editPlanCalories,
  editPlanCarbs,
  editPlanFat,
  editPlanProtein,
  estimatedDays,
  formulaPlan,
  nextOnboardingStep,
  normalizePlan,
  onboardingProgress,
  planFromProfile,
  previousOnboardingStep,
  profileFromDraft,
  seedTargetWeight,
  setDraftMetric,
  showsOnboardingHeader,
  targetWeightProblem,
  weeklyChangeKg,
} from '../src/domain/onboarding/onboarding';

const now = new Date(2026, 8, 16);

describe('onboarding steps', () => {
  it('walks 14 steps with a header on the middle ones', () => {
    expect(onboardingProgress('welcome')).toBe(0);
    expect(onboardingProgress('planReady')).toBe(1);
    expect(showsOnboardingHeader('welcome')).toBe(false);
    expect(showsOnboardingHeader('gender')).toBe(true);
    expect(showsOnboardingHeader('planReady')).toBe(false);
    expect(nextOnboardingStep('aiSetup')).toBe('buildingPlan');
    expect(nextOnboardingStep('planReady')).toBe('planReady');
    expect(previousOnboardingStep('welcome')).toBe('welcome');
    expect(previousOnboardingStep('birthday')).toBe('gender');
  });
});

describe('onboarding draft', () => {
  it('defaults to a 25-year-old imperial profile and converts units without loss', () => {
    const draft = defaultOnboardingDraft(now);
    expect(new Date(draft.birthday).getFullYear()).toBe(2001);
    expect(draftHeightCm(draft)).toBeCloseTo(175.26, 1);
    expect(draftWeightKg(draft)).toBeCloseTo(69.85, 1);

    const metric = setDraftMetric(draft, true);
    expect(metric.heightCm).toBe(175);
    expect(metric.weightKg).toBeCloseTo(69.9, 1);
    const back = setDraftMetric(metric, false);
    expect(back.heightFeet).toBe(5);
    expect(back.heightInches).toBe(9);
    expect(setDraftMetric(draft, false)).toBe(draft);
  });

  it('seeds the desired weight from the goal and estimates days at the chosen pace', () => {
    const lose = seedTargetWeight({ ...defaultOnboardingDraft(now), goal: 'lose' });
    expect(lose.targetWeightLbs).toBe(144);
    expect(lose.targetWeightKg).toBe(65);
    expect(weeklyChangeKg(1)).toBe(0.5);
    // 10 lbs ≈ 4.54 kg at 0.5 kg/week ≈ 63 days.
    expect(estimatedDays(lose)).toBe(63);
    expect(estimatedDays({ ...lose, goalSpeed: 2 })).toBe(31);
    expect(estimatedDays({ ...lose, goal: 'maintain' })).toBe(0);
  });

  it('builds a UserProfile with body fat and goal fields only when set', () => {
    const maintain = profileFromDraft(defaultOnboardingDraft(now));
    expect(maintain.goalWeightKg).toBeUndefined();
    expect(maintain.weeklyChangeKg).toBeUndefined();
    expect(maintain.bodyFatPercentage).toBeUndefined();

    const gain = profileFromDraft(seedTargetWeight({ ...defaultOnboardingDraft(now), goal: 'gain', knowsBodyFat: true, bodyFatPercent: 18, goalBodyFatPercent: 15, goalSpeed: 0 }));
    expect(gain.goalWeightKg).toBeCloseTo(164 / 2.20462, 3);
    expect(gain.weeklyChangeKg).toBe(0.25);
    expect(gain.bodyFatPercentage).toBe(0.18);
    expect(gain.goalBodyFatPercentage).toBe(0.15);
  });
});

describe('plan editing', () => {
  const profile = profileFromDraft(defaultOnboardingDraft(now));
  const plan = planFromProfile(profile, now);

  it('keeps calories consistent: carbs are the residual, editing carbs recomputes calories', () => {
    expect(plan.calories).toBe(plan.protein * 4 + plan.fat * 9 + plan.carbs * 4 + ((plan.calories - plan.protein * 4 - plan.fat * 9) % 4));
    // The calorie wheel runs 800…5000 in steps of 10, so edits snap to that grid.
    const base = editPlanCalories(plan, 2400);
    expect(base.calories).toBe(2400);
    const more = editPlanCalories(base, 2604);
    expect(more.calories).toBe(2600);
    expect(more.carbs).toBe(base.carbs + 50);
    const protein = editPlanProtein(more, more.protein + 40);
    expect(protein.carbs).toBe(more.carbs - 40);
    const fat = editPlanFat(protein, protein.fat + 9);
    expect(fat.carbs).toBe(protein.carbs - 20);
    const carbs = editPlanCarbs(fat, fat.carbs + 25);
    expect(carbs.calories).toBe(fat.protein * 4 + fat.fat * 9 + (fat.carbs + 25) * 4);
    // Calories can never drop below the 800 floor, nor below what protein + fat already weigh in at.
    expect(editPlanCalories(plan, 100).calories).toBe(Math.max(800, plan.protein * 4 + plan.fat * 9));
    expect(editPlanProtein(plan, 999).protein).toBe(300);
  });

  it('keeps every edit inside the plan limits with calories equal to the macro energy', () => {
    // 20 g protein + 10 g fat + 0 g carbs is 170 kcal on paper; the plan stays at the 800 kcal floor with carbs filling it.
    const minimal = editPlanCarbs(editPlanFat(editPlanProtein(plan, 20), 10), 0);
    expect(minimal).toEqual({ calories: 800, protein: 20, fat: 10, carbs: Math.trunc((800 - 20 * 4 - 10 * 9) / 4) });
    // Protein and fat that outweigh the calorie budget raise calories instead of hiding behind 0 g carbs.
    const heavy = editPlanFat(editPlanProtein(editPlanCalories(plan, 800), 300), 200);
    expect(heavy).toEqual({ calories: 300 * 4 + 200 * 9, protein: 300, fat: 200, carbs: 0 });
    // A carb edit past the ceiling stops at 5000 kcal and re-derives carbs.
    const huge = editPlanCarbs(plan, 500);
    expect(huge.calories).toBeLessThanOrEqual(5000);
    expect(huge.calories).toBe(huge.protein * 4 + huge.fat * 9 + huge.carbs * 4 + ((huge.calories - huge.protein * 4 - huge.fat * 9) % 4));
    expect(normalizePlan(plan)).toBe(plan);
  });

  it('clamps the formula plan so a tiny frame on a fast cut never gets a zero or negative target', () => {
    const tiny = profileFromDraft({ ...setDraftMetric(defaultOnboardingDraft(now), true), heightCm: 100, weightKg: 30, activityLevel: 'sedentary', goal: 'lose', goalSpeed: 2, targetWeightKg: 30 });
    expect(formulaPlan(tiny, now).calories).toBeLessThan(800);
    const clamped = planFromProfile(tiny, now);
    expect(clamped.calories).toBeGreaterThanOrEqual(800);
    expect(clamped.carbs).toBeGreaterThanOrEqual(0);
    expect(clamped.calories).toBeGreaterThanOrEqual(clamped.protein * 4 + clamped.fat * 9);
    // …and the clamped plan is pinned as custom targets so Home shows the same numbers.
    expect(customTargetsForPlan(tiny, clamped, now)).toEqual({ customCalories: clamped.calories, customProtein: clamped.protein, customFat: clamped.fat, customCarbs: clamped.carbs });
  });

  it('only stores custom targets when the plan differs from the raw formula', () => {
    expect(customTargetsForPlan(profile, plan, now)).toEqual({});
    const edited = editPlanCalories(plan, plan.calories - 300);
    expect(customTargetsForPlan(profile, edited, now)).toEqual({ customCalories: edited.calories, customProtein: edited.protein, customFat: edited.fat, customCarbs: edited.carbs });
  });
});

describe('desired weight validation', () => {
  it('rejects targets outside the bounds or pointing against the goal', () => {
    const lose = seedTargetWeight({ ...defaultOnboardingDraft(now), goal: 'lose' });
    expect(targetWeightProblem(lose, lose.targetWeightLbs)).toBeUndefined();
    expect(targetWeightProblem(lose, 154)).toBe('notBelowCurrent');
    expect(targetWeightProblem(lose, 160)).toBe('notBelowCurrent');
    expect(targetWeightProblem(lose, 10)).toBe('outOfRange');
    expect(targetWeightProblem(lose, Number.NaN)).toBe('outOfRange');

    const gain = setDraftMetric({ ...defaultOnboardingDraft(now), goal: 'gain' }, true);
    expect(targetWeightProblem(gain, gain.weightKg)).toBe('notAboveCurrent');
    expect(targetWeightProblem(gain, gain.weightKg + 5)).toBeUndefined();
    expect(targetWeightProblem(gain, 251)).toBe('outOfRange');

    // Maintain has no target, so only the range applies.
    expect(targetWeightProblem(defaultOnboardingDraft(now), 154)).toBeUndefined();

    // Seeding never leaves the bounds either.
    const heavy = seedTargetWeight({ ...defaultOnboardingDraft(now), goal: 'gain', weightLbs: 500, weightKg: 250 });
    expect(heavy.targetWeightLbs).toBe(500);
    expect(heavy.targetWeightKg).toBe(250);
  });
});
