// Trees and bushes: growing, breaking, and the debris they leave behind.
// Plants give no points; they're just in the way.

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
    p.px = fontPx(p.size);
    p.halfW = wordWidth(p.type, p.px, cfg.letterSpacing) / 2;
    p.halfH = p.px * 0.45;
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
  recordPlantBroken(p.type);
  floatText(p.x, p.y, p.def.breakNoise, CONFIG.colors.noise, false);
  sfx(p.def.vertical ? 'crack' : 'snap', { x: p.x });
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
