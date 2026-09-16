import { describe, expect, it } from 'vitest';

import { diaryReducer, favoriteEntries, initialDiaryState, recentEntries } from '../src/domain/diary/diaryState';
import { foodEntryInputFromAnalysis, type FoodAnalysis } from '../src/domain/food/analysis';
import { makeFoodEntry } from '../src/domain/food/food';

const analysis: FoodAnalysis = {
  name: 'Oatmeal',
  calories: 300,
  protein: 10,
  carbs: 54,
  fat: 6,
  servingSizeGrams: 250,
  emoji: '🥣',
  servingUnitOptions: [{ unit: 'bowl', gramsPerUnit: 250, quantity: 1 }],
  selectedServingUnit: 'bowl',
  selectedServingQuantity: 1,
  servingSizeIsKnown: true,
  requiresServingUnitFallback: false,
  progressiveMeal: false,
  ingredients: [],
  supplementalNutrients: {},
  fiber: 8,
};

describe('foodEntryInputFromAnalysis', () => {
  it('maps analysis kind to the native FoodSource and drops analysis-only flags', () => {
    const input = foodEntryInputFromAnalysis(analysis, 'photo', '2026-09-16T08:00:00.000Z', { mealType: 'breakfast', customNote: 'no sugar' });
    expect(input.source).toBe('snapFood');
    expect(input.mealType).toBe('breakfast');
    expect(input.customNote).toBe('no sugar');
    expect(input.servingSizeGrams).toBe(250);
    expect(input.fiber).toBe(8);
    expect('servingSizeIsKnown' in input).toBe(false);
    expect('requiresServingUnitFallback' in input).toBe(false);

    const entry = makeFoodEntry(input, 'entry-1');
    expect(entry.emoji).toBe('🥣');
    expect(entry.selectedServingUnit).toBe('bowl');
    expect(entry.additionalImageFilenames).toEqual([]);
  });

  it('omits serving grams when the analysis mass is unknown and picks the text source for voice', () => {
    const unknown = foodEntryInputFromAnalysis({ ...analysis, servingSizeIsKnown: false }, 'voice', '2026-09-16T08:00:00.000Z');
    expect(unknown.servingSizeGrams).toBeUndefined();
    expect(unknown.source).toBe('textInput');
    expect(unknown.mealType).toBeUndefined();
  });
});

describe('saved meals selectors', () => {
  const entry = (id: string, name: string, timestamp: string) =>
    makeFoodEntry({ name, calories: 100, protein: 1, carbs: 1, fat: 1, source: 'manual', timestamp }, id);

  it('splits favorites from recents and de-duplicates by name, newest first', () => {
    let state = initialDiaryState;
    state = diaryReducer(state, { type: 'food/add', entry: entry('1', 'Toast', '2026-09-14T08:00:00.000Z') });
    state = diaryReducer(state, { type: 'food/add', entry: entry('2', 'toast', '2026-09-15T08:00:00.000Z') });
    state = diaryReducer(state, { type: 'food/add', entry: entry('3', 'Eggs', '2026-09-15T09:00:00.000Z') });
    state = diaryReducer(state, { type: 'food/add', entry: entry('4', 'Salad', '2026-09-16T12:00:00.000Z') });
    state = diaryReducer(state, { type: 'food/toggleFavorite', entry: entry('x', 'Eggs', '') });

    expect(favoriteEntries(state).map((e) => e.id)).toEqual(['3']);
    expect(recentEntries(state).map((e) => e.id)).toEqual(['4', '2']);
    expect(recentEntries(state, 1).map((e) => e.id)).toEqual(['4']);
  });
});
