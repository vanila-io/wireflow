// Live test against the real provider. Skipped unless AI_LIVE=1 (it spends real
// money, a fraction of a cent with Haiku 5.5):
//   AI_LIVE=1 npx vitest run tests/unit/ai-live.test.ts
// Reads ANTHROPIC_API_KEY from the environment, or from .env (or the file
// AI_ENV_FILE names). The key is never printed. AI_LIVE_REPORT=<file> appends
// each run's token usage and cost to that file.
import { appendFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runRequest, TOOLS } from "@/lib/ai/agent";
import { applyActions, snapshot } from "@/lib/ai/diagram";
import { layoutIssues, type Screen } from "@/lib/ai/layout";
import { systemPrompt } from "@/lib/ai/prompt";
import { getProvider } from "@/lib/ai/providers";
import { cardSize } from "@/lib/diagram/model";
import { enforceRules } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";

const live = !!process.env.AI_LIVE;
const envFile = process.env.AI_ENV_FILE ?? ".env";
if (live && !process.env.ANTHROPIC_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile);

// The canvas a 1440 x 900 window shows next to the open panel.
const VIEW = { x: 0, y: 0, width: 1500, height: 1150 };

describe.skipIf(!live)("live: anthropic", () => {
  const provider = getProvider("anthropic");
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.AI_MODEL ?? provider.defaultModel;

  it("validates the key", async () => {
    await provider.validateKey({ apiKey, model });
    await expect(provider.validateKey({ apiKey: "sk-ant-wrong", model })).rejects.toMatchObject({ kind: "auth" });
  });

  it("builds a flow, then edits it in a follow-up, with prompt caching", { timeout: 240_000 }, async () => {
    const store = createDiagramStore({ initial: { nodes: [], edges: [] }, save: () => true });
    const chat = provider.createChat({ apiKey, model, system: systemPrompt(), tools: TOOLS });
    const editor = {
      read: () => ({ data: store.diagram(), selected: [], view: VIEW }),
      apply: (actions: Parameters<typeof applyActions>[1]) =>
        void store.apply((d) => applyActions(d, actions), { kind: "ai" }),
    };
    const events: unknown[] = [];
    const onEvent = (e: { type: string }) => e.type !== "text" && e.type !== "thinking" && events.push(e);

    const r1 = await runRequest({
      chat,
      editor,
      onEvent,
      text: "Create a simple checkout flow: product list, product page, cart, checkout, payment, order complete. Connect them in order.",
    });
    console.log("turn 1", JSON.stringify(r1), JSON.stringify(events));
    expect(r1.status).toBe("done");
    let d = store.diagram();
    expect(d.nodes.length).toBeGreaterThanOrEqual(6);
    expect(d.edges.length).toBeGreaterThanOrEqual(5);

    const before = d.nodes.length;
    const r2 = await runRequest({
      chat,
      editor,
      onEvent,
      text: 'Add a login screen before the cart and connect it. Rename the cart screen to "My Bag".',
    });
    d = store.diagram();
    console.log("turn 2", JSON.stringify(r2), JSON.stringify(snapshot({ data: d })));
    expect(r2.status).toBe("done");
    expect(d.nodes.length).toBe(before + 1);
    expect(d.nodes.some((n) => n.data.headerText === "My Bag")).toBe(true);
    // The system prompt + tools (thousands of tokens) were cached on turn 1 and read back on turn 2.
    expect(r2.usage.cacheRead).toBeGreaterThan(2000);
    // The result follows every diagram rule, and no screen is stacked on another.
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0 });
    const screens = new Map<string, Screen>(
      d.nodes.map((n) => {
        const { width, height } = cardSize(n.data);
        return [n.id, { x: n.position.x + width / 2, y: n.position.y + height / 2, size: [width, height] }];
      })
    );
    expect([...layoutIssues(screens).values()]).toEqual([]);
    const report = { model, turn1: r1.usage, turn2: r2.usage, usd: r1.usage.usd + r2.usage.usd };
    console.log(`total cost $${report.usd.toFixed(4)}`);
    if (process.env.AI_LIVE_REPORT) appendFileSync(process.env.AI_LIVE_REPORT, `${JSON.stringify(report)}\n`);
  });
});
