/**
 * Food diary shapes. Field names and raw values match `FoodEntry.swift` / `FoodEntry.kt` so
 * JSON exported by either native app decodes into these types unchanged.
 */

export type FoodSource = 'snapFood' | 'nutritionLabel' | 'barcode' | 'textInput' | 'manual';

export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type MealType = (typeof mealTypes)[number];

export function mealTypeDisplayName(meal: MealType): string {
  switch (meal) {
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    case 'snack':
      return 'Snack';
    case 'other':
      return 'Other';
  }
}

/** Meal boundaries in minutes from midnight (`MealSchedule` on iOS). */
export interface MealSchedule {
  breakfastStartMinutes: number;
  lunchStartMinutes: number;
  dinnerStartMinutes: number;
  snackStartMinutes: number;
}

export const defaultMealSchedule: MealSchedule = {
  breakfastStartMinutes: 5 * 60,
  lunchStartMinutes: 12 * 60,
  dinnerStartMinutes: 18 * 60,
  snackStartMinutes: 23 * 60,
};

export function isMealScheduleValid(schedule: MealSchedule): boolean {
  const { breakfastStartMinutes: b, lunchStartMinutes: l, dinnerStartMinutes: d, snackStartMinutes: s } = schedule;
  return b >= 0 && b < l && l < d && d < s && s < 1440;
}

export function mealTypeForDate(date: Date, schedule: MealSchedule = defaultMealSchedule): MealType {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= schedule.snackStartMinutes || minutes < schedule.breakfastStartMinutes) return 'snack';
  if (minutes >= schedule.dinnerStartMinutes) return 'dinner';
  if (minutes >= schedule.lunchStartMinutes) return 'lunch';
  return 'breakfast';
}

export interface ServingUnitOption {
  unit: string;
  gramsPerUnit: number;
  quantity?: number;
}

export interface MealIngredient {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageFilename?: string;
  additionalImageFilenames?: string[];
  emoji?: string;
}

/** Optional micronutrients in the units the AI prompt requests (g / mg / µg as on iOS). */
export interface OptionalNutrients {
  sugar?: number;
  addedSugar?: number;
  fiber?: number;
  saturatedFat?: number;
  monounsaturatedFat?: number;
  polyunsaturatedFat?: number;
  cholesterol?: number;
  caffeine?: number;
  /** Sports-nutrition compounds in grams keyed by `SupplementalNutrient.rawValue`. */
  supplementalNutrients: Record<string, number>;
  sodium?: number;
  potassium?: number;
  transFat?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
  vitaminE?: number;
  vitaminK?: number;
  folate?: number;
  omega3?: number;
}

export interface FoodEntry extends OptionalNutrients {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** ISO-8601 timestamp of the meal. */
  timestamp: string;
  /** Filenames under the app's food-image directory; bytes are never persisted in the blob. */
  imageFilename?: string;
  additionalImageFilenames: string[];
  emoji?: string;
  source: FoodSource;
  mealType: MealType;
  servingSizeGrams?: number;
  servingUnitOptions: ServingUnitOption[];
  selectedServingUnit?: string;
  selectedServingQuantity?: number;
  customNote?: string;
  progressiveMeal: boolean;
  ingredients: MealIngredient[];
}

export function foodEntryDate(entry: FoodEntry): Date {
  return new Date(entry.timestamp);
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function macroTotals(entries: readonly FoodEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      protein: total.protein + entry.protein,
      carbs: total.carbs + entry.carbs,
      fat: total.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export interface NewFoodEntryInput
  extends Partial<Omit<FoodEntry, 'id' | 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'source'>> {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: FoodSource;
}

export function makeFoodEntry(input: NewFoodEntryInput, id: string, now: Date = new Date()): FoodEntry {
  const timestamp = input.timestamp ?? now.toISOString();
  return {
    ...input,
    id,
    timestamp,
    additionalImageFilenames: input.additionalImageFilenames ?? [],
    mealType: input.mealType ?? mealTypeForDate(new Date(timestamp)),
    servingUnitOptions: input.servingUnitOptions ?? [],
    supplementalNutrients: input.supplementalNutrients ?? {},
    progressiveMeal: input.progressiveMeal ?? false,
    ingredients: input.ingredients ?? [],
  };
}
