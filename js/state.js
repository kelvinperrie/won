// Persistent game state: points, score, owned units and lures.
// Everything in `state` is saved; the battlefield (world.js) is not.

let state = null;

function makeUnitRecord(type, num) {
  const levels = {};
  for (const key of Object.keys(CONFIG.unitTypes[type].attributes)) levels[key] = 0;
  return { type, num, levels };
}

function newState() {
  const units = [];
  for (const [type, def] of Object.entries(CONFIG.unitTypes)) {
    for (let i = 1; i <= (def.startingCount || 0); i++) units.push(makeUnitRecord(type, i));
  }
  const lures = {};
  for (const [name, def] of Object.entries(CONFIG.animals)) lures[name] = def.startingLures || 0;
  const kills = {};
  for (const name of Object.keys({ ...CONFIG.animals, ...CONFIG.treeAnimals })) kills[name] = 0;
  const plantsBroken = {};
  for (const type of Object.keys(CONFIG.plants.types)) plantsBroken[type] = 0;
  return {
    points: 0,
    destroyed: 0,
    units,
    lures,
    kills,            // per animal type, for achievements
    plantsBroken,     // per plant type (TREE, BUSH), for achievements
    playerShots: 0,   // bullets fired by the player personally (not AI units)
    achievements: {}, // id -> time unlocked (ms)
    stats: newStats(),
  };
}

// Extra counters for the STATS tab (kills, plants and the player's shots above
// are shared with the achievements).
function newStats() {
  return {
    timePlayed: 0,     // seconds the game has been running
    pointsSpent: 0,
    aiShots: 0,        // bullets and SHELLs fired by AI units
    playerHits: 0,     // player shots whose blast hurt at least one animal
    bestMultiKill: 0,  // most animals killed by one blast
    escaped: 0,        // animals that left alive (possums, spiders, moles)
    webbed: 0,         // times a unit was covered in COBWEBS
    killsByUnit: {},   // unit label (MAN1, TANK1...) -> kills
  };
}

// ---------- Unit helpers ----------

function unitLabel(rec) {
  return rec.type + rec.num;
}

function isPlayerUnit(rec) {
  return rec.type === 'MAN' && rec.num === 1;
}

function attrDef(rec, key) {
  return CONFIG.unitTypes[rec.type].attributes[key];
}

function attrValueAt(rec, key, level) {
  const a = attrDef(rec, key);
  return a.base + a.perLevel * level;
}

function attrValue(rec, key) {
  return attrValueAt(rec, key, rec.levels[key]);
}

function attrAtMax(rec, key) {
  const a = attrDef(rec, key);
  return a.maxLevel !== undefined && rec.levels[key] >= a.maxLevel;
}

function attrCost(rec, key) {
  if (attrAtMax(rec, key)) return null;
  const a = attrDef(rec, key);
  return Math.ceil(a.cost * Math.pow(a.costGrowth, rec.levels[key]));
}

function formatAttr(rec, key, value) {
  const a = attrDef(rec, key);
  return value.toFixed(a.decimals) + a.suffix;
}

function unitCount(type) {
  return state.units.filter(u => u.type === type).length;
}

function nextUnitNum(type) {
  let max = 0;
  for (const u of state.units) if (u.type === type && u.num > max) max = u.num;
  return max + 1;
}

function unitAtMax(type) {
  const max = CONFIG.unitTypes[type].maxCount;
  return max !== undefined && unitCount(type) >= max;
}

// Price of the next unit of this type, or null if the limit is reached.
function unitCost(type) {
  const def = CONFIG.unitTypes[type];
  if (unitAtMax(type)) return null;
  const extra = Math.max(0, unitCount(type) - (def.startingCount || 0));
  return Math.ceil(def.cost * Math.pow(def.costGrowth, extra));
}

// ---------- Lure helpers ----------

function lureCost(name) {
  const def = CONFIG.animals[name];
  const extra = Math.max(0, state.lures[name] - (def.startingLures || 0));
  return Math.ceil(def.lureCost * Math.pow(def.lureCostGrowth, extra));
}

// ---------- Purchases (each saves straight away) ----------

function spend(cost) {
  if (cost === null || state.points < cost) return false;
  state.points -= cost;
  state.stats.pointsSpent += cost;
  return true;
}

function buyUpgrade(rec, key) {
  if (!spend(attrCost(rec, key))) return false;
  rec.levels[key]++;
  saveGame();
  return true;
}

function buyUnit(type) {
  if (!spend(unitCost(type))) return null;
  const rec = makeUnitRecord(type, nextUnitNum(type));
  state.units.push(rec);
  saveGame();
  return rec;
}

function buyLure(name) {
  if (!spend(lureCost(name))) return false;
  state.lures[name]++;
  saveGame();
  return true;
}

function awardKill(points) {
  state.points += points;
  state.destroyed += points;
}

// ---------- Save / load ----------

function saveGame() {
  try {
    const data = { version: CONFIG.save.version, ...state };
    localStorage.setItem(CONFIG.save.key, JSON.stringify(data));
  } catch (e) {
    // Storage blocked or full: the game keeps running, it just won't persist.
  }
}

// Reads the save and rebuilds a clean state from it, ignoring anything
// malformed or unknown so a bad save can never break the game.
function loadGame() {
  const fresh = newState();
  let data;
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return fresh;
    data = JSON.parse(raw);
  } catch (e) {
    return fresh;
  }
  if (!data || typeof data !== 'object') return fresh;
  data = migrateSave(data);
  if (!data) return fresh;

  const s = fresh;
  if (Number.isFinite(data.points) && data.points >= 0) s.points = Math.floor(data.points);
  if (Number.isFinite(data.destroyed) && data.destroyed >= 0) s.destroyed = Math.floor(data.destroyed);

  if (Array.isArray(data.units)) {
    const seen = new Set();
    const units = [];
    for (const u of data.units) {
      if (!u || !CONFIG.unitTypes[u.type] || !isNonNegInt(u.num) || u.num < 1) continue;
      const id = u.type + u.num;
      if (seen.has(id)) continue;
      seen.add(id);
      const rec = makeUnitRecord(u.type, u.num);
      for (const key of Object.keys(rec.levels)) {
        const lvl = u.levels && u.levels[key];
        if (isNonNegInt(lvl)) {
          const max = attrDef(rec, key).maxLevel;
          rec.levels[key] = max === undefined ? lvl : Math.min(lvl, max);
        }
      }
      units.push(rec);
    }
    // The player's MAN1 must always exist.
    if (!seen.has('MAN1')) units.unshift(makeUnitRecord('MAN', 1));
    // Respect per-type limits (keeps the earliest-bought units).
    const counts = {};
    s.units = units.filter(u => {
      counts[u.type] = (counts[u.type] || 0) + 1;
      const max = CONFIG.unitTypes[u.type].maxCount;
      return max === undefined || counts[u.type] <= max;
    });
  }

  if (data.lures && typeof data.lures === 'object') {
    for (const name of Object.keys(s.lures)) {
      if (isNonNegInt(data.lures[name])) s.lures[name] = data.lures[name];
    }
  }

  // Achievement progress (older saves won't have these; they start from zero).
  if (data.kills && typeof data.kills === 'object') {
    for (const name of Object.keys(s.kills)) {
      if (isNonNegInt(data.kills[name])) s.kills[name] = data.kills[name];
    }
  }
  if (data.plantsBroken && typeof data.plantsBroken === 'object') {
    for (const type of Object.keys(s.plantsBroken)) {
      if (isNonNegInt(data.plantsBroken[type])) s.plantsBroken[type] = data.plantsBroken[type];
    }
  }
  if (isNonNegInt(data.playerShots)) s.playerShots = data.playerShots;
  if (data.achievements && typeof data.achievements === 'object') {
    const known = new Set(ACHIEVEMENTS.map(a => a.id));
    for (const [id, when] of Object.entries(data.achievements)) {
      if (known.has(id) && Number.isFinite(when) && when > 0) s.achievements[id] = when;
    }
  }

  // Statistics (older saves won't have these either).
  const st = data.stats;
  if (st && typeof st === 'object') {
    for (const key of ['pointsSpent', 'aiShots', 'playerHits', 'bestMultiKill', 'escaped', 'webbed']) {
      if (isNonNegInt(st[key])) s.stats[key] = st[key];
    }
    if (Number.isFinite(st.timePlayed) && st.timePlayed >= 0) s.stats.timePlayed = st.timePlayed;
    if (st.killsByUnit && typeof st.killsByUnit === 'object') {
      for (const [label, n] of Object.entries(st.killsByUnit)) {
        if (/^[A-Z]+\d+$/.test(label) && isNonNegInt(n)) s.stats.killsByUnit[label] = n;
      }
    }
  }
  return s;
}

// Upgrades older save formats to the current one. Returns null if the save
// can't be understood.
function migrateSave(data) {
  if (data.version === CONFIG.save.version) return data;
  return null;
}

function resetGame() {
  state = newState();
  saveGame();
}
