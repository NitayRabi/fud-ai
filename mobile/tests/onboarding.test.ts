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
  nextOnboardingStep,
  onboardingProgress,
  planFromProfile,
  previousOnboardingStep,
  profileFromDraft,
  seedTargetWeight,
  setDraftMetric,
  showsOnboardingHeader,
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
    expect(editPlanCalories(plan, 100).calories).toBe(800);
    expect(editPlanProtein(plan, 999).protein).toBe(300);
  });

  it('only stores custom targets when the plan was edited', () => {
    expect(customTargetsForPlan(profile, plan, now)).toEqual({});
    const edited = editPlanCalories(plan, plan.calories - 300);
    expect(customTargetsForPlan(profile, edited, now)).toEqual({ customCalories: edited.calories, customProtein: edited.protein, customFat: edited.fat, customCarbs: edited.carbs });
  });
});
