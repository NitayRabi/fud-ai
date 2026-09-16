/**
 * HTTP transports for the BYOK providers and the hosted proxy. Pure TypeScript over `fetch`
 * so request shapes are unit-testable in Node.
 *
 * Mirrors the private `callGemini` / `callOpenAICompatible` / `callAnthropic` helpers in
 * `ios/calorietracker/Services/GeminiService.swift` and `HostedAIService.swift`:
 * - the Gemini key travels in `X-goog-api-key`, never the query string;
 * - a truncated response (`MAX_TOKENS` / `length` / `max_tokens`) is retried once with a
 *   compact-retry prompt and then reported as `truncated`;
 * - every request has a hard timeout (`aiRequestTimeoutSeconds`) and honours an external
 *   `AbortSignal`, so an analysis can never hang forever.
 */

import { AIError, classifyHTTPError, classifyNetworkError } from './errors';
import { hostedAIConstants } from './hosted';
import { openAICompatibleTokenLimitKey, type AIProviderDefinition } from './providers';
import { DEFAULT_MAX_RESPONSE_TOKENS, type RequestConfig } from './settings';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  /** JPEG bytes, base64. Only user turns carry images. */
  imageBase64?: string;
}

export interface AIGenerateRequest {
  prompt: string;
  /** JPEG bytes, base64-encoded, attached to the final user turn. */
  imagesBase64?: readonly string[];
  /** Free-form system instruction (`aiUserContext` or the Coach system prompt). */
  systemInstruction?: string;
  /** Ask for a JSON object (Gemini `responseMimeType`); false for plain-English prompts. */
  jsonResponse?: boolean;
  /** Prior conversation turns, oldest first, for multi-turn chat. */
  history?: readonly ChatTurn[];
  maxOutputTokens?: number;
}

export interface AIRequestOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface HTTPRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface TextResponse {
  text: string | undefined;
  wasTruncated: boolean;
}

const JPEG_MIME = 'image/jpeg';

// MARK: - Request builders

export function buildGeminiRequest(config: RequestConfig, request: AIGenerateRequest): HTTPRequest {
  if (!config.apiKey) throw new AIError('noKey');
  const contents: unknown[] = [];
  for (const turn of request.history ?? []) {
    const parts: unknown[] = [];
    if (turn.imageBase64) parts.push({ inlineData: { mimeType: JPEG_MIME, data: turn.imageBase64 } });
    parts.push({ text: turn.text });
    contents.push({ role: turn.role === 'user' ? 'user' : 'model', parts });
  }
  const finalParts: unknown[] = (request.imagesBase64 ?? []).map((data) => ({ inlineData: { mimeType: JPEG_MIME, data } }));
  finalParts.push({ text: request.prompt });
  contents.push({ role: 'user', parts: finalParts });

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_RESPONSE_TOKENS,
    temperature: 0.2,
  };
  if (request.jsonResponse !== false) generationConfig.responseMimeType = 'application/json';

  const body: Record<string, unknown> = { contents, generationConfig };
  if (request.systemInstruction) body.systemInstruction = { parts: [{ text: request.systemInstruction }] };

  return {
    url: `${trimSlash(config.baseURL)}/models/${config.model}:generateContent`,
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': config.apiKey },
    body,
  };
}

export function buildOpenAICompatibleRequest(config: RequestConfig, request: AIGenerateRequest): HTTPRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/apoorvdarshan/fud-ai';
    headers['X-Title'] = 'Fud AI';
  }

  const messages: unknown[] = [];
  if (request.systemInstruction) messages.push({ role: 'system', content: request.systemInstruction });
  for (const turn of request.history ?? []) {
    if (turn.imageBase64) {
      messages.push({
        role: turn.role,
        content: [{ type: 'image_url', image_url: { url: `data:${JPEG_MIME};base64,${turn.imageBase64}` } }, { type: 'text', text: turn.text }],
      });
    } else {
      messages.push({ role: turn.role, content: turn.text });
    }
  }
  const content: unknown[] = (request.imagesBase64 ?? []).map((data) => ({
    type: 'image_url',
    image_url: { url: `data:${JPEG_MIME};base64,${data}` },
  }));
  content.push({ type: 'text', text: request.prompt });
  messages.push({ role: 'user', content });

  const body: Record<string, unknown> = { model: config.model, messages };
  body[openAICompatibleTokenLimitKey(config.provider, config.model)] = request.maxOutputTokens ?? DEFAULT_MAX_RESPONSE_TOKENS;
  if (config.provider.id === 'openrouter') body.reasoning = { exclude: true };

  return { url: `${trimSlash(config.baseURL)}/chat/completions`, headers, body };
}

export function buildAnthropicRequest(config: RequestConfig, request: AIGenerateRequest): HTTPRequest {
  if (!config.apiKey) throw new AIError('noKey');
  const messages: unknown[] = [];
  for (const turn of request.history ?? []) {
    const content: unknown[] = [];
    if (turn.imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: JPEG_MIME, data: turn.imageBase64 } });
    content.push({ type: 'text', text: turn.text });
    messages.push({ role: turn.role, content });
  }
  const content: unknown[] = (request.imagesBase64 ?? []).map((data) => ({
    type: 'image',
    source: { type: 'base64', media_type: JPEG_MIME, data },
  }));
  content.push({ type: 'text', text: request.prompt });
  messages.push({ role: 'user', content });

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_RESPONSE_TOKENS,
    messages,
  };
  if (request.systemInstruction) body.system = request.systemInstruction;

  return {
    url: `${trimSlash(config.baseURL)}/messages`,
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
    body,
  };
}

/**
 * Hosted proxy (`web/hosted-ai-api.ts` → `POST /generate`). The app ships no secret: the
 * RevenueCat app user id identifies the subscription and the Worker meters usage.
 */
export function buildHostedRequest(appUserId: string, request: AIGenerateRequest): HTTPRequest {
  const images = (request.imagesBase64 ?? []).slice(0, hostedAIConstants.maxHostedImages);
  const body: Record<string, unknown> = { prompt: hostedPrompt(request), images };
  if (request.systemInstruction) body.systemInstruction = request.systemInstruction;
  return {
    url: `${hostedAIConstants.hostedAIBaseURL}/generate`,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', [hostedAIConstants.hostedUserIDHeader]: appUserId },
    body,
  };
}

/** The hosted `generate` route takes a single prompt, so history is flattened into it. */
function hostedPrompt(request: AIGenerateRequest): string {
  const history = request.history ?? [];
  if (history.length === 0) return request.prompt;
  const transcript = history.map((turn) => `${turn.role === 'user' ? 'User' : 'Coach'}: ${turn.text}`).join('\n');
  return `Conversation so far:\n${transcript}\n\nUser: ${request.prompt}`;
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// MARK: - Response parsers

type JSONObject = Record<string, unknown>;

function asObject(value: unknown): JSONObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JSONObject) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** `GeminiRequestConfiguration.parseTextResponse` — skips thought parts, tolerates MAX_TOKENS. */
export function parseGeminiText(json: unknown): TextResponse {
  const root = asObject(json);
  const first = asObject(asArray(root?.candidates)[0]);
  if (!root || !first) {
    const message = asString(asObject(root?.error)?.message);
    throw new AIError(message ? 'generic' : 'invalidResponse', message);
  }
  const finishReason = asString(first.finishReason);
  const parts = asArray(asObject(first.content)?.parts);
  const combined = parts
    .map(asObject)
    .filter((part) => part && part.thought !== true)
    .map((part) => asString(part?.text) ?? '')
    .join('')
    .trim();
  const wasTruncated = finishReason === 'MAX_TOKENS';
  if (combined.length === 0 && !wasTruncated) throw new AIError('invalidResponse');
  return { text: combined.length > 0 ? combined : undefined, wasTruncated };
}

/** `GeminiService.parseOpenAITextResponse` — surfaces `error.message`, treats `length` as truncation. */
export function parseOpenAIText(json: unknown): TextResponse {
  const root = asObject(json);
  const errorMessage = asString(asObject(root?.error)?.message);
  const choice = asObject(asArray(root?.choices)[0]);
  if (!choice) {
    if (errorMessage) throw new AIError('generic', `API error: ${errorMessage}`);
    throw new AIError('invalidResponse');
  }
  const message = asObject(choice.message);
  const rawContent = message?.content;
  let text: string | undefined;
  if (typeof rawContent === 'string') {
    text = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    text = rawContent
      .map(asObject)
      .map((part) => asString(part?.text) ?? '')
      .join('')
      .trim();
  }
  const finishReason = asString(choice.finish_reason);
  const hasReasoning = typeof message?.reasoning === 'string' || typeof message?.reasoning_content === 'string';
  const wasTruncated = finishReason === 'length' || (!text && hasReasoning);
  if (!text && !wasTruncated) throw new AIError('invalidResponse');
  return { text: text && text.length > 0 ? text : undefined, wasTruncated };
}

export function parseAnthropicText(json: unknown): TextResponse {
  const root = asObject(json);
  if (!root) throw new AIError('invalidResponse');
  const errorMessage = asString(asObject(root.error)?.message);
  if (errorMessage) throw new AIError('generic', `API error: ${errorMessage}`);
  const text = asArray(root.content)
    .map(asObject)
    .filter((block) => block?.type === 'text')
    .map((block) => asString(block?.text) ?? '')
    .join('')
    .trim();
  const wasTruncated = asString(root.stop_reason) === 'max_tokens';
  if (text.length === 0 && !wasTruncated) throw new AIError('invalidResponse');
  return { text: text.length > 0 ? text : undefined, wasTruncated };
}

export function parseHostedText(json: unknown): TextResponse {
  const text = asString(asObject(json)?.text)?.trim();
  if (!text) throw new AIError('invalidResponse');
  return { text, wasTruncated: false };
}

/**
 * `GeminiService.extractJSON` — strips code fences and returns the first balanced `{…}`
 * object, string-aware, so a chatty model reply still parses.
 */
export function extractJSON(text: string): string {
  let cleaned = text.trim();
  const fenceIndex = cleaned.toLowerCase().indexOf('```json');
  const anyFence = cleaned.indexOf('```');
  const open = fenceIndex >= 0 ? fenceIndex + 7 : anyFence >= 0 ? anyFence + 3 : -1;
  if (open >= 0) {
    cleaned = cleaned.slice(open);
    const close = cleaned.lastIndexOf('```');
    if (close >= 0) cleaned = cleaned.slice(0, close);
  }
  cleaned = cleaned.trim();
  const first = cleaned.indexOf('{');
  if (first === -1) return cleaned;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = first; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(first, i + 1);
    }
  }
  return cleaned;
}

// MARK: - Compact retry

export function compactRetryPrompt(prompt: string, maxOutputTokens: number, jsonResponse: boolean): string {
  const budget = maxOutputTokens > 0 ? ` Keep the complete response under ${maxOutputTokens} tokens.` : '';
  const shape = jsonResponse
    ? 'Return only the requested compact JSON object, with no reasoning, explanation, or markdown.'
    : 'Return only the requested concise plain-English answer, with no reasoning, explanation, JSON, or markdown.';
  return `${prompt}\n\nIMPORTANT: The previous response was truncated. ${shape}${budget}`;
}

// MARK: - Execution

/** Merge the caller's signal with a timeout; both abort the same request. */
export function timeoutSignal(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; dispose: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort();
  if (external) {
    if (external.aborted) forward();
    else external.addEventListener('abort', forward, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
    },
    timedOut: () => timedOut,
  };
}

async function postJSON(http: HTTPRequest, options: AIRequestOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const { signal, dispose, timedOut } = timeoutSignal(options.timeoutMs, options.signal);
  let response: Response;
  try {
    response = await fetchImpl(http.url, { method: 'POST', headers: http.headers, body: JSON.stringify(http.body), signal });
  } catch (error) {
    dispose();
    if (timedOut()) throw new AIError('timeout');
    if (options.signal?.aborted) throw new AIError('cancelled');
    throw new AIError(classifyNetworkError(error));
  }
  let raw: string;
  try {
    raw = await response.text();
  } catch (error) {
    dispose();
    if (timedOut()) throw new AIError('timeout');
    throw new AIError(classifyNetworkError(error));
  } finally {
    dispose();
  }
  if (!response.ok) {
    throw new AIError(classifyHTTPError(response.status, raw), undefined, response.status);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AIError('invalidResponse');
  }
}

type Builder = (request: AIGenerateRequest) => HTTPRequest;
type Parser = (json: unknown) => TextResponse;

async function generateWithRetry(build: Builder, parse: Parser, request: AIGenerateRequest, options: AIRequestOptions): Promise<string> {
  const maxTokens = request.maxOutputTokens ?? DEFAULT_MAX_RESPONSE_TOKENS;
  let response = parse(await postJSON(build(request), options));
  if (response.wasTruncated) {
    const retry: AIGenerateRequest = { ...request, prompt: compactRetryPrompt(request.prompt, maxTokens, request.jsonResponse !== false) };
    response = parse(await postJSON(build(retry), options));
    if (response.wasTruncated) throw new AIError('truncated');
  }
  if (!response.text) throw new AIError('invalidResponse');
  return response.text;
}

/** `GeminiService.dispatch` — route by API format. On-device runtimes are native-only for now. */
export async function generateText(config: RequestConfig, request: AIGenerateRequest, options: AIRequestOptions): Promise<string> {
  if (!config.baseURL) throw new AIError('invalidURL');
  const provider: AIProviderDefinition = config.provider;
  switch (provider.apiFormat) {
    case 'onDevice':
      if ((request.imagesBase64?.length ?? 0) > 0) throw new AIError('textOnly');
      throw new AIError('unsupportedDevice');
    case 'liteRTLocal':
      throw new AIError('localUnavailable');
    case 'gemini':
      return generateWithRetry((r) => buildGeminiRequest(config, r), parseGeminiText, request, options);
    case 'openaiCompatible':
      return generateWithRetry((r) => buildOpenAICompatibleRequest(config, r), parseOpenAIText, request, options);
    case 'anthropic':
      return generateWithRetry((r) => buildAnthropicRequest(config, r), parseAnthropicText, request, options);
  }
}

/** Hosted proxy call; quota and entitlement failures map to hosted-specific messages. */
export async function generateHostedText(appUserId: string, request: AIGenerateRequest, options: AIRequestOptions): Promise<string> {
  try {
    const text = parseHostedText(await postJSON(buildHostedRequest(appUserId, request), options)).text;
    if (!text) throw new AIError('invalidResponse');
    return text;
  } catch (error) {
    if (error instanceof AIError && error.status !== undefined) {
      if (error.status === 401 || error.status === 403) throw new AIError('hostedUnauthorized', undefined, error.status);
      if (error.status === 402 || error.status === 429) throw new AIError('hostedQuota', undefined, error.status);
      if (error.status >= 500) throw new AIError('overloaded', 'Hosted AI is temporarily unavailable. Please try again shortly.', error.status);
    }
    throw error;
  }
}
