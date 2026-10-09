// Live test against the real provider. Skipped unless AI_LIVE=1 (it spends real
// money, a fraction of a cent with Haiku 5.5):
//   AI_LIVE=1 pnpm exec vitest run tests/unit/ai-live.test.ts
// Reads ANTHROPIC_API_KEY from the environment, or from .env (or the file AI_ENV_FILE names).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runRequest, TOOLS } from '@/lib/ai/agent';
import { applyActions, snapshot } from '@/lib/ai/diagram';
import { layoutIssues, type Screen } from '@/lib/ai/layout';
import { systemPrompt } from '@/lib/ai/prompt';
import { getProvider } from '@/lib/ai/providers';
import { absoluteBoxes } from '@/lib/diagram/groups';
import { isCard, isGroup } from '@/lib/diagram/model';
import { enforceRules } from '@/lib/diagram/rules';
import { createDiagramStore } from '@/lib/diagram/store';

const live = !!process.env.AI_LIVE;
const envFile = process.env.AI_ENV_FILE ?? '.env';
if (live && !process.env.ANTHROPIC_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile);

// The canvas a 1440 x 900 window shows next to the open panel.
const VIEW = { x: 0, y: 0, width: 1500, height: 1150 };

describe.skipIf(!live)('live: anthropic', () => {
  const provider = getProvider('anthropic');
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.AI_MODEL ?? provider.defaultModel;

  it('validates the key', async () => {
    await provider.validateKey({ apiKey, model });
    await expect(provider.validateKey({ apiKey: 'sk-ant-wrong', model })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('builds a flow, then edits it in a follow-up, with prompt caching', { timeout: 240_000 }, async () => {
    const store = createDiagramStore({ initial: { nodes: [], edges: [] }, save: () => true });
    const chat = provider.createChat({ apiKey, model, system: systemPrompt(), tools: TOOLS });
    const editor = {
      read: () => ({ data: store.diagram(), selected: [], view: VIEW }),
      apply: (actions: Parameters<typeof applyActions>[1]) => void store.apply((d) => applyActions(d, actions), { kind: 'ai' }),
    };
    const events: unknown[] = [];
    const onEvent = (e: { type: string }) => e.type !== 'text' && e.type !== 'thinking' && events.push(e);

    const r1 = await runRequest({
      chat,
      editor,
      onEvent,
      text: 'Create a simple checkout flow: product list, product page, cart, checkout, payment, order complete. Connect them in order and group the last three as "Checkout".',
    });
    console.log('turn 1', JSON.stringify(r1), JSON.stringify(events));
    expect(r1.status).toBe('done');
    let d = store.diagram();
    expect(d.nodes.filter(isCard).length).toBeGreaterThanOrEqual(6);
    expect(d.edges.length).toBeGreaterThanOrEqual(5);
    expect(d.nodes.filter(isGroup)).toHaveLength(1);

    const before = d.nodes.filter(isCard).length;
    const r2 = await runRequest({ chat, editor, onEvent, text: 'Add a login screen before the cart and connect it. Rename the cart screen to "My Bag".' });
    d = store.diagram();
    console.log('turn 2', JSON.stringify(r2), JSON.stringify(snapshot({ data: d })));
    expect(r2.status).toBe('done');
    expect(d.nodes.filter(isCard).length).toBe(before + 1);
    expect(d.nodes.some((n) => isCard(n) && n.data.headerText === 'My Bag')).toBe(true);
    // The system prompt + tools (thousands of tokens) were cached on turn 1 and read back on turn 2.
    expect(r2.usage.cacheRead).toBeGreaterThan(2000);
    // The result follows every diagram rule, and no screen is stacked on another or
    // inside a group it is not in.
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0, parents: 0 });
    const boxes = absoluteBoxes(d.nodes);
    const screens = new Map<string, Screen>(
      d.nodes.filter(isCard).map((n) => {
        const b = boxes.get(n.id)!;
        return [n.id, { x: b.x + b.width / 2, y: b.y + b.height / 2, size: [b.width, b.height], parent: n.parentId ?? null }];
      }),
    );
    const groups = new Map(d.nodes.filter(isGroup).map((g) => [g.id, { parent: g.parentId ?? null }]));
    expect([...layoutIssues(screens, groups).values()]).toEqual([]);
    console.log(`total cost $${(r1.usage.usd + r2.usage.usd).toFixed(4)}`);
  });
});
