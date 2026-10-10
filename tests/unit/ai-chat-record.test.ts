// "Keep chat after reload" (#104): a stored chat is read back field by field,
// for this provider and model only, and its undo steps only where they are
// still this diagram's.
import { describe, expect, it } from "vitest";
import { parseChatRecord, stepFingerprint, type Message } from "@/lib/ai/chat-record";
import { createHistory, record } from "@/lib/diagram/history";

const history = record(record(createHistory("{}"), '{"nodes":[1]}', "ai"), '{"nodes":[1,2]}', "ai");
const step1 = 1;
const messages: Message[] = [
  { id: "u1", role: "user", text: "add a login screen" },
  {
    id: "a1",
    role: "assistant",
    text: "Added it.",
    thinking: "",
    applied: [{ count: 1, summary: "Added Login.", step: step1, fingerprint: stepFingerprint(history, step1) }],
    status: "done",
    cost: 0.0012,
  },
];
const stored = { v: 1, provider: "anthropic", model: "claude-haiku-5-5", messages, history: { messages: [] } };
const opts = { provider: "anthropic", model: "claude-haiku-5-5", history };

describe("a kept chat", () => {
  it("reads back what was stored, with the provider history as it was", () => {
    const r = parseChatRecord(structuredClone(stored), opts)!;
    expect(r.messages.map((m) => (m.role === "user" ? m.text : [m.text, m.status, m.cost]))).toEqual([
      "add a login screen",
      ["Added it.", "done", 0.0012],
    ]);
    expect(r.messages[1]).toMatchObject({ applied: [{ count: 1, summary: "Added Login.", step: step1 }] });
    expect(r.history).toEqual({ messages: [] });
  });

  it("is dropped for another provider or model, or when it isn't one", () => {
    expect(parseChatRecord(stored, { ...opts, model: "claude-opus-5-5" })).toBeNull();
    expect(parseChatRecord(stored, { ...opts, provider: "other" })).toBeNull();
    for (const bad of [null, "chat", { ...stored, v: 2 }, { ...stored, messages: "x" }, { ...stored, messages: [] }])
      expect(parseChatRecord(bad, opts)).toBeNull();
  });

  it("keeps only text fields of known kinds, and ends a reply saved mid-stream", () => {
    const r = parseChatRecord(
      {
        ...stored,
        messages: [
          { role: "user", text: { html: "<b>x</b>" } },
          { role: "system", text: "ignored" },
          { role: "assistant", text: "partial", status: "streaming", errorKind: "evil", cost: "1", extra: 1 },
        ],
      },
      opts
    )!;
    expect(r.messages).toEqual([
      { id: "r0", role: "user", text: "" },
      { id: "r2", role: "assistant", text: "partial", thinking: "", applied: [], status: "aborted" },
    ]);
  });

  it("forgets an undo step that isn't this diagram's any more (another tab's history starts over)", () => {
    const otherTab = record(createHistory("{}"), '{"nodes":["something else"]}', "ai");
    const r = parseChatRecord(stored, { ...opts, history: otherTab })!;
    expect(r.messages[1]).toMatchObject({ applied: [{ step: null }] });
    expect(parseChatRecord(stored, { ...opts, history: createHistory("{}") })!.messages[1]).toMatchObject({
      applied: [{ step: null }],
    });
  });
});
