// The battlefield: everything that moves. None of this is saved.
// Positions are in CSS pixels. Sizes and speeds come from CONFIG as
// percentages of the screen's shorter side (world.S) and are converted
// with pct().
//
// This file holds the shared pieces and the main update. The things on the
// battlefield each have their own file: units.js (units and their bullets),
// plants.js (trees, bushes and debris) and animals.js.

const world = {
  w: 0,
  h: 0,
  S: 1,              // shorter side of the window, in px
  units: [],
  animals: [],
  plants: [],        // trees and bushes
  plantIn: 0,        // seconds until the next plant appears
  bullets: [],
  effects: [],       // BOOMs and floating text
  debris: [],        // fallen BRANCHes and LEAFs from broken plants (oldest first)
  holes: [],         // HOLEs left where moles dug up or down
  spawnAcc: {},      // per animal type: progress toward the next spawn (spawns at 1)
};

const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseOnField: false, // cursor is over the battlefield (shows the aim circle)
  firing: false,
};

function pct(p) {
  return (p / 100) * world.S;
}

function fontPx(p) {
  return Math.max(CONFIG.text.minPx, pct(p));
}

// ---------- Text measuring (for hit boxes and BOOM sizing) ----------

const measureCtx = document.createElement('canvas').getContext('2d');
const widthCache = new Map();

// Width of `text` at a font size of `px`, in px.
function textWidth(text, px) {
  let w100 = widthCache.get(text);
  if (w100 === undefined) {
    measureCtx.font = `bold 100px ${CONFIG.text.font}`;
    w100 = measureCtx.measureText(text).width;
    widthCache.set(text, w100);
  }
  return (w100 * px) / 100;
}

// Width of a word as drawn with extra letter spacing (fraction of font size).
function wordWidth(text, px, spacing) {
  return textWidth(text, px) + spacing * px * (text.length - 1);
}

// ---------- Setup ----------

function resizeWorld(w, h) {
  if (world.w > 0 && world.h > 0) {
    const sx = w / world.w;
    const sy = h / world.h;
    for (const list of [world.units, world.animals, world.plants, world.bullets, world.effects, world.debris, world.holes]) {
      for (const e of list) {
        e.x *= sx;
        e.y *= sy;
      }
    }
  }
  world.w = w;
  world.h = h;
  world.S = Math.max(1, Math.min(w, h));
}

// Throws away everything on the battlefield and rebuilds the units from state.
function resetWorld() {
  world.units = state.units.map(createUnitEntity);
  world.animals = [];
  world.plants = [];
  for (let i = 0; i < CONFIG.plants.startCount; i++) spawnPlant(true);
  world.plantIn = rand(...CONFIG.plants.spawnEvery);
  world.bullets = [];
  world.effects = [];
  world.debris = [];
  world.holes = [];
  world.spawnAcc = {};
  for (const name of Object.keys(CONFIG.animals)) {
    world.spawnAcc[name] = Math.max(0, 1 - CONFIG.spawn.firstSpawnDelay / spawnSeconds(name));
  }
}

// ---------- Update ----------

function updateWorld(dt) {
  updateSpawning(dt);
  updatePlants(dt);
  for (const u of world.units) updateUnit(u, dt);
  for (const a of world.animals) updateAnimal(a, dt);
  for (const b of world.bullets) updateBullet(b, dt);
  for (const e of world.effects) e.t += dt;
  for (const d of world.debris) d.t += dt;
  for (const h of world.holes) h.t += dt;
  // Hit flashes (see feedback.js) fade out.
  for (const list of [world.animals, world.plants]) {
    for (const e of list) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  }

  world.animals = world.animals.filter(a => !a.dead);
  world.plants = world.plants.filter(p => !p.broken);
  world.bullets = world.bullets.filter(b => !b.dead);
  world.effects = world.effects.filter(e => e.t < e.life);
  world.holes = world.holes.filter(h => h.t < h.life);
}

// ---------- Shared helpers ----------

function clampToScreen(e) {
  const m = pct(1.5);
  e.x = clamp(e.x, m, world.w - m);
  e.y = clamp(e.y, m, world.h - m);
}

// True for an animal that can be shot at: alive and not underground.
function targetable(a) {
  return !!a && !a.dead && !a.hidden;
}

// The closest thing in `list` to (x, y), skipping dead (and underground) ones, or null.
function closestTo(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of list) {
    if (e.dead || e.hidden) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

// Distance from point (px, py) to an entity's rotated word box (0 = inside).
// Works for anything with x, y, angle, halfW and halfH (animals, plants).
function distToWord(a, px, py) {
  const c = Math.cos(-a.angle);
  const s = Math.sin(-a.angle);
  const dx = px - a.x;
  const dy = py - a.y;
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  const ox = Math.max(0, Math.abs(lx) - a.halfW);
  const oy = Math.max(0, Math.abs(ly) - a.halfH);
  return Math.hypot(ox, oy);
}

function floatText(x, y, text, color, italic) {
  world.effects.push({ kind: 'text', x, y, text, color, italic, t: 0, life: 1.1 });
}
