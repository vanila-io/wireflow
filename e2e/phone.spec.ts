import { expect, openEditor, seed, test } from "./fixtures";

// On a phone the header has room for Export JSON only. AI and Open file used to
// be hidden there, and the toolbar ran off the right edge of the screen.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const DIAGRAM = {
  nodes: [
    {
      id: "a",
      type: "flow",
      position: { x: 0, y: 0 },
      data: { graphicId: "e-commerce-cart", src: "/graphics/e-commerce/cart.svg", label: "Cart", headerText: "Cart", showHeader: true },
    },
  ],
  edges: [],
};

test("AI and Open file are under More in the phone header", async ({ page }) => {
  await openEditor(page);
  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: "AI assistant" })).toBeHidden();
  await expect(header.getByRole("button", { name: "Export JSON" })).toBeVisible();

  await header.getByRole("button", { name: "More" }).tap();
  await page.getByRole("menuitem", { name: "AI assistant" }).tap();
  const panel = page.getByRole("complementary", { name: "AI assistant" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "API key" })).toBeInViewport();
  await panel.getByRole("button", { name: "Close the AI assistant" }).tap();
  await expect(panel).toBeHidden();

  await header.getByRole("button", { name: "More" }).tap();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Open file" }).tap();
  await chooser;
});

test("the toolbar stays on screen and every button in it can be reached", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  const toolbar = page.getByRole("toolbar", { name: "Diagram" });
  const box = (await toolbar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  for (const name of ["Undo", "Open file", "Export JSON", "Clear canvas", "More tools"]) {
    const button = toolbar.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
  }
  await toolbar.getByRole("button", { name: "More tools" }).tap();
  await expect(page.getByRole("menuitem", { name: "Export JPG image" })).toBeInViewport();
});
