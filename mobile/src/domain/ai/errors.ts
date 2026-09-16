/**
 * Stable AI error categories with actionable copy. Ported from
 * `ios/calorietracker/Services/AIErrorMessages.swift` (`AIErrorKind`) so both apps show the
 * same message for the same failure, and remote response bodies never reach the UI verbatim.
 */

export type AIErrorKind =
  | 'noKey'
  | 'imageConversion'
  | 'invalidResponse'
  | 'invalidURL'
  | 'offline'
  | 'connection'
  | 'timeout'
  | 'cancelled'
  | 'credits'
  | 'dailyQuota'
  | 'quota'
  | 'modelUnavailable'
  | 'rateLimited'
  | 'keyRejected'
  | 'overloaded'
  | 'generic'
  | 'localUnavailable'
  | 'unsupportedDevice'
  | 'truncated'
  | 'textOnly'
  | 'hostedUnauthorized'
  | 'hostedQuota';

export const aiErrorMessages: Record<AIErrorKind, string> = {
  noKey: 'No API key configured. Add your key in Settings → AI Access.',
  imageConversion: 'Failed to process the image. Try another photo.',
  invalidResponse: 'Could not understand the AI response. Please try again.',
  invalidURL: 'Invalid API URL. Check your provider settings.',
  offline: 'You appear to be offline. Check your connection and try again.',
  connection: 'Could not connect to the AI provider. Check your connection and provider URL, then try again.',
  timeout: 'The AI took too long to respond. Try again, or raise the request timeout in Settings → AI Access.',
  cancelled: 'Analysis cancelled.',
  credits: 'Your AI account is out of credits. Top up, or switch provider in Settings → AI Access.',
  dailyQuota: 'Your AI account’s daily quota is used up. Try again tomorrow, or switch provider in Settings → AI Access.',
  quota: 'Your AI account’s usage quota was exceeded. Check your provider’s limits, or switch provider in Settings → AI Access.',
  modelUnavailable: 'The selected model or API endpoint is unavailable. Check the model and API URL in Settings → AI Access.',
  rateLimited:
    'Rate limit hit on your API key. Wait a minute, or switch provider in Settings → AI Access. If you use a free tier, check whether its daily quota is used up.',
  keyRejected: 'Your API key was rejected. Open Settings → AI Access and re-paste a valid key.',
  overloaded: 'The AI provider is overloaded right now. Try again in a minute, or switch provider/model in Settings → AI Access.',
  generic: 'The AI request failed. Try again, or switch provider in Settings → AI Access.',
  localUnavailable: 'On-device AI is not available in the shared app yet. Choose a cloud provider in Settings → AI Access.',
  unsupportedDevice: 'Apple Intelligence requires iOS 26 or later on a supported iPhone.',
  truncated: 'The AI response was truncated twice. Try a shorter input or another model.',
  textOnly: 'This provider is available for text-only requests.',
  hostedUnauthorized: 'Hosted AI could not identify your subscription. Try Restore Purchases.',
  hostedQuota: "You're out of hosted AI actions for today. Buy credits, upgrade, or switch to BYOK.",
};

export class AIError extends Error {
  readonly kind: AIErrorKind;
  /** HTTP status when the failure came from a response. */
  readonly status?: number;

  constructor(kind: AIErrorKind, message?: string, status?: number) {
    super(message ?? aiErrorMessages[kind]);
    this.name = 'AIError';
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

/** User-facing message for any thrown value, defaulting to the generic AI copy. */
export function aiErrorMessage(error: unknown): string {
  if (isAIError(error)) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return aiErrorMessages.cancelled;
  return aiErrorMessages.generic;
}

/** `AIErrorKind.classify(status:raw:)` — maps an HTTP failure to a stable category. */
export function classifyHTTPError(status: number, raw: string): AIErrorKind {
  const text = raw.toLowerCase();
  const has = (...markers: string[]) => markers.some((m) => text.includes(m));
  if (status === 401 || status === 403 || (status === 400 && has('api key not valid', 'api_key_invalid', 'api key expired', 'api_key_expired'))) {
    return 'keyRejected';
  }
  if (status === 402 || has('insufficient credits', 'insufficient credit', 'credit balance is too low', 'out of credits', 'billing_hard_limit_reached')) {
    return 'credits';
  }
  if (has('quota', 'limit', 'resource_exhausted') && has('daily', 'per day', 'per_day', 'perday', 'requestsperday')) return 'dailyQuota';
  if (has('quota exceeded', 'quota_exceeded', 'exceeded your current quota', 'insufficient_quota')) return 'quota';
  if (status === 404) return 'modelUnavailable';
  if (status === 429) return 'rateLimited';
  if (status === 503 || status === 529) return 'overloaded';
  return 'generic';
}

/** `AIErrorKind.network(_:)` — categorise a thrown fetch error. */
export function classifyNetworkError(error: unknown): AIErrorKind {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'cancelled';
    if (error.name === 'TimeoutError') return 'timeout';
    const text = error.message.toLowerCase();
    if (text.includes('network request failed') || text.includes('failed to fetch') || text.includes('enotfound') || text.includes('offline')) {
      return 'offline';
    }
  }
  return 'connection';
}
