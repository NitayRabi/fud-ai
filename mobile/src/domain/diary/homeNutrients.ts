/** `HomeTopNutrient` — the nutrients selectable for the bars under the calorie dome. */

import type { FoodEntry } from '../food/food';
import type { HomeTopNutrientId } from '../prefs/preferences';
import type { DailyTargets } from '../profile/userProfile';

interface HomeNutrientDefinition {
  displayName: string;
  unit: string;
  total: (entries: readonly FoodEntry[]) => number;
}

const sum = (entries: readonly FoodEntry[], pick: (e: FoodEntry) => number | undefined) =>
  entries.reduce((acc, e) => acc + (pick(e) ?? 0), 0);

const supplemental = (key: string) => (entries: readonly FoodEntry[]) => sum(entries, (e) => e.supplementalNutrients[key]);

export const homeNutrients: Record<HomeTopNutrientId, HomeNutrientDefinition> = {
  protein: { displayName: 'Protein', unit: 'g', total: (e) => sum(e, (x) => x.protein) },
  carbs: { displayName: 'Carbs', unit: 'g', total: (e) => sum(e, (x) => x.carbs) },
  fat: { displayName: 'Fat', unit: 'g', total: (e) => sum(e, (x) => x.fat) },
  fiber: { displayName: 'Fiber', unit: 'g', total: (e) => sum(e, (x) => x.fiber) },
  sugar: { displayName: 'Sugar', unit: 'g', total: (e) => sum(e, (x) => x.sugar) },
  addedSugar: { displayName: 'Added Sugar', unit: 'g', total: (e) => sum(e, (x) => x.addedSugar) },
  saturatedFat: { displayName: 'Sat. Fat', unit: 'g', total: (e) => sum(e, (x) => x.saturatedFat) },
  cholesterol: { displayName: 'Cholesterol', unit: 'mg', total: (e) => sum(e, (x) => x.cholesterol) },
  caffeine: { displayName: 'Caffeine', unit: 'mg', total: (e) => sum(e, (x) => x.caffeine) },
  sodium: { displayName: 'Sodium', unit: 'mg', total: (e) => sum(e, (x) => x.sodium) },
  potassium: { displayName: 'Potassium', unit: 'mg', total: (e) => sum(e, (x) => x.potassium) },
  transFat: { displayName: 'Trans Fat', unit: 'g', total: (e) => sum(e, (x) => x.transFat) },
  calcium: { displayName: 'Calcium', unit: 'mg', total: (e) => sum(e, (x) => x.calcium) },
  iron: { displayName: 'Iron', unit: 'mg', total: (e) => sum(e, (x) => x.iron) },
  magnesium: { displayName: 'Magnesium', unit: 'mg', total: (e) => sum(e, (x) => x.magnesium) },
  zinc: { displayName: 'Zinc', unit: 'mg', total: (e) => sum(e, (x) => x.zinc) },
  vitaminA: { displayName: 'Vitamin A', unit: 'µg', total: (e) => sum(e, (x) => x.vitaminA) },
  vitaminC: { displayName: 'Vitamin C', unit: 'mg', total: (e) => sum(e, (x) => x.vitaminC) },
  vitaminD: { displayName: 'Vitamin D', unit: 'µg', total: (e) => sum(e, (x) => x.vitaminD) },
  vitaminB12: { displayName: 'Vitamin B12', unit: 'µg', total: (e) => sum(e, (x) => x.vitaminB12) },
  vitaminE: { displayName: 'Vitamin E', unit: 'mg', total: (e) => sum(e, (x) => x.vitaminE) },
  vitaminK: { displayName: 'Vitamin K', unit: 'µg', total: (e) => sum(e, (x) => x.vitaminK) },
  folate: { displayName: 'Folate', unit: 'µg', total: (e) => sum(e, (x) => x.folate) },
  omega3: { displayName: 'Omega-3', unit: 'g', total: (e) => sum(e, (x) => x.omega3) },
  creatine: { displayName: 'Creatine', unit: 'g', total: supplemental('creatine') },
  betaAlanine: { displayName: 'Beta-Alanine', unit: 'g', total: supplemental('betaAlanine') },
  lCitrulline: { displayName: 'L-Citrulline', unit: 'g', total: supplemental('lCitrulline') },
  lCarnitine: { displayName: 'L-Carnitine', unit: 'g', total: supplemental('lCarnitine') },
  lArginine: { displayName: 'L-Arginine', unit: 'g', total: supplemental('lArginine') },
  taurine: { displayName: 'Taurine', unit: 'g', total: supplemental('taurine') },
  betaine: { displayName: 'Betaine', unit: 'g', total: supplemental('betaine') },
  hmb: { displayName: 'HMB', unit: 'g', total: supplemental('hmb') },
};

/** Optional-nutrient goals (`OptionalNutrientGoals`) are per-user; unset means "No goal". */
export type OptionalNutrientGoals = Partial<Record<HomeTopNutrientId, number>>;

export function homeNutrientGoal(id: HomeTopNutrientId, targets: DailyTargets, optionalGoals: OptionalNutrientGoals = {}): number {
  switch (id) {
    case 'protein':
      return targets.protein;
    case 'carbs':
      return targets.carbs;
    case 'fat':
      return targets.fat;
    default:
      return optionalGoals[id] ?? 0;
  }
}

/** Water takes the fourth slot when tracking is enabled, so only three nutrients show. */
export function displayedHomeNutrients(selection: readonly HomeTopNutrientId[], waterTrackingEnabled: boolean): HomeTopNutrientId[] {
  return selection.slice(0, waterTrackingEnabled ? 3 : 4);
}
