import type { CDPSession, Locator, Page } from '@playwright/test';

// Real touch input (Chromium's Input.dispatchTouchEvent): the browser turns it into
// touch and pointer events with pointerType "touch", as on a phone.
export class Finger {
  private constructor(private cdp: CDPSession) {}

  static async on(page: Page) {
    return new Finger(await page.context().newCDPSession(page));
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 16) {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Chrome doesn't turn a tap that lands within a few hundred ms of the previous
    // gesture into a click (seen in emulation). People don't tap that fast; wait.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  async tap(at: { x: number; y: number }) {
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

export async function centre(locator: Locator) {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
