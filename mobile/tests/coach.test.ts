import { describe, expect, it } from 'vitest';

import { buildCoachSystemPrompt, chatReducer, contextMessages, initialChatState, suggestedPrompts, type ChatMessage } from '../src/domain/coach/coach';
import { computeWeightForecast, regressionSlopePerDay } from '../src/domain/coach/weightForecast';
import { makeFoodEntry } from '../src/domain/food/food';
import { defaultUserProfile, type UserProfile } from '../src/domain/profile/userProfile';

const now = new Date(2026, 8, 16, 12);
const daysAgo = (n: number, hour = 9) => {
  const d = new Date(2026, 8, 16, hour);
  d.setDate(d.getDate() - n);
  return d;
};
const food = (n: number, calories: number) => makeFoodEntry({ name: `f${n}`, calories, protein: 1, carbs: 1, fat: 1, source: 'manual', timestamp: daysAgo(n).toISOString() }, `f-${n}-${calories}`);
const weigh = (n: number, kg: number) => ({ id: `w-${n}`, date: daysAgo(n).toISOString(), weightKg: kg });

const profile: UserProfile = { ...defaultUserProfile, gender: 'male', weightKg: 85, heightCm: 180, activityLevel: 'moderate', goal: 'lose', goalWeightKg: 78, birthday: new Date(1990, 0, 1).toISOString() };

describe('weight forecast', () => {
  it('excludes today from the intake average and projects at the energy-balance pace', () => {
    const foods = [food(0, 5000), food(1, 1800), food(2, 1800), food(3, 1800)];
    const weights = [weigh(0, 84), weigh(7, 84.5), weigh(14, 85)];
    const forecast = computeWeightForecast(weights, foods, profile, now);
    expect(forecast.avgDailyCalories).toBe(1800);
    expect(forecast.daysOfFoodData).toBe(3);
    expect(forecast.weightEntriesUsed).toBe(3);
    expect(forecast.hasEnoughData).toBe(true);
    expect(forecast.dailyEnergyBalance).toBeLessThan(0);
    expect(forecast.predictedWeeklyChangeKg).toBeLessThan(0);
    expect(forecast.currentWeightKg).toBe(84);
    expect(forecast.predictedWeight30dKg).toBeLessThan(84);
    expect(forecast.daysToGoal).toBeGreaterThan(0);
    expect(forecast.goalReachDate).toBeInstanceOf(Date);
    expect(forecast.observedWeeklyChangeKg).toBeCloseTo(-0.5, 1);
  });

  it('reports insufficient data and no goal ETA when moving the wrong way', () => {
    const forecast = computeWeightForecast([weigh(0, 84)], [food(1, 3500)], profile, now);
    expect(forecast.hasEnoughData).toBe(false);
    expect(forecast.daysToGoal).toBeUndefined();
    expect(forecast.observedWeeklyChangeKg).toBeUndefined();
    expect(regressionSlopePerDay([weigh(0, 80)])).toBeUndefined();
  });
});

describe('coach chat', () => {
  const message = (id: string, role: ChatMessage['role']): ChatMessage => ({ id, role, content: id, timestamp: now.toISOString() });

  it('appends, replaces the last assistant message, resets, and windows context to 20', () => {
    let state = initialChatState;
    for (let i = 0; i < 25; i += 1) state = chatReducer(state, { type: 'append', message: message(`m${i}`, i % 2 === 0 ? 'user' : 'assistant') });
    expect(state.messages).toHaveLength(25);
    expect(contextMessages(state)).toHaveLength(20);
    expect(contextMessages(state)[0]?.id).toBe('m5');
    expect(chatReducer(state, { type: 'append', message: message('m3', 'user') })).toBe(state);

    state = chatReducer(state, { type: 'replaceLastAssistant', content: 'fixed' });
    expect(state.messages[23]?.content).toBe('fixed');
    expect(state.messages[24]?.content).toBe('m24');

    expect(chatReducer(state, { type: 'reset' }).messages).toEqual([]);
    expect(chatReducer(initialChatState, { type: 'reset' })).toBe(initialChatState);
  });

  it('suggests goal-specific prompts and a training prompt when workouts exist', () => {
    expect(suggestedPrompts('lose', false)[0]).toBe("What's my expected weight in 30 days?");
    expect(suggestedPrompts('maintain', false)).toContain('Am I holding my weight?');
    expect(suggestedPrompts('gain', true)[0]).toBe('Analyze my last 4 weeks of training');
  });

  it('builds a system prompt with profile, formulas, forecast and recent data', () => {
    const prompt = buildCoachSystemPrompt({
      profile,
      weights: [weigh(0, 84), weigh(7, 85)],
      bodyFats: [],
      foods: [food(1, 1800), food(2, 1900)],
      fastingSessions: [],
      workoutSessions: [],
      heightMetric: true,
      weightMetric: false,
      userContext: 'Vegetarian',
      now,
    });
    expect(prompt).toContain('You are Coach, an AI nutrition and weight-change assistant');
    expect(prompt).toContain('- Today: 2026-09-16');
    expect(prompt).toContain('- Goal: Lose Weight / Cutting');
    expect(prompt).toContain('- Goal weight: 172.0 lbs');
    expect(prompt).toContain('Mifflin-St Jeor');
    expect(prompt).toContain('- Avg daily intake: 1850 kcal');
    expect(prompt).toContain('## Last 14 days of logged calories');
    expect(prompt).toContain('## User-supplied context');
    expect(prompt).toContain('Vegetarian');
    expect(prompt).not.toContain('strength-training');
  });
});
