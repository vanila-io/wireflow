// One-off generator: builds the full favicon + PWA icon set from the
// Wireflow logo. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import fs from "node:fs";

const SRC = "public/wireflow-logo.png";
const BLUE = "#465BFF";

async function main() {
  // Tight-crop the logo (it sits on solid white), shrink to leave a small
  // breathing margin, then square-pad to 512 on white
  const png = await sharp(SRC)
    .trim({ threshold: 10 })
    .resize(450, 450, { fit: "contain", background: "#ffffff" })
    .extend({
      top: 31,
      bottom: 31,
      left: 31,
      right: 31,
      background: "#ffffff",
    })
    .png()
    .toBuffer();

  // Maskable: safe-zone padded, full-bleed background so Android circles crop cleanly.
  async function maskable(size) {
    const inner = Math.round(size * 0.75); // W occupies the safe zone
    const art = await sharp(png).resize(inner, inner, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    return sharp({
      create: { width: size, height: size, channels: 3, background: BLUE },
    })
      .composite([{ input: art, gravity: "center" }])
      .png()
      .toBuffer();
  }

  // PWA icons (any)
  await sharp(png).resize(192, 192).png().toFile("public/icon-192.png");
  await sharp(png).resize(512, 512).png().toFile("public/icon-512.png");
  // Maskable variants: brand-blue full bleed so Android circular masks crop cleanly
  fs.writeFileSync("public/icon-512-maskable.png", await maskable(512));
  fs.writeFileSync("public/icon-192-maskable.png", await maskable(192));

  // Conventional favicon files (declared explicitly in layout metadata.icons)
  await sharp(png).resize(16, 16, { kernel: "lanczos3" }).png().toFile("public/favicon-16x16.png");
  await sharp(png).resize(32, 32, { kernel: "lanczos3" }).png().toFile("public/favicon-32x32.png");
  await sharp(png).resize(180, 180).png().toFile("public/apple-touch-icon.png");

  // favicon.ico — ICO container embedding 16/32/48 PNG payloads
  const sizes = [16, 32, 48];
  const bufs = [];
  for (const s of sizes) {
    bufs.push(
      await sharp(png).resize(s, s, { kernel: "lanczos3" }).png().toBuffer()
    );
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4); // image count

  const entries = [];
  let offset = 6 + sizes.length * 16;
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0); // width (no 256 sizes here)
    e.writeUInt8(sizes[i], 1); // height
    e.writeUInt16LE(1, 2); // color planes
    e.writeUInt16LE(32, 4); // bits per pixel
    e.writeUInt32LE(bufs[i].length, 8); // byte size
    e.writeUInt32LE(offset, 12); // offset
    offset += bufs[i].length;
    entries.push(e);
  }

  const ico = Buffer.concat([header, ...entries, ...bufs]);
  fs.writeFileSync("public/favicon.ico", ico);
  console.log("icons written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
