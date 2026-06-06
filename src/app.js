import { calcCombatLevel, emptyHiscore, formatNumber } from "./hiscores.js";

const TABLE_SKILLS = ["hitpoints", "attack", "strength", "defence", "magic", "ranged", "prayer"];

const state = {
  players: [],
  team: "all",
  fetchedAt: null,
  sortColumn: "total",
  sortDirection: "desc"
};

const elements = {
  strip: document.querySelector("#team-strip"),
  body: document.querySelector("#players-body"),
  headers: document.querySelectorAll("th[data-sort]")
};

loadPlayers();
setupHeaderClickHandlers();

async function loadPlayers() {
  const response = await fetch("/data/players.json");
  const data = await response.json();
  state.players = data.players;
  state.fetchedAt = data.fetchedAt;
  render();
}

function render() {
  renderTeamStrip();
  renderRows();
  updateSortIndicators();
}

function renderTeamStrip() {
  const teams = new Map();
  state.players.forEach((player) => {
    if (!teams.has(player.team)) {
      teams.set(player.team, {
        team: player.team,
        colour: player.colour,
        accent: player.accent,
        count: 0,
        totalLevel: 0,
        totalXp: 0,
        ranked: 0
      });
    }

    const team = teams.get(player.team);
    team.count += 1;
    if (player.hiscore?.totalLevel > -1) {
      team.totalLevel += player.hiscore.totalLevel;
      team.totalXp += Math.max(0, player.hiscore.totalXp ?? 0);
      team.ranked += 1;
    }
  });

  elements.strip.replaceChildren(
    ...[...teams.values()].map((team) => {
      const card = document.createElement("button");
      card.className = "team-card";
      card.type = "button";
      card.style.setProperty("--accent", team.accent);
      card.dataset.active = state.team === team.team;
      card.addEventListener("click", () => {
        state.team = state.team === team.team ? "all" : team.team;
        render();
      });
      card.innerHTML = `
        <span>${team.team}</span>
        <strong>Total levels: ${formatNumber(team.totalLevel)}</strong>
        <small>Total XP: ${formatNumber(team.totalXp)}</small>
      `;
      return card;
    })
  );
}

function renderRows() {
  const players = filteredPlayers();

  if (players.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="12" class="empty">No player data loaded yet.</td>`;
    elements.body.replaceChildren(row);
    return;
  }

  elements.body.replaceChildren(...players.map(playerRow));
}

function filteredPlayers() {
  let players = state.players
    .filter((player) => state.team === "all" || player.team === state.team)
    .slice();

  if (state.sortColumn) {
    players = sortPlayers(players, state.sortColumn, state.sortDirection);
  } else {
    // Default sort by total level descending
    players = players.sort((a, b) => (b.hiscore?.totalLevel ?? -1) - (a.hiscore?.totalLevel ?? -1));
  }

  return players;
}

function playerRow(player) {
  const row = document.createElement("tr");
  row.style.setProperty("--accent", player.accent);
  const skills = player.hiscore?.skills ?? {};
  const unavailable = player.hiscore?.error;

  row.innerHTML = `
    <td>
      <div class="player-cell">
        <span class="team-dot"></span>
        <div>
          <strong>${player.displayName}${player.captain ? " (c)" : ""}</strong>
          <small>${player.accountName}</small>
        </div>
      </div>
    </td>
    <td>${player.team}</td>
    <td>${formatNumber(player.hiscore?.totalLevel)}</td>
    <td>${formatCompact(player.hiscore?.totalXp)}</td>
    <td class="stat-col">${formatNumber(player.hiscore?.combatLevel ?? calcCombatLevel(skills))}</td>
    ${skillCells(skills)}
  `;

  if (unavailable) {
    row.title = unavailable;
  }

  const hiscoreUrl = `https://secure.runescape.com/m=hiscore_oldschool_tournament/hiscorepersonal?user1=${encodeURIComponent(player.accountName)}`;
  row.addEventListener("click", () => {
    window.open(hiscoreUrl, "_blank", "noopener,noreferrer");
  });

  return row;
}

function skillCells(skills) {
  return TABLE_SKILLS
    .map((skill) => `<td class="skill-col">${formatNumber(skills[skill]?.level)}</td>`)
    .join("");
}

function formatCompact(value) {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function setupHeaderClickHandlers() {
  elements.headers.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.sort;
      handleSort(column);
    });
  });
}

function handleSort(column) {
  // Determine if this is a name column or a level column
  const nameColumns = ["player", "team"];
  const isNameColumn = nameColumns.includes(column);

  if (state.sortColumn === column) {
    // Toggle direction
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    // New column, set initial direction
    state.sortDirection = isNameColumn ? "asc" : "desc";
    state.sortColumn = column;
  }

  render();
}

function sortPlayers(players, column, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  return players.sort((a, b) => {
    let valueA, valueB;

    switch (column) {
      case "player":
        valueA = a.displayName.toLowerCase();
        valueB = b.displayName.toLowerCase();
        break;
      case "team":
        valueA = a.team.toLowerCase();
        valueB = b.team.toLowerCase();
        break;
      case "total":
        valueA = a.hiscore?.totalLevel ?? -1;
        valueB = b.hiscore?.totalLevel ?? -1;
        break;
      case "xp":
        valueA = a.hiscore?.totalXp ?? -1;
        valueB = b.hiscore?.totalXp ?? -1;
        break;
      case "combat":
        valueA = a.hiscore?.combatLevel ?? calcCombatLevel(a.hiscore?.skills ?? {});
        valueB = b.hiscore?.combatLevel ?? calcCombatLevel(b.hiscore?.skills ?? {});
        break;
      default:
        // Skill columns
        valueA = a.hiscore?.skills?.[column]?.level ?? -1;
        valueB = b.hiscore?.skills?.[column]?.level ?? -1;
    }

    if (typeof valueA === "string") {
      return valueA.localeCompare(valueB) * multiplier;
    }

    return (valueA - valueB) * multiplier;
  });
}

function updateSortIndicators() {
  elements.headers.forEach((header) => {
    const indicator = header.querySelector(".sort-indicator");
    const column = header.dataset.sort;

    if (column === state.sortColumn && state.sortDirection) {
      indicator.textContent = state.sortDirection === "asc" ? " ▲" : " ▼";
    } else {
      indicator.textContent = "";
    }
  });
}
