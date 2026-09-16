/**
 * Unified diary grouping (`homeDiaryMealGroups` in `WaterViews.swift`). Water and fasting are
 * grouped by their log/end time but never contribute calories or macros.
 */

import { fastDiaryDate, type FastingSession } from '../fasting/fasting';
import {
  foodEntryDate,
  macroTotals,
  mealTypeForDate,
  mealTypes,
  type FoodEntry,
  type MacroTotals,
  type MealSchedule,
  type MealType,
} from '../food/food';
import type { WaterEntry } from '../water/water';

export type FoodLogSortOrder = 'standard' | 'latestMealsFirst';

export const FOOD_LOG_SORT_ORDER_KEY = 'foodLogSortOrder';

export function foodLogSortOrderDisplayName(order: FoodLogSortOrder): string {
  return order === 'standard' ? 'Standard' : 'Latest Meals First';
}

export type HomeDiaryItem =
  | { kind: 'food'; id: string; date: Date; meal: MealType; entry: FoodEntry }
  | { kind: 'water'; id: string; date: Date; meal: MealType; entry: WaterEntry }
  | { kind: 'fasting'; id: string; date: Date; meal: MealType; session: FastingSession };

export interface HomeDiaryMealGroup {
  id: string;
  meal: MealType;
  items: HomeDiaryItem[];
  foodEntries: FoodEntry[];
  totals: MacroTotals;
}

export function homeDiaryMealGroups(input: {
  foodEntries: readonly FoodEntry[];
  waterEntries: readonly WaterEntry[];
  fastingSessions?: readonly FastingSession[];
  order: FoodLogSortOrder;
  schedule?: MealSchedule;
}): HomeDiaryMealGroup[] {
  const { foodEntries, waterEntries, fastingSessions = [], order, schedule } = input;

  const items: HomeDiaryItem[] = [
    ...foodEntries.map((entry): HomeDiaryItem => ({
      kind: 'food',
      id: `food-${entry.id}`,
      date: foodEntryDate(entry),
      meal: entry.mealType,
      entry,
    })),
    ...waterEntries.map((entry): HomeDiaryItem => {
      const date = new Date(entry.date);
      return { kind: 'water', id: `water-${entry.id}`, date, meal: mealTypeForDate(date, schedule), entry };
    }),
    ...fastingSessions.map((session): HomeDiaryItem => {
      const date = fastDiaryDate(session);
      return { kind: 'fasting', id: `fasting-${session.id}`, date, meal: mealTypeForDate(date, schedule), session };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const makeGroup = (id: string, meal: MealType, groupItems: HomeDiaryItem[]): HomeDiaryMealGroup => {
    const groupFood = groupItems.flatMap((item) => (item.kind === 'food' ? [item.entry] : []));
    return { id, meal, items: groupItems, foodEntries: groupFood, totals: macroTotals(groupFood) };
  };

  if (order === 'standard') {
    return mealTypes.flatMap((meal) => {
      const mealItems = items.filter((item) => item.meal === meal);
      return mealItems.length === 0 ? [] : [makeGroup(`standard-${meal}`, meal, mealItems)];
    });
  }

  const groups: HomeDiaryMealGroup[] = [];
  let currentMeal: MealType | undefined;
  let currentItems: HomeDiaryItem[] = [];
  const flush = () => {
    const first = currentItems[0];
    if (currentMeal && first) groups.push(makeGroup(`latest-${currentMeal}-${first.id}`, currentMeal, currentItems));
  };
  for (const item of items) {
    if (item.meal === currentMeal) {
      currentItems.push(item);
    } else {
      flush();
      currentMeal = item.meal;
      currentItems = [item];
    }
  }
  flush();
  return groups;
}
