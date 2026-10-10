// The user's own image as a card (#86, #69): read a picked or dropped file,
// scale it down in the browser and encode it as a JPEG data URL small enough
// to keep in this browser's storage (lib/diagram/model.ts: MAX_IMAGE_SIDE,
// MAX_IMAGE_CHARS). Transparent areas become white, like the cards.
import { MAX_IMAGE_CHARS, MAX_IMAGE_SIDE } from "@/lib/diagram/model";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
// Larger files are refused before decoding: they could stall the tab.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ImageError extends Error {}

export type PreparedImage = { src: string; ratio: number; width: number; height: number; label: string };

/** The file's name without its extension, as the card's label. */
export const imageLabel = (name: string) => name.replace(/\.[^.]+$/, "").trim().slice(0, 60) || "Image";

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ImageError("Wireflow takes PNG, JPEG, WebP or GIF images.");
  if (file.size > MAX_FILE_BYTES) throw new ImageError("It's larger than 25 MB.");
  let bitmap: ImageBitmap;
  try {
    // Turned the way the camera held it (EXIF orientation), as browsers show it.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("It couldn't be read as an image.");
  }
  try {
    for (let side = MAX_IMAGE_SIDE; side >= 320; side = Math.round(side * 0.75)) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.85, 0.7]) {
        const src = canvas.toDataURL("image/jpeg", quality);
        if (src.length <= MAX_IMAGE_CHARS) return { src, ratio: height / width, width, height, label: imageLabel(file.name) };
      }
    }
  } finally {
    bitmap.close();
  }
  throw new ImageError("It has too much detail to keep in this browser, even scaled down.");
}

// How much this site can keep in localStorage, in characters. Browsers don't
// say: Chromium and Firefox refuse more than 5 Mi characters (5,242,880,
// measured with Playwright 1.63), and Safari's limit is also about 5 MB.
// Counting 5 million leaves some room.
export const STORAGE_CHARS = 5_000_000;

/** Characters this site has in localStorage (keys and values). */
export function storageUse(storage: Storage): number {
  let used = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    used += key.length + (storage.getItem(key)?.length ?? 0);
  }
  return used;
}

export const megabytes = (chars: number) => (chars / 1_000_000).toFixed(1);
