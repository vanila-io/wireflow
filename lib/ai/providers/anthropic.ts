// Anthropic, through the official SDK, straight from the browser to
// api.anthropic.com with the user's own key (there is no Wireflow server).
// Ported from #105 (src/ai/providers/anthropic.js); request parameters checked
// against @anthropic-ai/sdk 0.128.0's types, prices against the pricing page.
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaUsage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  AiError,
  type Chat,
  type Model,
  type Price,
  type Provider,
  type ToolCall,
  type Turn,
  type Usage,
} from "./types";

// USD per million tokens (5-minute cache writes). Claude Haiku 5.5 bills a request
// whose prompt (input + cache reads + cache writes) is over 100K tokens at a second
// rate card. Cache hits on Sonnet 5.5 and Opus 5.5 are 0.05x their input price.
type PriceCard = Price & { over100k?: Price };
export const PRICES: Record<string, PriceCard> = {
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    over100k: { input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  // Models a server-side refusal fallback may answer with.
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

// `fallback`: on a safety refusal the API re-runs the request on another model.
// Claude Haiku 5.5 has no server-side fallback.
const MODELS: Model[] = [
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", fallback: true },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", fallback: true },
].map((m) => ({ ...m, price: PRICES[m.id] }));

const MAX_TOKENS = 32000; // per-request output ceiling; the user pays for it
const JSON_RETRIES = 2;

function toAiError(err: unknown): AiError {
  if (err instanceof Anthropic.APIUserAbortError) return new AiError("aborted", "Stopped.", err);
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError("auth", "Anthropic rejected this key (wrong, expired or revoked?).", err);
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError("permission", "This key can't use that model or workspace.", err);
  if (err instanceof Anthropic.NotFoundError) return new AiError("bad_request", `Not found: ${err.message}`, err);
  if (err instanceof Anthropic.RateLimitError)
    return new AiError("rate_limit", "Rate limited by Anthropic. Try again shortly.", err);
  if (err instanceof Anthropic.BadRequestError) return new AiError("bad_request", err.message, err);
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError(
      "network",
      "Network error or blocked request (offline, ad blocker?). If this was the first request, check the key.",
      err
    );
  }
  // An error event in the middle of a stream has no HTTP status, only an error type.
  if (
    err instanceof Anthropic.APIError &&
    ((err.status ?? 0) >= 500 || ["overloaded_error", "api_error"].includes(err.type ?? ""))
  ) {
    return new AiError("overloaded", "Anthropic is overloaded or erroring. Try again.", err);
  }
  if (err instanceof Anthropic.APIError) return new AiError("unknown", err.message, err);
  return new AiError("unknown", err instanceof Error ? err.message : String(err), err);
}

type UsageLike = Pick<
  BetaUsage,
  "input_tokens" | "output_tokens" | "cache_creation_input_tokens" | "cache_read_input_tokens"
> & {
  model?: string;
  iterations?: UsageLike[] | null;
};

/**
 * Tokens and USD for one response. With a server-side fallback, usage.iterations
 * lists every attempt (the top-level usage covers only the last one), and each is
 * billed at the rates of the model that ran it. A model missing from PRICES is
 * priced as the requested one.
 */
export function costOf(usage: UsageLike, model: string): Usage {
  const total: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };
  for (const attempt of usage.iterations?.length ? usage.iterations : [usage]) {
    const tokens = {
      input: attempt.input_tokens ?? 0,
      output: attempt.output_tokens ?? 0,
      cacheWrite: attempt.cache_creation_input_tokens ?? 0,
      cacheRead: attempt.cache_read_input_tokens ?? 0,
    };
    let price: PriceCard = PRICES[attempt.model ?? ""] ?? PRICES[model];
    if (price.over100k && tokens.input + tokens.cacheWrite + tokens.cacheRead > 100_000) price = price.over100k;
    for (const k of ["input", "output", "cacheWrite", "cacheRead"] as const) {
      total[k] += tokens[k];
      total.usd += (tokens[k] * price[k]) / 1e6;
    }
  }
  return total;
}

// After a mid-output fallback, the declining model's thinking and tool calls before
// the last `fallback` block must not be sent back (or run). Its text and the block
// itself stay where they are.
const DROPPED_BEFORE_FALLBACK = new Set(["thinking", "redacted_thinking", "connector_text", "tool_use"]);
function keptContent(content: BetaContentBlock[]) {
  const boundary = content.findLastIndex((b) => b.type === "fallback");
  return content.filter((b, i) => i > boundary || !DROPPED_BEFORE_FALLBACK.has(b.type));
}

type ToolResultParam = { type: "tool_result"; tool_use_id: string; is_error: boolean; content: string };
const notApplied = (id: string): ToolResultParam => ({
  type: "tool_result",
  tool_use_id: id,
  is_error: true,
  content: "Not applied: the turn was interrupted.",
});

/**
 * A conversation with Claude. The history is kept in Anthropic's own format,
 * append-only: thinking blocks are replayed unchanged, and an append-only
 * history keeps the prompt cache warm.
 */
function createChat({ apiKey, model, system, tools }: Parameters<Provider["createChat"]>[0]): Chat {
  const info = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages: BetaMessageParam[] = [];
  // Answers owed to the tool calls of the last assistant turn, in call order. Every
  // tool_use is answered before anything else is sent; a call that never ran
  // (stopped, cut off, out of steps) is answered as not applied.
  let owed = new Map<string, ToolResultParam>();

  const apiTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as { type: "object" },
    eager_input_streaming: true,
  }));

  return {
    async send({ text = [], toolResults = [] }, { onText, onThinking, onRetry, signal } = {}): Promise<Turn> {
      for (const r of toolResults) {
        if (owed.has(r.id))
          owed.set(r.id, { type: "tool_result", tool_use_id: r.id, is_error: !!r.isError, content: r.content });
      }
      const user: BetaMessageParam = {
        role: "user",
        content: [...owed.values(), ...text.map((t) => ({ type: "text" as const, text: t }))],
      };

      const params: MessageCreateParamsNonStreaming = {
        model: info.id,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "medium" },
        // The explicit breakpoint caches tools + system (+ the template catalog);
        // the top-level one follows the end of the growing conversation.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        cache_control: { type: "ephemeral" },
        tools: apiTools,
        // Forced tool choice is rejected on Sonnet/Opus 5.5.
        tool_choice: { type: "auto" },
        messages: [...messages, user],
        ...(info.fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      };

      let message;
      // Usage of attempts that were re-sent: they are billed too.
      const retried: UsageLike[] = [];
      for (let attempt = 0; ; attempt++) {
        const stream = client.beta.messages.stream(params, { signal });
        if (onText) stream.on("text", onText);
        if (onThinking) stream.on("thinking", onThinking);
        try {
          message = await stream.finalMessage();
          break;
        } catch (err) {
          // A stream that breaks off with something other than an API error (an event
          // that does not parse) is re-sent a couple of times; rethrow the rest. Tool input
          // that does not parse arrives as {} (SDK 0.128) and the validator reports it.
          if (err instanceof Anthropic.APIError || signal?.aborted || attempt >= JSON_RETRIES) throw toAiError(err);
          const partial = stream.currentMessage?.usage;
          if (partial) retried.push(partial as UsageLike);
          onRetry?.();
        }
      }
      const usage = [...retried, message.usage as UsageLike]
        .map((u) => costOf(u, info.id))
        .reduce((a, b) => ({
          input: a.input + b.input,
          output: a.output + b.output,
          cacheWrite: a.cacheWrite + b.cacheWrite,
          cacheRead: a.cacheRead + b.cacheRead,
          usd: a.usd + b.usd,
        }));

      // A declined turn is dropped, partial output included, so the next message
      // continues from the last answered turn instead of repeating this request.
      if (message.stop_reason === "refusal") {
        return {
          status: "refused",
          text: "",
          toolCalls: [],
          refusal: message.stop_details?.explanation ?? null,
          model: message.model,
          usage,
        };
      }

      // The request joins the history only once it has an answer: a request that was
      // stopped or failed must not come back as part of the next one. Tool results it
      // carried stay owed and go out with the next request.
      const content = keptContent(message.content);
      messages.push(user, { role: "assistant", content });

      const toolCalls: ToolCall[] = content.flatMap((b) =>
        b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : []
      );
      owed = new Map(toolCalls.map((c) => [c.id, notApplied(c.id)]));
      const status = message.stop_reason === "max_tokens" ? "truncated" : toolCalls.length ? "tool_use" : "done";
      return {
        status,
        text: content.map((b) => (b.type === "text" ? b.text : "")).join(""),
        toolCalls: status === "tool_use" ? toolCalls : [],
        refusal: null,
        model: message.model,
        usage,
      };
    },
  };
}

async function validateKey({ apiKey, model }: { apiKey: string; model: string }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await client.models.retrieve(model); // free; checks the key and access to the model
  } catch (err) {
    throw toAiError(err);
  }
}

const anthropic: Provider = {
  id: "anthropic",
  label: "Anthropic",
  keyHint: "sk-ant-…",
  keyUrl: "https://platform.claude.com/settings/keys",
  models: MODELS,
  defaultModel: "claude-haiku-5-5",
  createChat,
  validateKey,
};
export default anthropic;
