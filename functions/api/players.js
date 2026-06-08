import { emptyHiscore, parseHiscoreLite } from "../../src/hiscores.js";

const HISCORES_URL =
  "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const CACHE_SECONDS = 120;
const SNAPSHOT_CACHE_SECONDS = 300;
const ERROR_CACHE_SECONDS = 15;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 350;
const HISCORES_DOWN_START_UTC_HOUR = 4;
const HISCORES_DOWN_END_UTC_HOUR = 10;

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/api/players");
  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  if (hiscoresAreDown()) {
    const snapshot = await loadSnapshot(request, env);
    const response = jsonResponse(
      {
        ...snapshot,
        snapshot: true,
        snapshotReason: "Hiscores are unavailable between 04:00 and 10:00 UTC."
      },
      Math.min(SNAPSHOT_CACHE_SECONDS, secondsUntilHiscoresReturn())
    );

    await cache.put(cacheKey, response.clone());
    return response;
  }

  const fetchedAt = new Date().toISOString();
  const roster = await loadRoster(request, env);
  const players = await Promise.all(roster.map((player) => fetchPlayer(player)));
  const cacheSeconds = players.some((player) => player.hiscore?.error)
    ? ERROR_CACHE_SECONDS
    : CACHE_SECONDS;
  const response = jsonResponse(
    {
      fetchedAt,
      source: HISCORES_URL,
      players
    },
    cacheSeconds
  );

  await cache.put(cacheKey, response.clone());
  return response;
}

async function loadSnapshot(request, env) {
  const url = new URL("/data/players.json", request.url);
  const response = env?.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load snapshot: ${response.status}`);
  }

  return response.json();
}

async function loadRoster(request, env) {
  const data = await loadSnapshot(request, env);
  const roster = Array.isArray(data) ? data : data.players;

  if (!Array.isArray(roster)) {
    throw new Error("Roster must be an array or an object with a players array.");
  }

  return roster;
}

async function fetchPlayer(player) {
  const url = new URL(HISCORES_URL);
  url.searchParams.set("player", player.accountName);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "dmm3hiscores/0.1 unofficial fan project"
        }
      });

      if (!response.ok) {
        if (attempt === 0 && RETRY_STATUSES.has(response.status)) {
          await delay(RETRY_DELAY_MS);
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
        await delay(RETRY_DELAY_MS);
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
  return hour >= HISCORES_DOWN_START_UTC_HOUR && hour < HISCORES_DOWN_END_UTC_HOUR;
}

function secondsUntilHiscoresReturn(date = new Date()) {
  const end = new Date(date);
  end.setUTCHours(HISCORES_DOWN_END_UTC_HOUR, 0, 0, 0);
  return Math.max(1, Math.ceil((end.getTime() - date.getTime()) / 1000));
}

function jsonResponse(data, cacheSeconds) {
  return Response.json(data, {
    headers: {
      "Cache-Control": `public, max-age=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*"
    }
  });
}
