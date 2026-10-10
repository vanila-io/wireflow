// Writes public/sw.js after `next build` (the "build" script runs it, and
// OpenNext runs that script before it copies public/ into the Worker's assets).
// See scripts/sw-template.js and README "Offline".
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const out = join(root, "public/sw.js");

if (process.env.NEXT_PUBLIC_OFFLINE === "off") {
  writeFileSync(out, readFileSync(join(root, "scripts/sw-off.js")));
  console.log("build-sw: wrote the switched-off worker (NEXT_PUBLIC_OFFLINE=off)");
  process.exit(0);
}

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
const url = (base, path) =>
  `${base}/${relative(base === "" ? join(root, "public") : join(root, ".next/static"), path)
    .split(sep)
    .join("/")}`;

if (!existsSync(join(root, ".next/BUILD_ID"))) throw new Error("build-sw: run next build first");
const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim();

const precache = [
  "/app",
  "/manifest.webmanifest",
  "/favicon.ico",
  ...files(join(root, ".next/static")).map((p) => url("/_next/static", p)),
  ...files(join(root, "public"))
    .filter((p) => /\.(svg|png)$/.test(p))
    .map((p) => url("", p)),
].sort();

const version = createHash("sha256").update(buildId).update(precache.join("\n")).digest("hex").slice(0, 16);
const template = readFileSync(join(root, "scripts/sw-template.js"), "utf8");
writeFileSync(
  out,
  template.replace('"__VERSION__"', JSON.stringify(version)).replace("__PRECACHE__", JSON.stringify(precache, null, 1))
);
console.log(`build-sw: wrote public/sw.js (version ${version}, ${precache.length} files)`);
