import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyHiscore, parseHiscoreLite } from "../src/hiscores.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = readPort(process.argv) ?? 8788;
const hiscoresUrl = "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const cacheMs = 120_000;
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
  if (playersCache && Date.now() - playersCache.cachedAt < cacheMs) {
    return playersCache.data;
  }

  const rosterData = JSON.parse(await readFile(join(root, "data/players.json"), "utf8"));
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
    data
  };

  return data;
}

async function fetchPlayer(player) {
  const url = new URL(hiscoresUrl);
  url.searchParams.set("player", player.accountName);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "dmm3hiscores/0.1 unofficial fan project"
      }
    });

    if (!response.ok) {
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
    return {
      ...player,
      hiscore: emptyHiscore(error instanceof Error ? error.message : "Lookup failed")
    };
  }
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
