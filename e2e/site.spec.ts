import { test, expect } from "./fixtures";

// Files the earlier app served, restored after the rewrite dropped them.
test("robots.txt lets every crawler in, as before", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");
  const text = await res.text();
  expect(text).toMatch(/^User-agent: \*$/m);
  expect(text).toMatch(/^Disallow:\s*$/m);
});

test("every page names Safari's pinned-tab icon, and it is served", async ({ page, request }) => {
  for (const path of ["/", "/app"]) {
    await page.goto(path);
    const icon = page.locator('link[rel="mask-icon"]');
    await expect(icon).toHaveAttribute("href", "/safari-pinned-tab.svg");
    await expect(icon).toHaveAttribute("color", "#465BFF");
  }
  const res = await request.get("/safari-pinned-tab.svg");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
});
