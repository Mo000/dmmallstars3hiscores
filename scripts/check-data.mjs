import fs from "node:fs/promises";
import { parseHiscoreLite } from "../src/hiscores.js";

const roster = JSON.parse(
  await fs.readFile(new URL("../data/players.json", import.meta.url), "utf8")
);
const required = ["id", "displayName", "accountName", "team", "teamCode", "colour", "accent"];
const seen = new Set();

for (const player of roster) {
  for (const key of required) {
    if (!player[key]) {
      throw new Error(`${player.id ?? "Unknown player"} is missing ${key}`);
    }
  }

  if (seen.has(player.id)) {
    throw new Error(`Duplicate player id: ${player.id}`);
  }

  seen.add(player.id);
}

const fixture = await fs.readFile(new URL("./fixture-hiscore.txt", import.meta.url), "utf8");
const parsed = parseHiscoreLite(fixture);

if (parsed.totalLevel !== 2277 || parsed.skills.attack.level !== 99 || parsed.combatLevel !== 126) {
  throw new Error("Hiscore parser fixture failed.");
}

console.log(`Checked ${roster.length} players and hiscore parser fixture.`);
