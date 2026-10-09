import { existsSync } from 'node:fs';
import process from 'node:process';
import { layoutIssues } from '../src/ai/layout.js';
import { command, dropTemplate, expect, onCanvas, openEditor, saved, test } from './helpers';

const API = 'https://api.anthropic.com';
const panel = (page) => page.locator('.ai-panel');

async function openPanel(page, key) {
  await openEditor(page);
  await page.locator('.ai-toggle').click();
  await panel(page).getByLabel('API key').fill(key);
  await panel(page).getByRole('button', { name: /check & use key/i }).click();
  await expect(panel(page).getByLabel('Message')).toBeVisible();
}

async function ask(page, text) {
  await panel(page).getByLabel('Message').fill(text);
  await panel(page).getByLabel('Message').press('Enter');
}

// Start the page with this diagram saved, as if the user had built it earlier.
const seed = (page, data) =>
  page.addInitScript((d) => {
    if (localStorage.getItem('data') === null) localStorage.setItem('data', JSON.stringify(d));
  }, data);

// Screens stacked on each other or inside a group they are not in (see src/ai/layout.js).
function layoutProblems({ nodes = [], groups = [] }) {
  const screens = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, size: n.size, parent: n.parent ?? null }]));
  return [...layoutIssues(screens, new Map(groups.map((g) => [g.id, { parent: g.parent ?? null }]))).values()];
}

// --- Mocked API: hand-written SSE, no key, no cost ----------------------------

const sse = (events) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

const start = (inputTokens = 10) => ({
  type: 'message_start',
  message: {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [],
    stop_reason: null,
    usage: { input_tokens: inputTokens, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  },
});

function toolTurn(input, id = 'toolu_1', tokens = { input: 10, output: 50 }) {
  const json = JSON.stringify(input);
  const mid = Math.floor(json.length / 2);
  return sse([
    start(tokens.input),
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name: 'edit_diagram', input: {} } },
    // Tool input split across chunks, as the API streams it.
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(0, mid) } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(mid) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: tokens.output } },
    { type: 'message_stop' },
  ]);
}

function textTurn(text) {
  return sse([
    start(),
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

const cors = { 'access-control-allow-origin': '*' };

// Each request to /v1/messages gets the next turn: an SSE body, or a number for an
// HTTP error. `slow` holds back the reply to the request with that index (0-based).
async function mockAnthropic(page, turns, { slow } = {}) {
  const requests = [];
  await page.route(`${API}/v1/models/**`, (route) =>
    route.fulfill({ headers: cors, json: { id: 'claude-haiku-5-5', type: 'model', display_name: 'Claude Haiku 5.5', created_at: '2026-01-01T00:00:00Z' } }),
  );
  await page.route(`${API}/v1/messages**`, async (route) => {
    const req = route.request();
    requests.push({ headers: req.headers(), body: req.postDataJSON() });
    const index = requests.length - 1;
    const turn = turns[index];
    if (index === slow) await new Promise((resolve) => setTimeout(resolve, 3000));
    // The SDK retries 429s; make its backoff 1 ms.
    const reply =
      typeof turn === 'number'
        ? { status: turn, headers: { ...cors, 'retry-after-ms': '1' }, json: { type: 'error', error: { type: 'error', message: `mock ${turn}` } } }
        : { headers: { ...cors, 'content-type': 'text/event-stream' }, body: turn };
    await route.fulfill(reply).catch(() => {}); // the request may have been stopped meanwhile
  });
  return requests;
}

const userTexts = (body) => body.messages.filter((m) => m.role === 'user').flatMap((m) => m.content.filter((b) => b.type === 'text').map((b) => b.text));

const flow = {
  summary: 'Added a login flow.',
  operations: [
    { op: 'add_screen', id: 'login', template: 'sign-in-1', label: 'Login', x: 150, y: 200 },
    { op: 'add_screen', id: 'home', template: 'header-1', label: 'Home', x: 330, y: 200 },
    { op: 'add_screen', id: 'profile', template: 'profile-1', label: 'Profile', x: 510, y: 200 },
    { op: 'connect', id: 'c1', from: 'login', to: 'home', label: 'Sign in' },
    { op: 'connect', id: 'c2', from: 'home', to: 'profile' },
    { op: 'group', id: 'app', label: 'App', members: ['home', 'profile'] },
  ],
};

test('the AI panel and its SDK load only when opened, from a button in the canvas corner', async ({ page }) => {
  const scripts = [];
  page.on('response', (r) => r.request().resourceType() === 'script' && scripts.push(r));
  const sdkLoaded = async () => (await Promise.all(scripts.map((r) => r.text()))).some((js) => js.includes('anthropic-dangerous-direct-browser-access'));

  await openEditor(page);
  expect(await sdkLoaded()).toBe(false);

  // Bottom-right corner of the canvas column, not under the details column.
  const canvas = await page.locator('#canvas_1').boundingBox();
  const button = await page.locator('.ai-toggle').boundingBox();
  expect(Math.abs(canvas.x + canvas.width - (button.x + button.width) - 24)).toBeLessThan(2);
  expect(Math.abs(page.viewportSize().height - (button.y + button.height) - 24)).toBeLessThan(2);

  await page.locator('.ai-toggle').click();
  await expect(panel(page).getByLabel('API key')).toBeVisible();
  expect(await sdkLoaded()).toBe(true);
});

test('a mocked AI reply edits the diagram as one undo step that survives reload', async ({ page }) => {
  const requests = await mockAnthropic(page, [toolTurn(flow), textTurn('Added a login flow.')]);
  await openPanel(page, 'sk-ant-test-key');

  await ask(page, 'Add a login flow');
  await expect(panel(page).locator('.ai-applied')).toHaveText(/Added a login flow/);
  await expect(panel(page).locator('.ai-text')).toHaveText('Added a login flow.');

  let data = await saved(page);
  expect(data.nodes.map((n) => [n.id, n.label, n.shape, n.parent ?? null])).toEqual([
    ['login', 'Login', 'node-image-header', null],
    ['home', 'Home', 'node-image-header', 'app'],
    ['profile', 'Profile', 'node-image-header', 'app'],
  ]);
  expect(data.edges.map((e) => [e.source, e.target, e.label ?? ''])).toEqual([['login', 'home', 'Sign in'], ['home', 'profile', '']]);
  expect(data.groups.map((g) => g.label)).toEqual(['App']);

  // The key goes only in x-api-key, to Anthropic, with the browser opt-in header.
  expect(requests[0].headers['x-api-key']).toBe('sk-ant-test-key');
  expect(requests[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(requests[0].body.model).toBe('claude-haiku-5-5');
  // The diagram travels with the request, with the part of the canvas the user can see.
  const diagram = JSON.parse(/^<diagram>(.*)<\/diagram>$/.exec(requests[0].body.messages[0].content.at(-1).text)[1]);
  expect(diagram).toMatchObject({ selected: [], screens: [], view: { x: 0, y: 0 } });
  const canvas = await page.locator('#canvas_1').boundingBox();
  const drawer = await panel(page).locator('.ant-drawer-content-wrapper').boundingBox();
  expect(diagram.view.width).toBe(Math.round(drawer.x - canvas.x));
  // The second request answers the tool call.
  expect(requests[1].body.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' });

  // One undo removes the whole AI change, and that is saved too.
  await command(page, 'undo').click();
  expect((await saved(page)).nodes).toEqual([]);
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Undone:/);

  // Redo brings back the same ids, groups included.
  await command(page, 'redo').click();
  data = await saved(page);
  expect(data.nodes.map((n) => [n.id, n.parent ?? null])).toEqual([['login', null], ['home', 'app'], ['profile', 'app']]);
  expect(data.groups.map((g) => g.id)).toEqual(['app']);
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Applied:/);

  // The panel's own Undo works too, and the undone state is what a reload shows.
  await panel(page).getByRole('button', { name: 'Undo: Added a login flow.' }).click();
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Undone:/);
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect((await saved(page)).nodes).toEqual([]);
});

test('an invalid batch is reported back to the model and nothing is applied', async ({ page }) => {
  const bad = { summary: 'x', operations: [{ op: 'add_screen', id: 'a', template: 'no-such-template', label: 'A' }] };
  const requests = await mockAnthropic(page, [toolTurn(bad), textTurn('Sorry, that template does not exist.')]);
  await openPanel(page, 'sk-ant-test-key');
  await ask(page, 'Add something');
  await expect(panel(page).locator('.ai-text')).toHaveText(/Sorry/);
  await expect(panel(page).locator('.ai-applied')).toHaveCount(0);
  const result = requests[1].body.messages.at(-1).content[0];
  expect(result.is_error).toBe(true);
  expect(JSON.parse(result.content).errors[0].message).toMatch(/unknown template/);
  expect((await saved(page))?.nodes ?? []).toEqual([]);
});

test('the panel offers Undo only while the AI change is the latest one', async ({ page }) => {
  await mockAnthropic(page, [toolTurn({ summary: 'Added A.', operations: [{ op: 'add_screen', id: 'a', template: 'cart', label: 'A', x: 300, y: 300 }] }), textTurn('Done.')]);
  await openPanel(page, 'sk-ant-test-key');
  await ask(page, 'add a');
  const undo = panel(page).getByRole('button', { name: 'Undo: Added A.' });
  await expect(undo).toBeVisible();

  // A change by the user comes after it: undoing from the panel would undo that too.
  await dropTemplate(page, 0, await onCanvas(page, 150, 550));
  await expect.poll(async () => (await saved(page)).nodes.length).toBe(2);
  await expect(undo).toHaveCount(0);
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Applied: Added A\./);

  await command(page, 'undo').click();
  await undo.click();
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Undone:/);
  expect((await saved(page)).nodes).toEqual([]);
});

test('after Open file replaces the diagram, earlier AI changes show as replaced, not undone', async ({ page }) => {
  await mockAnthropic(page, [toolTurn({ summary: 'Added A.', operations: [{ op: 'add_screen', id: 'a', template: 'cart', label: 'A', x: 300, y: 300 }] }), textTurn('Done.')]);
  await openPanel(page, 'sk-ant-test-key');
  await ask(page, 'add a');
  await expect(panel(page).getByRole('button', { name: 'Undo: Added A.' })).toBeVisible();

  const file = { format: 'wireflow', version: 1, diagram: { nodes: [{ type: 'node', size: [96, 88], shape: 'node-image-header', label: 'Checkout', template: 'E-Commerce/Checkout', x: 500, y: 450, id: 'c0ffee01' }], edges: [], groups: [] } };
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open file' }).click();
  await (await choosing).setFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.locator('.ant-modal-confirm').getByRole('button', { name: 'Replace' }).click();

  await expect.poll(async () => (await saved(page)).nodes.map((n) => n.id)).toEqual(['c0ffee01']);
  await expect(panel(page).locator('.ai-applied')).toHaveText(/^Replaced by an opened file: Added A\./);
  await expect(panel(page).getByRole('button', { name: /^Undo/ })).toHaveCount(0);
});

test('redoing an AI change that clears the diagram is saved', async ({ page }) => {
  await seed(page, { nodes: [{ id: 'n1', type: 'node', shape: 'node-image-header', size: [96, 88], label: 'Kept', x: 200, y: 200 }], edges: [], groups: [] });
  await mockAnthropic(page, [toolTurn({ summary: 'Cleared.', operations: [{ op: 'clear' }] }), textTurn('Cleared.')]);
  await openPanel(page, 'sk-ant-test-key');
  await ask(page, 'start over');
  await expect(panel(page).locator('.ai-applied')).toHaveText(/Cleared/);
  expect((await saved(page)).nodes).toEqual([]);

  await command(page, 'undo').click();
  expect((await saved(page)).nodes.map((n) => n.id)).toEqual(['n1']);
  await command(page, 'redo').click();
  expect((await saved(page)).nodes).toEqual([]);
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect((await saved(page)).nodes).toEqual([]);
});

test('a layout that hides a screen behind a group is applied with warnings for the model to fix', async ({ page }) => {
  const add = (id, template, x, y) => ({ op: 'add_screen', id, template, label: id, x, y });
  // As Haiku 5.5 laid out a store flow: wrapped onto a second row, with "signin" inside the group's box.
  const store = {
    summary: 'Built a store flow.',
    operations: [
      add('cart', 'cart', 480, 180),
      add('signin', 'sign-in-2', 660, 180),
      add('checkout', 'checkout', 840, 180),
      add('payment', 'paypal', 840, 400),
      add('done', 'complete', 660, 400),
      { op: 'connect', id: 'c1', from: 'cart', to: 'signin' },
      { op: 'connect', id: 'c2', from: 'signin', to: 'checkout' },
      { op: 'connect', id: 'c3', from: 'checkout', to: 'payment' },
      { op: 'connect', id: 'c4', from: 'payment', to: 'done' },
      { op: 'group', id: 'pay', label: 'Payment', members: ['checkout', 'payment', 'done'] },
    ],
  };
  const fix = { summary: 'Moved Sign in out of the Payment group.', operations: [{ op: 'update_screen', id: 'signin', x: 480, y: 400 }] };
  const requests = await mockAnthropic(page, [toolTurn(store), toolTurn(fix, 'toolu_2'), textTurn('Done.')]);
  await openPanel(page, 'sk-ant-test-key');
  await ask(page, 'Build a store checkout flow');
  await expect(panel(page).locator('.ai-text')).toHaveText('Done.');

  const first = JSON.parse(requests[1].body.messages.at(-1).content[0].content);
  expect(first).toMatchObject({ ok: true, applied: 10 });
  expect(first.warnings).toEqual([expect.stringMatching(/^screen "signin" is not in group "pay" but lies inside its box/)]);
  const second = JSON.parse(requests[2].body.messages.at(-1).content[0].content);
  expect(second).toEqual({ ok: true, applied: 1 });
  const data = await saved(page);
  expect(layoutProblems(data)).toEqual([]);
  // Its arrows now leave and enter on the sides that face each other.
  expect(data.edges.filter((e) => e.source === 'signin' || e.target === 'signin').map((e) => [e.id, e.sourceAnchor, e.targetAnchor])).toEqual([
    ['c1', 2, 0],
    ['c2', 1, 3],
  ]);
});

test('Ctrl+H and Ctrl+K typed in the AI panel leave the selected node alone', async ({ page }) => {
  await mockAnthropic(page, []);
  await openEditor(page);
  const at = await onCanvas(page, 300, 300);
  await dropTemplate(page, 0, at);
  await page.mouse.click(at.x, at.y);
  await page.locator('.ai-toggle').click();
  await panel(page).getByLabel('API key').fill('sk-ant-test-key');
  await panel(page).getByRole('button', { name: /check & use key/i }).click();
  const header = async () => (await saved(page)).nodes[0].shape;

  await panel(page).getByLabel('Message').press('Control+h');
  expect(await header()).toBe('node-image-header');

  // On the canvas the shortcut still works; then Ctrl+K in the panel must not undo it.
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press('Control+h');
  await expect.poll(header).toBe('node-image-without-header');
  await panel(page).getByLabel('Message').press('Control+k');
  expect(await header()).toBe('node-image-without-header');
});

test.describe('when requests fail', () => {
  // Chromium logs every failed or refused request as a console error.
  test.use({ allowErrors: [/Failed to load resource/] });

  test('if the panel cannot be loaded, the editor keeps working and a later click retries', async ({ page }) => {
    await page.route('**/assets/AiPanel-*.js', (route) => route.abort());
    await openEditor(page);
    await page.locator('.ai-toggle').click();
    await expect(page.locator('.ai-toggle')).toHaveAttribute('aria-label', /Couldn't load the AI assistant/);
    await expect(page.locator('#canvas_1')).toBeVisible();
    await expect(page.locator('.toolbar .command')).toHaveCount(14);

    await page.unroute('**/assets/AiPanel-*.js');
    await page.locator('.ai-toggle').click();
    await expect(panel(page).getByLabel('API key')).toBeVisible();
    await expect(page.locator('.ai-toggle')).toHaveAttribute('aria-label', 'AI assistant');
  });

  test('a stopped or failed request is not sent again with the next one', async ({ page }) => {
    const requests = await mockAnthropic(page, [textTurn('slow'), 400, textTurn('Added.')], { slow: 0 });
    await openPanel(page, 'sk-ant-test-key');

    await ask(page, 'Delete every screen');
    await panel(page).getByRole('button', { name: 'Stop' }).click();
    await expect(panel(page).locator('.ai-messages').getByText('Stopped.')).toBeVisible();
    await ask(page, 'Rename everything to X');
    await expect(panel(page).locator('.ant-alert-error')).toHaveText(/mock 400/);

    await ask(page, 'Add a login screen');
    await expect(panel(page).locator('.ai-text').last()).toHaveText('Added.');
    expect(userTexts(requests[2].body).filter((t) => !t.startsWith('<diagram>'))).toEqual(['Add a login screen']);
  });

  test('the session cost includes steps that finished before a later step failed', async ({ page }) => {
    const one = { summary: 'Added A.', operations: [{ op: 'add_screen', id: 'a', template: 'cart', label: 'A', x: 300, y: 300 }] };
    // 20,000 input + 2,000 output tokens on Haiku 5.5 ($0.10 / $0.50 per MTok) = $0.0030.
    await mockAnthropic(page, [toolTurn(one, 'toolu_1', { input: 20000, output: 2000 }), 400]);
    await openPanel(page, 'sk-ant-test-key');
    await ask(page, 'add a');
    await expect(panel(page).locator('.ant-alert-error')).toBeVisible();
    await expect(panel(page).locator('.ai-cost')).toHaveText('$0.0030');
    await expect(panel(page).locator('.ai-footer')).toContainText('$0.0030 this session');
    expect((await saved(page)).nodes.map((n) => n.id)).toEqual(['a']);
  });

  test('a rejected key and a rate limit show a clear message', async ({ page }) => {
    await page.route(`${API}/v1/models/**`, (route) =>
      route.fulfill({ status: 401, headers: cors, json: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }),
    );
    await page.goto('/');
    await page.locator('.ai-toggle').click();
    await panel(page).getByLabel('API key').fill('sk-ant-bad');
    await panel(page).getByRole('button', { name: /check & use key/i }).click();
    await expect(panel(page).locator('.ant-alert-error')).toHaveText(/rejected this key/);

    await page.unroute(`${API}/v1/models/**`);
    const requests = await mockAnthropic(page, [429, 429, 429]);
    await panel(page).getByLabel('API key').fill('sk-ant-ok');
    await panel(page).getByRole('button', { name: /check & use key/i }).click();
    await ask(page, 'hello');
    await expect(panel(page).locator('.ant-alert-error')).toHaveText(/Rate limited/);
    expect(requests).toHaveLength(3); // the SDK retried twice
  });
});

// --- Live API: real key, real model (costs a fraction of a cent) -------------
//   AI_LIVE=1 pnpm test:e2e e2e/ai-chat.spec.js -g live
// Reads ANTHROPIC_API_KEY from the environment or .env.

if (process.env.AI_LIVE && !process.env.ANTHROPIC_API_KEY && existsSync('.env')) process.loadEnvFile('.env');

test.describe('live', () => {
  test.skip(!process.env.AI_LIVE, 'set AI_LIVE=1 to run against the real API');
  test.setTimeout(180_000);

  test('builds and then edits a flow through the real API, with no hidden screens', async ({ page }) => {
    await openPanel(page, process.env.ANTHROPIC_API_KEY);

    // This request once produced a group box hiding the "Sign in" screen.
    await ask(page, 'Build an online store checkout flow: product list, product page, cart, sign in, checkout, payment, order confirmation. Connect them in order and group the last three as "Payment".');
    await expect(panel(page).locator('.ai-applied').first()).toBeVisible({ timeout: 120_000 });
    await expect(panel(page).getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 120_000 });
    let data = await saved(page);
    expect(data.nodes.length).toBeGreaterThanOrEqual(7);
    expect(data.edges.length).toBeGreaterThanOrEqual(6);
    expect(data.groups.map((g) => g.label)).toEqual(['Payment']);
    // Every node shows a bundled template image.
    for (const n of data.nodes) expect(n.img).toMatch(/^\/assets\/.+\.svg$/);
    expect(layoutProblems(data)).toEqual([]);

    const applied = await panel(page).locator('.ai-applied').count();
    await ask(page, 'Rename the cart screen to "My Bag" and add a "Forgot password" screen below sign in, connected from it.');
    await expect(panel(page).locator('.ai-applied')).toHaveCount(applied + 1, { timeout: 120_000 });
    await expect(panel(page).getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 120_000 });
    data = await saved(page);
    expect(data.nodes.some((n) => n.label === 'My Bag')).toBe(true);
    expect(data.nodes.some((n) => /forgot/i.test(n.label))).toBe(true);
    expect(layoutProblems(data)).toEqual([]);
    console.log(await panel(page).locator('.ai-messages').innerText());
    console.log(await panel(page).locator('.ai-footer span').first().innerText()); // the cost, not the masked key
    await page.screenshot({ path: process.env.AI_SCREENSHOT ?? 'test-results/ai-live.png' });
  });
});
