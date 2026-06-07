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

for (const entry of staticEntries) {
  try {
    await cp(new URL(`../${entry}`, import.meta.url), new URL(`../dist/${entry}`, import.meta.url), {
      recursive: true
    });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

console.log(`Built static site to ${dist.replace(root, "")}`);
