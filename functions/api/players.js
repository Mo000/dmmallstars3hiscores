import { emptyHiscore, parseHiscoreLite } from "../../src/hiscores.js";

const HISCORES_URL =
  "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const CACHE_SECONDS = 120;

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/api/players");
  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  const fetchedAt = new Date().toISOString();
  const roster = await loadRoster(request, env);
  const players = await Promise.all(roster.map((player) => fetchPlayer(player)));
  const response = Response.json(
    {
      fetchedAt,
      source: HISCORES_URL,
      players
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "Access-Control-Allow-Origin": "*"
      }
    }
  );

  await cache.put(cacheKey, response.clone());
  return response;
}

async function loadRoster(request, env) {
  const url = new URL("/data/players.json", request.url);
  const response = env?.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load roster: ${response.status}`);
  }

  return response.json();
}

async function fetchPlayer(player) {
  const url = new URL(HISCORES_URL);
  url.searchParams.set("player", player.accountName);

  try {
    const response = await fetch(url, {
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

