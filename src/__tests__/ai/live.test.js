// Live test against a real provider. Skipped unless AI_LIVE=1 (it spends real money).
//   AI_LIVE=1 pnpm vitest run src/__tests__/ai/live.test.js
// Reads ANTHROPIC_API_KEY from the environment or from .env.
import { existsSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { getProvider } from '../../ai/providers';
import { runRequest, TOOLS } from '../../ai/agent';
import { normalize, snapshot } from '../../ai/diagram';
import { systemPrompt } from '../../ai/prompt';

const live = !!process.env.AI_LIVE;
if (live && !process.env.ANTHROPIC_API_KEY && existsSync('.env')) process.loadEnvFile('.env');

// Applies planned actions to plain data the way gg-editor would.
function memoryEditor(initial = {}) {
  let data = structuredClone(normalize(initial));
  const all = () => [...data.nodes, ...data.edges, ...data.groups];
  const removeId = (id) => {
    const group = data.groups.find((g) => g.id === id);
    data.nodes = data.nodes.filter((n) => n.id !== id);
    data.edges = data.edges.filter((e) => e.id !== id && e.source !== id && e.target !== id);
    data.groups = data.groups.filter((g) => g.id !== id);
    if (group) [...data.nodes, ...data.groups].filter((x) => x.parent === id).forEach((x) => removeId(x.id));
    data.edges = data.edges.filter((e) => data.nodes.some((n) => n.id === e.source) && data.nodes.some((n) => n.id === e.target));
  };
  return {
    read: () => ({ data: structuredClone(data), selected: [] }),
    snapshot,
    apply(actions) {
      for (const a of actions) {
        if (a.kind === 'clear') data = normalize({});
        if (a.kind === 'add') (a.type === 'node' ? data.nodes : data.edges).push({ ...a.model });
        if (a.kind === 'update') Object.assign(all().find((x) => x.id === a.id), a.model);
        if (a.kind === 'remove') removeId(a.id);
        if (a.kind === 'group') {
          const parent = all().find((x) => x.id === a.members[0]).parent;
          data.groups.push({ id: a.id, label: a.label, ...(parent ? { parent } : {}) });
          a.members.forEach((m) => (all().find((x) => x.id === m).parent = a.id));
        }
        if (a.kind === 'ungroup') {
          const { parent } = data.groups.find((g) => g.id === a.id);
          all().filter((x) => x.parent === a.id).forEach((x) => (parent ? (x.parent = parent) : delete x.parent));
          data.groups = data.groups.filter((g) => g.id !== a.id);
        }
      }
      return data;
    },
    get data() {
      return data;
    },
  };
}

describe.skipIf(!live)('live: anthropic', () => {
  const provider = getProvider('anthropic');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL ?? provider.defaultModel;

  it('validates the key', async () => {
    await provider.validateKey({ apiKey, model });
    await expect(provider.validateKey({ apiKey: 'sk-ant-wrong', model })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('builds a flow, then edits it in a follow-up, with prompt caching', { timeout: 180_000 }, async () => {
    const chat = provider.createChat({ apiKey, model, system: systemPrompt(), tools: TOOLS });
    const editor = memoryEditor();
    const events = [];
    const onEvent = (e) => e.type !== 'text' && e.type !== 'thinking' && events.push(e);

    const r1 = await runRequest({
      chat,
      editor,
      onEvent,
      text: 'Create a simple checkout flow: product list, product page, cart, checkout, payment with PayPal, order complete. Connect them in order and group the last three as "Checkout".',
    });
    console.log('turn 1', r1, events);
    expect(r1.status).toBe('done');
    expect(editor.data.nodes.length).toBeGreaterThanOrEqual(6);
    expect(editor.data.edges.length).toBeGreaterThanOrEqual(5);
    expect(editor.data.groups.length).toBe(1);
    editor.data.nodes.forEach((n) => expect(n.img).toMatch(/\.svg$/));

    const before = editor.data.nodes.length;
    const r2 = await runRequest({ chat, editor, onEvent, text: 'Add a login screen before the cart and connect it. Rename the cart screen to "My Bag".' });
    console.log('turn 2', r2, JSON.stringify(snapshot(editor.data)));
    expect(r2.status).toBe('done');
    expect(editor.data.nodes.length).toBe(before + 1);
    expect(editor.data.nodes.some((n) => n.label === 'My Bag')).toBe(true);
    // The system prompt + tools (thousands of tokens) were cached on turn 1 and read back on turn 2.
    expect(r2.usage.cacheRead).toBeGreaterThan(2000);
    console.log(`total cost $${(r1.usage.usd + r2.usage.usd).toFixed(4)}`);
  });
});
