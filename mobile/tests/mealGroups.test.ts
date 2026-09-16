import { describe, expect, it } from 'vitest';

import { homeDiaryMealGroups } from '../src/domain/diary/mealGroups';
import { makeFoodEntry } from '../src/domain/food/food';

const iso = (h: number, m = 0) => new Date(2026, 8, 15, h, m, 0).toISOString();
const food = (id: string, h: number, calories: number) =>
  makeFoodEntry({ name: id, calories, protein: 10, carbs: 20, fat: 5, source: 'manual', timestamp: iso(h) }, id);

describe('homeDiaryMealGroups', () => {
  const foodEntries = [food('oats', 8, 300), food('salad', 13, 400), food('pasta', 19, 600)];
  const waterEntries = [
    { id: 'w1', date: iso(8, 30), milliliters: 250 },
    { id: 'w2', date: iso(19, 30), milliliters: 500 },
  ];
  const fastingSessions = [{ id: 'f1', startedAt: iso(20), endedAt: iso(12), goalMinutes: 960 }];

  it('groups by meal in standard order and sums food only', () => {
    const groups = homeDiaryMealGroups({ foodEntries, waterEntries, fastingSessions, order: 'standard' });
    expect(groups.map((g) => g.meal)).toEqual(['breakfast', 'lunch', 'dinner']);

    const breakfast = groups[0]!;
    expect(breakfast.items.map((i) => i.kind)).toEqual(['water', 'food']);
    expect(breakfast.totals.calories).toBe(300);

    const lunch = groups[1]!;
    expect(lunch.items.map((i) => i.kind)).toEqual(['food', 'fasting']);
    expect(lunch.totals.calories).toBe(400);

    const dinner = groups[2]!;
    expect(dinner.totals).toEqual({ calories: 600, protein: 10, carbs: 20, fat: 5 });
  });

  it('latest-first keeps chronological runs of the same meal together', () => {
    const groups = homeDiaryMealGroups({ foodEntries, waterEntries, order: 'latestMealsFirst' });
    expect(groups.map((g) => g.meal)).toEqual(['dinner', 'lunch', 'breakfast']);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['water-w2', 'food-pasta']);
  });

  it('returns no groups for an empty day', () => {
    expect(homeDiaryMealGroups({ foodEntries: [], waterEntries: [], order: 'standard' })).toEqual([]);
  });
});
