import { readFile, writeFile } from "node:fs/promises";
import { emptyHiscore, parseHiscoreLite } from "../src/hiscores.js";

const HISCORES_URL = "https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws";
const ROSTER_FILE = "data/players.json";

async function main() {
  console.log("Fetching hiscores data...");
  
  const roster = JSON.parse(await readFile(ROSTER_FILE, "utf8"));
  const players = await Promise.all(roster.map(fetchPlayer));
  
  const data = {
    fetchedAt: new Date().toISOString(),
    source: HISCORES_URL,
    players
  };
  
  await writeFile(ROSTER_FILE, JSON.stringify(data, null, 2), "utf8");
  console.log("Hiscores data updated successfully");
}

async function fetchPlayer(player) {
  const url = new URL(HISCORES_URL);
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

main().catch(error => {
  console.error("Error fetching hiscores:", error);
  process.exit(1);
});
