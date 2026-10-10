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

test("keeps the nav links, the features, the open-source section and the footer", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("header nav:visible");
  await expect(nav.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "https://wireflow.co/blog/");
  await expect(nav.getByRole("link", { name: "Open Source" })).toHaveAttribute("href", "https://github.com/vanila-io/wireflow");
  await expect(nav.getByRole("link", { name: "Crafted by Automatio team" })).toHaveAttribute("href", "https://automatio.ai/");

  await expect(page.getByRole("heading", { name: "Everything you need to map a flow" })).toBeVisible();
  for (const title of [
    "100+ graphics to use",
    "Real-time collaboration",
    "Project permissions",
    "Live chat",
    "Easy to use interface",
    "No Photoshop required",
  ]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }

  const oss = page.locator("#open-source");
  await expect(oss.getByRole("heading", { name: "Fully Open Source" })).toBeVisible();
  await expect(oss.getByRole("link", { name: "Check on GitHub" })).toHaveAttribute("href", "https://github.com/vanila-io/wireflow");
  await expect(oss.getByRole("link", { name: /Support us/ })).toHaveAttribute("href", "https://opencollective.com/wireflow/contribute");
  for (const tech of ["Node.js", "Next.js", "React.js"]) await expect(oss.getByText(tech, { exact: true })).toBeVisible();

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
    `Choose from ${graphics.length} flows in ${categories.length} categories`
  );
  const filters = gallery.getByRole("group", { name: "Filter flows by category" }).getByRole("button");
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
  await gallery.getByRole("button", { name: `Show all ${graphics.length} flows` }).click();
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
    await page.getByRole("button", { name: `Show all ${graphics.length} flows` }).click();
    await expect(cards).toHaveCount(graphics.length);
    await expect(page.locator("#templates li").nth(8).getByRole("link")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
