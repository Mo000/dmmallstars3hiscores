export const SKILLS = [
  "overall",
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecraft",
  "hunter",
  "construction"
];

export const COMBAT_SKILLS = [
  "attack",
  "strength",
  "defence",
  "hitpoints",
  "ranged",
  "magic",
  "prayer"
];

export function calcCombatLevel(skills) {
  const level = (skill) => {
    const value = skills[skill]?.level;
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  const attack = level("attack");
  const strength = level("strength");
  const defence = level("defence");
  const hitpoints = level("hitpoints");
  const prayer = level("prayer");
  const ranged = level("ranged");
  const magic = level("magic");

  if ([attack, strength, defence, hitpoints, prayer, ranged, magic].some((value) => value === null)) {
    return -1;
  }

  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * Math.floor(ranged * 1.5);
  const mage = 0.325 * Math.floor(magic * 1.5);

  return Math.floor(base + Math.max(melee, range, mage));
}

export function parseHiscoreLite(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Hiscore response was empty.");
  }

  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((value) => Number(value)));

  const skills = {};
  SKILLS.forEach((skill, index) => {
    const [rank = -1, level = -1, xp = -1] = lines[index] ?? [];
    skills[skill] = {
      rank: Number.isFinite(rank) ? rank : -1,
      level: Number.isFinite(level) ? level : -1,
      xp: Number.isFinite(xp) ? xp : -1
    };
  });

  return {
    overallRank: skills.overall.rank,
    totalLevel: skills.overall.level,
    totalXp: skills.overall.xp,
    combatScore: COMBAT_SKILLS.reduce((sum, skill) => {
      const level = skills[skill]?.level ?? 0;
      return sum + Math.max(0, level);
    }, 0),
    combatLevel: calcCombatLevel(skills),
    skills
  };
}

export function emptyHiscore(error = "Not fetched yet") {
  return {
    overallRank: -1,
    totalLevel: -1,
    totalXp: -1,
    combatScore: -1,
    combatLevel: -1,
    skills: {},
    error
  };
}

export function formatNumber(value) {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-GB").format(value);
}
