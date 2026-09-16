import { describe, expect, it } from 'vitest';

import { aiSetupContinueLabel, validateAISetup, type AISetupDraft } from '../src/domain/ai/onboardingValidation';
import {
  aiProviders,
  allAIProviders,
  apiKeyPlaceholder,
  apiKeyShapeHint,
  defaultModel,
  supportedModelOrDefault,
  textProviders,
  upgradedLegacyModel,
  visionProviders,
} from '../src/domain/ai/providers';
import { resolveVisionSelection } from '../src/domain/ai/settings';

const byokDraft = (overrides: Partial<AISetupDraft> = {}): AISetupDraft => ({
  substep: 'byok',
  hasAcceptedTerms: true,
  hasHostedEntitlement: false,
  provider: aiProviders.gemini,
  model: defaultModel(aiProviders.gemini),
  apiKey: 'AIzaSyExampleKey',
  baseURL: '',
  ...overrides,
});

describe('API key placeholders (#373)', () => {
  it('never uses a key-shaped prefix as the placeholder', () => {
    for (const provider of allAIProviders.filter((p) => p.requiresAPIKey)) {
      const placeholder = apiKeyPlaceholder(provider);
      expect(placeholder.startsWith('Paste')).toBe(true);
      if (provider.apiKeyPrefixHint) {
        expect(placeholder.startsWith(provider.apiKeyPrefixHint)).toBe(false);
      }
    }
    expect(apiKeyPlaceholder(aiProviders.gemini)).toBe('Paste Gemini API key');
    expect(apiKeyShapeHint(aiProviders.gemini)).toBe('Gemini keys start with AIza');
    expect(apiKeyPlaceholder(aiProviders.ollama)).toBe('No key needed');
    expect(apiKeyShapeHint(aiProviders.ollama)).toBeUndefined();
  });
});

describe('validateAISetup', () => {
  it('explains a missing key before anything else on the BYOK path', () => {
    const result = validateAISetup(byokDraft({ apiKey: '   ', hasAcceptedTerms: false }));
    expect(result.canContinue).toBe(false);
    expect(result.blocker).toBe('enterApiKey');
    expect(result.helperText).toContain('Gemini API key');
  });

  it('then asks for terms', () => {
    const result = validateAISetup(byokDraft({ hasAcceptedTerms: false }));
    expect(result.blocker).toBe('acceptTerms');
    expect(result.helperText).toMatch(/Terms of Service/);
  });

  it('continues once key, model and terms are present', () => {
    expect(validateAISetup(byokDraft())).toEqual({ canContinue: true });
  });

  it('does not require a key for keyless providers but does require a URL for custom endpoints', () => {
    expect(validateAISetup(byokDraft({ provider: aiProviders.ollama, model: 'qwen3-vl', apiKey: '' })).canContinue).toBe(true);

    const custom = validateAISetup(byokDraft({ provider: aiProviders.customOpenAI, model: 'my-model', apiKey: 'x', baseURL: '' }));
    expect(custom.blocker).toBe('enterBaseURL');

    const noModel = validateAISetup(byokDraft({ provider: aiProviders.customOpenAI, model: ' ', apiKey: 'x', baseURL: 'https://h/v1' }));
    expect(noModel.blocker).toBe('chooseModel');
  });

  it('keeps hosted tappable without an entitlement so the paywall can open', () => {
    const draft = byokDraft({ substep: 'hosted', apiKey: '' });
    expect(validateAISetup(draft).canContinue).toBe(true);
    expect(aiSetupContinueLabel(draft)).toBe('Subscribe to Continue');
    expect(aiSetupContinueLabel({ ...draft, hasHostedEntitlement: true })).toBe('Accept & Continue');
  });

  it('blocks on the choice screen', () => {
    expect(validateAISetup(byokDraft({ substep: 'choice' })).blocker).toBe('chooseOption');
  });
});

describe('provider registry', () => {
  it('matches the native raw values for persisted selections', () => {
    expect(aiProviders.gemini.rawValue).toBe('Google Gemini');
    expect(aiProviders.customOpenAI.rawValue).toBe('Custom (OpenAI-compatible)');
    expect(aiProviders.gemma4Local.rawValue).toBe('Gemma 4 E2B (On-Device)');
  });

  it('exposes Apple Intelligence on iOS only and never for vision', () => {
    expect(visionProviders('ios').map((p) => p.id)).not.toContain('appleIntelligence');
    expect(textProviders('ios').map((p) => p.id)).toContain('appleIntelligence');
    expect(textProviders('android').map((p) => p.id)).not.toContain('appleIntelligence');
    expect(visionProviders('android').map((p) => p.id)).not.toContain('deepseek');
  });

  it('falls back to the provider default for removed presets and keeps free-form ids', () => {
    expect(supportedModelOrDefault(aiProviders.gemini, 'gemini-1.5-flash')).toBe('gemini-3.5-flash-lite');
    expect(supportedModelOrDefault(aiProviders.gemini, 'gemini-3.8-flash')).toBe('gemini-3.8-flash');
    expect(supportedModelOrDefault(aiProviders.openrouter, 'someone/new-model')).toBe('someone/new-model');
    expect(upgradedLegacyModel(aiProviders.anthropic, 'claude-sonnet-4-6')).toBe('claude-sonnet-5');
    expect(upgradedLegacyModel(aiProviders.gemini, 'gemini-3.1-flash-lite-preview')).toBe('gemini-3.5-flash-lite');
  });

  it('resolves unknown or ineligible stored providers to Gemini like iOS', () => {
    expect(resolveVisionSelection('android', 'Apple Intelligence (On-Device)', 'x').provider.id).toBe('gemini');
    expect(resolveVisionSelection('ios', undefined, undefined)).toEqual({ provider: aiProviders.gemini, model: 'gemini-3.5-flash-lite' });
    expect(resolveVisionSelection('ios', 'OpenAI', 'gpt-5.5').model).toBe('gpt-5.5');
  });
});
