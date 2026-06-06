import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const configDir = fileURLToPath(new URL("../.wrangler-config/", import.meta.url));
const wranglerBin = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
await mkdir(configDir, { recursive: true });

const args = [
  wranglerBin,
  "pages",
  "dev",
  ".",
  "--compatibility-date=2026-06-06",
  ...process.argv.slice(2)
];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configDir
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }

  process.exit(code ?? 0);
});
