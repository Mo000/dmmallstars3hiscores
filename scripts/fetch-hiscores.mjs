import { readFile, writeFile } from "node:fs/promises";
import { emptyHiscore, parseHiscoreLite } from "../src/hiscores.js";

const HISCORES_URL = "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const ROSTER_FILE = "data/players.json";
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 350;
const HISCORES_DOWN_START_UTC_HOUR = 4;
const HISCORES_DOWN_END_UTC_HOUR = 10;

async function main() {
  if (hiscoresAreDown()) {
    console.log("Hiscores are unavailable between 04:00 and 10:00 UTC. Keeping existing snapshot.");
    return;
  }

  console.log("Fetching hiscores data...");
  
  const data = JSON.parse(await readFile(ROSTER_FILE, "utf8"));
  const roster = Array.isArray(data) ? data : data.players;

  if (!Array.isArray(roster)) {
    throw new Error(`${ROSTER_FILE} must be an array or an object with a players array.`);
  }

  const players = await Promise.all(roster.map(fetchPlayer));
  
  const updatedData = {
    fetchedAt: new Date().toISOString(),
    source: HISCORES_URL,
    players
  };
  
  await writeFile(ROSTER_FILE, JSON.stringify(updatedData, null, 2), "utf8");
  console.log("Hiscores data updated successfully");
}

async function fetchPlayer(player) {
  const url = new URL(HISCORES_URL);
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

main().catch(error => {
  console.error("Error fetching hiscores:", error);
  process.exit(1);
});
