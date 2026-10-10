// AI providers (#105). Provider-neutral: the agent loop, the diagram layer and
// the layout check only use these types; each provider adapts them.

// `kind` is one of these; the panel words its messages by kind.
export type AiErrorKind =
  | "auth"
  | "permission"
  | "rate_limit"
  | "overloaded"
  | "network"
  | "bad_request"
  | "aborted"
  | "unknown";

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "AiError";
  }
}

/** USD per million tokens. */
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };
export type Model = { id: string; label: string; price: Price; fallback?: boolean };

/** A tool, described by a JSON Schema for its input. */
export type Tool = { name: string; description: string; parameters: Record<string, unknown> };

export type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number; usd: number };
export type ToolCall = { id: string; name: string; input: unknown };
export type ToolResult = { id: string; content: string; isError?: boolean };

export type Turn = {
  status: "done" | "tool_use" | "refused" | "truncated";
  text: string;
  toolCalls: ToolCall[];
  refusal: string | null;
  model: string;
  usage: Usage;
};

export type SendOptions = {
  /** The provider is re-sending the same turn: drop what onText/onThinking streamed for it so far. */
  onRetry?: () => void;
  onText?: (delta: string) => void;
  onThinking?: (delta: string) => void;
  signal?: AbortSignal;
};

/**
 * A conversation. It keeps its own history in whatever format the provider needs.
 * A request joins the history only once it is answered: after a stop, an error or
 * a refusal, the next send continues from the last answered turn. Tool calls that
 * were never answered are closed out on the next send, and tool results that
 * could not be delivered are sent again.
 */
export type Chat = {
  send(input: { text?: string[]; toolResults?: ToolResult[] }, options?: SendOptions): Promise<Turn>;
};

export type Provider = {
  id: string;
  label: string;
  keyHint: string;
  keyUrl: string;
  models: Model[];
  defaultModel: string;
  /** Throws an AiError if the key is not accepted (costs no tokens). */
  validateKey(args: { apiKey: string; model: string }): Promise<void>;
  createChat(args: { apiKey: string; model: string; system: string; tools: Tool[] }): Chat;
};
