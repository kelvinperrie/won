// The battlefield: everything that moves. None of this is saved.
// Positions are in CSS pixels. Sizes and speeds come from CONFIG as
// percentages of the screen's shorter side (world.S) and are converted
// with pct().

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

// Width of an animal's word as drawn, including its squished letter spacing.
function animalWordWidth(name, px) {
  return wordWidth(name, px, CONFIG.text.animalLetterSpacing);
}

// ---------- Angles ----------

const DEG = Math.PI / 180;

// Signed shortest turn from angle a to angle b, in (-PI, PI].
function angleDiff(a, b) {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d === -Math.PI ? Math.PI : d;
}

// Turns angle a toward b by at most maxStep radians.
function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}

// ---------- Setup ----------

function resizeWorld(w, h) {
  if (world.w > 0 && world.h > 0) {
    const sx = w / world.w;
    const sy = h / world.h;
    for (const list of [world.units, world.animals, world.plants, world.bullets, world.effects, world.debris]) {
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

function startPosition() {
  return { x: world.w / 2, y: world.h - pct(6) };
}

function createUnitEntity(rec) {
  const def = CONFIG.unitTypes[rec.type];
  const ai = !isPlayerUnit(rec);
  const centred = def.startAt === 'center';
  const p = centred ? { x: world.w / 2, y: world.h / 2 } : startPosition();
  // Units face up the screen; something that never moves lies flat, reading normally.
  const facing = def.immobile ? Math.PI : -Math.PI / 2;
  return {
    rec,
    def,
    x: p.x + (ai && !centred ? rand(-pct(3), pct(3)) : 0),
    y: p.y,
    angle: facing,         // direction of travel
    labelAngle: facing,    // direction the word is drawn; turns smoothly toward `angle`
    barrelAngle: -Math.PI / 2, // tanks only
    cooldown: 0,
    webbed: 0,             // seconds left covered in COBWEBS (slower moving and shooting)
    target: null,
    isPlayer: !ai,
  };
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
  world.spawnAcc = {};
  for (const name of Object.keys(CONFIG.animals)) {
    world.spawnAcc[name] = Math.max(0, 1 - CONFIG.spawn.firstSpawnDelay / spawnSeconds(name));
  }
}

// Seconds between spawns for ONE lure of this animal.
function spawnSeconds(name) {
  return CONFIG.animals[name].spawnSeconds || CONFIG.spawn.secondsPerLure;
}

function addUnitEntity(rec) {
  world.units.push(createUnitEntity(rec));
}

// ---------- Update ----------

function updateWorld(dt) {
  updateSpawning(dt);
  updatePlants(dt);
  for (const u of world.units) {
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.webbed = Math.max(0, u.webbed - dt);
    if (u.isPlayer) updatePlayer(u, dt);
    else if (u.def.ai === 'tank') updateTank(u, dt);
    else updateAI(u, dt);

    const rate = u.def.labelTurnRate;
    u.labelAngle = rate ? turnToward(u.labelAngle, u.angle, rate * DEG * dt) : u.angle;
  }
  for (const a of world.animals) updateAnimal(a, dt);
  for (const b of world.bullets) updateBullet(b, dt);
  for (const e of world.effects) e.t += dt;
  for (const d of world.debris) d.t += dt;

  world.animals = world.animals.filter(a => !a.dead);
  world.plants = world.plants.filter(p => !p.broken);
  world.bullets = world.bullets.filter(b => !b.dead);
  world.effects = world.effects.filter(e => e.t < e.life);
}

function clampToScreen(e) {
  const m = pct(1.5);
  e.x = clamp(e.x, m, world.w - m);
  e.y = clamp(e.y, m, world.h - m);
}

function updatePlayer(u, dt) {
  const k = input.keys;
  const dx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const dy = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const speed = pct(unitStat(u, 'speed'));
    u.x += (dx / len) * speed * dt;
    u.y += (dy / len) * speed * dt;
    u.angle = Math.atan2(dy, dx);
    clampToScreen(u);
  }

  if (input.firing && u.cooldown <= 0) {
    // The shot explodes at the point aimed at (or at the range limit), which is
    // exactly where the aim circle shows.
    const aim = playerAim(u);
    fireBullet(u, aim.angle, aim.dist);
    recordPlayerShot();
  }
}

// Where the player's shot will land: the cursor, pulled in to the range limit
// if it's further away. radius is the blast radius (the unit's Power).
function playerAim(u) {
  const ax = input.mouseX - u.x;
  const ay = input.mouseY - u.y;
  const angle = ax || ay ? Math.atan2(ay, ax) : u.angle;
  const range = pct(attrValue(u.rec, 'range'));
  const toMouse = Math.hypot(ax, ay);
  const dist = Math.max(1, Math.min(toMouse, range));
  return {
    angle,
    dist,
    x: u.x + Math.cos(angle) * dist,
    y: u.y + Math.sin(angle) * dist,
    radius: pct(attrValue(u.rec, 'power')),
    limited: toMouse > range,
  };
}

function closestUnit(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const u of world.units) {
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

// Letter spacing for a unit's label (some types squish theirs tighter).
function unitSpacing(u) {
  return u.def.letterSpacing !== undefined ? u.def.letterSpacing : CONFIG.text.unitLetterSpacing;
}

// Half the length of a unit's word as drawn.
function unitHalfWidth(u) {
  return wordWidth(unitLabel(u.rec), fontPx(u.def.textSize || CONFIG.text.unitSize), unitSpacing(u)) / 2;
}

// A unit's speed or shooting speed, cut down while it's covered in COBWEBS.
function unitStat(u, key) {
  const v = attrValue(u.rec, key);
  if (u.webbed > 0 && (key === 'speed' || key === 'fireRate')) return v * (1 - CONFIG.cobwebs.slow);
  return v;
}

function closestAnimal(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const a of world.animals) {
    if (a.dead) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function updateAI(u, dt) {
  // Stick with the current target until it's dead, then pick the closest.
  if (!u.target || u.target.dead) {
    u.target = closestAnimal(u.x, u.y);
    u.inRange = false;
    u.shuffleIn = 0;
  }
  const t = u.target;
  if (!t) return; // nothing to hunt: wait in place

  const dx = t.x - u.x;
  const dy = t.y - u.y;
  const d = Math.hypot(dx, dy);
  const range = pct(attrValue(u.rec, 'range'));

  // Hysteresis: become "in range" at 90% of range, but only go back to
  // chasing past 95%, so small drifts at the edge can't flip it back and forth.
  if (!u.inRange && d <= range * 0.9) u.inRange = true;
  else if (u.inRange && d > range * 0.95) u.inRange = false;

  const speed = pct(unitStat(u, 'speed'));
  if (!u.inRange) {
    const step = Math.min(speed * dt, d - range * 0.85);
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    u.angle = Math.atan2(dy, dx);
    clampToScreen(u);
  } else {
    // In range: shuffle a little while shooting.
    u.shuffleIn = (u.shuffleIn || 0) - dt;
    if (u.shuffleIn <= 0) {
      u.shuffleIn = rand(...CONFIG.ai.shuffleSeconds);
      u.shuffleAngle = pickShuffleAngle(u, Math.atan2(dy, dx), d, range);
    }
    const step = speed * CONFIG.ai.shuffleSpeed * dt;
    u.x += Math.cos(u.shuffleAngle) * step;
    u.y += Math.sin(u.shuffleAngle) * step;
    u.angle = u.shuffleAngle;
    clampToScreen(u);
  }

  if (d <= range * 0.95 && u.cooldown <= 0) {
    // AI aim is a little off, so some shots miss.
    const spread = CONFIG.ai.aimSpread * DEG;
    fireBullet(u, leadAngle(u.x, u.y, t) + rand(-spread, spread));
  }
}

// Angle from (x, y) to where the target will be when a bullet arrives.
function leadAngle(x, y, t) {
  const tFlight = Math.hypot(t.x - x, t.y - y) / pct(CONFIG.bullet.speed);
  return Math.atan2(t.y + t.vy * tFlight - y, t.x + t.vx * tFlight - x);
}

// ---------- Tank ----------

function barrelLength(u) {
  const b = u.def.barrel;
  return wordWidth(b.word, fontPx(b.textSize), CONFIG.text.unitLetterSpacing);
}

// Where shots leave the unit: the barrel tip for a tank, the centre otherwise.
function muzzle(u) {
  if (!u.def.barrel) return { x: u.x, y: u.y };
  const len = barrelLength(u);
  return { x: u.x + Math.cos(u.barrelAngle) * len, y: u.y + Math.sin(u.barrelAngle) * len };
}

// The tank can't change direction instantly: it turns on the spot until it
// faces where it wants to go, then drives forward. The barrel turns on its
// own and fires once it's lined up.
function updateTank(u, dt) {
  const range = pct(attrValue(u.rec, 'range'));
  if (u.def.immobile) {
    // Can't chase, so only bother with animals it can reach: keep the current
    // target while it's in range, otherwise switch to the closest one in range.
    const inReach = a => a && !a.dead && Math.hypot(a.x - u.x, a.y - u.y) <= range * 0.95;
    if (!inReach(u.target)) {
      const c = closestAnimal(u.x, u.y);
      u.target = inReach(c) ? c : null;
    }
  } else if (!u.target || u.target.dead) {
    u.target = closestAnimal(u.x, u.y);
  }
  const t = u.target;
  if (!t) return;

  const d = Math.hypot(t.x - u.x, t.y - u.y);

  // Body
  if (!u.def.immobile && d > range * 0.9) {
    const want = Math.atan2(t.y - u.y, t.x - u.x);
    u.angle = turnToward(u.angle, want, u.def.hullTurnRate * DEG * dt);
    if (Math.abs(angleDiff(u.angle, want)) < 1 * DEG) {
      const step = Math.min(pct(unitStat(u, 'speed')) * dt, d - range * 0.85);
      u.x += Math.cos(u.angle) * step;
      u.y += Math.sin(u.angle) * step;
      clampToScreen(u);
    }
  }

  // Barrel
  const m = muzzle(u);
  const aim = leadAngle(m.x, m.y, t);
  u.barrelAngle = turnToward(u.barrelAngle, aim, u.def.barrel.turnRate * DEG * dt);
  const lined = Math.abs(angleDiff(u.barrelAngle, aim)) < 2 * DEG;
  if (lined && d <= range * 0.95 && u.cooldown <= 0) {
    const spread = CONFIG.ai.aimSpread * DEG;
    fireBullet(u, u.barrelAngle + rand(-spread, spread));
  }
}

// Picks a shuffle direction within 90° of the target (or within 90° of
// directly away from it, if the unit has got too close). If another unit is
// crowding it, it leans as far away from that unit as the 90° cone allows.
function pickShuffleAngle(u, aim, d, range) {
  const center = d < range * CONFIG.ai.tooClose ? aim + Math.PI : aim;
  const half = Math.PI / 2;
  const away = awayFromNeighbour(u);
  const offset = away === null ? rand(-half, half) : clamp(angleDiff(center, away) + rand(-0.35, 0.35), -half, half);
  return center + offset;
}

// Direction away from the nearest unit within personal space, or null.
function awayFromNeighbour(u) {
  let nearest = null;
  let nearestD = pct(CONFIG.ai.personalSpace);
  for (const o of world.units) {
    if (o === u) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = o;
    }
  }
  if (!nearest) return null;
  return nearestD > 0 ? Math.atan2(u.y - nearest.y, u.x - nearest.x) : rand(-Math.PI, Math.PI);
}

// maxDist (optional) makes the shot explode sooner than its full range.
function fireBullet(u, angle, maxDist) {
  const speed = pct(CONFIG.bullet.speed);
  const m = muzzle(u);
  world.bullets.push({
    x: m.x,
    y: m.y,
    word: u.def.projectile || 'BULLET',
    size: u.def.projectileSize || CONFIG.bullet.fontSize,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    travelled: 0,
    maxDist: maxDist !== undefined ? maxDist : pct(attrValue(u.rec, 'range')),
    radius: pct(attrValue(u.rec, 'power')),
    damage: attrValue(u.rec, 'damage'),
    dead: false,
  });
  u.cooldown = 1 / unitStat(u, 'fireRate');
}

function updateBullet(b, dt) {
  if (b.dead) return;
  const speed = Math.hypot(b.vx, b.vy);
  let remaining = speed * dt;
  // Move in small steps so fast bullets can't skip over thin words.
  const maxStep = 4;
  while (remaining > 0) {
    const step = Math.min(maxStep, remaining, b.maxDist - b.travelled);
    b.x += (b.vx / speed) * step;
    b.y += (b.vy / speed) * step;
    b.travelled += step;
    remaining -= step;

    for (const a of world.animals) {
      if (!a.dead && distToWord(a, b.x, b.y) <= 0) {
        explode(b);
        return;
      }
    }
    for (const p of world.plants) {
      if (!p.broken && distToWord(p, b.x, b.y) <= 0) {
        explode(b);
        return;
      }
    }
    if (b.travelled >= b.maxDist - 0.001) {
      explode(b);
      return;
    }
  }
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

function explode(b) {
  b.dead = true;
  world.effects.push({ kind: 'boom', x: b.x, y: b.y, radius: b.radius, t: 0, life: CONFIG.explosion.duration });
  for (const a of world.animals) {
    if (a.dead || distToWord(a, b.x, b.y) > b.radius) continue;
    a.hp -= b.damage;
    if (a.hp <= 0) killAnimal(a);
  }
  for (const p of world.plants) {
    if (p.broken || distToWord(p, b.x, b.y) > b.radius) continue;
    p.damage += b.damage;
    if (p.damage >= plantMaxHp(p)) breakPlant(p);
  }
}

function killAnimal(a) {
  a.dead = true;
  awardKill(a.def.points);
  recordKill(a.name);
  floatText(a.x, a.y, a.def.noise + '!', CONFIG.colors.noise, true);
  if (a.def.points > 0) floatText(a.x, a.y - pct(2.5), '+' + formatNumber(a.def.points), CONFIG.colors.points, false);
}

function floatText(x, y, text, color, italic) {
  world.effects.push({ kind: 'text', x, y, text, color, italic, t: 0, life: 1.1 });
}

// ---------- Plants (trees and bushes) ----------

function plantMaxHp(p) {
  return p.def.health * (p.size / p.def.maxSize);
}

function updatePlants(dt) {
  const cfg = CONFIG.plants;
  world.plantIn -= dt;
  if (!world.plants.some(p => !p.broken)) {
    // The battlefield is bare: start one growing straight away.
    spawnPlant();
    world.plantIn = rand(...cfg.spawnEvery);
  } else if (world.plantIn <= 0) {
    world.plantIn = rand(...cfg.spawnEvery);
    if (world.plants.length < cfg.maxPlants) spawnPlant();
  }

  for (const p of world.plants) {
    const d = p.def;
    p.size = Math.min(d.maxSize, p.size + ((d.maxSize - d.startSize) / d.growSeconds) * dt);
    const px = fontPx(p.size);
    p.px = px;
    p.halfW = (textWidth(p.type, px) + cfg.letterSpacing * px * (p.type.length - 1)) / 2;
    p.halfH = px * 0.45;
  }
}

function pickPlantType() {
  const types = Object.entries(CONFIG.plants.types);
  let r = Math.random() * types.reduce((s, [, d]) => s + d.weight, 0);
  for (const [type, d] of types) {
    r -= d.weight;
    if (r <= 0) return type;
  }
  return types[0][0];
}

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Builds a plant's BRANCHes and LEAFs. Positions and sizes are in units of
// the plant's font size, relative to its centre, so they scale as it grows.
function createPlantDecor(type, def) {
  const dc = CONFIG.plants.decor;
  const sp = CONFIG.plants.letterSpacing;
  const halfLen = wordWidth(type, 1, sp) / 2; // half the main word's length
  const branches = [];
  const leaves = [];
  const leaf = (x, y, angle, size) => leaves.push({ x, y, angle, size });

  if (def.vertical) {
    // Branches fan out from the top of the trunk, leaves cluster at the tips.
    const top = { x: 0, y: -halfLen * 0.9 };
    const n = randInt(...dc.treeBranches);
    const up = -Math.PI / 2;
    const angles = [up - rand(...dc.branchAngle) * DEG, up + rand(...dc.branchAngle) * DEG];
    if (n > 2) angles.push(up + rand(-12, 12) * DEG);
    const len = wordWidth('BRANCH', dc.branchSize, sp);
    for (const a of angles.slice(0, n)) {
      const cx = top.x + Math.cos(a) * (len / 2);
      const cy = top.y + Math.sin(a) * (len / 2);
      branches.push({ x: cx, y: cy, angle: a, size: dc.branchSize });
      const tx = top.x + Math.cos(a) * len;
      const ty = top.y + Math.sin(a) * len;
      // Leaves fan outward from the tip like a spray, each pointing away from it.
      const count = randInt(...dc.leavesPerBranch);
      const leafLen = wordWidth('LEAF', dc.leafSize, sp);
      for (let i = 0; i < count; i++) {
        const f = count === 1 ? 0 : i / (count - 1) - 0.5;
        const la = a + (f * 2 * dc.leafFan + rand(-8, 8)) * DEG;
        const r = leafLen * rand(0.5, 0.75);
        leaf(tx + Math.cos(la) * r, ty + Math.sin(la) * r, la, dc.leafSize);
      }
    }
  } else {
    // A few leaves spaced along the top edge of the bush, lying nearly flat.
    const count = randInt(...dc.bushLeaves);
    for (let i = 0; i < count; i++) {
      const x = lerp(-halfLen * 0.7, halfLen * 0.7, count === 1 ? 0.5 : i / (count - 1)) + rand(-0.1, 0.1);
      leaf(x, -0.5 - rand(0.02, 0.12), Math.PI + rand(-0.35, 0.35), dc.bushLeafSize);
    }
  }
  return { branches, leaves };
}

function spawnPlant(grown = false) {
  const type = pickPlantType();
  const def = CONFIG.plants.types[type];
  // Try a few spots and keep the one furthest from other plants.
  let best = null;
  let bestGap = -1;
  for (let i = 0; i < 25; i++) {
    const x = rand(world.w * 0.06, world.w * 0.94);
    const y = rand(world.h * def.yRange[0], world.h * def.yRange[1]);
    let gap = Infinity;
    for (const p of world.plants) gap = Math.min(gap, Math.hypot(p.x - x, p.y - y));
    if (gap > bestGap) {
      bestGap = gap;
      best = { x, y };
    }
    if (gap >= pct(CONFIG.plants.minGap)) break;
  }
  world.plants.push({
    type,
    def,
    x: best.x,
    y: best.y,
    // Trees stand upright with the T at the top; bushes lie flat, reading left to right.
    angle: def.vertical ? -Math.PI / 2 : Math.PI,
    size: grown ? def.maxSize : def.startSize,
    px: fontPx(grown ? def.maxSize : def.startSize),
    decor: createPlantDecor(type, def),
    halfW: 0,
    halfH: 0,
    damage: 0,
    broken: false,
  });
}

function breakPlant(p) {
  p.broken = true; // no points for plants
  floatText(p.x, p.y, p.def.breakNoise, CONFIG.colors.noise, false);
  // Things living in the plant may jump out (some only from well-grown plants).
  const grown = p.size / p.def.maxSize;
  for (const r of p.def.releases || []) {
    if (grown > (r.minGrowth || 0) && Math.random() < r.chance) releaseTreeAnimal(r.animal, p.x, p.y);
  }
  dropDebris(p);
}

// The broken plant's BRANCHes and LEAFs tumble to the ground around where it
// stood and stay there, until the debris limit pushes the oldest ones out.
function dropDebris(p) {
  const cfg = CONFIG.plants.debris;
  const dc = CONFIG.plants.decor;
  const s = p.px;
  const len = wordWidth(p.type, s, CONFIG.plants.letterSpacing);
  const pieces = [
    ...p.decor.branches.map(b => ({ word: 'BRANCH', from: b, color: dc.branchColor })),
    ...p.decor.leaves.map(l => ({ word: 'LEAF', from: l, color: dc.leafColor })),
  ];
  const extra = randInt(...cfg.extraLeaves);
  const leafSize = p.def.vertical ? dc.leafSize : dc.bushLeafSize;
  for (let i = 0; i < extra; i++) pieces.push({ word: 'LEAF', from: { x: 0, y: 0, size: leafSize }, color: dc.leafColor });

  for (const piece of pieces) {
    const f = piece.from;
    if (f.size * s < 3) continue; // too small to see on a sapling
    // Where it was on the plant, and where it lands: scattered around the plant's centre.
    const sx = p.x + f.x * s;
    const sy = p.y + f.y * s;
    const a = rand(0, Math.PI * 2);
    const r = len * rand(...cfg.scatter);
    const x = p.x + Math.cos(a) * r;
    const y = p.y + Math.sin(a) * r * 0.6; // squashed a little, so it spreads along the ground
    world.debris.push({
      word: piece.word,
      x,
      y,
      fromDx: sx - x, // offset back to where it hung on the plant, for the fall
      fromDy: sy - y,
      angle: rand(0, Math.PI * 2),
      startAngle: f.angle === undefined ? 0 : f.angle,
      size: f.size * p.size, // % of screen, so it scales with the window
      color: mixColor(piece.color, p.def.damagedColor, cfg.fade),
      t: 0,
    });
  }
  while (world.debris.length > cfg.max) world.debris.shift();
}

// ---------- Animals ----------

function animalPx(def) {
  return fontPx(def.textSize || CONFIG.text.animalSize);
}

function updateSpawning(dt) {
  for (const [name, owned] of Object.entries(state.lures)) {
    if (!owned) continue;
    world.spawnAcc[name] += (dt * owned) / spawnSeconds(name);
    let guard = 20;
    while (world.spawnAcc[name] >= 1 && guard-- > 0) {
      if (world.animals.length >= CONFIG.spawn.maxAnimals) {
        world.spawnAcc[name] = 1; // hold until there's room
        break;
      }
      spawnAnimal(name);
      world.spawnAcc[name] -= 1;
    }
  }
}

function spawnAnimal(name) {
  const def = CONFIG.animals[name];
  const size = animalPx(def);
  const halfW = animalWordWidth(name, size) / 2;
  const off = halfW + pct(1);
  let x, y;
  const edge = Math.floor(Math.random() * 3); // 0 left, 1 right, 2 top
  if (edge === 0) {
    x = -off;
    y = rand(world.h * 0.05, world.h * 0.8);
  } else if (edge === 1) {
    x = world.w + off;
    y = rand(world.h * 0.05, world.h * 0.8);
  } else {
    x = rand(world.w * 0.05, world.w * 0.95);
    y = -off;
  }
  // Head toward a random point in the middle of the screen.
  const tx = rand(world.w * 0.2, world.w * 0.8);
  const ty = rand(world.h * 0.2, world.h * 0.7);
  const heading = Math.atan2(ty - y, tx - x);

  addAnimal(name, def, x, y, heading);
  // Announce the arrival once the animal is near the screen.
  floatText(clamp(x, pct(4), world.w - pct(4)), clamp(y, pct(4), world.h - pct(4)), def.noise, CONFIG.colors.noise, true);
}

// A tree animal (e.g. possum) jumps out of a broken tree. It ignores the
// animal cap, wanders for a while, then runs off the nearest edge and is gone.
function releaseTreeAnimal(name, x, y) {
  const def = CONFIG.treeAnimals[name];
  const a = addAnimal(name, def, x, y, rand(0, Math.PI * 2));
  a.entered = true;
  if (def.staySeconds) a.leaveIn = rand(...def.staySeconds);
  floatText(x, y - pct(2.5), def.noise, CONFIG.colors.noise, true);
}

function addAnimal(name, def, x, y, heading) {
  const size = animalPx(def);
  const a = {
    name,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    heading,
    angle: heading,
    turnRate: 0,
    hp: def.health,
    px: size,
    halfW: animalWordWidth(name, size) / 2,
    halfH: size * 0.45,
    entered: false,
    leaveIn: null,   // seconds until it leaves (tree animals only)
    leaving: false,  // heading off the edge; removed once fully off screen
    noiseIn: rand(3, 9),
    abruptTurnIn: rand(...CONFIG.animalWander.abruptTurnEvery),
    dead: false,
  };
  world.animals.push(a);
  return a;
}

// Direction to the nearest screen edge from (x, y).
function nearestEdgeHeading(x, y) {
  const opts = [
    [x, Math.PI],                // left
    [world.w - x, 0],            // right
    [y, -Math.PI / 2],           // top
    [world.h - y, Math.PI / 2],  // bottom
  ];
  opts.sort((p, q) => p[0] - q[0]);
  return opts[0][1];
}

function updateAnimal(a, dt) {
  if (a.dead) return;
  // Keep the hit box in step with the window size.
  const size = animalPx(a.def);
  a.px = size;
  a.halfW = animalWordWidth(a.name, size) / 2;
  a.halfH = size * 0.45;
  const speed = pct(a.def.speed);
  const m = a.halfW * 0.6;

  // Spiders run at the nearest unit, web it, then leave.
  if (a.def.behaviour === 'webber' && !a.leaving) {
    const u = closestUnit(a.x, a.y);
    if (u) {
      a.heading = Math.atan2(u.y - a.y, u.x - a.x);
      if (Math.hypot(u.x - a.x, u.y - a.y) <= unitHalfWidth(u) + pct(CONFIG.cobwebs.reach)) {
        u.webbed = CONFIG.cobwebs.seconds;
        floatText(u.x, u.y - pct(2.5), 'webbed!', CONFIG.colors.noise, true);
        a.leaving = true;
        a.heading = nearestEdgeHeading(a.x, a.y);
      }
    }
    if (!a.leaving) {
      // Make a beeline: no wandering, no sudden turns.
      a.angle = a.heading;
      a.vx = Math.cos(a.heading) * speed;
      a.vy = Math.sin(a.heading) * speed;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      return;
    }
  }

  // Tree animals only stay for a while, then make for the nearest edge.
  if (a.leaveIn !== null && !a.leaving) {
    a.leaveIn -= dt;
    if (a.leaveIn <= 0) {
      a.leaving = true;
      a.heading = nearestEdgeHeading(a.x, a.y);
    }
  }
  if (a.leaving) {
    a.angle = a.heading;
    a.vx = Math.cos(a.heading) * speed;
    a.vy = Math.sin(a.heading) * speed;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    // Gone once the whole word is off screen (no points for escapees).
    const off = a.halfW + pct(1);
    if (a.x < -off || a.x > world.w + off || a.y < -off || a.y > world.h + off) a.dead = true;
    return;
  }

  if (a.entered) {
    // Wander: the turn rate drifts randomly, so paths curve gently.
    a.turnRate = clamp(a.turnRate + rand(-4, 4) * dt, -1.2, 1.2);
    a.heading += a.turnRate * dt;

    // Now and then, an abrupt change of direction.
    a.abruptTurnIn -= dt;
    if (a.abruptTurnIn <= 0) {
      const w = CONFIG.animalWander;
      a.abruptTurnIn = rand(...w.abruptTurnEvery);
      const turn = rand(...w.abruptTurnAngle) * Math.PI / 180;
      a.heading += Math.random() < 0.5 ? -turn : turn;
      a.turnRate = 0;
    }
  }

  a.vx = Math.cos(a.heading) * speed;
  a.vy = Math.sin(a.heading) * speed;
  a.x += a.vx * dt;
  a.y += a.vy * dt;

  if (!a.entered) {
    if (a.x >= m && a.x <= world.w - m && a.y >= m && a.y <= world.h - m) a.entered = true;
  } else {
    // Bounce off the edges: animals can't escape.
    if ((a.x < m && a.vx < 0) || (a.x > world.w - m && a.vx > 0)) {
      a.heading = Math.PI - a.heading;
      a.turnRate = 0;
    }
    if ((a.y < m && a.vy < 0) || (a.y > world.h - m && a.vy > 0)) {
      a.heading = -a.heading;
      a.turnRate = 0;
    }
    a.x = clamp(a.x, m * 0.5, world.w - m * 0.5);
    a.y = clamp(a.y, m * 0.5, world.h - m * 0.5);
  }
  a.angle = a.heading;

  a.noiseIn -= dt;
  if (a.noiseIn <= 0) {
    a.noiseIn = rand(5, 12);
    if (a.entered) floatText(a.x, a.y - pct(2.5), a.def.noise, CONFIG.colors.noise, true);
  }
}
