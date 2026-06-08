import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyHiscore, parseHiscoreLite } from "../src/hiscores.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = readPort(process.argv) ?? 8788;
const hiscoresUrl = "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const cacheMs = 120_000;
const errorCacheMs = 15_000;
const snapshotCacheMs = 300_000;
const retryStatuses = new Set([429, 500, 502, 503, 504]);
const retryDelayMs = 350;
const hiscoresDownStartUtcHour = 4;
const hiscoresDownEndUtcHour = 10;
let playersCache = null;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/players") {
      await sendJson(response, await getPlayers());
      return;
    }

    await sendStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DMM hiscores dev server: http://127.0.0.1:${port}/`);
});

function readPort(args) {
  const portIndex = args.indexOf("--port");
  const raw = portIndex >= 0 ? args[portIndex + 1] : undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getPlayers() {
  if (playersCache && Date.now() - playersCache.cachedAt < playersCache.cacheMs) {
    return playersCache.data;
  }

  const rosterData = JSON.parse(await readFile(join(root, "data/players.json"), "utf8"));

  if (hiscoresAreDown()) {
    const snapshot = Array.isArray(rosterData)
      ? {
          fetchedAt: null,
          source: hiscoresUrl,
          players: rosterData
        }
      : rosterData;

    const data = {
      ...snapshot,
      snapshot: true,
      snapshotReason: "Hiscores are unavailable between 04:00 and 10:00 UTC."
    };

    playersCache = {
      cachedAt: Date.now(),
      cacheMs: Math.min(snapshotCacheMs, msUntilHiscoresReturn()),
      data
    };

    return data;
  }

  const roster = Array.isArray(rosterData) ? rosterData : rosterData.players;

  if (!Array.isArray(roster)) {
    throw new Error("players.json must be an array or an object with a players array.");
  }

  const players = await Promise.all(roster.map(fetchPlayer));
  const data = {
    fetchedAt: new Date().toISOString(),
    source: hiscoresUrl,
    players
  };

  playersCache = {
    cachedAt: Date.now(),
    cacheMs: players.some((player) => player.hiscore?.error) ? errorCacheMs : cacheMs,
    data
  };

  return data;
}

async function fetchPlayer(player) {
  const url = new URL(hiscoresUrl);
  url.searchParams.set("player", player.accountName);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "dmm3hiscores/0.1 unofficial fan project"
        }
      });

      if (!response.ok) {
        if (attempt === 0 && retryStatuses.has(response.status)) {
          await delay(retryDelayMs);
          continue;
        }

        return {
          ...player,
          hiscore: emptyHiscore(`Hiscores returned ${response.status}`)
        };
      }

      return {
        ...player,
        hiscore: parseHiscoreLite(await response.text())
      };
    } catch (error) {
      if (attempt === 0) {
        await delay(retryDelayMs);
        continue;
      }

      return {
        ...player,
        hiscore: emptyHiscore(error instanceof Error ? error.message : "Lookup failed")
      };
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hiscoresAreDown(date = new Date()) {
  const hour = date.getUTCHours();
  return hour >= hiscoresDownStartUtcHour && hour < hiscoresDownEndUtcHour;
}

function msUntilHiscoresReturn(date = new Date()) {
  const end = new Date(date);
  end.setUTCHours(hiscoresDownEndUtcHour, 0, 0, 0);
  return Math.max(1000, end.getTime() - date.getTime());
}

async function sendStatic(response, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = normalize(join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(file);
  } catch {
    const file = await readFile(join(root, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(file);
  }
}

async function sendJson(response, value) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30"
  });
  response.end(JSON.stringify(value));
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };

  return types[extname(filePath)] ?? "application/octet-stream";
}
