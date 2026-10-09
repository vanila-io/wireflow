import { test as base, expect, type Page } from '@playwright/test';

export { expect };

// Every test fails if the page logs a console error or throws an uncaught
// error. `allowErrors` (set with test.use) matches errors a test causes on purpose.
export const test = base.extend<{ allowErrors: RegExp | null }>({
  allowErrors: [null, { option: true }],
  page: async ({ page, allowErrors }, runTest) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !allowErrors?.test(msg.text())) errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await runTest(page);
    expect(errors, 'console errors / uncaught page errors').toEqual([]);
  },
});

export const STORAGE_KEY = 'wireflow-flow-v1';

type Saved = { nodes: Array<Record<string, unknown> & { id: string; data: Record<string, unknown> }>; edges: Array<Record<string, unknown> & { id: string; source: string; target: string }> };

// The diagram the editor autosaves (null before the first save).
export const saved = (page: Page): Promise<Saved | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

export async function openEditor(page: Page, query = '') {
  await page.goto(`/app${query}`);
  await expect(page.locator('.react-flow__pane')).toBeVisible();
}

export const card = (page: Page, label: string) => page.locator('.react-flow__node').filter({ has: page.getByRole('img', { name: label, exact: true }) });
