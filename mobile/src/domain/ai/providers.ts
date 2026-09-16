/**
 * AI provider registry. Ported from `ios/calorietracker/Models/AIProvider.swift` and kept in
 * lock-step with `android/.../models/AIProvider.kt`. Raw values match the iOS `rawValue`
 * strings so preference blobs exported from either native app resolve to the same provider.
 *
 * Model lineups verified against provider docs on 2026-09-07 (same snapshot as native).
 */

export const aiProviderIds = [
  'appleIntelligence',
  'gemma4Local',
  'gemini',
  'openai',
  'anthropic',
  'xai',
  'openrouter',
  'togetherai',
  'groq',
  'huggingface',
  'fireworks',
  'deepinfra',
  'mistral',
  'deepseek',
  'cerebras',
  'ollama',
  'customOpenAI',
] as const;

export type AIProviderId = (typeof aiProviderIds)[number];

export type AIAPIFormat = 'onDevice' | 'liteRTLocal' | 'gemini' | 'openaiCompatible' | 'anthropic';

export interface AIProviderDefinition {
  id: AIProviderId;
  /** Persisted identifier; identical to the Swift `rawValue`. */
  rawValue: string;
  displayName: string;
  /** Short brand name used in helper copy ("Paste Gemini API key"). */
  shortName: string;
  baseURL: string;
  apiFormat: AIAPIFormat;
  /** Vision-capable presets (image + structured text). Empty for text-only or free-form providers. */
  models: readonly string[];
  /** Text-capable presets. Defaults to `models` when the provider has no wider text catalog. */
  textModels: readonly string[];
  requiresAPIKey: boolean;
  requiresCustomEndpoint: boolean;
  requiresCustomModelName: boolean;
  supportsCustomModelName: boolean;
  supportsVision: boolean;
  /** Local and user-hosted endpoints need the longer configurable timeout. */
  usesConfigurableRequestTimeout: boolean;
  /**
   * Hint about the key's shape, shown in helper copy — never used as the field placeholder,
   * because a prefix like `AIza...` reads as a filled-in key (App Review, #373).
   */
  apiKeyPrefixHint?: string;
  /** Platforms the provider is selectable on. On-device options are per-platform. */
  platforms: readonly ('ios' | 'android')[];
}

const BOTH = ['ios', 'android'] as const;

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
] as const;

const OPENAI_MODELS = [
  'gpt-5.4-mini',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o-mini',
] as const;

const ANTHROPIC_MODELS = [
  'claude-sonnet-5',
  'claude-opus-5',
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-haiku-4-5',
] as const;

const XAI_MODELS = ['grok-4.6', 'grok-4.3'] as const;

const OPENROUTER_MODELS = [
  'openrouter/free',
  'google/gemini-3.5-flash-lite',
  'google/gemini-3.8-flash',
  'google/gemini-3.7-flash',
  'openai/gpt-5.6-luna',
  'qwen/qwen3.8-27b',
  'openai/gpt-5-mini',
  'anthropic/claude-sonnet-5',
  'qwen/qwen3-vl-8b-instruct',
] as const;

const TOGETHER_VISION_MODELS = [
  'Qwen/Qwen3.5-9B',
  'moonshotai/Kimi-K3',
  'Qwen/Qwen3.8-2.4T-A95B',
  'google/gemma-4-31B-it',
  'MiniMaxAI/MiniMax-M3',
] as const;

const TOGETHER_TEXT_MODELS = [
  'MiniMaxAI/MiniMax-M2.7',
  'Qwen/Qwen3.7-Max',
  'Qwen/Qwen3.5-397B-A17B',
  'Qwen/Qwen3.6-Plus',
  'Qwen/Qwen3.5-9B',
  'moonshotai/Kimi-K2.6',
  'zai-org/GLM-5.1',
  'zai-org/GLM-5',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'deepseek-ai/DeepSeek-V4-Pro',
] as const;

const GROQ_VISION_MODELS = ['qwen/qwen3.6-27b'] as const;
const GROQ_TEXT_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
] as const;

const HUGGINGFACE_MODELS = [
  'google/gemma-4-31B-it',
  'Qwen/Qwen3.8-27B',
  'moonshotai/Kimi-K3',
  'google/gemma-3-27b-it',
  'Qwen/Qwen3.5-9B',
] as const;

const FIREWORKS_MODELS = [
  'accounts/fireworks/models/qwen3p7-plus',
  'accounts/fireworks/models/kimi-k3',
  'accounts/fireworks/models/muse-glimmer-30b',
  'accounts/fireworks/models/minimax-m3',
  'accounts/fireworks/models/kimi-k2p6',
] as const;

const DEEPINFRA_MODELS = [
  'google/gemma-3-27b-it',
  'Qwen/Qwen3.8-27B',
  'MiniMaxAI/MiniMax-M3',
  'google/gemma-4-31B-it',
  'google/gemma-4-26B-A4B-it',
] as const;

const MISTRAL_MODELS = [
  'mistral-small-2603',
  'mistral-medium-3-5',
  'mistral-large-2512',
  'ministral-14b-2512',
] as const;

const OLLAMA_VISION_MODELS = ['qwen3-vl', 'qwen3.8', 'gemma4', 'llama3.2-vision', 'llava', 'moondream'] as const;
const OLLAMA_TEXT_MODELS = ['qwen3.8', 'gemma4', 'llama3.2', 'qwen3', 'mistral-small3.2', ...OLLAMA_VISION_MODELS] as const;

const DEEPSEEK_TEXT_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
const CEREBRAS_TEXT_MODELS = ['gpt-oss-120b', 'gemma-4-31b'] as const;

function cloud(
  id: AIProviderId,
  rawValue: string,
  shortName: string,
  baseURL: string,
  models: readonly string[],
  options: Partial<AIProviderDefinition> = {},
): AIProviderDefinition {
  return {
    id,
    rawValue,
    displayName: rawValue,
    shortName,
    baseURL,
    apiFormat: 'openaiCompatible',
    models,
    textModels: models,
    requiresAPIKey: true,
    requiresCustomEndpoint: false,
    requiresCustomModelName: false,
    supportsCustomModelName: false,
    supportsVision: true,
    usesConfigurableRequestTimeout: false,
    platforms: BOTH,
    ...options,
  };
}

export const aiProviders: Record<AIProviderId, AIProviderDefinition> = {
  appleIntelligence: cloud('appleIntelligence', 'Apple Intelligence (On-Device)', 'Apple Intelligence', '', [], {
    apiFormat: 'onDevice',
    textModels: ['System Language Model'],
    requiresAPIKey: false,
    supportsVision: false,
    platforms: ['ios'],
  }),
  gemma4Local: cloud('gemma4Local', 'Gemma 4 E2B (On-Device)', 'Gemma 4', '', ['gemma-4-E2B-it'], {
    apiFormat: 'liteRTLocal',
    requiresAPIKey: false,
    platforms: BOTH,
  }),
  gemini: cloud('gemini', 'Google Gemini', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta', GEMINI_MODELS, {
    apiFormat: 'gemini',
    apiKeyPrefixHint: 'AIza',
  }),
  openai: cloud('openai', 'OpenAI', 'OpenAI', 'https://api.openai.com/v1', OPENAI_MODELS, { apiKeyPrefixHint: 'sk-' }),
  anthropic: cloud('anthropic', 'Anthropic Claude', 'Anthropic', 'https://api.anthropic.com/v1', ANTHROPIC_MODELS, {
    apiFormat: 'anthropic',
    apiKeyPrefixHint: 'sk-ant-',
  }),
  xai: cloud('xai', 'xAI Grok', 'xAI', 'https://api.x.ai/v1', XAI_MODELS, { apiKeyPrefixHint: 'xai-' }),
  openrouter: cloud('openrouter', 'OpenRouter', 'OpenRouter', 'https://openrouter.ai/api/v1', OPENROUTER_MODELS, {
    supportsCustomModelName: true,
    apiKeyPrefixHint: 'sk-or-',
  }),
  togetherai: cloud('togetherai', 'Together AI', 'Together AI', 'https://api.together.xyz/v1', TOGETHER_VISION_MODELS, {
    textModels: TOGETHER_TEXT_MODELS,
  }),
  groq: cloud('groq', 'Groq', 'Groq', 'https://api.groq.com/openai/v1', GROQ_VISION_MODELS, {
    textModels: GROQ_TEXT_MODELS,
    apiKeyPrefixHint: 'gsk_',
  }),
  huggingface: cloud('huggingface', 'Hugging Face', 'Hugging Face', 'https://router.huggingface.co/v1', HUGGINGFACE_MODELS, {
    supportsCustomModelName: true,
    apiKeyPrefixHint: 'hf_',
  }),
  fireworks: cloud('fireworks', 'Fireworks AI', 'Fireworks', 'https://api.fireworks.ai/inference/v1', FIREWORKS_MODELS, {
    apiKeyPrefixHint: 'fw_',
  }),
  deepinfra: cloud('deepinfra', 'DeepInfra', 'DeepInfra', 'https://api.deepinfra.com/v1/openai', DEEPINFRA_MODELS),
  mistral: cloud('mistral', 'Mistral', 'Mistral', 'https://api.mistral.ai/v1', MISTRAL_MODELS),
  deepseek: cloud('deepseek', 'DeepSeek', 'DeepSeek', 'https://api.deepseek.com', [], {
    textModels: DEEPSEEK_TEXT_MODELS,
    supportsVision: false,
    apiKeyPrefixHint: 'sk-',
  }),
  cerebras: cloud('cerebras', 'Cerebras', 'Cerebras', 'https://api.cerebras.ai/v1', [], {
    textModels: CEREBRAS_TEXT_MODELS,
    supportsVision: false,
    apiKeyPrefixHint: 'csk-',
  }),
  ollama: cloud('ollama', 'Ollama (Local)', 'Ollama', 'http://localhost:11434/v1', OLLAMA_VISION_MODELS, {
    textModels: OLLAMA_TEXT_MODELS,
    requiresAPIKey: false,
    usesConfigurableRequestTimeout: true,
  }),
  customOpenAI: cloud('customOpenAI', 'Custom (OpenAI-compatible)', 'Custom', '', [], {
    requiresCustomEndpoint: true,
    requiresCustomModelName: true,
    supportsCustomModelName: true,
    usesConfigurableRequestTimeout: true,
  }),
};

export const allAIProviders: readonly AIProviderDefinition[] = aiProviderIds.map((id) => aiProviders[id]);

export type MobilePlatform = 'ios' | 'android';

export function isAvailableOnPlatform(provider: AIProviderDefinition, platform: MobilePlatform): boolean {
  return provider.platforms.includes(platform);
}

/** Providers exposed for photo/label analysis (`AIProvider.visionProviders`). */
export function visionProviders(platform: MobilePlatform): AIProviderDefinition[] {
  return allAIProviders.filter((p) => p.supportsVision && isAvailableOnPlatform(p, platform));
}

/** Providers exposed for text-only requests (`AIProvider.textProviders`). */
export function textProviders(platform: MobilePlatform): AIProviderDefinition[] {
  return allAIProviders.filter(
    (p) => (isAvailableOnPlatform(p, platform) && p.textModels.length > 0) || p.requiresCustomModelName,
  );
}

export function aiProviderFromRawValue(rawValue: string | null | undefined): AIProviderDefinition | undefined {
  if (!rawValue) return undefined;
  return allAIProviders.find((p) => p.rawValue === rawValue);
}

export function defaultModel(provider: AIProviderDefinition): string {
  return provider.models[0] ?? '';
}

export function defaultTextModel(provider: AIProviderDefinition): string {
  return provider.textModels[0] ?? defaultModel(provider);
}

export function normalizedModelID(model: string): string {
  const trimmed = model.trim();
  switch (trimmed) {
    case 'gemini-3.1-flash-lite-preview':
      return 'gemini-3.1-flash-lite';
    default:
      return trimmed;
  }
}

/** Provider-scoped replacements for presets removed from the registry (`upgradedLegacyModel`). */
export function upgradedLegacyModel(provider: AIProviderDefinition, model: string | null | undefined): string | undefined {
  if (!model) return undefined;
  const normalized = normalizedModelID(model);
  const key = `${provider.id}:${normalized}`;
  switch (key) {
    case 'gemini:gemini-3.1-flash-lite':
    case 'gemini:gemini-2.5-flash':
    case 'gemini:gemini-2.5-pro':
      return 'gemini-3.5-flash-lite';
    case 'openrouter:google/gemini-3.1-flash-lite':
      return 'google/gemini-3.5-flash-lite';
    case 'huggingface:Qwen/Qwen2.5-VL-72B-Instruct':
      return 'Qwen/Qwen3.8-27B';
    case 'mistral:mistral-medium-2604':
      return 'mistral-medium-3-5';
    case 'anthropic:claude-sonnet-4-6':
      return 'claude-sonnet-5';
    case 'anthropic:claude-opus-4-7':
      return 'claude-opus-5';
    default:
      return undefined;
  }
}

export function supportedModelOrDefault(provider: AIProviderDefinition, model: string | null | undefined): string {
  if (!model) return defaultModel(provider);
  const normalized = normalizedModelID(model);
  if (provider.supportsCustomModelName) return normalized;
  return provider.models.includes(normalized) ? normalized : defaultModel(provider);
}

export function supportedTextModelOrDefault(provider: AIProviderDefinition, model: string | null | undefined): string {
  if (!model) return defaultTextModel(provider);
  const normalized = normalizedModelID(model);
  if (provider.supportsCustomModelName) return normalized;
  return provider.textModels.includes(normalized) ? normalized : defaultTextModel(provider);
}

/**
 * Placeholder for the API key field. Always an instruction, never a key-shaped prefix, so an
 * empty field is obviously empty (#373).
 */
export function apiKeyPlaceholder(provider: AIProviderDefinition): string {
  if (!provider.requiresAPIKey) return 'No key needed';
  if (provider.id === 'customOpenAI') return 'Paste API key (or anything if the endpoint has none)';
  return `Paste ${provider.shortName} API key`;
}

/** Optional secondary hint about the key's shape, e.g. "Gemini keys start with AIza". */
export function apiKeyShapeHint(provider: AIProviderDefinition): string | undefined {
  if (!provider.requiresAPIKey || !provider.apiKeyPrefixHint) return undefined;
  return `${provider.shortName} keys start with ${provider.apiKeyPrefixHint}`;
}

export function openAICompatibleTokenLimitKey(provider: AIProviderDefinition, model: string): 'max_completion_tokens' | 'max_tokens' {
  if (provider.id === 'openai' || (provider.id === 'customOpenAI' && usesOpenAICompletionTokenLimit(model))) {
    return 'max_completion_tokens';
  }
  return 'max_tokens';
}

function usesOpenAICompletionTokenLimit(model: string): boolean {
  const normalized = (model.trim().toLowerCase().split('/').pop() ?? model.toLowerCase());
  return (
    normalized.startsWith('gpt-5') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4')
  );
}
