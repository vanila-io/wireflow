// The conversation as the AI panel shows it, and as "Keep chat after reload"
// stores it (#104): the messages on screen, plus the provider's own history
// (Chat.history()), which is what the next request continues from.
import type { History } from "@/lib/diagram/history";
import type { AiErrorKind } from "./providers/types";

// `step` is the undo step the change became (null if unknown); `fingerprint`
// identifies that step's diagram, so a chat restored in another tab, whose undo
// history starts over, doesn't take some other step for it.
export type Applied = { count: number; summary: string; step: number | null; fingerprint?: string };
export type AssistantStatus = "streaming" | "done" | "refused" | "truncated" | "step_limit" | "aborted" | "error";
export type Message =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      thinking: string;
      applied: Applied[];
      status: AssistantStatus;
      refusal?: string | null;
      error?: string;
      errorKind?: AiErrorKind;
      cost?: number;
    };
export type AssistantMessage = Extract<Message, { role: "assistant" }>;

export type ChatRecord = { v: 1; provider: string; model: string; messages: Message[]; history: unknown };

// FNV-1a, enough to tell two diagrams apart (not a security check).
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

/** The fingerprint of undo step `id` in the history, or undefined if it isn't there. */
export function stepFingerprint(h: History, id: number): string | undefined {
  const step = [h.present, ...h.past, ...h.future].find((s) => s.id === id);
  return step && hash(step.json);
}

const STATUSES: AssistantStatus[] = ["done", "refused", "truncated", "step_limit", "aborted", "error"];
const ERROR_KINDS: AiErrorKind[] = [
  "auth",
  "permission",
  "rate_limit",
  "overloaded",
  "network",
  "bad_request",
  "aborted",
  "unknown",
];
const str = (v: unknown) => (typeof v === "string" ? v : "");

function parseApplied(v: unknown, history: History): Applied[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((a) => {
    if (typeof a !== "object" || a === null) return [];
    const { count, summary, step, fingerprint } = a as Record<string, unknown>;
    // The step only if it is still this diagram's step (see Applied).
    const known =
      Number.isInteger(step) &&
      typeof fingerprint === "string" &&
      stepFingerprint(history, step as number) === fingerprint;
    return [
      {
        count: Number.isInteger(count) ? (count as number) : 0,
        summary: str(summary),
        step: known ? (step as number) : null,
        ...(known && { fingerprint: fingerprint as string }),
      },
    ];
  });
}

/**
 * A stored chat read back, field by field (the panel shows only these, as plain
 * text). Null if it isn't one, or was kept for another provider or model.
 */
export function parseChatRecord(
  value: unknown,
  { provider, model, history }: { provider: string; model: string; history: History }
): ChatRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (r.v !== 1 || r.provider !== provider || r.model !== model || !Array.isArray(r.messages)) return null;
  const messages = r.messages.flatMap((m, i): Message[] => {
    if (typeof m !== "object" || m === null) return [];
    const x = m as Record<string, unknown>;
    const id = `r${i}`;
    if (x.role === "user") return [{ id, role: "user", text: str(x.text) }];
    if (x.role !== "assistant") return [];
    return [
      {
        id,
        role: "assistant",
        text: str(x.text),
        thinking: str(x.thinking),
        applied: parseApplied(x.applied, history),
        // A reply still streaming when it was saved ended there.
        status: STATUSES.includes(x.status as AssistantStatus) ? (x.status as AssistantStatus) : "aborted",
        ...(typeof x.refusal === "string" && { refusal: x.refusal }),
        ...(typeof x.error === "string" && { error: x.error }),
        ...(ERROR_KINDS.includes(x.errorKind as AiErrorKind) && { errorKind: x.errorKind as AiErrorKind }),
        ...(typeof x.cost === "number" && Number.isFinite(x.cost) && { cost: x.cost }),
      },
    ];
  });
  if (!messages.length) return null;
  return { v: 1, provider, model, messages, history: r.history };
}
