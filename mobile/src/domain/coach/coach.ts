/**
 * Coach conversation domain. Ported from `ChatStore.swift` (persisted history, 20-message
 * context window), `ChatService.buildSystemPrompt` and the goal-aware suggested prompts in
 * `ChatView.swift`. The data tools (`CoachTools`) are not ported: the system prompt carries
 * the profile, formulas and forecast, and the model is told the tools are unavailable.
 */

import type { BodyFatEntry, WeightEntry } from '../body/bodyState';
import { dayKey } from '../dates';
import type { FastingSession } from '../fasting/fasting';
import type { FoodEntry } from '../food/food';
import {
  activityLevelDisplayName,
  ageYears,
  bmr,
  dailyTargets,
  tdee,
  weightGoalDisplayName,
  type UserProfile,
  type WeightGoal,
} from '../profile/userProfile';
import type { WorkoutSession } from '../workouts/workoutSessions';
import { computeWeightForecast } from './weightForecast';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** ISO-8601. */
  timestamp: string;
  /**
   * Bounded JPEG thumbnail (≤ 700 px, like the `thumbnailData` iOS keeps in
   * `attachmentImageData`), base64. The full-size image is sent to the model once and never
   * persisted; only the newest `MAX_PERSISTED_ATTACHMENTS` messages keep their thumbnail.
   */
  attachmentImageBase64?: string;
}

export const COACH_CHAT_STORAGE_KEY = 'coachChatHistory';
export const MAX_MESSAGES_IN_CONTEXT = 20;
/**
 * The whole history is one AsyncStorage value (Android reads rows through a ~2 MB cursor
 * window), so unlike UserDefaults on iOS it has to stay bounded: the oldest messages roll
 * off past `MAX_PERSISTED_MESSAGES`, and thumbnails older than the newest
 * `MAX_PERSISTED_ATTACHMENTS` are dropped while their text stays.
 */
export const MAX_PERSISTED_MESSAGES = 200;
export const MAX_PERSISTED_ATTACHMENTS = 12;

export interface ChatState {
  messages: readonly ChatMessage[];
  revision: number;
}

export const initialChatState: ChatState = { messages: [], revision: 0 };

export type ChatAction =
  | { type: 'hydrate'; messages: readonly ChatMessage[] }
  | { type: 'append'; message: ChatMessage }
  | { type: 'replaceLastAssistant'; content: string }
  | { type: 'reset' };

/** Apply the persistence bounds; returns the same array when nothing has to go. */
export function boundedMessages(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  const trimmed = messages.length > MAX_PERSISTED_MESSAGES ? messages.slice(-MAX_PERSISTED_MESSAGES) : messages;
  let attachmentsSeen = 0;
  let changed = trimmed !== messages;
  const result: ChatMessage[] = [];
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const message = trimmed[i]!;
    if (message.attachmentImageBase64 !== undefined) {
      attachmentsSeen += 1;
      if (attachmentsSeen > MAX_PERSISTED_ATTACHMENTS) {
        const { attachmentImageBase64: _dropped, ...rest } = message;
        result.push(rest);
        changed = true;
        continue;
      }
    }
    result.push(message);
  }
  return changed ? result.reverse() : messages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, messages: boundedMessages(action.messages) };
    case 'append':
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return { messages: boundedMessages([...state.messages, action.message]), revision: state.revision + 1 };
    case 'replaceLastAssistant': {
      let index = -1;
      for (let i = state.messages.length - 1; i >= 0; i -= 1) {
        if (state.messages[i]?.role === 'assistant') {
          index = i;
          break;
        }
      }
      if (index === -1) return state;
      const messages = [...state.messages];
      messages[index] = { ...messages[index]!, content: action.content };
      return { messages, revision: state.revision + 1 };
    }
    case 'reset':
      if (state.messages.length === 0) return state;
      return { messages: [], revision: state.revision + 1 };
  }
}

/** Trailing slice sent to the LLM; the full history stays persisted. */
export function contextMessages(state: ChatState): ChatMessage[] {
  return state.messages.slice(-MAX_MESSAGES_IN_CONTEXT);
}

// MARK: - Suggested prompts

export function suggestedPrompts(goal: WeightGoal, hasWorkouts: boolean): string[] {
  let values: string[];
  switch (goal) {
    case 'lose':
      values = ["What's my expected weight in 30 days?", 'How do I lose weight faster safely?', 'Am I eating too much?', 'What should I eat for dinner?'];
      break;
    case 'gain':
      values = ["What's my expected weight in 30 days?", 'How do I gain weight healthily?', 'Am I eating enough?', 'High-protein foods I can add?'];
      break;
    case 'maintain':
      values = ['Am I holding my weight?', "What's my average intake?", 'Macro suggestions?', "How's my trend?"];
      break;
  }
  if (hasWorkouts) values.unshift('Analyze my last 4 weeks of training');
  return values;
}

// MARK: - System prompt

export interface CoachContext {
  profile: UserProfile;
  weights: readonly WeightEntry[];
  bodyFats: readonly BodyFatEntry[];
  foods: readonly FoodEntry[];
  fastingSessions: readonly FastingSession[];
  workoutSessions: readonly WorkoutSession[];
  heightMetric: boolean;
  weightMetric: boolean;
  userContext?: string;
  now?: Date;
}

const formatKg = (kg: number, metric: boolean) => (metric ? `${kg.toFixed(1)} kg` : `${(kg * 2.20462).toFixed(1)} lbs`);
const formatWeekly = (kg: number, metric: boolean) => {
  const value = metric ? kg : kg * 2.20462;
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} ${metric ? 'kg' : 'lbs'}/week`;
};

/** Recent-history summary that stands in for the `get_*` data tools. */
function recentDataSummary(context: CoachContext, now: Date): string[] {
  const lines: string[] = [];
  const cutoff = now.getTime() - 14 * 86_400_000;
  const byDay = new Map<string, number>();
  for (const food of context.foods) {
    const t = new Date(food.timestamp).getTime();
    if (t < cutoff) continue;
    const key = dayKey(new Date(food.timestamp));
    byDay.set(key, (byDay.get(key) ?? 0) + food.calories);
  }
  if (byDay.size > 0) {
    lines.push('## Last 14 days of logged calories');
    for (const [day, kcal] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) lines.push(`- ${day}: ${kcal} kcal`);
    lines.push('');
  }
  const recentWeights = context.weights.filter((w) => new Date(w.date).getTime() >= now.getTime() - 30 * 86_400_000).slice(-10);
  if (recentWeights.length > 0) {
    lines.push('## Recent weigh-ins');
    for (const w of recentWeights) lines.push(`- ${dayKey(new Date(w.date))}: ${formatKg(w.weightKg, context.weightMetric)}`);
    lines.push('');
  }
  const recentWorkouts = context.workoutSessions.filter((s) => new Date(s.completedAt).getTime() >= now.getTime() - 28 * 86_400_000).slice(-8);
  if (recentWorkouts.length > 0) {
    lines.push('## Recent strength workouts (last 4 weeks)');
    for (const s of recentWorkouts) {
      const names = s.exercises.map((e) => `${e.name} ×${e.sets.length}`).join(', ');
      lines.push(`- ${s.diaryDateKey}: ${names}${s.caloriesBurned ? ` (~${s.caloriesBurned} kcal est.)` : ''}`);
    }
    lines.push('');
  }
  return lines;
}

export function buildCoachSystemPrompt(context: CoachContext): string {
  const now = context.now ?? new Date();
  const { profile } = context;
  const forecast = computeWeightForecast(context.weights, context.foods, profile, now);
  const targets = dailyTargets(profile, now);
  const workoutAccess = context.workoutSessions.length > 0;
  const bmrFormula = profile.bodyFatPercentage !== undefined ? 'Katch-McArdle (uses body fat %)' : 'Mifflin-St Jeor (body fat not set)';

  const lines: string[] = [];
  lines.push(
    workoutAccess
      ? "You are Coach, an AI nutrition, weight-change, and strength-training assistant inside a calorie tracking app. Answer in plain English, be specific and factual, and ground your recommendations in the user's own data. Avoid medical advice; when relevant, suggest consulting a doctor. Be concise — 2–5 sentences per response unless the user asks for detail."
      : "You are Coach, an AI nutrition and weight-change assistant inside a calorie tracking app. Answer in plain English, be specific and factual, and ground your recommendations in the user's own data. Avoid medical advice; when relevant, suggest consulting a doctor. Be concise — 2–5 sentences per response unless the user asks for detail.",
  );
  lines.push('');
  lines.push('## Current date');
  lines.push(`- Today: ${dayKey(now)}`);
  lines.push('');
  lines.push('## User profile');
  lines.push(`- Gender: ${profile.gender}`);
  lines.push(`- Age: ${ageYears(profile, now)}`);
  lines.push(`- Height: ${context.heightMetric ? `${profile.heightCm.toFixed(0)} cm` : `${(profile.heightCm / 2.54).toFixed(1)} in`}`);
  lines.push(`- Current weight: ${formatKg(profile.weightKg, context.weightMetric)}`);
  lines.push(`- Activity: ${activityLevelDisplayName(profile.activityLevel)}`);
  lines.push(`- Goal: ${weightGoalDisplayName(profile.goal)}`);
  if (profile.goalWeightKg !== undefined) lines.push(`- Goal weight: ${formatKg(profile.goalWeightKg, context.weightMetric)}`);
  if (profile.bodyFatPercentage !== undefined) lines.push(`- Body fat: ${Math.round(profile.bodyFatPercentage * 100)}%`);
  if (profile.goalBodyFatPercentage !== undefined) lines.push(`- Goal body fat: ${Math.round(profile.goalBodyFatPercentage * 100)}%`);
  lines.push('');
  lines.push('## Formulas in use');
  lines.push(`- BMR: ${bmrFormula}. Current BMR ≈ ${Math.trunc(bmr(profile, now))} kcal/day`);
  lines.push(`- TDEE: BMR × activity multiplier ≈ ${Math.trunc(tdee(profile, now))} kcal/day`);
  lines.push(`- Calorie goal: ${targets.calories} kcal/day`);
  lines.push(`- Macro targets: ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat`);
  lines.push('');
  lines.push('## Computed forecast (from their logged data)');
  if (forecast.hasEnoughData) {
    lines.push(`- Days of food logged (last 90d): ${forecast.daysOfFoodData}`);
    lines.push(`- Weight entries available: ${forecast.weightEntriesUsed}`);
    lines.push(`- Avg daily intake: ${forecast.avgDailyCalories} kcal`);
    lines.push(`- Daily energy balance: ${forecast.dailyEnergyBalance >= 0 ? '+' : ''}${forecast.dailyEnergyBalance} kcal`);
    lines.push(`- Predicted change (from diet): ${formatWeekly(forecast.predictedWeeklyChangeKg, context.weightMetric)}`);
    if (forecast.observedWeeklyChangeKg !== undefined) lines.push(`- Observed change (from scale): ${formatWeekly(forecast.observedWeeklyChangeKg, context.weightMetric)}`);
    lines.push(`- Expected weight in 30 days: ${formatKg(forecast.predictedWeight30dKg, context.weightMetric)}`);
    lines.push(`- Expected weight in 60 days: ${formatKg(forecast.predictedWeight60dKg, context.weightMetric)}`);
    lines.push(`- Expected weight in 90 days: ${formatKg(forecast.predictedWeight90dKg, context.weightMetric)}`);
    if (forecast.daysToGoal !== undefined) lines.push(`- Days to goal at current pace: ~${forecast.daysToGoal} days`);
    if (forecast.trendsDisagree) lines.push('- NOTE: Predicted and observed trends differ by >0.3 kg/week — user may be under-logging food.');
  } else {
    lines.push('- Not enough data yet (need ≥2 days food + ≥2 weights). Encourage the user to log more.');
  }
  lines.push('');
  lines.push('## Data available');
  lines.push(`- ${context.weights.length} weight entries, ${context.bodyFats.length} body-fat readings, ${context.foods.length} food entries logged total.`);
  lines.push(`- ${context.fastingSessions.length} explicitly tracked fasting sessions are available. Never treat a missing food log as a fast.`);
  if (workoutAccess) {
    lines.push(`- ${context.workoutSessions.length} completed strength workouts are available.`);
    lines.push(
      '- Workout logs may guide training, recovery, exercise selection, and progressive-overload advice. Never use estimated workout burn or workout volume to recalculate calorie/macro targets, alter the nutrition forecast, or invent energy expenditure.',
    );
  }
  lines.push('- You do not have data-fetching tools in this session; answer from the summaries below and say when something is outside them.');
  lines.push('');
  lines.push(...recentDataSummary(context, now));
  lines.push('When the user asks how to lose or gain, give a concrete calorie target and at least one actionable food or activity change. When they ask expected weight, reference the forecast numbers above.');
  const userContext = context.userContext?.trim();
  if (userContext) {
    lines.push('');
    lines.push('## User-supplied context (Settings → AI Access)');
    lines.push(userContext);
  }
  return lines.join('\n');
}
