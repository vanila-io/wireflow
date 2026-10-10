import { describe, expect, it } from "vitest";
import { EXPORT_PADDING, exportSize } from "@/components/editor/export-image";

describe("image export size (#68)", () => {
  it("draws the whole diagram at zoom 1, padded, at twice the pixel density", () => {
    expect(exportSize({ x: -300, y: 50, width: 2000, height: 700 })).toEqual({
      width: 2000 + 2 * EXPORT_PADDING,
      height: 700 + 2 * EXPORT_PADDING,
      pixelRatio: 2,
    });
  });

  it("lowers the pixel ratio only as far as the browser needs for a very large diagram", () => {
    const wide = exportSize({ x: 0, y: 0, width: 30_000, height: 300 });
    expect(wide.pixelRatio * wide.width).toBeLessThanOrEqual(16_384);
    const big = exportSize({ x: 0, y: 0, width: 6000, height: 6000 });
    expect(big.pixelRatio ** 2 * big.width * big.height).toBeLessThanOrEqual(16_000_000 + 1);
    expect(big.pixelRatio).toBeGreaterThan(0.6);
  });
});
