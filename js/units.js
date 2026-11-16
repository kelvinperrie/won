// Units on the battlefield (the player's MAN1 and the AI units) and the
// bullets they fire.

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

function addUnitEntity(rec) {
  world.units.push(createUnitEntity(rec));
}

function updateUnit(u, dt) {
  u.cooldown = Math.max(0, u.cooldown - dt);
  u.webbed = Math.max(0, u.webbed - dt);
  if (u.isPlayer) updatePlayer(u, dt);
  else if (u.def.ai === 'tank') updateTank(u, dt);
  else updateAI(u, dt);

  const rate = u.def.labelTurnRate;
  u.labelAngle = rate ? turnToward(u.labelAngle, u.angle, rate * DEG * dt) : u.angle;
}

// ---------- Unit helpers ----------

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

// Angle from (x, y) to where the target will be when a bullet arrives.
function leadAngle(x, y, t) {
  const tFlight = Math.hypot(t.x - x, t.y - y) / pct(CONFIG.bullet.speed);
  return Math.atan2(t.y + t.vy * tFlight - y, t.x + t.vx * tFlight - x);
}

// ---------- Player ----------

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

// ---------- AI MANs ----------

function updateAI(u, dt) {
  // Stick with the current target until it's dead (or gone underground), then pick the closest.
  if (!targetable(u.target)) {
    u.target = closestTo(world.animals, u.x, u.y);
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
  const nearest = closestTo(world.units.filter(o => o !== u), u.x, u.y);
  if (!nearest) return null;
  const d = Math.hypot(nearest.x - u.x, nearest.y - u.y);
  if (d >= pct(CONFIG.ai.personalSpace)) return null;
  return d > 0 ? Math.atan2(u.y - nearest.y, u.x - nearest.x) : rand(-Math.PI, Math.PI);
}

// ---------- Tanks and artillery ----------

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
  const minRange = pct(u.def.minRange || 0);
  if (u.def.immobile) {
    // Can't chase, so only bother with animals it can reach: keep the current
    // target while it's in reach, otherwise switch to the closest one in reach.
    // Anything inside minRange is too close to shoot at.
    const inReach = a => {
      if (!targetable(a)) return false;
      const d = Math.hypot(a.x - u.x, a.y - u.y);
      return d >= minRange && d <= range * 0.95;
    };
    if (!inReach(u.target)) u.target = closestTo(world.animals.filter(inReach), u.x, u.y);
  } else if (!targetable(u.target)) {
    u.target = closestTo(world.animals, u.x, u.y);
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
  if (lined && d >= minRange && d <= range * 0.95 && u.cooldown <= 0) {
    const spread = CONFIG.ai.aimSpread * DEG;
    fireBullet(u, u.barrelAngle + rand(-spread, spread));
  }
}

// ---------- Bullets ----------

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
    shooter: unitLabel(u.rec), // who gets the credit for kills (STATS tab)
    byPlayer: u.isPlayer,
    isShell: !!u.def.barrel,
    dead: false,
  });
  u.cooldown = 1 / unitStat(u, 'fireRate');
  if (!u.isPlayer) recordAIShot();
  sfx(u.isPlayer ? 'shot' : u.def.barrel ? 'shell' : 'aiShot', { x: m.x });
}

// True if (x, y) is inside any live animal's or plant's word.
// Underground moles can't be hit.
function hitsSomething(x, y) {
  for (const a of world.animals) if (targetable(a) && distToWord(a, x, y) <= 0) return true;
  for (const p of world.plants) if (!p.broken && distToWord(p, x, y) <= 0) return true;
  return false;
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
    if (hitsSomething(b.x, b.y) || b.travelled >= b.maxDist - 0.001) {
      explode(b);
      return;
    }
  }
}

function explode(b) {
  b.dead = true;
  world.effects.push({ kind: 'boom', x: b.x, y: b.y, radius: b.radius, t: 0, life: CONFIG.explosion.duration });
  // A blast the size of the biggest SHELL (15% radius) makes the biggest sound.
  sfx('boom', { x: b.x, size: b.radius / pct(15) });
  const shake = CONFIG.feedback.shake;
  if (b.isShell) addShake(shake.shell);
  else if (b.byPlayer) addShake(shake.bullet);

  const flash = CONFIG.feedback.hitFlashSeconds;
  let hit = false;
  let kills = 0;
  for (const a of world.animals) {
    if (!targetable(a) || distToWord(a, b.x, b.y) > b.radius) continue;
    hit = true;
    a.hp -= b.damage;
    a.flash = flash;
    if (a.hp <= 0) {
      killAnimal(a, b.shooter);
      kills++;
    }
  }
  for (const p of world.plants) {
    if (p.broken || distToWord(p, b.x, b.y) > b.radius) continue;
    p.damage += b.damage;
    p.flash = flash;
    if (p.damage >= plantMaxHp(p)) breakPlant(p);
  }
  recordBlast(b.byPlayer, hit, kills);
}
