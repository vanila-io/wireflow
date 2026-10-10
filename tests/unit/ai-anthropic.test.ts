// Ported from #105 (src/__tests__/ai/anthropic.test.js): the adapter driven by a
// scripted fetch that answers with hand-written SSE.
import { afterEach, describe, expect, it, vi } from "vitest";
import anthropic, { costOf } from "@/lib/ai/providers/anthropic";

type Event = Record<string, unknown> & { type: string };
const sse = (events: Event[]) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
const start = (model: string): Event => ({
  type: "message_start",
  message: {
    id: "msg",
    type: "message",
    role: "assistant",
    model,
    content: [],
    stop_reason: null,
    usage: { input_tokens: 10, output_tokens: 1 },
  },
});
const block = (index: number, content_block: unknown, deltas: unknown[] = []): Event[] => [
  { type: "content_block_start", index, content_block },
  ...deltas.map((delta) => ({ type: "content_block_delta", index, delta })),
  { type: "content_block_stop", index },
];
const text = (index: number, value: string) =>
  block(index, { type: "text", text: "" }, [{ type: "text_delta", text: value }]);
const thinking = (index: number) =>
  block(index, { type: "thinking", thinking: "", signature: "" }, [
    { type: "thinking_delta", thinking: "hmm" },
    { type: "signature_delta", signature: "sig" },
  ]);
const toolUse = (index: number, id: string, input: unknown) =>
  block(index, { type: "tool_use", id, name: "edit_diagram", input: {} }, [
    { type: "input_json_delta", partial_json: JSON.stringify(input) },
  ]);
const reply = (
  blocks: Event[],
  {
    model = "claude-haiku-5-5",
    stop = "end_turn",
    stopDetails = null as unknown,
    usage = { output_tokens: 5 } as unknown,
  } = {}
) =>
  sse([
    start(model),
    ...blocks,
    { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null, stop_details: stopDetails }, usage },
    { type: "message_stop" },
  ]);

type Body = {
  messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
  [k: string]: unknown;
};
// Answers each request with the next scripted reply: an SSE body, or an HTTP status for an error.
function scriptApi(replies: Array<string | number>) {
  const bodies: Body[] = [];
  const headers: Record<string, string>[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string));
    headers.push(Object.fromEntries(new Headers(init.headers).entries()));
    const next = replies[bodies.length - 1];
    if (typeof next === "number") {
      return new Response(
        JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "mock" } }),
        {
          status: next,
          headers: { "content-type": "application/json", "x-should-retry": "false" },
        }
      );
    }
    return new Response(next, { headers: { "content-type": "text/event-stream" } });
  });
  return { bodies, headers };
}
afterEach(() => vi.unstubAllGlobals());

const tool = { name: "edit_diagram", description: "Edit the diagram.", parameters: { type: "object" } };
const newChat = (model = "claude-haiku-5-5") =>
  anthropic.createChat({ apiKey: "sk-ant-test", model, system: "You edit diagrams.", tools: [tool] });
const userTexts = (body: Body) =>
  body.messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.content.filter((b) => b.type === "text").map((b) => b.text));

describe("anthropic chat history", () => {
  // Review pass finding: a re-sent turn streamed its text a second time on top
  // of the first, and the first attempt's tokens were not counted. A stream that
  // breaks off with something other than an API error (here, an event that isn't
  // JSON) is re-sent.
  it("re-sends a turn whose stream broke off, tells the caller, and counts both attempts", async () => {
    const broken =
      sse([start("claude-haiku-5-5"), ...text(0, "Adding it.")]) + "event: content_block_delta\ndata: {not json\n\n";
    scriptApi([broken, reply(text(0, "Adding it."), { usage: { output_tokens: 1000 } })]);
    const streamed: string[] = [];
    let retries = 0;
    const turn = await newChat().send(
      { text: ["add"] },
      {
        onText: (d) => streamed.push(d),
        onRetry: () => {
          retries++;
          streamed.length = 0;
        },
      }
    );
    expect(retries).toBe(1);
    expect(streamed.join("")).toBe("Adding it.");
    expect(turn.text).toBe("Adding it.");
    // 10 input tokens per attempt; 1 output token so far in the first, 1000 in the second.
    expect(turn.usage.input).toBe(20);
    expect(turn.usage.output).toBe(1001);
  });

  it("does not send a failed request again with the next one", async () => {
    const { bodies } = scriptApi([400, reply(text(0, "ok"))]);
    const chat = newChat();
    await expect(chat.send({ text: ["delete everything"] })).rejects.toMatchObject({ kind: "bad_request" });
    await chat.send({ text: ["add a login screen"] });
    expect(userTexts(bodies[1])).toEqual(["add a login screen"]);
  });

  it("keeps the results of a step whose request failed, and sends them with the next request", async () => {
    const { bodies } = scriptApi([
      reply(toolUse(0, "toolu_1", { operations: [] }), { stop: "tool_use" }),
      400,
      reply(text(0, "ok")),
    ]);
    const chat = newChat();
    expect((await chat.send({ text: ["build"] })).status).toBe("tool_use");
    await expect(chat.send({ toolResults: [{ id: "toolu_1", content: '{"ok":true}' }] })).rejects.toMatchObject({
      kind: "bad_request",
    });
    await chat.send({ text: ["next"] });
    expect(bodies[2].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(bodies[2].messages[2].content).toEqual([
      { type: "tool_result", tool_use_id: "toolu_1", is_error: false, content: '{"ok":true}' },
      { type: "text", text: "next" },
    ]);
  });

  it("answers tool calls that never ran as not applied", async () => {
    const { bodies } = scriptApi([
      reply(toolUse(0, "toolu_1", { operations: [] }), { stop: "tool_use" }),
      reply(text(0, "ok")),
    ]);
    const chat = newChat();
    await chat.send({ text: ["build"] });
    await chat.send({ text: ["never mind"] });
    expect(bodies[1].messages.at(-1)!.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_1",
      is_error: true,
    });
  });

  it("drops a refused turn, partial output included", async () => {
    const declined = { type: "refusal", category: "cyber", explanation: "Declined for safety." };
    const { bodies } = scriptApi([
      reply(text(0, "Sure, here"), { stop: "refusal", stopDetails: declined }),
      reply(text(0, "ok")),
    ]);
    const chat = newChat();
    expect(await chat.send({ text: ["bad request"] })).toMatchObject({
      status: "refused",
      refusal: "Declined for safety.",
      toolCalls: [],
    });
    await chat.send({ text: ["something else"] });
    expect(bodies[1].messages).toEqual([{ role: "user", content: [{ type: "text", text: "something else" }] }]);
  });

  it("after a mid-output fallback, neither sends back nor runs what the declining model produced before it", async () => {
    const fallback = { type: "fallback", from: { model: "claude-sonnet-5-5" }, to: { model: "claude-sonnet-5" } };
    const iterations = [
      {
        type: "message",
        model: "claude-sonnet-5-5",
        input_tokens: 1000,
        output_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      {
        type: "fallback_message",
        model: "claude-sonnet-5",
        input_tokens: 1000,
        output_tokens: 200,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    ];
    const { bodies } = scriptApi([
      reply(
        [...thinking(0), ...toolUse(1, "toolu_x", { operations: [] }), ...block(2, fallback), ...text(3, "Done.")],
        {
          model: "claude-sonnet-5-5",
          usage: { output_tokens: 200, iterations },
        }
      ),
      reply(text(0, "ok")),
    ]);
    const chat = newChat("claude-sonnet-5-5");
    const turn = await chat.send({ text: ["build"] });
    expect(turn).toMatchObject({ status: "done", toolCalls: [], text: "Done.", model: "claude-sonnet-5" });
    // Both attempts are billed, each at its own model's rates.
    expect(turn.usage.usd).toBeCloseTo((1000 * 2 + 100 * 10 + 1000 * 2 + 200 * 10) / 1e6, 10);
    await chat.send({ text: ["next"] });
    expect(bodies[1].messages[1].content.map((b) => b.type)).toEqual(["fallback", "text"]);
    expect(bodies[1].messages[2].content.map((b) => b.type)).toEqual(["text"]); // no answer owed for toolu_x
  });
});

describe("anthropic request", () => {
  it("caches tools + system and the conversation, asks for summarized adaptive thinking, and sends the key only in x-api-key", async () => {
    const { bodies, headers } = scriptApi([reply(text(0, "ok"))]);
    await newChat().send({ text: ["hi"] });
    expect(bodies[0]).toMatchObject({
      model: "claude-haiku-5-5",
      system: [{ type: "text", text: "You edit diagrams.", cache_control: { type: "ephemeral" } }],
      cache_control: { type: "ephemeral" },
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium" },
      tool_choice: { type: "auto" },
      tools: [{ name: "edit_diagram", input_schema: { type: "object" }, eager_input_streaming: true }],
    });
    expect(headers[0]["x-api-key"]).toBe("sk-ant-test");
    expect(headers[0]["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(JSON.stringify(bodies[0])).not.toContain("sk-ant-test");
    expect(Object.entries(headers[0]).filter(([k, v]) => k !== "x-api-key" && v.includes("sk-ant"))).toEqual([]);
  });

  it("asks for a refusal fallback on Sonnet and Opus only (Haiku has none)", async () => {
    const { bodies, headers } = scriptApi([reply(text(0, "ok")), reply(text(0, "ok")), reply(text(0, "ok"))]);
    await newChat("claude-haiku-5-5").send({ text: ["hi"] });
    await newChat("claude-sonnet-5-5").send({ text: ["hi"] });
    await newChat("claude-opus-5-5").send({ text: ["hi"] });
    expect(bodies.map((b) => b.fallbacks)).toEqual([undefined, "default", "default"]);
    expect(headers.map((h) => h["anthropic-beta"] ?? null)).toEqual([
      null,
      "server-side-fallback-2026-07-01",
      "server-side-fallback-2026-07-01",
    ]);
  });
});

describe("costOf", () => {
  const usage = (input: number, output: number, cacheWrite: number, cacheRead: number, model?: string) => ({
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: cacheWrite,
    cache_read_input_tokens: cacheRead,
    ...(model ? { model } : {}),
  });

  it("prices each token kind (USD per MTok)", () => {
    expect(costOf(usage(50000, 0, 0, 0), "claude-haiku-5-5").usd).toBeCloseTo(0.005, 10);
    expect(costOf(usage(0, 1e6, 0, 0), "claude-haiku-5-5").usd).toBeCloseTo(0.5);
    expect(costOf(usage(0, 0, 1e6, 0), "claude-sonnet-5-5").usd).toBeCloseTo(2.5);
    // Cache hits on Sonnet 5.5 and Opus 5.5 cost 0.05x the input price.
    expect(costOf(usage(0, 0, 0, 1e6), "claude-sonnet-5-5").usd).toBeCloseTo(0.1);
    expect(costOf(usage(0, 0, 0, 1e6), "claude-opus-5-5").usd).toBeCloseTo(0.2);
    expect(costOf(usage(1000, 100, 2000, 10000), "claude-haiku-5-5")).toEqual({
      input: 1000,
      output: 100,
      cacheWrite: 2000,
      cacheRead: 10000,
      usd: expect.closeTo((1000 * 0.1 + 100 * 0.5 + 2000 * 0.125 + 10000 * 0.01) / 1e6, 12),
    });
  });

  it("uses the Haiku 5.5 rates for prompts over 100K tokens, counting cached tokens", () => {
    expect(costOf(usage(40000, 1000, 0, 60000), "claude-haiku-5-5").usd).toBeCloseTo(
      (40000 * 0.1 + 1000 * 0.5 + 60000 * 0.01) / 1e6,
      12
    );
    expect(costOf(usage(40000, 1000, 0, 60001), "claude-haiku-5-5").usd).toBeCloseTo(
      (40000 * 0.5 + 1000 * 2.5 + 60001 * 0.05) / 1e6,
      12
    );
  });

  it("bills every attempt of a fallback at its own model, and unknown models as the requested one", () => {
    const u = {
      ...usage(1, 1, 0, 0),
      iterations: [usage(1e6, 0, 0, 0, "claude-opus-5-5"), usage(1e6, 0, 0, 0, "claude-opus-4-8")],
    };
    expect(costOf(u, "claude-opus-5-5").usd).toBeCloseTo(4 + 5);
    expect(costOf(usage(1e6, 0, 0, 0, "claude-future"), "claude-opus-5-5").usd).toBeCloseTo(4);
  });
});
