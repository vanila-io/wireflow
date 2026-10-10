// Export the whole diagram as an image (the earlier editor's "Export as JPEG",
// now also PNG). That editor captured the visible canvas at screen resolution,
// so a large diagram came out tiny and blurry (#68). This draws every card and
// connection at zoom 1, whatever the current viewport, at twice the pixel
// density when the browser can hold an image that large. It follows React
// Flow's "Download Image" example: getNodesBounds + getViewportForBounds, and
// html-to-image on .react-flow__viewport (pinned to 1.11.11, the version that
// example names as the last one that exports images correctly).
import { getViewportForBounds, type Rect } from "@xyflow/react";
import { toJpeg, toPng } from "html-to-image";

export type ImageFormat = "jpg" | "png";

// Space around the diagram, in canvas pixels.
export const EXPORT_PADDING = 40;
// Browsers refuse canvases past a size: Safari at about 16.7 million pixels,
// Chrome at 32,767 px a side. Larger diagrams get a lower pixel ratio.
const MAX_PIXELS = 16_000_000;
const MAX_SIDE = 16_384;
const PIXEL_RATIO = 2;
// The editor canvas behind the cards (JPG has no transparency).
const BACKGROUND = "#ffffff";

/** The image size at zoom 1 (CSS pixels) and the pixel ratio to draw it at. */
export function exportSize(bounds: Rect) {
  const width = Math.ceil(bounds.width + 2 * EXPORT_PADDING);
  const height = Math.ceil(bounds.height + 2 * EXPORT_PADDING);
  const pixelRatio = Math.min(PIXEL_RATIO, Math.sqrt(MAX_PIXELS / (width * height)), MAX_SIDE / Math.max(width, height));
  return { width, height, pixelRatio };
}

/** Draw the diagram in `viewport` (React Flow's .react-flow__viewport). Returns a data URL and the pixel size. */
export async function renderImage(viewport: HTMLElement, bounds: Rect, format: ImageFormat) {
  const { width, height, pixelRatio } = exportSize(bounds);
  // Zoom 1 exactly (min = max zoom), with the diagram centred: EXPORT_PADDING on every side.
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 1, 1, 0);
  const options = {
    backgroundColor: BACKGROUND,
    width,
    height,
    pixelRatio,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${zoom})` },
    // Handles and a note's resize controls are editing controls, not part of the diagram.
    filter: (node: HTMLElement) =>
      !node.classList?.contains("react-flow__handle") && !node.classList?.contains("react-flow__resize-control"),
  };
  const url = format === "jpg" ? await toJpeg(viewport, { ...options, quality: 0.95 }) : await toPng(viewport, options);
  return { url, width: Math.round(width * pixelRatio), height: Math.round(height * pixelRatio) };
}

export function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}
