/**
 * Food analysis prompts and response parsing. Ported from the `analyzeTextInput` /
 * `analyzeFood` / `autoAnalyze` prompts and `parseFoodAnalysis` in
 * `ios/calorietracker/Services/GeminiService.swift`, so BYOK providers and the hosted proxy
 * return the same `FoodAnalysis` shape as the native apps.
 */

import type { FoodAnalysis, FoodAnalysisKind, FoodAnalysisRequest } from '../food/analysis';
import type { MealIngredient, ServingUnitOption } from '../food/food';
import { AIError } from './errors';
import { extractJSON, type AIGenerateRequest } from './transport';

// MARK: - Prompt shapes (verbatim from GeminiService)

const NUTRIENT_KEYS =
  '"sugar":0.0,"added_sugar":0.0,"fiber":0.0,"saturated_fat":0.0,"monounsaturated_fat":0.0,"polyunsaturated_fat":0.0,"trans_fat":0.0,"cholesterol":0.0,"caffeine":0.0,"creatine":0.0,"beta_alanine":0.0,"l_citrulline":0.0,"l_carnitine":0.0,"l_arginine":0.0,"taurine":0.0,"betaine":0.0,"hmb":0.0,"sodium":0.0,"potassium":0.0,"calcium":0.0,"iron":0.0,"magnesium":0.0,"zinc":0.0,"vitamin_a":0.0,"vitamin_c":0.0,"vitamin_d":0.0,"vitamin_b12":0.0,"vitamin_e":0.0,"vitamin_k":0.0,"folate":0.0,"omega_3":0.0';

export const foodAnalysisJSONShape = `{"name":"...","calories":0,"protein":0.0,"carbs":0.0,"fat":0.0,"serving_size_grams":0.0,"emoji":"🍽️",${NUTRIENT_KEYS},"ingredients":[],"unit_options":[]}`;

export const foodAnalysisJSONShapeWithoutEmoji = `{"name":"...","calories":0,"protein":0.0,"carbs":0.0,"fat":0.0,"serving_size_grams":0.0,${NUTRIENT_KEYS},"ingredients":[],"unit_options":[]}`;

export const nutrientUnitsInstruction =
  'Calories are integers. Protein/carbs/fat are decimal gram values when needed. serving_size_grams is the estimated weight in grams. Nutrients are numbers: sugar/fiber/fats/omega_3/creatine/beta_alanine/l_citrulline/l_carnitine/l_arginine/taurine/betaine/hmb in grams; cholesterol/caffeine/sodium/potassium/calcium/iron/magnesium/zinc/vitamin_c/vitamin_e in milligrams; vitamin_a/vitamin_d/vitamin_b12/vitamin_k/folate in micrograms. Only report sports-nutrition compounds when explicitly present in a label or description; otherwise use 0.';

export const servingUnitOptionsInstruction = `unit_options is required and must always be a JSON array. Each item must be a complete object with this exact schema (the values are schema examples only; never copy them):
{"unit":"slice","quantity":2.0,"grams_per_unit":60.0}
quantity is the number of units in the whole analyzed amount, and grams_per_unit is the grams in one unit. For every item, quantity * grams_per_unit must approximately equal serving_size_grams. Do not include g/gram/grams as an option.
Return [] when there is no reliable non-gram unit. An empty array is a complete, valid answer.
Never invent a count from the food name or total grams. Only return a countable unit when its quantity is stated in the user's text, visible in the image or label, or strongly implied by the described or visible analyzed portion. Do not assume quantity is 1 merely because the food is commonly sold or served as one piece.`;

export const ingredientBreakdownInstruction =
  'ingredients is required. For a meal with multiple meaningful foods, return each food once using this exact object shape: {"name":"...","grams":0.0,"calories":0,"protein":0.0,"carbs":0.0,"fat":0.0}. Ingredient grams and macros must describe the analyzed amount and add up approximately to the meal totals. Return [] for a nutrition label, a single simple food, or when a reliable breakdown is not possible.';

export function textFoodPrompt(description: string): string {
  return `Estimate the nutritional content for: ${description}
Parse any quantities, brands, and multiple items from the text. If a brand is mentioned, use that brand's known nutritional data. If multiple items are described, sum up the total nutrition.
Respond ONLY with JSON:
${foodAnalysisJSONShape}
${nutrientUnitsInstruction}
${servingUnitOptionsInstruction}
${ingredientBreakdownInstruction}
When supported by the text, use slice/piece for discrete foods, ml/cup/fl oz for liquids, tbsp/tsp for spooned foods, and can/packet for packaged foods.
Include a single food emoji that best represents the food. Use null for any nutrient you cannot estimate.`;
}

export function photoFoodPrompt(description?: string): string {
  let prompt = `Analyze this food image. Identify the food and estimate its nutritional content.

Respond ONLY with a JSON object in this exact format, no other text:
${foodAnalysisJSONShapeWithoutEmoji}

${nutrientUnitsInstruction}
${servingUnitOptionsInstruction}
${ingredientBreakdownInstruction}
When supported by the image, use slice/piece for discrete foods, ml/cup/fl oz for liquids, tbsp/tsp for spooned foods, and can/packet for packaged foods. For a whole or mostly-whole divisible food, count only clearly visible pieces or slices and derive grams_per_unit from serving_size_grams / quantity.
Give your best estimate for the visible food amount shown in the image. For whole/mostly-whole cakes, pizzas, pies, loaves, or similar foods, estimate the total visible item/remaining item weight rather than defaulting to one slice. Use null for any nutrient you cannot estimate.`;
  const trimmed = description?.trim();
  if (trimmed) {
    prompt += `\n\nAdditional context from the user about this meal: ${trimmed}\nUse this context to improve accuracy of identification, portion size, and nutrition estimates.`;
  }
  return prompt;
}

/** `autoAnalyze` — the image may be a plate or a nutrition-facts label. */
export function autoAnalyzePrompt(): string {
  return `Analyze this image. It could be either a photo of food OR a nutrition facts label.

If it's a food photo: identify the food and estimate nutritional content for the serving shown.
If it's a nutrition label: read the values and calculate for one serving size as listed on the label.

Respond ONLY with JSON:
${foodAnalysisJSONShapeWithoutEmoji}
${nutrientUnitsInstruction}
${servingUnitOptionsInstruction}
${ingredientBreakdownInstruction}
When supported by the image or label, use slice/piece for discrete foods, ml/cup/fl oz for liquids, tbsp/tsp for spooned foods, and can/packet for packaged foods. For a whole or mostly-whole divisible food, count only clearly visible pieces or slices and derive grams_per_unit from serving_size_grams / quantity.
Use null for any nutrient you cannot estimate.`;
}

/** Turn a `FoodAnalysisRequest` into the provider-agnostic generate request. */
export function foodAnalysisGenerateRequest(request: FoodAnalysisRequest): AIGenerateRequest {
  const images = request.imagesBase64 ?? [];
  const kind: FoodAnalysisKind = request.kind;
  let prompt: string;
  switch (kind) {
    case 'text':
    case 'voice':
      if (!request.text?.trim()) throw new AIError('invalidResponse', 'Describe the meal first.');
      prompt = textFoodPrompt(request.text.trim());
      break;
    case 'photo':
      if (images.length === 0) throw new AIError('imageConversion');
      prompt = photoFoodPrompt(request.text);
      break;
    case 'nutritionLabel':
      if (images.length === 0) throw new AIError('imageConversion');
      prompt = autoAnalyzePrompt();
      break;
    case 'barcode':
      throw new AIError('generic', 'Barcode lookup is not available in the shared app yet.');
  }
  return {
    prompt,
    imagesBase64: images,
    jsonResponse: true,
    ...(request.userContext?.trim() ? { systemInstruction: request.userContext.trim() } : {}),
  };
}

// MARK: - Parsing

type JSONObject = Record<string, unknown>;

function asObject(value: unknown): JSONObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JSONObject) : undefined;
}

/** `strictJSONNumber` — finite numbers only; never coerces strings or booleans. */
export function strictNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optional(json: JSONObject, key: string): number | undefined {
  const n = strictNumber(json[key]);
  return n === undefined ? undefined : n;
}

/** Sports-nutrition compounds: JSON key → `SupplementalNutrient.rawValue`. */
export const supplementalNutrientKeys: readonly { json: string; rawValue: string }[] = [
  { json: 'creatine', rawValue: 'creatine' },
  { json: 'beta_alanine', rawValue: 'betaAlanine' },
  { json: 'l_citrulline', rawValue: 'lCitrulline' },
  { json: 'l_carnitine', rawValue: 'lCarnitine' },
  { json: 'l_arginine', rawValue: 'lArginine' },
  { json: 'taurine', rawValue: 'taurine' },
  { json: 'betaine', rawValue: 'betaine' },
  { json: 'hmb', rawValue: 'hmb' },
];

const GRAM_UNITS = new Set(['g', 'gram', 'grams']);

interface ParsedUnitOptions {
  options: ServingUnitOption[];
  requiresFallback: boolean;
}

/**
 * `parseInitialServingUnitOptions` — the array is all-or-nothing: one malformed or
 * inconsistent option discards the set and flags that a fallback is needed.
 */
export function parseServingUnitOptions(json: JSONObject, servingSizeGrams: number | undefined): ParsedUnitOptions {
  const raw = json.unit_options ?? json.serving_unit_options;
  if (raw === undefined) return { options: [], requiresFallback: true };
  if (!Array.isArray(raw)) return { options: [], requiresFallback: true };
  if (raw.length === 0) return { options: [], requiresFallback: false };
  const seen = new Set<string>();
  const options: ServingUnitOption[] = [];
  for (const item of raw) {
    const option = asObject(item);
    const unit = typeof option?.unit === 'string' ? option.unit.trim() : '';
    const quantity = strictNumber(option?.quantity);
    const gramsPerUnit = strictNumber(option?.grams_per_unit ?? option?.gramsPerUnit);
    if (!unit || quantity === undefined || gramsPerUnit === undefined || quantity <= 0 || gramsPerUnit <= 0) {
      return { options: [], requiresFallback: true };
    }
    if (GRAM_UNITS.has(unit.toLowerCase())) return { options: [], requiresFallback: true };
    if (servingSizeGrams !== undefined && servingSizeGrams > 0) {
      const total = quantity * gramsPerUnit;
      if (Math.abs(total - servingSizeGrams) / servingSizeGrams > 0.25) return { options: [], requiresFallback: true };
    }
    const key = unit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ unit, gramsPerUnit, quantity });
  }
  return { options, requiresFallback: false };
}

export function parseFoodAnalysis(text: string, makeId: () => string): FoodAnalysis {
  let json: JSONObject | undefined;
  try {
    json = asObject(JSON.parse(extractJSON(text)) as unknown);
  } catch {
    json = undefined;
  }
  const name = typeof json?.name === 'string' ? json.name.trim() : '';
  const calories = strictNumber(json?.calories);
  const protein = strictNumber(json?.protein);
  const carbs = strictNumber(json?.carbs);
  const fat = strictNumber(json?.fat);
  if (!json || !name || calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    throw new AIError('invalidResponse');
  }

  const responseServing = strictNumber(json.serving_size_grams);
  const servingSizeGrams = responseServing ?? 1;
  const units = parseServingUnitOptions(json, responseServing);
  const selected = units.options[0];

  const supplementalNutrients: Record<string, number> = {};
  for (const { json: key, rawValue } of supplementalNutrientKeys) {
    const value = optional(json, key);
    if (value !== undefined) supplementalNutrients[rawValue] = value;
  }

  const ingredients: MealIngredient[] = (Array.isArray(json.ingredients) ? json.ingredients : [])
    .slice(0, 20)
    .map(asObject)
    .flatMap((item) => {
      const ingredientName = typeof item?.name === 'string' ? item.name.trim() : '';
      const grams = strictNumber(item?.grams);
      const kcal = strictNumber(item?.calories);
      const p = strictNumber(item?.protein);
      const c = strictNumber(item?.carbs);
      const f = strictNumber(item?.fat);
      if (!ingredientName || grams === undefined || grams <= 0 || kcal === undefined || p === undefined || c === undefined || f === undefined) return [];
      if ([kcal, p, c, f].some((v) => v < 0)) return [];
      return [{ id: makeId(), name: ingredientName, grams, calories: Math.round(kcal), protein: p, carbs: c, fat: f }];
    });

  const emoji = typeof json.emoji === 'string' && json.emoji.trim() ? json.emoji.trim() : undefined;

  return {
    name,
    calories: Math.round(calories),
    protein,
    carbs,
    fat,
    servingSizeGrams,
    ...(emoji ? { emoji } : {}),
    servingUnitOptions: units.options,
    ...(selected ? { selectedServingUnit: selected.unit, selectedServingQuantity: selected.quantity } : {}),
    servingSizeIsKnown: responseServing !== undefined && responseServing > 0,
    requiresServingUnitFallback: units.requiresFallback,
    progressiveMeal: false,
    ingredients,
    supplementalNutrients,
    ...defined('sugar', optional(json, 'sugar')),
    ...defined('addedSugar', optional(json, 'added_sugar')),
    ...defined('fiber', optional(json, 'fiber')),
    ...defined('saturatedFat', optional(json, 'saturated_fat')),
    ...defined('monounsaturatedFat', optional(json, 'monounsaturated_fat')),
    ...defined('polyunsaturatedFat', optional(json, 'polyunsaturated_fat')),
    ...defined('cholesterol', optional(json, 'cholesterol')),
    ...defined('caffeine', optional(json, 'caffeine')),
    ...defined('sodium', optional(json, 'sodium')),
    ...defined('potassium', optional(json, 'potassium')),
    ...defined('transFat', optional(json, 'trans_fat')),
    ...defined('calcium', optional(json, 'calcium')),
    ...defined('iron', optional(json, 'iron')),
    ...defined('magnesium', optional(json, 'magnesium')),
    ...defined('zinc', optional(json, 'zinc')),
    ...defined('vitaminA', optional(json, 'vitamin_a')),
    ...defined('vitaminC', optional(json, 'vitamin_c')),
    ...defined('vitaminD', optional(json, 'vitamin_d')),
    ...defined('vitaminB12', optional(json, 'vitamin_b12')),
    ...defined('vitaminE', optional(json, 'vitamin_e')),
    ...defined('vitaminK', optional(json, 'vitamin_k')),
    ...defined('folate', optional(json, 'folate')),
    ...defined('omega3', optional(json, 'omega_3')),
  };
}

function defined<K extends string>(key: K, value: number | undefined): { [P in K]?: number } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]?: number });
}

/** Scale an analysis to a new gram amount (`FoodResultView` serving editor). */
export function scaledAnalysis(analysis: FoodAnalysis, grams: number): FoodAnalysis {
  if (!analysis.servingSizeIsKnown || analysis.servingSizeGrams <= 0 || grams <= 0) return analysis;
  const factor = grams / analysis.servingSizeGrams;
  const scale = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * factor * 100) / 100);
  const scaled: FoodAnalysis = {
    ...analysis,
    calories: Math.round(analysis.calories * factor),
    protein: scale(analysis.protein) ?? 0,
    carbs: scale(analysis.carbs) ?? 0,
    fat: scale(analysis.fat) ?? 0,
    servingSizeGrams: grams,
    ingredients: analysis.ingredients.map((i) => ({
      ...i,
      grams: scale(i.grams) ?? i.grams,
      calories: Math.round(i.calories * factor),
      protein: scale(i.protein) ?? i.protein,
      carbs: scale(i.carbs) ?? i.carbs,
      fat: scale(i.fat) ?? i.fat,
    })),
    supplementalNutrients: Object.fromEntries(Object.entries(analysis.supplementalNutrients).map(([k, v]) => [k, scale(v) ?? v])),
  };
  for (const key of optionalNutrientKeys) {
    const value = analysis[key];
    if (value !== undefined) scaled[key] = scale(value);
  }
  return scaled;
}

const optionalNutrientKeys = [
  'sugar',
  'addedSugar',
  'fiber',
  'saturatedFat',
  'monounsaturatedFat',
  'polyunsaturatedFat',
  'cholesterol',
  'caffeine',
  'sodium',
  'potassium',
  'transFat',
  'calcium',
  'iron',
  'magnesium',
  'zinc',
  'vitaminA',
  'vitaminC',
  'vitaminD',
  'vitaminB12',
  'vitaminE',
  'vitaminK',
  'folate',
  'omega3',
] as const;
