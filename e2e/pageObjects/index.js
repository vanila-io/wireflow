const mouse = page.mouse;

export const clientXY = async (selector) =>
  await page.$eval(selector, (e) => [e.offsetLeft, e.offsetTop]);

export const moveDown = async (x, y) => {
  await mouse.move(x, y);
  await mouse.down();
};

export const moveUp = async (x, y) => {
  await mouse.move(x, y);
  await mouse.up();
};
