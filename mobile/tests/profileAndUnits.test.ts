import { describe, expect, it } from 'vitest';

import { formatFastDuration, formatFastGoal } from '../src/domain/fasting/fasting';
import { defaultPreferences, parseHomeTopNutrients, preferenceKeys, serializeHomeTopNutrients } from '../src/domain/prefs/preferences';
import { bmr, dailyCalories, dailyTargets, type UserProfile } from '../src/domain/profile/userProfile';
import { planFromCustomerInfo } from '../src/domain/purchases/revenueCat';
import { formatWater, millilitersFromDisplayedValue, waterDisplayValue } from '../src/domain/water/water';

const now = new Date(2026, 8, 15);

const profile: UserProfile = {
  gender: 'male',
  birthday: new Date(1996, 5, 1).toISOString(),
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  goal: 'maintain',
};

describe('UserProfile goal math (parity with UserProfile.swift)', () => {
  it('uses Mifflin-St Jeor without body fat', () => {
    // 10*80 + 6.25*180 - 5*30 - 161 + 166 = 1780
    expect(bmr(profile, now)).toBe(1780);
    expect(dailyCalories(profile, now)).toBe(Math.trunc(1780 * 1.465));
  });

  it('uses Katch-McArdle when body fat is known', () => {
    expect(bmr({ ...profile, bodyFatPercentage: 0.2 }, now)).toBeCloseTo(370 + 21.6 * 0.8 * 80, 6);
  });

  it('applies a cutting deficit and protein boost', () => {
    const cutting = { ...profile, goal: 'lose' as const, weeklyChangeKg: 0.5 };
    expect(dailyCalories(cutting, now)).toBe(Math.trunc(1780 * 1.465) - Math.trunc((0.5 * 7700) / 7));
    expect(dailyTargets(cutting, now).protein).toBe(Math.trunc((1.6 + 0.2) * 80));
  });

  it('pins custom macros and balances the rest', () => {
    const targets = dailyTargets({ ...profile, customCalories: 2400, customProtein: 180 }, now);
    expect(targets.calories).toBe(2400);
    expect(targets.protein).toBe(180);
    // Remaining 1680 kcal split between carbs and fat by their formula weights.
    expect(targets.carbs * 4 + targets.fat * 9).toBeLessThanOrEqual(1680);
    expect(targets.carbs * 4 + targets.fat * 9).toBeGreaterThan(1600);
  });
});

describe('water and fasting formatting', () => {
  it('formats fluid ounces with one decimal only when needed', () => {
    expect(waterDisplayValue('ml', 250)).toBe('250');
    expect(waterDisplayValue('floz', 500)).toBe('16.9');
    expect(formatWater('floz', 236.5882365 * 2)).toBe('16 fl oz');
    expect(millilitersFromDisplayedValue('floz', 8)).toBe(237);
    expect(millilitersFromDisplayedValue('ml', 0.2)).toBe(1);
  });

  it('formats durations compactly', () => {
    expect(formatFastDuration(0)).toBe('0m');
    expect(formatFastDuration(45 * 60)).toBe('45m');
    expect(formatFastDuration(16 * 3600 + 20 * 60)).toBe('16h 20m');
    expect(formatFastGoal(16 * 60)).toBe('16h');
  });
});

describe('preferences', () => {
  it('uses the iOS UserDefaults key names', () => {
    expect(preferenceKeys.waterTrackingEnabled).toBe('waterTrackingEnabled');
    expect(preferenceKeys.aiAccessMode).toBe('aiAccessMode');
    expect(preferenceKeys.selectedAIProvider).toBe('selectedAIProvider');
    expect(preferenceKeys.homeTopNutrients).toBe('homeTopNutrients');
  });

  it('parses the Home nutrient selection like HomeTopNutrient.selection(from:)', () => {
    expect(parseHomeTopNutrients(defaultPreferences.homeTopNutrients)).toEqual(['protein', 'carbs', 'fat', 'fiber']);
    expect(parseHomeTopNutrients('fat,fat,bogus,sugar,iron,zinc,calcium')).toEqual(['fat', 'sugar', 'iron', 'zinc']);
    expect(parseHomeTopNutrients('')).toEqual(['protein', 'carbs', 'fat', 'fiber']);
    expect(serializeHomeTopNutrients(['protein', 'carbs', 'fat', 'fiber', 'sugar'])).toBe('protein,carbs,fat,fiber');
  });
});

describe('RevenueCat entitlements → plan', () => {
  it('prefers pro over plus and defaults to none', () => {
    expect(planFromCustomerInfo(undefined)).toBe('none');
    expect(planFromCustomerInfo({ originalAppUserId: 'u', entitlements: {} })).toBe('none');
    expect(planFromCustomerInfo({ originalAppUserId: 'u', entitlements: { plus: { identifier: 'plus', isActive: true } } })).toBe('plus');
    expect(
      planFromCustomerInfo({
        originalAppUserId: 'u',
        entitlements: { plus: { identifier: 'plus', isActive: true }, pro: { identifier: 'pro', isActive: true } },
      }),
    ).toBe('pro');
  });
});
