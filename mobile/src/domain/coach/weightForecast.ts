/**
 * Thermodynamic + statistical weight forecast. Ported from
 * `ios/calorietracker/Services/WeightAnalysisService.swift` (`WeightForecast`). No network, no
 * LLM: energy balance from the last 90 completed days of food, linear regression on weigh-ins.
 */

import type { WeightEntry } from '../body/bodyState';
import { addDays, startOfDay } from '../dates';
import { foodEntryDate, type FoodEntry } from '../food/food';
import { KILOCALORIES_PER_KILOGRAM, tdee, type UserProfile } from '../profile/userProfile';

export const FORECAST_MAX_LOOKBACK_DAYS = 90;

export interface WeightForecast {
  avgDailyCalories: number;
  tdee: number;
  dailyEnergyBalance: number;
  predictedWeeklyChangeKg: number;
  observedWeeklyChangeKg?: number;
  currentWeightKg: number;
  predictedWeight30dKg: number;
  predictedWeight60dKg: number;
  predictedWeight90dKg: number;
  daysToGoal?: number;
  goalReachDate?: Date;
  hasEnoughData: boolean;
  trendsDisagree: boolean;
  daysOfFoodData: number;
  weightEntriesUsed: number;
}

/** Simple linear regression slope in kg/day over the weigh-ins; undefined below 2 points. */
export function regressionSlopePerDay(entries: readonly WeightEntry[]): number | undefined {
  if (entries.length < 2) return undefined;
  const xs = entries.map((e) => new Date(e.date).getTime() / 1000);
  const ys = entries.map((e) => e.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    num += dx * (ys[i]! - meanY);
    den += dx * dx;
  }
  if (den === 0) return undefined;
  return (num / den) * 86_400;
}

export function computeWeightForecast(weights: readonly WeightEntry[], foods: readonly FoodEntry[], profile: UserProfile, now: Date = new Date()): WeightForecast {
  const today = startOfDay(now);
  const cutoff = addDays(today, -FORECAST_MAX_LOOKBACK_DAYS).getTime();
  const todayTime = today.getTime();
  const tomorrow = addDays(today, 1).getTime();

  // Today's diary is still in progress and would bias maintenance downward, so it is excluded.
  const recent = foods.filter((f) => {
    const t = foodEntryDate(f).getTime();
    return t >= cutoff && t < todayTime;
  });
  const daysLogged = new Set(recent.map((f) => startOfDay(foodEntryDate(f)).getTime())).size;
  const avgDailyCalories = daysLogged > 0 ? Math.trunc(recent.reduce((s, f) => s + f.calories, 0) / daysLogged) : 0;

  const expenditure = Math.trunc(tdee(profile, now));
  const balance = avgDailyCalories - expenditure;
  const predictedWeeklyChangeKg = (balance * 7) / KILOCALORIES_PER_KILOGRAM;

  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const currentWeightKg = sorted[0]?.weightKg ?? profile.weightKg;
  const window = sorted.filter((w) => {
    const t = new Date(w.date).getTime();
    return t >= cutoff && t < tomorrow;
  });
  const slope = regressionSlopePerDay(window);
  const observedWeeklyChangeKg = slope === undefined ? undefined : slope * 7;

  const project = (days: number) => currentWeightKg + (predictedWeeklyChangeKg * days) / 7;

  let daysToGoal: number | undefined;
  let goalReachDate: Date | undefined;
  if (profile.goalWeightKg !== undefined && predictedWeeklyChangeKg !== 0 && profile.goal !== 'maintain') {
    const remaining = profile.goalWeightKg - currentWeightKg;
    const correctWay = (profile.goal === 'lose' && predictedWeeklyChangeKg < 0 && remaining < 0) || (profile.goal === 'gain' && predictedWeeklyChangeKg > 0 && remaining > 0);
    if (correctWay) {
      const daysPerKg = 7 / Math.abs(predictedWeeklyChangeKg);
      daysToGoal = Math.round(Math.abs(remaining) * daysPerKg);
      goalReachDate = addDays(now, daysToGoal);
    }
  }

  const hasEnoughData = daysLogged >= 2 && window.length >= 2;
  const trendsDisagree = observedWeeklyChangeKg !== undefined && hasEnoughData ? Math.abs(predictedWeeklyChangeKg - observedWeeklyChangeKg) > 0.3 : false;

  return {
    avgDailyCalories,
    tdee: expenditure,
    dailyEnergyBalance: balance,
    predictedWeeklyChangeKg,
    ...(observedWeeklyChangeKg !== undefined ? { observedWeeklyChangeKg } : {}),
    currentWeightKg,
    predictedWeight30dKg: project(30),
    predictedWeight60dKg: project(60),
    predictedWeight90dKg: project(90),
    ...(daysToGoal !== undefined ? { daysToGoal } : {}),
    ...(goalReachDate !== undefined ? { goalReachDate } : {}),
    hasEnoughData,
    trendsDisagree,
    daysOfFoodData: daysLogged,
    weightEntriesUsed: window.length,
  };
}
