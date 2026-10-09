import Anthropic from '@anthropic-ai/sdk';
import { AiError } from './errors';

// Prices in USD per million tokens (5-minute cache writes).
const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 } },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', price: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 }, fallback: true },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', price: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 }, fallback: true },
];

const MAX_TOKENS = 32000; // per-request output ceiling; the user pays for it
const JSON_RETRIES = 2;

function toAiError(err) {
  if (err instanceof Anthropic.APIUserAbortError) return new AiError('aborted', 'Stopped.', err);
  if (err instanceof Anthropic.AuthenticationError) return new AiError('auth', 'Anthropic rejected this key (wrong, expired or revoked?).', err);
  if (err instanceof Anthropic.PermissionDeniedError) return new AiError('permission', "This key can't use that model or workspace.", err);
  if (err instanceof Anthropic.NotFoundError) return new AiError('bad_request', `Not found: ${err.message}`, err);
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate_limit', 'Rate limited by Anthropic. Try again shortly.', err);
  if (err instanceof Anthropic.BadRequestError) return new AiError('bad_request', err.message, err);
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', 'Network error or blocked request (offline, ad blocker?). If this was the first request, check the key.', err);
  if (err instanceof Anthropic.APIError && (err.status >= 500 || err.status === 529)) return new AiError('overloaded', 'Anthropic is overloaded or erroring. Try again.', err);
  if (err instanceof Anthropic.APIError) return new AiError('unknown', err.message, err);
  return new AiError('unknown', err?.message ?? String(err), err);
}

function costOf(usage, price) {
  const u = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
  };
  const usd = (u.input * price.input + u.output * price.output + u.cacheWrite * price.cacheWrite + u.cacheRead * price.cacheRead) / 1e6;
  return { ...u, usd };
}

/**
 * A conversation with Claude. Keeps the history in Anthropic's native format,
 * append-only (thinking blocks are replayed unchanged, and an append-only
 * history keeps the prompt cache warm).
 */
function createChat({ apiKey, model, system, tools, baseURL }) {
  const info = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  const messages = [];
  // tool_use ids from the last assistant turn that have not been answered yet.
  let pending = [];

  const apiTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
    eager_input_streaming: true,
  }));

  async function send({ text = [], toolResults = [] }, { onText, onThinking, signal } = {}) {
    // Every tool_use must be answered before anything else is sent. Answer the
    // ones nobody ran (stopped, cut off, refused) as not applied.
    const answered = new Set(toolResults.map((r) => r.id));
    const unanswered = pending.filter((id) => !answered.has(id));
    pending = [];
    const content = [
      ...unanswered.map((id) => ({ type: 'tool_result', tool_use_id: id, is_error: true, content: 'Not applied: the turn was interrupted.' })),
      ...toolResults.map((r) => ({ type: 'tool_result', tool_use_id: r.id, is_error: !!r.isError, content: r.content })),
      ...text.map((t) => ({ type: 'text', text: t })),
    ];
    // Stays in history even if the request fails; consecutive user turns are merged by the API.
    messages.push({ role: 'user', content });

    const params = {
      model: info.id,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'medium' },
      // Explicit breakpoint caches tools + system (+ template catalog); the
      // top-level one follows the end of the growing conversation.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      cache_control: { type: 'ephemeral' },
      tools: apiTools,
      tool_choice: { type: 'auto' },
      messages,
      // Opus/Sonnet 5.5: on a safety refusal, re-run on a fallback model server-side.
      ...(info.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    };

    let message;
    for (let attempt = 0; ; attempt++) {
      const stream = client.beta.messages.stream(params, { signal });
      if (onText) stream.on('text', onText);
      if (onThinking) stream.on('thinking', onThinking);
      try {
        message = await stream.finalMessage();
        break;
      } catch (err) {
        // Eager tool-input streaming: unparseable tool JSON rejects without an
        // API error. Re-issue the same turn a couple of times; rethrow the rest.
        if (err instanceof Anthropic.APIError || signal?.aborted || attempt >= JSON_RETRIES) throw toAiError(err);
      }
    }

    messages.push({ role: 'assistant', content: message.content });

    const toolCalls = message.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input }));
    pending = toolCalls.map((c) => c.id);
    const replyText = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const usage = costOf(message.usage, (MODELS.find((m) => m.id === message.model) ?? info).price);

    let status = 'done';
    if (message.stop_reason === 'refusal') status = 'refused';
    else if (message.stop_reason === 'max_tokens') status = 'truncated';
    else if (toolCalls.length) status = 'tool_use';

    return {
      status,
      text: replyText,
      toolCalls: status === 'tool_use' ? toolCalls : [],
      refusal: status === 'refused' ? (message.stop_details?.category ?? null) : null,
      model: message.model,
      usage,
    };
  }

  return { send };
}

async function validateKey({ apiKey, model, baseURL }) {
  const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  try {
    await client.models.retrieve(model); // free; checks the key and model access
  } catch (err) {
    throw toAiError(err);
  }
}

export default {
  id: 'anthropic',
  label: 'Anthropic',
  keyHint: 'sk-ant-…',
  keyUrl: 'https://platform.claude.com/settings/keys',
  models: MODELS,
  defaultModel: 'claude-haiku-5-5',
  createChat,
  validateKey,
};
