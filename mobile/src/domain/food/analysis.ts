/**
 * What an AI food analysis returns before the user reviews and saves it. Mirrors
 * `GeminiService.FoodAnalysis` (iOS) and `services/ai/FoodAnalysis.kt` (Android).
 */

import type { FoodSource, MealIngredient, OptionalNutrients, ServingUnitOption } from './food';

export interface FoodAnalysis extends OptionalNutrients {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSizeGrams: number;
  emoji?: string;
  servingUnitOptions: ServingUnitOption[];
  selectedServingUnit?: string;
  selectedServingQuantity?: number;
  /** False only for restored/legacy totals whose original food mass is unknown. */
  servingSizeIsKnown: boolean;
  requiresServingUnitFallback: boolean;
  customNote?: string;
  progressiveMeal: boolean;
  ingredients: MealIngredient[];
}

export type FoodAnalysisKind = 'photo' | 'nutritionLabel' | 'text' | 'voice' | 'barcode';

export interface FoodAnalysisRequest {
  kind: FoodAnalysisKind;
  /** JPEG bytes, base64-encoded. Up to `hostedAIConstants.maxHostedImages` when hosted. */
  imagesBase64?: string[];
  /** Typed or transcribed meal description. */
  text?: string;
  barcode?: string;
  /** Free-form user context prepended as a system instruction when non-empty. */
  userContext?: string;
}

export function foodSourceForAnalysis(kind: FoodAnalysisKind): FoodSource {
  switch (kind) {
    case 'photo':
      return 'snapFood';
    case 'nutritionLabel':
      return 'nutritionLabel';
    case 'barcode':
      return 'barcode';
    case 'text':
    case 'voice':
      return 'textInput';
  }
}

/** Every AI transport (BYOK providers, hosted proxy, on-device) implements this. */
export interface FoodAnalysisService {
  analyze(request: FoodAnalysisRequest): Promise<FoodAnalysis>;
}
