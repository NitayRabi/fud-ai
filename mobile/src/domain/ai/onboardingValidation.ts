/**
 * Validation for the "Set Up Your AI" onboarding step (step 11 on iOS).
 *
 * The BYOK continue button is gated on terms + a usable key/model/URL, exactly like
 * `OnboardingView.canAdvanceAI`. What this adds (#373) is a *reason* for the disabled state so
 * the screen can explain what is missing instead of silently ignoring taps.
 */

import type { AIProviderDefinition } from './providers';

export type AISetupSubstep = 'choice' | 'byok' | 'hosted';

export interface AISetupDraft {
  substep: AISetupSubstep;
  hasAcceptedTerms: boolean;
  hasHostedEntitlement: boolean;
  provider: AIProviderDefinition;
  model: string;
  apiKey: string;
  baseURL: string;
}

export type AISetupBlocker =
  | 'chooseOption'
  | 'acceptTerms'
  | 'enterApiKey'
  | 'chooseModel'
  | 'enterBaseURL';

export interface AISetupValidation {
  canContinue: boolean;
  /** The first unmet requirement, in the order the user should fix them. */
  blocker?: AISetupBlocker;
  /** Copy for the helper line under the continue button. */
  helperText?: string;
}

export function validateAISetup(draft: AISetupDraft): AISetupValidation {
  if (draft.substep === 'choice') {
    return { canContinue: false, blocker: 'chooseOption' };
  }

  if (draft.substep === 'byok') {
    // Missing-key is checked before terms: it is the invisible requirement reviewers miss,
    // and it is the only one where nothing on screen changes when unmet.
    if (draft.provider.requiresAPIKey && draft.apiKey.trim().length === 0) {
      return {
        canContinue: false,
        blocker: 'enterApiKey',
        helperText: `Paste your ${draft.provider.shortName} API key above to continue.`,
      };
    }
    if (draft.model.trim().length === 0) {
      return {
        canContinue: false,
        blocker: 'chooseModel',
        helperText: 'Choose or type a model to continue.',
      };
    }
    if (draft.provider.requiresCustomEndpoint && draft.baseURL.trim().length === 0) {
      return {
        canContinue: false,
        blocker: 'enterBaseURL',
        helperText: 'Enter the base URL of your OpenAI-compatible endpoint to continue.',
      };
    }
  }

  if (!draft.hasAcceptedTerms) {
    return {
      canContinue: false,
      blocker: 'acceptTerms',
      helperText: 'Accept the Terms of Service and Privacy Policy to continue.',
    };
  }

  // Hosted stays tappable without an entitlement so the button can open the paywall.
  return { canContinue: true };
}

export function aiSetupContinueLabel(draft: Pick<AISetupDraft, 'substep' | 'hasHostedEntitlement'>): string {
  if (draft.substep === 'hosted' && !draft.hasHostedEntitlement) return 'Subscribe to Continue';
  return 'Accept & Continue';
}
