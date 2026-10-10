import type { Page } from "@playwright/test";
import { expect, openEditor, test } from "./fixtures";

// The "Keyboard shortcuts" panel collapses from its heading. It is open by
// default where it fits above the minimap (as on wireflow.co), collapsed by
// default where it would cover it, and the user's choice is remembered.
const THRESHOLD = 941; // SHORTCUTS_OPEN_MIN_HEIGHT in components/editor/shortcuts-panel.tsx

const panel = (page: Page) => page.getByRole("complementary", { name: "Keyboard shortcuts" });
const toggle = (page: Page) => panel(page).getByRole("button", { name: "Keyboard shortcuts" });
const rows = (page: Page) => panel(page).getByText("Select all / none");

async function boxes(page: Page) {
  const p = (await panel(page).boundingBox())!;
  const m = (await page.locator(".react-flow__minimap").boundingBox())!;
  return { panelBottom: p.y + p.height, minimapTop: m.y };
}

test.describe("on a tall screen", () => {
  test.use({ viewport: { width: 1440, height: THRESHOLD } });

  test("the panel is open, ends above the minimap, and collapses and opens from its heading", async ({ page }) => {
    await openEditor(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(rows(page)).toBeVisible();
    const { panelBottom, minimapTop } = await boxes(page);
    expect(panelBottom).toBeLessThanOrEqual(minimapTop);

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(rows(page)).toBeHidden();
    // Remembered after a reload.
    await page.reload();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");

    // The keyboard opens it again.
    await toggle(page).focus();
    await page.keyboard.press("Enter");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(rows(page)).toBeVisible();
    await page.reload();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("on a shorter screen", () => {
  test.use({ viewport: { width: 1440, height: THRESHOLD - 1 } });

  test("the panel starts collapsed, because open it would cover the minimap", async ({ page }) => {
    await openEditor(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(rows(page)).toBeHidden();
    const collapsed = await boxes(page);
    expect(collapsed.panelBottom).toBeLessThan(collapsed.minimapTop);

    // Opened by the user, it stays open (and would overlap the minimap by a pixel here).
    await toggle(page).click();
    await expect(rows(page)).toBeVisible();
    const open = await boxes(page);
    expect(open.panelBottom).toBeGreaterThan(open.minimapTop);
    await page.reload();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  });

  test("growing the window opens it, shrinking it collapses it again, until the user chooses", async ({ page }) => {
    await openEditor(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await page.setViewportSize({ width: 1440, height: 1080 });
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1440, height: 800 });
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("it still works when the browser blocks storage", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await openEditor(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  });
});
