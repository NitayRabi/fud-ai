/**
 * Hosted AI (Plus / Pro) constants. Mirrors `ios/calorietracker/Models/HostedAIConstants.swift`
 * and the Worker in `web/hosted-ai-api.ts`. Product IDs are shared with the native apps so the
 * same RevenueCat project and entitlements apply.
 */

export const hostedAIConstants = {
  plusEntitlementID: 'plus',
  proEntitlementID: 'pro',

  plusMonthlyProductID: 'com.apoorvdarshan.calorietracker.plus.monthly',
  plusYearlyProductID: 'com.apoorvdarshan.calorietracker.plus.yearly',
  proMonthlyProductID: 'com.apoorvdarshan.calorietracker.pro.monthly',
  proYearlyProductID: 'com.apoorvdarshan.calorietracker.pro.yearly',

  credits50ProductID: 'com.apoorvdarshan.calorietracker.credits.50',
  credits150ProductID: 'com.apoorvdarshan.calorietracker.credits.150',
  credits400ProductID: 'com.apoorvdarshan.calorietracker.credits.400',

  plusDailyLimit: 30,
  proDailyLimit: 60,

  hostedAIBaseURL: 'https://fud-ai.app/api/hosted-ai/v1',
  hostedUserIDHeader: 'X-Fud-User-Id',
  maxHostedImages: 3,
} as const;

export const subscriptionProductIDs: readonly string[] = [
  hostedAIConstants.plusMonthlyProductID,
  hostedAIConstants.plusYearlyProductID,
  hostedAIConstants.proMonthlyProductID,
  hostedAIConstants.proYearlyProductID,
];

export const creditProductIDs: readonly string[] = [
  hostedAIConstants.credits50ProductID,
  hostedAIConstants.credits150ProductID,
  hostedAIConstants.credits400ProductID,
];

export function creditAmount(productID: string): number | undefined {
  switch (productID) {
    case hostedAIConstants.credits50ProductID:
      return 50;
    case hostedAIConstants.credits150ProductID:
      return 150;
    case hostedAIConstants.credits400ProductID:
      return 400;
    default:
      return undefined;
  }
}

export type HostedPlan = 'none' | 'plus' | 'pro';

export function hostedPlanDisplayName(plan: HostedPlan): string {
  switch (plan) {
    case 'none':
      return 'None';
    case 'plus':
      return 'Plus';
    case 'pro':
      return 'Pro';
  }
}

export function dailyLimit(plan: HostedPlan): number {
  switch (plan) {
    case 'pro':
      return hostedAIConstants.proDailyLimit;
    case 'plus':
      return hostedAIConstants.plusDailyLimit;
    case 'none':
      return 0;
  }
}

/** `AIMode` — persisted under `aiAccessMode` on iOS. */
export type AIMode = 'byok' | 'hosted';

export const AI_MODE_STORAGE_KEY = 'aiAccessMode';

export function aiModeDisplayName(mode: AIMode): string {
  return mode === 'byok' ? 'BYOK' : 'Hosted (Plus/Pro)';
}

export type HostedAIAction =
  | { kind: 'photoFood' }
  | { kind: 'textFood' }
  | { kind: 'voiceFood' }
  | { kind: 'ingredientAI' }
  | { kind: 'reprocessMeal' }
  | { kind: 'whatIf' }
  | { kind: 'allergensLab' }
  | { kind: 'siriFood' }
  | { kind: 'coachMessage' }
  | { kind: 'workoutAI' }
  | { kind: 'manualRecalculateGoals'; llmCalls: number }
  | { kind: 'hostedSTT' };

/** Expected hosted round-trips for UI copy only; the Worker is the source of truth. */
export function estimatedCost(action: HostedAIAction): number {
  switch (action.kind) {
    case 'voiceFood':
      return 2;
    case 'manualRecalculateGoals':
      return Math.max(1, action.llmCalls);
    default:
      return 1;
  }
}

export type HostedAIQuotaError =
  | { code: 'notHostedMode' }
  | { code: 'noActiveSubscription' }
  | { code: 'quotaExceeded'; remainingDaily: number; creditBank: number }
  | { code: 'rateLimited' };

export function hostedAIQuotaErrorMessage(error: HostedAIQuotaError): string | undefined {
  switch (error.code) {
    case 'notHostedMode':
      return undefined;
    case 'noActiveSubscription':
      return 'Subscribe to Plus or Pro to use Hosted AI, or switch to BYOK in Settings → AI Access.';
    case 'quotaExceeded':
      return "You're out of hosted AI actions for today. Buy credits, upgrade, or switch to BYOK.";
    case 'rateLimited':
      return 'Hosted AI is busy. Please wait a moment and try again.';
  }
}
