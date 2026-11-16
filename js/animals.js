// Animals: spawning from lures, tree animals jumping out of broken plants,
// how they move, and what happens when they're killed.

function animalPx(def) {
  return fontPx(def.textSize || CONFIG.text.animalSize);
}

// Width of an animal's word as drawn, including its squished letter spacing.
function animalWordWidth(name, px) {
  return wordWidth(name, px, CONFIG.text.animalLetterSpacing);
}

// Keeps an animal's font size and hit box in step with the window size.
function sizeAnimal(a) {
  a.px = animalPx(a.def);
  a.halfW = animalWordWidth(a.name, a.px) / 2;
  a.halfH = a.px * 0.45;
}

// Seconds between spawns for ONE lure of this animal.
function spawnSeconds(name) {
  return CONFIG.animals[name].spawnSeconds || CONFIG.spawn.secondsPerLure;
}

// ---------- Spawning ----------

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
  if (def.behaviour === 'burrower') return spawnBurrower(name, def);
  const off = animalWordWidth(name, animalPx(def)) / 2 + pct(1);
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

// ---------- Moles ----------

// A mole digs up out of the ground somewhere on the battlefield, away from
// plants and units. It's underground (can't be hit or targeted) until it's out.
function spawnBurrower(name, def) {
  const spot = pickDigSpot();
  const a = addAnimal(name, def, spot.x, spot.y, rand(0, Math.PI * 2));
  a.entered = true;
  a.hidden = true;
  a.phase = 'emerging'; // then 'up', then 'burrowing'
  a.phaseT = 0;
  a.surfaceFor = rand(...def.burrow.surfaceSeconds);
  digAt(a.x, a.y);
  floatText(a.x, a.y - pct(2.5), def.noise, CONFIG.colors.noise, true);
  return a;
}

// A random spot well inside the battlefield, trying to keep clear of plants
// and units so the mole doesn't pop up inside a TREE or right under a MAN.
function pickDigSpot() {
  let best = null;
  let bestGap = -1;
  for (let i = 0; i < 20; i++) {
    const x = rand(world.w * 0.1, world.w * 0.9);
    const y = rand(world.h * 0.12, world.h * 0.85);
    let gap = Infinity;
    for (const p of world.plants) gap = Math.min(gap, distToWord(p, x, y));
    for (const u of world.units) gap = Math.min(gap, Math.hypot(u.x - x, u.y - y) / 2);
    if (gap > bestGap) {
      bestGap = gap;
      best = { x, y };
    }
    if (gap >= pct(6)) break;
  }
  return best;
}

// Breaking through the ground, up or down: leaves a HOLE, throws up some
// dirt, and gives a little rumble.
function digAt(x, y) {
  const d = CONFIG.digging;
  world.holes.push({ x, y, t: 0, life: d.holeSeconds });
  const n = randInt(...d.dirtCount);
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + rand(-1.1, 1.1); // mostly upward
    const speed = pct(rand(...d.dirtSpeed));
    world.effects.push({
      kind: 'dirt',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: rand(-8, 8),
      t: 0,
      life: d.dirtSeconds,
    });
  }
  sfx('dig', { x });
  addShake(CONFIG.feedback.shake.dig);
}

// Moves a mole through its dig-up, scurry, dig-down cycle. Returns true while
// it's digging (it stays put); false while it's up and wandering like any animal.
function updateBurrower(a, dt) {
  const b = a.def.burrow;
  a.phaseT += dt;
  if (a.phase === 'emerging') {
    a.vx = a.vy = 0;
    if (a.phaseT >= b.emergeSeconds) {
      a.phase = 'up';
      a.phaseT = 0;
      a.hidden = false;
    }
    return true;
  }
  if (a.phase === 'up') {
    if (a.phaseT < a.surfaceFor) return false;
    a.phase = 'burrowing';
    a.phaseT = 0;
    a.hidden = true;
    digAt(a.x, a.y);
  }
  // Burrowing: once it's all the way down it's gone, with no points.
  a.vx = a.vy = 0;
  if (a.phaseT >= b.burrowSeconds) {
    a.dead = true;
    recordEscape();
  }
  return true;
}

function addAnimal(name, def, x, y, heading) {
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
    px: 0,
    halfW: 0,
    halfH: 0,
    entered: false,
    leaveIn: null,   // seconds until it leaves (tree animals only)
    leaving: false,  // heading off the edge; removed once fully off screen
    noiseIn: rand(...(def.noiseEvery || CONFIG.animalNoise.firstIn)),
    abruptTurnIn: rand(...CONFIG.animalWander.abruptTurnEvery),
    dead: false,
  };
  sizeAnimal(a);
  world.animals.push(a);
  return a;
}

// ---------- Movement ----------

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

// Sets the animal's velocity from its heading and moves it along.
function moveAlongHeading(a, speed, dt) {
  a.vx = Math.cos(a.heading) * speed;
  a.vy = Math.sin(a.heading) * speed;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
}

function startLeaving(a) {
  a.leaving = true;
  a.heading = nearestEdgeHeading(a.x, a.y);
}

function updateAnimal(a, dt) {
  if (a.dead) return;
  sizeAnimal(a);
  const speed = pct(a.def.speed);

  // Moles dig up, scurry about (wandering as below), then dig back down.
  if (a.def.behaviour === 'burrower' && updateBurrower(a, dt)) return;

  // Spiders run at the nearest unit, web it, then leave.
  if (a.def.behaviour === 'webber' && !a.leaving) {
    const u = closestTo(world.units, a.x, a.y);
    if (u) {
      a.heading = Math.atan2(u.y - a.y, u.x - a.x);
      if (Math.hypot(u.x - a.x, u.y - a.y) <= unitHalfWidth(u) + pct(CONFIG.cobwebs.reach)) {
        u.webbed = CONFIG.cobwebs.seconds;
        floatText(u.x, u.y - pct(2.5), 'webbed!', CONFIG.colors.noise, true);
        sfx('webbed', { x: u.x });
        recordWebbed(unitLabel(u.rec));
        startLeaving(a);
      }
    }
    if (!a.leaving) {
      // Make a beeline: no wandering, no sudden turns.
      a.angle = a.heading;
      moveAlongHeading(a, speed, dt);
      return;
    }
  }

  // Tree animals only stay for a while, then make for the nearest edge.
  if (a.leaveIn !== null && !a.leaving) {
    a.leaveIn -= dt;
    if (a.leaveIn <= 0) startLeaving(a);
  }
  if (a.leaving) {
    a.angle = a.heading;
    moveAlongHeading(a, speed, dt);
    // Gone once the whole word is off screen (no points for escapees).
    const off = a.halfW + pct(1);
    if (a.x < -off || a.x > world.w + off || a.y < -off || a.y > world.h + off) {
      a.dead = true;
      recordEscape();
    }
    return;
  }

  if (a.entered) wander(a, dt);
  moveAlongHeading(a, speed, dt);

  const m = a.halfW * 0.6;
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
    a.noiseIn = rand(...(a.def.noiseEvery || CONFIG.animalNoise.every));
    if (a.entered) floatText(a.x, a.y - pct(2.5), a.def.noise, CONFIG.colors.noise, true);
  }
}

// Changes the heading of an animal that's wandering about the battlefield.
function wander(a, dt) {
  // The turn rate drifts randomly, so paths curve gently.
  a.turnRate = clamp(a.turnRate + rand(-4, 4) * dt, -1.2, 1.2);
  a.heading += a.turnRate * dt;

  // Now and then, an abrupt change of direction.
  a.abruptTurnIn -= dt;
  if (a.abruptTurnIn <= 0) {
    const w = CONFIG.animalWander;
    a.abruptTurnIn = rand(...w.abruptTurnEvery);
    const turn = rand(...w.abruptTurnAngle) * DEG;
    a.heading += Math.random() < 0.5 ? -turn : turn;
    a.turnRate = 0;
  }
}

// ---------- Death ----------

// killer (optional) is the label of the unit that fired, e.g. 'MAN2'.
function killAnimal(a, killer) {
  a.dead = true;
  awardKill(a.def.points);
  recordKill(a.name);
  recordUnitKill(killer);
  // Bigger (more valuable) animals die with a lower note.
  sfx('kill', { x: a.x, pitch: clamp(1.4 - Math.log10(a.def.points + 1) * 0.25, 0.6, 1.4) });
  // Dying noise gets a '!', unless the noise already has one.
  const cry = a.def.noise.endsWith('!') ? a.def.noise : a.def.noise + '!';
  floatText(a.x, a.y, cry, CONFIG.colors.noise, true);
  if (a.def.points > 0) floatText(a.x, a.y - pct(2.5), '+' + formatNumber(a.def.points), CONFIG.colors.points, false);
}
