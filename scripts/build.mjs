import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = fileURLToPath(new URL("../dist/", import.meta.url));

const staticEntries = [
  "index.html",
  "src",
  "icons",
  "data",
  "public",
  "runescape_uf.ttf"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all(
  staticEntries.map((entry) =>
    cp(new URL(`../${entry}`, import.meta.url), new URL(`../dist/${entry}`, import.meta.url), {
      recursive: true
    })
  )
);

console.log(`Built static site to ${dist.replace(root, "")}`);
