// The AI panel against a mocked api.anthropic.com (hand-written SSE: no key, no
// cost). Ported from #105's e2e/ai-chat.spec.js via #113.
import type { Page } from "@playwright/test";
import { test, expect, openEditor, saved, seed, STORAGE_KEY, tiles } from "./fixtures";

const API = "https://api.anthropic.com";
const panel = (page: Page) => page.getByRole("complementary", { name: "AI assistant" });
const aiButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: /AI assistant|Couldn't load/ });

async function openPanel(page: Page, key = "sk-ant-test-key") {
  await openEditor(page);
  await aiButton(page).click();
  await panel(page).getByLabel("API key").fill(key);
  await panel(page).getByRole("button", { name: "Check & use key" }).click();
  await expect(panel(page).getByLabel("Message")).toBeVisible();
}

async function ask(page: Page, text: string) {
  await panel(page).getByLabel("Message").fill(text);
  await panel(page).getByLabel("Message").press("Enter");
}

type Ev = Record<string, unknown> & { type: string };
const sse = (events: Ev[]) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
const start = (inputTokens = 10): Ev => ({
  type: "message_start",
  message: {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [],
    stop_reason: null,
    usage: { input_tokens: inputTokens, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  },
});

function toolTurn(input: unknown, id = "toolu_1", tokens = { input: 10, output: 50 }) {
  const json = JSON.stringify(input);
  const mid = Math.floor(json.length / 2);
  return sse([
    start(tokens.input),
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id, name: "edit_diagram", input: {} } },
    // Tool input split across chunks, as the API streams it.
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: json.slice(0, mid) } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: json.slice(mid) } },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: "tool_use", stop_sequence: null },
      usage: { output_tokens: tokens.output },
    },
    { type: "message_stop" },
  ]);
}

function textTurn(text: string) {
  return sse([
    start(),
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: "message_stop" },
  ]);
}

const cors = { "access-control-allow-origin": "*" };
type Req = {
  headers: Record<string, string>;
  body: { messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }> };
};

// Each request to /v1/messages gets the next turn: an SSE body, or a number for
// an HTTP error. `slow` holds back the reply to the request with that index.
async function mockAnthropic(page: Page, turns: Array<string | number>, { slow }: { slow?: number } = {}) {
  const requests: Req[] = [];
  await page.route(`${API}/v1/models/**`, (route) =>
    route.fulfill({
      headers: cors,
      json: {
        id: "claude-haiku-5-5",
        type: "model",
        display_name: "Claude Haiku 5.5",
        created_at: "2026-01-01T00:00:00Z",
      },
    })
  );
  await page.route(`${API}/v1/messages**`, async (route) => {
    const req = route.request();
    requests.push({ headers: req.headers(), body: req.postDataJSON() });
    const index = requests.length - 1;
    const turn = turns[index];
    if (index === slow) await new Promise((resolve) => setTimeout(resolve, 3000));
    // The SDK retries 429s; make its backoff 1 ms.
    const reply =
      typeof turn === "number"
        ? {
            status: turn,
            headers: { ...cors, "retry-after-ms": "1" },
            json: { type: "error", error: { type: "error", message: `mock ${turn}` } },
          }
        : { headers: { ...cors, "content-type": "text/event-stream" }, body: turn };
    await route.fulfill(reply).catch(() => {}); // the request may have been stopped meanwhile
  });
  return requests;
}

const userTexts = (r: Req) =>
  r.body.messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.content.filter((b) => b.type === "text").map((b) => b.text!));

const flow = {
  summary: "Added a login flow.",
  operations: [
    { op: "add_screen", id: "login", template: "sign-in-sign-in-1", label: "Login", x: 200, y: 200 },
    { op: "add_screen", id: "home", template: "header-header-1", label: "Home", x: 500, y: 200 },
    { op: "add_screen", id: "profile", template: "socials-profile-1", label: "Profile", x: 800, y: 200 },
    { op: "connect", id: "c1", from: "login", to: "home", label: "Sign in" },
    { op: "connect", id: "c2", from: "home", to: "profile" },
  ],
};

test("the AI panel and its SDK load only when opened", async ({ page }) => {
  const scripts: Array<import("@playwright/test").Response> = [];
  page.on("response", (r) => r.request().resourceType() === "script" && scripts.push(r));
  const sdkLoaded = async () =>
    (await Promise.all(scripts.map((r) => r.text().catch(() => "")))).some((js) =>
      js.includes("anthropic-dangerous-direct-browser-access")
    );

  await openEditor(page);
  expect(await sdkLoaded()).toBe(false);
  await aiButton(page).click();
  await expect(panel(page).getByLabel("API key")).toBeVisible();
  await expect(panel(page)).toContainText("stored unencrypted");
  expect(await sdkLoaded()).toBe(true);
  // Closing keeps the panel (and a chat) around; the button reopens it.
  await panel(page).getByRole("button", { name: "Close the AI assistant" }).click();
  await expect(panel(page)).toBeHidden();
  await aiButton(page).click();
  await expect(panel(page)).toBeVisible();
});

test("a mocked AI reply edits the diagram as one undo step that survives a reload", async ({ page }) => {
  const requests = await mockAnthropic(page, [toolTurn(flow), textTurn("Added a login flow.")]);
  await openPanel(page);
  await ask(page, "Add a login flow");
  await expect(panel(page).getByText("Added a login flow.", { exact: true })).toBeVisible();
  await expect(panel(page).locator('[data-state="latest"]')).toContainText("Applied: Added a login flow.");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".flow-node-header").getByText("Profile", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);

  // The request carried the key only in x-api-key, and the diagram with the visible area.
  expect(requests[0].headers["x-api-key"]).toBe("sk-ant-test-key");
  const firstUser = userTexts(requests[0]);
  expect(firstUser[0]).toBe("Add a login flow");
  const snap = JSON.parse(firstUser[1].replace(/^<diagram>|<\/diagram>$/g, ""));
  expect(snap.view.width).toBeGreaterThan(100);
  // The tool result went back with the next request.
  expect(JSON.stringify(requests[1].body)).toContain('"tool_use_id":"toolu_1"');

  const data = (await saved(page))!;
  expect(data.nodes.map((n) => n.id).sort()).toEqual(["home", "login", "profile"]);

  // One undo removes the whole change, and the panel says so.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(panel(page).locator('[data-state="undone"]')).toContainText("Undone: Added a login flow.");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

// Review pass finding: a step that is re-sent showed its streamed text twice.
test.describe("a stream that breaks off", () => {
  // The SDK logs the event it couldn't parse.
  test.use({ allowErrors: /Could not parse message into JSON|From chunk/ });

  test("is re-sent, and the reply shows its text once", async ({ page }) => {
    const broken =
      sse([
        start(),
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Here is the flow." } },
      ]) + "event: content_block_delta\ndata: {not json\n\n";
    const requests = await mockAnthropic(page, [broken, textTurn("Here is the flow.")]);
    await openPanel(page);
    await ask(page, "hi");
    await expect(panel(page).locator('.ai-msg[data-status="done"]')).toBeVisible();
    expect(requests).toHaveLength(2);
    await expect(panel(page).locator(".ai-msg").getByText("Here is the flow.", { exact: true })).toBeVisible();
  });
});

test("model output is shown as plain text, never as markup", async ({ page }) => {
  const reply = '<b>bold</b> <img src="x" onerror="window.__xss = 1"> [link](javascript:alert(1))';
  await mockAnthropic(page, [textTurn(reply)]);
  await openPanel(page);
  await ask(page, "say something");
  await expect(panel(page).locator(".ai-msg").getByText(reply, { exact: true })).toBeVisible();
  await expect(panel(page).locator(".ai-msg b, .ai-msg img, .ai-msg a")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("an invalid batch is reported back to the model and nothing is applied", async ({ page }) => {
  const badBatch = { summary: "x", operations: [{ op: "connect", id: "c", from: "nope", to: "nada" }] };
  const requests = await mockAnthropic(page, [toolTurn(badBatch), textTurn("Sorry.")]);
  await openPanel(page);
  await ask(page, "connect things");
  await expect(panel(page).locator(".ai-msg").getByText("Sorry.")).toBeVisible();
  const result = requests[1].body.messages.at(-1)!.content.find((b) => b.type === "tool_result") as unknown as {
    is_error: boolean;
    content: string;
  };
  expect(result.is_error).toBe(true);
  expect(JSON.parse(result.content).errors).toEqual([{ index: 0, op: "connect", message: 'no screen or note "nope"' }]);
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
});

// Review pass finding: a panel closed during a request reported a visible area of width 0.
test("closing the panel during a request reports the whole canvas as visible", async ({ page }) => {
  const badBatch = { summary: "x", operations: [{ op: "connect", id: "c", from: "nope", to: "nada" }] };
  const requests = await mockAnthropic(page, [toolTurn(badBatch), textTurn("Sorry.")], { slow: 0 });
  await openPanel(page);
  const first = (await page.locator(".react-flow").boundingBox())!;
  await ask(page, "connect things");
  await panel(page).getByRole("button", { name: "Close the AI assistant" }).click();
  await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(2);
  const result = requests[1].body.messages.at(-1)!.content.find((b) => b.type === "tool_result") as unknown as {
    content: string;
  };
  const { view } = JSON.parse(result.content).diagram;
  // The canvas is at zoom 1 when empty, so the view is about as wide as the canvas.
  expect(view.width).toBeGreaterThan(first.width * 0.9);
});

test("the panel offers Undo only while the AI change is the latest one, and shows changes replaced by an opened file", async ({
  page,
}) => {
  const one = {
    summary: "Added A.",
    operations: [{ op: "add_screen", id: "a", template: "e-commerce-cart", label: "A", x: 300, y: 300 }],
  };
  await mockAnthropic(page, [toolTurn(one), textTurn("Done.")]);
  await openPanel(page);
  await ask(page, "add a");
  const change = panel(page).locator("[data-state]");
  await expect(change).toHaveAttribute("data-state", "latest");
  await expect(panel(page).getByRole("button", { name: "Undo: Added A." })).toBeVisible();

  // A later edit by the user: the AI change is no longer the latest.
  await tiles(page).first().click();
  await expect(change).toHaveAttribute("data-state", "applied");
  await expect(panel(page).getByRole("button", { name: "Undo: Added A." })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(change).toHaveAttribute("data-state", "latest");
  await panel(page).getByRole("button", { name: "Undo: Added A." }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(change).toHaveAttribute("data-state", "undone");

  // Redo it, then open a file over it.
  await page.getByRole("button", { name: "Redo" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open file" }).first().click();
  const file = {
    nodes: [{ id: "f", type: "flow", position: { x: 0, y: 0 }, data: { graphicId: "misc-404" } }],
    edges: [],
  };
  await (
    await chooser
  ).setFiles({ name: "other.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByRole("dialog").getByRole("button", { name: "Replace" }).click();
  await expect(change).toHaveAttribute("data-state", "replaced");
  await expect(change).toContainText("Replaced by an opened file: Added A.");
});

test("typing in the panel never triggers editor shortcuts", async ({ page }) => {
  const node = {
    id: "n",
    type: "flow",
    position: { x: 0, y: 0 },
    data: { graphicId: "misc-404", label: "Not Found 404", headerText: "X", showHeader: true },
  };
  await seed(page, { nodes: [node], edges: [] });
  await mockAnthropic(page, []);
  await openPanel(page);
  await page.locator(".react-flow__node img").click();
  await panel(page).getByLabel("Message").fill("");
  await panel(page).getByLabel("Message").pressSequentially("hello Hh");
  await panel(page).getByLabel("Message").press("Backspace");
  await panel(page).getByLabel("Message").press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".flow-node-header")).toHaveCount(1);
});

test.describe("when requests fail", () => {
  // Chromium logs every failed or refused request as a console error.
  test.use({
    allowErrors: /Failed to load resource|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/,
  });

  test("if the panel cannot be loaded, the editor keeps working, and it loads after a reload", async ({ browser }) => {
    // Without a service worker that could have the chunk cached.
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await openEditor(page);
    // Everything the editor needs has loaded; only the panel's chunk is still to come.
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await aiButton(page).click();
    await expect(aiButton(page)).toHaveAttribute("aria-label", /Couldn't load the AI assistant/);
    await tiles(page).first().click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    await page.unroute("**/_next/static/chunks/**");
    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await aiButton(page).click();
    await expect(panel(page).getByLabel("API key")).toBeVisible();
    await expect(aiButton(page)).toHaveAttribute("aria-label", "AI assistant");
    await context.close();
  });

  test("a stopped or failed request is not sent again with the next one", async ({ page }) => {
    const requests = await mockAnthropic(page, [textTurn("slow"), 400, textTurn("Added.")], { slow: 0 });
    await openPanel(page);
    await ask(page, "Delete every screen");
    await panel(page).getByRole("button", { name: "Stop" }).click();
    await expect(panel(page).locator(".ai-msg").getByText("Stopped.")).toBeVisible();
    await ask(page, "Rename everything to X");
    await expect(panel(page).getByRole("alert")).toContainText("mock 400");
    await ask(page, "Add a login screen");
    await expect(panel(page).locator(".ai-msg").getByText("Added.", { exact: true })).toBeVisible();
    expect(userTexts(requests[2]).filter((t) => !t.startsWith("<diagram>"))).toEqual(["Add a login screen"]);
  });

  test("the session cost includes steps that finished before a later step failed", async ({ page }) => {
    const one = {
      summary: "Added A.",
      operations: [{ op: "add_screen", id: "a", template: "e-commerce-cart", label: "A", x: 300, y: 300 }],
    };
    // 20,000 input + 2,000 output tokens on Haiku 5.5 ($0.10 / $0.50 per MTok) = $0.0030.
    await mockAnthropic(page, [toolTurn(one, "toolu_1", { input: 20000, output: 2000 }), 400]);
    await openPanel(page);
    await ask(page, "add a");
    await expect(panel(page).getByRole("alert")).toBeVisible();
    await expect(panel(page).getByText("$0.0030", { exact: true })).toBeVisible();
    await expect(panel(page).getByText("$0.0030 this session")).toBeVisible();
    expect((await saved(page))!.nodes.map((n) => n.id)).toEqual(["a"]);
  });

  test("a rejected key and a rate limit show a clear message; the key is kept only if asked", async ({ page }) => {
    await page.route(`${API}/v1/models/**`, (route) =>
      route.fulfill({
        status: 401,
        headers: cors,
        json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
      })
    );
    await openEditor(page);
    await aiButton(page).click();
    await panel(page).getByLabel("API key").fill("sk-ant-bad");
    await panel(page).getByRole("button", { name: "Check & use key" }).click();
    await expect(panel(page).getByRole("alert")).toHaveText(
      "Anthropic rejected this key (wrong, expired or revoked?)."
    );
    await page.unroute(`${API}/v1/models/**`);

    await mockAnthropic(page, [429, 429, 429]);
    await panel(page).getByLabel("API key").fill("sk-ant-ok");
    await panel(page).getByRole("button", { name: "Check & use key" }).click();
    await ask(page, "hi");
    await expect(panel(page).getByRole("alert")).toHaveText("Rate limited by Anthropic. Try again shortly.");
    // Not remembered: nothing in storage, and a reload asks again.
    expect(await page.evaluate(() => localStorage.getItem("wireflow-ai"))).not.toContain("sk-ant");
    await page.reload();
    await aiButton(page).click();
    await expect(panel(page).getByLabel("API key")).toBeVisible();
  });
});
