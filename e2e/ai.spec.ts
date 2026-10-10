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
  await expect(panel(page)).toContainText("Stored encrypted in this browser");
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
    expect((await page.evaluate(() => localStorage.getItem("wireflow-ai"))) ?? "").not.toContain("sk-ant");
    await page.reload();
    await aiButton(page).click();
    await expect(panel(page).getByLabel("API key")).toBeVisible();
  });
});

// What the panel keeps in this browser (#104): the remembered key, encrypted in
// IndexedDB, and the chat while "Keep chat after reload" is on.
test.describe("what the AI panel keeps in this browser", () => {
  // An obviously fake key; the random part shows up nowhere else.
  const secret = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

  // Everything the page can read from its storage: localStorage, sessionStorage and
  // every record of every IndexedDB database, with bytes shown as Latin-1, UTF-8,
  // UTF-16 and base64, and CryptoKeys as what they expose.
  type Dump = {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    indexedDB: Record<string, [IDBValidKey, unknown][]>;
  };
  const dumpStorage = (page: Page): Promise<Dump> =>
    page.evaluate(async () => {
      const req = <T>(r: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      const show = (v: unknown): unknown => {
        if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
          const bytes =
            v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
          const latin1 = String.fromCharCode(...bytes);
          return {
            bytes: bytes.length,
            latin1,
            utf8: new TextDecoder().decode(bytes),
            utf16: new TextDecoder("utf-16le").decode(bytes),
            base64: btoa(latin1),
          };
        }
        if (v instanceof CryptoKey)
          return { cryptoKey: { type: v.type, extractable: v.extractable, algorithm: v.algorithm, usages: v.usages } };
        if (Array.isArray(v)) return v.map(show);
        if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, show(x)]));
        return v;
      };
      const indexedDBDump: Record<string, [IDBValidKey, unknown][]> = {};
      for (const { name } of await indexedDB.databases()) {
        const db = await req(indexedDB.open(name!));
        for (const store of Array.from(db.objectStoreNames)) {
          const s = db.transaction(store).objectStore(store);
          const [keys, values] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
          indexedDBDump[`${name}/${store}`] = keys.map((k, i) => [k, show(values[i])]);
        }
        db.close();
      }
      return { localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage }, indexedDB: indexedDBDump };
    });
  const kv = async (page: Page) => Object.fromEntries((await dumpStorage(page)).indexedDB["wireflow-ai/kv"] ?? []);
  const expectNowhere = async (page: Page, key: string, part: string) => {
    const dump = JSON.stringify(await dumpStorage(page));
    for (const text of [key, part, Buffer.from(key).toString("base64"), Buffer.from(part).toString("base64")])
      expect(dump).not.toContain(text);
  };

  async function useKey(page: Page, key = "sk-ant-test-key", { remember = false } = {}) {
    await panel(page).getByLabel("API key").fill(key);
    if (remember) await panel(page).getByRole("checkbox", { name: "Remember on this device" }).check();
    await panel(page).getByRole("button", { name: "Check & use key" }).click();
    await expect(panel(page).getByLabel("Message")).toBeVisible();
  }
  // The replies on screen (not the screen reader's copy of the last one).
  const replies = (page: Page) => panel(page).locator(".ai-msg");
  async function reopen(page: Page) {
    await page.reload();
    await expect(page.locator(".react-flow__pane")).toBeVisible();
    await aiButton(page).click();
  }

  test("a remembered key is stored encrypted, never in plain text; it survives a reload, and Forget key deletes it", async ({
    page,
  }) => {
    const part = secret();
    const key = `sk-ant-test-${part}`;
    const requests = await mockAnthropic(page, [textTurn("Hi.")]);
    await openEditor(page);
    await aiButton(page).click();
    await useKey(page, key, { remember: true });

    await expectNowhere(page, key, part);
    // What is stored instead: a non-extractable AES-GCM key and a ciphertext with its IV.
    const records = await kv(page);
    expect(Object.keys(records).sort()).toEqual(["apiKey", "deviceKey"]);
    expect(records.deviceKey).toMatchObject({
      cryptoKey: { type: "secret", extractable: false, algorithm: { name: "AES-GCM", length: 256 } },
    });
    expect(records.apiKey).toMatchObject({ v: 1, iv: { bytes: 12 } });
    expect((await page.evaluate(() => localStorage.getItem("wireflow-ai"))) ?? "").not.toContain("sk-ant");

    await reopen(page);
    await expect(panel(page).getByLabel("Message")).toBeVisible();
    await expect(panel(page).locator(".ai-masked-key")).toHaveText(`sk-ant-…${key.slice(-4)}`);
    await expect(panel(page).getByText("Remembered on this device, encrypted.")).toBeAttached();
    await ask(page, "hi");
    await expect(replies(page).getByText("Hi.", { exact: true })).toBeVisible();
    expect(requests[0].headers["x-api-key"]).toBe(key);
    await expectNowhere(page, key, part);

    await panel(page).getByRole("button", { name: "Forget key" }).click();
    await expect(panel(page).getByLabel("API key")).toBeVisible();
    await expect.poll(async () => Object.keys(await kv(page))).toEqual([]);
    await reopen(page);
    await expect(panel(page).getByLabel("API key")).toBeVisible();
  });

  test("a key an earlier version kept in plain text is encrypted once and the plain text deleted", async ({ page }) => {
    const part = secret();
    const key = `sk-ant-test-${part}`;
    await mockAnthropic(page, []);
    await page.goto("/manifest.webmanifest");
    await page.evaluate(
      (k) =>
        localStorage.setItem(
          "wireflow-ai",
          JSON.stringify({ provider: "anthropic", model: "claude-sonnet-5-5", apiKey: k })
        ),
      key
    );
    await openEditor(page);
    await aiButton(page).click();
    await expect(panel(page).getByLabel("Message")).toBeVisible();
    await expect(panel(page).locator(".ai-masked-key")).toHaveText(`sk-ant-…${key.slice(-4)}`);
    // The other settings stay.
    await expect(panel(page).getByLabel("Model")).toHaveValue("claude-sonnet-5-5");
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("wireflow-ai")))!)).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
    });
    await expectNowhere(page, key, part);
    expect(Object.keys(await kv(page)).sort()).toEqual(["apiKey", "deviceKey"]);

    await reopen(page);
    await expect(panel(page).locator(".ai-masked-key")).toHaveText(`sk-ant-…${key.slice(-4)}`);
  });

  test("where the browser keeps nothing, Remember is off and says why, and the key stays in memory only", async ({
    page,
  }) => {
    // As in a browser that blocks site data.
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        get() {
          return {
            open() {
              throw new DOMException("The operation is insecure.", "SecurityError");
            },
          };
        },
      });
    });
    await mockAnthropic(page, []);
    await openEditor(page);
    await aiButton(page).click();
    const remember = panel(page).getByRole("checkbox", { name: "Remember on this device" });
    await expect(remember).toBeDisabled();
    await expect(remember).not.toBeChecked();
    await expect(panel(page)).toContainText("the key can't be remembered");
    await useKey(page);
    await expect(panel(page).getByRole("checkbox", { name: "Keep chat after reload" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("wireflow-ai"))).toBeNull();
    await reopen(page);
    await expect(panel(page).getByLabel("API key")).toBeVisible();
  });

  test("Keep chat after reload is off by default; on, the chat comes back and the next request continues it; New chat and unticking delete it", async ({
    page,
  }) => {
    const requests = await mockAnthropic(page, [
      textTurn("First reply."),
      textTurn("Second reply."),
      textTurn("Third reply."),
      textTurn("Fourth reply."),
    ]);
    const keep = panel(page).getByRole("checkbox", { name: "Keep chat after reload" });
    await openPanel(page);
    await expect(keep).not.toBeChecked();
    await ask(page, "first");
    await expect(replies(page).getByText("First reply.", { exact: true })).toBeVisible();
    expect(await kv(page)).toEqual({});
    await reopen(page);
    await useKey(page);
    await expect(replies(page).getByText("First reply.", { exact: true })).toHaveCount(0);

    await keep.check();
    await ask(page, "second");
    await expect(replies(page).getByText("Second reply.", { exact: true })).toBeVisible();
    await expect.poll(async () => Object.keys(await kv(page))).toEqual(["chat"]);
    await reopen(page);
    // The chat shows before a key is entered again (here it wasn't remembered).
    await useKey(page);
    await expect(keep).toBeChecked();
    await expect(panel(page).getByText("second", { exact: true })).toBeVisible();
    await expect(replies(page).getByText("Second reply.", { exact: true })).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "New chat" })).toBeEnabled();

    // The next request continues the same conversation, unchanged.
    await ask(page, "third");
    await expect(replies(page).getByText("Third reply.", { exact: true })).toBeVisible();
    expect(requests[2].body.messages.slice(0, 2)).toEqual([
      requests[1].body.messages[0],
      { role: "assistant", content: [{ type: "text", text: "Second reply." }] },
    ]);
    expect(userTexts(requests[2]).filter((t) => !t.startsWith("<diagram>"))).toEqual(["second", "third"]);

    await panel(page).getByRole("button", { name: "New chat" }).click();
    await expect(replies(page).getByText("Third reply.", { exact: true })).toHaveCount(0);
    await expect.poll(async () => Object.keys(await kv(page))).toEqual([]);
    await reopen(page);
    await useKey(page);
    await expect(panel(page).getByText("second", { exact: true })).toHaveCount(0);

    await ask(page, "fourth");
    await expect(replies(page).getByText("Fourth reply.", { exact: true })).toBeVisible();
    await expect.poll(async () => Object.keys(await kv(page))).toEqual(["chat"]);
    await keep.uncheck();
    await expect.poll(async () => Object.keys(await kv(page))).toEqual([]);
    await reopen(page);
    await useKey(page);
    await expect(keep).not.toBeChecked();
    await expect(replies(page).getByText("Fourth reply.", { exact: true })).toHaveCount(0);
  });

  test("a kept chat's changes can still be undone from it after a reload, but never stand in for another tab's edits", async ({
    page,
    context,
  }) => {
    await mockAnthropic(page, [toolTurn(flow), textTurn("Added a login flow.")]);
    await openPanel(page);
    await panel(page).getByRole("checkbox", { name: "Keep chat after reload" }).check();
    await ask(page, "Add a login flow");
    await expect(panel(page).locator('[data-state="latest"]')).toContainText("Applied: Added a login flow.");
    await expect.poll(async () => Object.keys(await kv(page))).toEqual(["chat"]);

    // Same tab: its undo history survives the reload, so the change is still the latest one.
    await reopen(page);
    await useKey(page);
    await panel(page).getByRole("button", { name: "Undo: Added a login flow." }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(panel(page).locator('[data-state="undone"]')).toContainText("Undone: Added a login flow.");

    // Another tab starts a new undo history: its own first edit must not pass for the AI's change.
    const other = await context.newPage();
    await mockAnthropic(other, []);
    await openEditor(other);
    await tiles(other).first().click();
    await expect(other.locator(".react-flow__node")).toHaveCount(1);
    await aiButton(other).click();
    await useKey(other);
    await expect(panel(other).locator('[data-state="applied"]')).toContainText("Applied: Added a login flow.");
    await expect(panel(other).getByRole("button", { name: /^Undo/ })).toHaveCount(0);
  });
});
