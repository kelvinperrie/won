// Statistics: the counters behind the STATS tab, and the tab itself.
// Kills per animal, plants broken and the player's own shots are counted in
// achievements.js; the rest live in state.stats (see newStats in state.js).

function recordUnitKill(label) {
  if (!label) return;
  const k = state.stats.killsByUnit;
  k[label] = (k[label] || 0) + 1;
}

function recordAIShot() {
  state.stats.aiShots++;
}

// After every explosion: did a player shot hurt anything, and how many died.
function recordBlast(byPlayer, hitAnimal, kills) {
  if (byPlayer && hitAnimal) state.stats.playerHits++;
  if (kills > state.stats.bestMultiKill) state.stats.bestMultiKill = kills;
}

function recordEscape() {
  state.stats.escaped++;
}

// label is the unit that got webbed, e.g. 'MAN1'. Knockoff Spidey pops up to rub it in.
function recordWebbed(label) {
  state.stats.webbed++;
  toastEvent('webbed', label);
  checkAchievements();
}

function recordTimePlayed(dt) {
  state.stats.timePlayed += dt;
}

// e.g. 75 -> "1m 15s", 4000 -> "1h 06m".
function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

// ---------- The STATS tab ----------

const statsTab = { refreshIn: 0 };

// Keeps the tab up to date while it's showing (twice a second is plenty).
function updateStatsTab(dt) {
  if (ui.tab !== 'stats') return;
  statsTab.refreshIn -= dt;
  if (statsTab.refreshIn > 0) return;
  statsTab.refreshIn = 0.5;
  renderStats();
}

function renderStats() {
  const el = document.getElementById('stats');
  if (!el) return;
  const s = state.stats;
  const n = formatNumber;
  const row = (label, value, opts = {}) =>
    `<tr${opts.muted ? ' class="muted"' : ''}><td${opts.color ? ` style="color: ${opts.color}"` : ''}>${label}</td><td class="val">${value}</td></tr>`;
  const section = (title, rows) => `<h2>${title}</h2><table class="stats-table">${rows.join('')}</table>`;

  const animals = allAnimalTypes();
  const totalKills = Object.values(state.kills).reduce((sum, k) => sum + k, 0);
  const accuracy = state.playerShots ? Math.round((100 * s.playerHits) / state.playerShots) + '%' : '-';

  const animalRows = Object.entries(animals).map(([name, def]) => {
    const kills = state.kills[name] || 0;
    const c = def.color || CONFIG.colors.animal;
    return row(name, n(kills), kills ? { color: `rgb(${c.join(',')})` } : { muted: true });
  });
  const unitRows = state.units.map(rec => {
    const label = unitLabel(rec);
    const kills = s.killsByUnit[label] || 0;
    return row(label + (isPlayerUnit(rec) ? ' (you)' : ''), n(kills), { muted: !kills });
  });
  const plural = type => type + (type.endsWith('SH') ? 'es' : 's'); // TREEs, BUSHes
  const plantRows = Object.keys(CONFIG.plants.types).map(type => row(`${plural(type)} broken`, n(state.plantsBroken[type] || 0)));

  el.innerHTML = [
    section('OVERVIEW', [
      row('Time played', formatDuration(s.timePlayed)),
      row('Nature destroyed', n(state.destroyed)),
      row('Points spent', n(s.pointsSpent)),
      row('Animals killed', n(totalKills)),
      row('Animals that got away', n(s.escaped)),
      row('Most kills in one blast', n(s.bestMultiKill)),
    ]),
    section('SHOOTING', [
      row('Your shots', n(state.playerShots)),
      row('Your shots that hit', n(s.playerHits)),
      row('Your accuracy', accuracy),
      row('AI unit shots', n(s.aiShots)),
      row('Times webbed', n(s.webbed)),
    ]),
    section('KILLS BY ANIMAL', animalRows),
    section('KILLS BY UNIT', unitRows),
    section('PLANTS', plantRows),
  ].join('');
}
