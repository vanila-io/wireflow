import { existsSync } from 'node:fs';
import process from 'node:process';
import { command, expect, openEditor, saved, test } from './helpers';

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

// --- Mocked API: hand-written SSE, no key, no cost ----------------------------

const sse = (events) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

const usage = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const start = { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, usage } };

function toolTurn(input) {
  const json = JSON.stringify(input);
  const mid = Math.floor(json.length / 2);
  return sse([
    start,
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'edit_diagram', input: {} } },
    // Tool input split across chunks, as the API streams it.
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(0, mid) } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(mid) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 50 } },
    { type: 'message_stop' },
  ]);
}

function textTurn(text) {
  return sse([
    start,
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

const cors = { 'access-control-allow-origin': '*' };

async function mockAnthropic(page, turns) {
  const requests = [];
  await page.route(`${API}/v1/models/**`, (route) =>
    route.fulfill({ headers: cors, json: { id: 'claude-haiku-5-5', type: 'model', display_name: 'Claude Haiku 5.5', created_at: '2026-01-01T00:00:00Z' } }),
  );
  await page.route(`${API}/v1/messages**`, (route) => {
    const req = route.request();
    requests.push({ headers: req.headers(), body: req.postDataJSON() });
    const turn = turns[requests.length - 1];
    if (typeof turn === 'number') return route.fulfill({ status: turn, headers: cors, json: { type: 'error', error: { type: 'error', message: `mock ${turn}` } } });
    route.fulfill({ headers: { ...cors, 'content-type': 'text/event-stream' }, body: turn });
  });
  return requests;
}

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

test('the AI panel and its SDK load only when opened', async ({ page }) => {
  const scripts = [];
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
  await page.goto('/');
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(scripts.some((u) => u.includes('AiPanel'))).toBe(false);
  await page.locator('.ai-toggle').click();
  await expect(panel(page).getByLabel('API key')).toBeVisible();
  expect(scripts.some((u) => u.includes('AiPanel'))).toBe(true);
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
  expect(requests[0].body.messages[0].content.at(-1).text).toMatch(/^<diagram>/);
  // The second request answers the tool call.
  expect(requests[1].body.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' });

  // One undo removes the whole AI change, and that is saved too.
  await command(page, 'undo').click();
  expect((await saved(page)).nodes).toEqual([]);

  // Redo brings back the same ids.
  await command(page, 'redo').click();
  expect((await saved(page)).nodes.map((n) => n.id)).toEqual(['login', 'home', 'profile']);

  // The panel's own Undo works too, and the undone state is what a reload shows.
  await panel(page).getByRole('button', { name: 'Undo' }).click();
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

test.describe('API errors', () => {
  test.use({ allowErrors: [/Failed to load resource/] });

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
    await mockAnthropic(page, [429, 429, 429]);
    await panel(page).getByLabel('API key').fill('sk-ant-ok');
    await panel(page).getByRole('button', { name: /check & use key/i }).click();
    await ask(page, 'hello');
    await expect(panel(page).locator('.ant-alert-error')).toHaveText(/Rate limited/, { timeout: 15_000 });
  });
});

// --- Live API: real key, real model (costs a fraction of a cent) -------------
//   AI_LIVE=1 pnpm test:e2e e2e/ai-chat.spec.js
// Reads ANTHROPIC_API_KEY from the environment or .env.

if (process.env.AI_LIVE && !process.env.ANTHROPIC_API_KEY && existsSync('.env')) process.loadEnvFile('.env');

test.describe('live', () => {
  test.skip(!process.env.AI_LIVE, 'set AI_LIVE=1 to run against the real API');
  test.setTimeout(180_000);

  test('builds and then edits a flow through the real API', async ({ page }) => {
    await openPanel(page, process.env.ANTHROPIC_API_KEY);

    await ask(page, 'Build a sign-up flow: landing page, sign up form, email verification, welcome screen, then the main dashboard. Connect them in order.');
    await expect(panel(page).locator('.ai-applied').first()).toBeVisible({ timeout: 120_000 });
    await expect(panel(page).getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 120_000 });
    let data = await saved(page);
    expect(data.nodes.length).toBeGreaterThanOrEqual(5);
    expect(data.edges.length).toBeGreaterThanOrEqual(4);
    // Every node shows a bundled template image.
    for (const n of data.nodes) expect(n.img).toMatch(/^\/assets\/.+\.svg$/);

    await ask(page, 'Rename the welcome screen to "Hello!" and add a "Forgot password" screen connected from the sign up form.');
    await expect(panel(page).locator('.ai-applied')).toHaveCount(2, { timeout: 120_000 });
    await expect(panel(page).getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 120_000 });
    data = await saved(page);
    expect(data.nodes.some((n) => n.label === 'Hello!')).toBe(true);
    expect(data.nodes.some((n) => /forgot/i.test(n.label))).toBe(true);
    console.log(await panel(page).locator('.ai-messages').innerText());
    console.log(await panel(page).locator('.ai-footer').innerText());
    await page.screenshot({ path: process.env.AI_SCREENSHOT ?? 'test-results/ai-live.png' });
  });
});
