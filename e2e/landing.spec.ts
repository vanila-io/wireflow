import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import graphics from "../lib/graphics.json";

// The landing page (/): everything the earlier page had is still there
// (the "Content kept" list of the redesign), the live data renders or hides
// cleanly, and the layout holds from a phone to a desktop.

const categories = [...new Set(graphics.map((g) => g.category))];
const DESCRIPTION =
  "Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.";

test("keeps the headline, tagline, CTAs and the free-forever line", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free Wire /User Flow Tool");
  await expect(page.getByText("for creating beautiful user flow prototypes.", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Free forever. No sign up needed.")).toBeVisible();

  const ctas = page.getByRole("link", { name: "Start designing" });
  await expect(ctas).toHaveCount(2); // header and hero
  for (const cta of await ctas.all()) await expect(cta).toHaveAttribute("href", "/app");
  await ctas.last().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
});

test("uses the editor's colours: the CTA matches the editor's primary button, on a white page", async ({ page }) => {
  await page.goto("/app");
  // The header's blue "Export JSON" (the toolbar's icon button has no visible text).
  const editorPrimary = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Export JSON");
    return button ? getComputedStyle(button).backgroundColor : null;
  });
  expect(editorPrimary).toBe("rgb(67, 83, 255)"); // wire blue, #4353ff

  await page.goto("/");
  const cta = page.getByRole("main").getByRole("link", { name: "Start designing" });
  expect(await cta.evaluate((a) => getComputedStyle(a).backgroundColor)).toBe(editorPrimary);
  const landing = page.locator(".landing");
  expect(await landing.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
});

test("keeps the nav links, the features, the open-source section and the footer", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("header nav:visible");
  await expect(nav.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "https://wireflow.co/blog/");
  await expect(nav.getByRole("link", { name: "Open Source" })).toHaveAttribute("href", "https://github.com/vanila-io/wireflow");
  await expect(nav.getByRole("link", { name: "Crafted by Automatio team" })).toHaveAttribute("href", "https://automatio.ai/");

  await expect(page.getByRole("heading", { name: "Everything you need to map a flow" })).toBeVisible();
  // Only features the editor has today (no collaboration, permissions or chat).
  for (const title of [
    `${graphics.length} screen templates`,
    "Easy to use interface",
    "AI assistant",
    "Save, open and export",
    "Groups, notes and estimates",
    "No Photoshop required",
  ]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  for (const gone of ["Real-time collaboration", "Project permissions", "Live chat", "100+ graphics to use"]) {
    await expect(page.getByText(gone)).toHaveCount(0);
  }

  const oss = page.locator("#open-source");
  await expect(oss.getByRole("heading", { name: "Fully Open Source" })).toBeVisible();
  await expect(oss.getByRole("link", { name: "Check on GitHub" })).toHaveAttribute("href", "https://github.com/vanila-io/wireflow");
  await expect(oss.getByRole("link", { name: /Support us/ })).toHaveAttribute("href", "https://opencollective.com/wireflow/contribute");
  // What Wireflow is built on, not encyclopedia blurbs.
  for (const tech of ["Next.js and React", "React Flow", "Cloudflare, through OpenNext", "Claude API"]) {
    await expect(oss.getByText(tech, { exact: true })).toBeVisible();
  }
  await expect(oss.getByText("Node.js", { exact: true })).toHaveCount(0);

  const footer = page.locator("footer");
  for (const [name, href] of [
    ["Flow editor", "/app"],
    ["Blog", "https://wireflow.co/blog/"],
    ["GitHub repository", "https://github.com/vanila-io/wireflow"],
    ["Support on Open Collective", "https://opencollective.com/wireflow/contribute"],
    ["Crafted by Automatio team", "https://automatio.ai/"],
  ]) {
    await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(footer).toContainText("Wireflow - user flow chart tool. MIT licensed, built by the Vanila team.");
});

test("the templates feature counts the template list", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#features article").filter({ has: page.getByRole("heading", { name: /screen templates$/ }) });
  await expect(card.getByRole("heading")).toHaveText(`${graphics.length} screen templates`);
  await expect(card).toContainText(`Ready-made wireframe screens in ${categories.length} categories`);
});

test("keeps the title, description, Open Graph tags, manifest and icons", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Wireflow - Free Wire / User Flow Tool");
  const meta = (sel: string) => page.locator(sel).first();
  await expect(meta('meta[name="description"]')).toHaveAttribute("content", DESCRIPTION);
  await expect(meta('meta[property="og:title"]')).toHaveAttribute("content", "Wireflow - Free Wire / User Flow Tool");
  await expect(meta('meta[property="og:description"]')).toHaveAttribute("content", DESCRIPTION);
  await expect(meta('meta[property="og:url"]')).toHaveAttribute("content", "https://wireflow.co");
  await expect(meta('meta[property="og:image"]')).toHaveAttribute("content", "https://wireflow.co/icon-512.png");
  await expect(meta('meta[property="og:site_name"]')).toHaveAttribute("content", "Wireflow");
  await expect(meta('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(meta('meta[name="theme-color"]')).toHaveAttribute("content", "#465BFF");
  // Analytics are only added when configured at build time; the test build sets none.
  await expect(page.locator('script[src*="googletagmanager"], script[data-site-id]')).toHaveCount(0);
});

test("shows the GitHub star count, or leaves the number out", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("hero-stars");
  await expect(hero).toHaveAttribute("href", "https://github.com/vanila-io/wireflow");
  await expect(hero).toHaveText(/^(\d{1,3}(,\d{3})* stars on GitHub|Open source on GitHub)$/);
  const card = page.getByTestId("repo-stars");
  await expect(card).toHaveText(/^(\d{1,3}(,\d{3})*stars on GitHub|Open source)$/i);
});

test("lists the current sponsors by tier with each tier's rel, or the empty state", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#sponsors");
  await expect(section.getByRole("heading", { name: "Sponsors & Backers" })).toBeVisible();
  await expect(section.getByText("Wireflow is free and open source thanks to our sponsors.")).toBeVisible();
  await expect(section.getByRole("link", { name: /Become a sponsor/ })).toHaveAttribute(
    "href",
    "https://opencollective.com/wireflow/contribute"
  );
  const tiers = section.getByRole("heading", { level: 3 });
  if ((await tiers.count()) === 0) {
    await expect(section.getByText("No active sponsor packages right now — be the first.")).toBeVisible();
    return;
  }
  const rels: Record<string, string> = {
    "Diamond sponsors": "noopener",
    "Gold sponsors": "noopener",
    "Silver sponsors": "sponsored noopener",
    "Bronze sponsors": "nofollow noopener",
  };
  for (const tier of await tiers.allTextContents()) {
    const list = section.locator("div", { has: page.getByRole("heading", { name: tier }) }).last().getByRole("link");
    expect(await list.count()).toBeGreaterThan(0);
    for (const link of await list.all()) {
      await expect(link).toHaveAttribute("rel", rels[tier.trim()]);
      await expect(link).toHaveAttribute("target", "_blank");
    }
  }
  // Avatars load (the CSP allows the hosts Open Collective uses).
  const broken = await section.locator("img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src)
  );
  expect(broken).toEqual([]);
});

test("the gallery is built from the template list, and its filters work", async ({ page }) => {
  await page.goto("/");
  const gallery = page.locator("#templates");
  await expect(gallery.getByRole("heading", { level: 2 })).toHaveText(
    `Choose from ${graphics.length} screens in ${categories.length} categories`
  );
  const filters = gallery.getByRole("group", { name: "Filter screens by category" }).getByRole("button");
  await expect(filters).toHaveCount(categories.length + 1);
  const cards = gallery.getByRole("listitem");
  await expect(cards).toHaveCount(18);

  const mobile = graphics.filter((g) => g.category === "mobile");
  await gallery.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect(gallery.getByRole("button", { name: "Mobile", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(cards).toHaveCount(mobile.length);
  await expect(cards.first().getByRole("link")).toHaveAttribute("href", `/app?card=${mobile[0].id}`);

  await gallery.getByRole("button", { name: "All", exact: true }).click();
  await gallery.getByRole("button", { name: `Show all ${graphics.length} screens` }).click();
  await expect(cards).toHaveCount(graphics.length);
  await expect(cards.nth(18).getByRole("link")).toBeFocused();

  await cards.first().getByRole("link").click();
  await expect(page).toHaveURL(`/app?card=${graphics[0].id}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

test("starts with a skip link, shows focus, and every image has alt text or is marked decorative",async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  // Keyboard focus shows a wire-blue ring at once (logo, three nav links, then the header CTA).
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(page.locator("header").getByRole("link", { name: "Start designing" })).toBeFocused();
  expect(
    await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineStyle} ${s.outlineColor}`;
    })
  ).toBe("solid rgb(67, 83, 255)");
  const missing = await page.locator("img:not([alt])").count();
  expect(missing).toBe(0);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`has no horizontal overflow at ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(viewport.width);
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the menu opens the nav links, and the gallery starts shorter", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header nav:visible")).toHaveCount(0);
    await page.getByLabel("Menu").click();
    const nav = page.locator("header nav:visible");
    await expect(nav.getByRole("link", { name: "Blog" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Open Source" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Crafted by Automatio team" })).toBeVisible();

    const cards = page.locator("#templates li:visible");
    await expect(cards).toHaveCount(8);
    await page.getByRole("button", { name: `Show all ${graphics.length} screens` }).click();
    await expect(cards).toHaveCount(graphics.length);
    await expect(page.locator("#templates li").nth(8).getByRole("link")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

// ---- The animated illustrations (components/landing/anim) ----

const ILLUSTRATIONS = ["hero-animation", "templates-animation", "interface-animation"];
// The SVG shown in an illustration (the hero has a desktop and a phone one).
const scene = (page: Page, id: string) => page.getByTestId(id).locator("svg:visible");
// The play states of its animations, without repeats: ["running"], ["paused"] or [].
const states = (svg: Locator) =>
  svg.evaluate((el) => [...new Set(el.getAnimations({ subtree: true }).map((a) => a.playState))].sort());
// How visible an element is: its opacity times its ancestors'.
const opacity = (el: Locator) =>
  el.evaluate((node) => {
    let o = 1;
    for (let n: Element | null = node; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  });

test.describe("animated illustrations", () => {
  test("the hero and both feature cards are animated SVGs in place of images", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/graphics/") && r.status() >= 400) failed.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByRole("img", { name: /^The Wireflow editor: three screens are dragged/ })).toBeVisible();
    for (const id of ILLUSTRATIONS) {
      const wrapper = page.getByTestId(id);
      await wrapper.scrollIntoViewIfNeeded();
      await expect(wrapper.locator("img, picture")).toHaveCount(0);
      await expect(scene(page, id)).toHaveCount(1);
      await expect.poll(() => states(scene(page, id))).toEqual(["running"]);
    }
    // The feature cards' text says what their animations show.
    for (const id of ILLUSTRATIONS.slice(1)) await expect(scene(page, id)).toHaveAttribute("aria-hidden", "true");
    expect(failed).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("animates only transform, opacity and stroke-dashoffset", async ({ page }) => {
    await page.goto("/");
    const properties = await page.evaluate(() => [
      ...new Set(
        document
          .getAnimations()
          .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
          .flatMap((k) => Object.keys(k))
      ),
    ]);
    expect(properties.filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)).sort()).toEqual([
      "opacity",
      "strokeDashoffset",
      "transform",
    ]);
  });

  test("an illustration off screen is paused, and every one while the tab is hidden", async ({ page }) => {
    await page.goto("/");
    const hero = scene(page, "hero-animation");
    const sketch = scene(page, "interface-animation");
    // At the top of the page the feature cards are below the fold.
    await expect.poll(() => states(hero)).toEqual(["running"]);
    await expect.poll(() => states(sketch)).toEqual(["paused"]);

    await sketch.scrollIntoViewIfNeeded();
    await expect.poll(() => states(sketch)).toEqual(["running"]);
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect.poll(() => states(hero)).toEqual(["paused"]);
    await expect.poll(() => states(sketch)).toEqual(["paused"]);

    await sketch.scrollIntoViewIfNeeded();
    await expect.poll(() => states(sketch)).toEqual(["running"]);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => states(sketch)).toEqual(["paused"]);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing moves, and each illustration shows its final frame", async ({ page }) => {
      await page.goto("/");
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

      // The hero: three screens in place, both connections drawn and labelled,
      // the group; no pointer, selection or highlighted tile.
      const hero = scene(page, "hero-animation");
      for (const text of ["Home", "Product", "Cart", "Browse", "Add to cart", "CHECKOUT"]) {
        expect(await opacity(hero.locator("text").getByText(text, { exact: true }))).toBe(1);
      }
      for (const card of await hero.locator(".c1, .c2, .c3").all()) {
        expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
      }
      for (const path of await hero.locator("path[pathLength]").all()) {
        expect(await path.evaluate((el) => getComputedStyle(el).strokeDashoffset)).toBe("0px");
      }
      for (const hidden of await hero.locator(".cur, .s1, .s2, .s3, .t1, .t2, .t3, .grp-sel").all()) {
        expect(await opacity(hidden)).toBe(0);
      }

      // Templates: the first category's eight templates, under its blue chip.
      const templates = scene(page, "templates-animation");
      const sets = templates.locator(".set");
      await expect(sets).toHaveCount(4);
      for (const tile of await sets.first().locator(".tile").all()) expect(await opacity(tile)).toBe(1);
      for (const tile of await sets.nth(1).locator(".tile").all()) expect(await opacity(tile)).toBe(0);
      expect(await opacity(templates.locator(".chip").first())).toBe(1);

      // The interface: all three screens and both connections; no pointer, no pressed button.
      const sketch = scene(page, "interface-animation");
      expect(await opacity(sketch.locator("text").getByText("Checkout", { exact: true }))).toBe(1);
      for (const hidden of await sketch.locator(".cur, .pu, .pr").all()) expect(await opacity(hidden)).toBe(0);
    });
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the hero shows the closer view of the canvas, inside the screen", async ({ page }) => {
      await page.goto("/");
      const svg = scene(page, "hero-animation");
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute("viewBox", "0 0 480 480");
      await expect(page.getByRole("img", { name: /^The Wireflow editor: two screens/ })).toBeVisible();
      await expect.poll(() => states(svg)).toEqual(["running"]);
      const box = (await svg.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(Math.abs(box.width - box.height)).toBeLessThan(1); // square, as its frame
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
});
