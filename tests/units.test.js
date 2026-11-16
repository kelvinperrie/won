const test = require('node:test');
const assert = require('node:assert');
const { loadGame, runFor } = require('./load-game');

// A battlefield with no animals arriving and nothing in the way.
function emptyGame() {
  const game = loadGame();
  for (const name of Object.keys(game.state.lures)) game.state.lures[name] = 0;
  game.world.plants = [];
  return game;
}

function addUnit(game, type) {
  game.state.points = 1e9;
  const rec = game.buyUnit(type);
  assert.ok(rec, `could not buy ${type}`);
  game.addUnitEntity(rec);
  return game.world.units[game.world.units.length - 1];
}

test('the player moves with WASD and stays on screen', () => {
  const game = emptyGame();
  const man = game.world.units[0];
  const startX = man.x;
  game.input.keys.add('KeyD');
  runFor(game, 1);
  assert.ok(man.x > startX, 'moved right');
  runFor(game, 60);
  assert.ok(man.x <= game.world.w, 'still on screen');
});

test('a player shot explodes where the aim circle is', () => {
  const game = emptyGame();
  const man = game.world.units[0];
  game.input.mouseX = man.x;
  game.input.mouseY = man.y - 100; // well inside range
  const aim = game.playerAim(man);
  assert.strictEqual(aim.limited, false);

  game.fireBullet(man, aim.angle, aim.dist);
  const b = game.world.bullets[0];
  while (!b.dead) game.updateBullet(b, 1 / 60);
  const boom = game.world.effects.find(e => e.kind === 'boom');
  assert.ok(Math.hypot(boom.x - aim.x, boom.y - aim.y) < 1, 'boom at the aim point');
  assert.strictEqual(boom.radius, aim.radius);
});

test('aiming past the range limit pulls the circle in to the limit', () => {
  const game = emptyGame();
  const man = game.world.units[0];
  game.input.mouseX = man.x;
  game.input.mouseY = man.y - 5000;
  const aim = game.playerAim(man);
  assert.strictEqual(aim.limited, true);
  assert.ok(Math.abs(aim.dist - game.pct(game.attrValue(man.rec, 'range'))) < 1e-9);
});

test('only shots the player fires count toward Trigger Happy', () => {
  const game = emptyGame();
  addUnit(game, 'MAN');
  game.spawnAnimal('bear'); // something for the AI to shoot at
  game.input.firing = true;
  game.input.mouseX = 10;
  game.input.mouseY = 10;
  runFor(game, 3);
  const playerShots = game.state.playerShots;
  assert.ok(playerShots > 0, 'player fired');
  game.input.firing = false;
  let aiShots = 0;
  runFor(game, 10, () => {
    aiShots += game.world.bullets.length;
    return false;
  });
  assert.ok(aiShots > 0, 'the AI MAN was firing');
  assert.strictEqual(game.state.playerShots, playerShots, 'AI shots are not counted');
});

test('cobwebs slow movement and shooting, then wear off', () => {
  const game = emptyGame();
  const man = game.world.units[0];
  const speed = game.unitStat(man, 'speed');
  const fireRate = game.unitStat(man, 'fireRate');
  man.webbed = game.CONFIG.cobwebs.seconds;
  const slow = 1 - game.CONFIG.cobwebs.slow;
  assert.ok(Math.abs(game.unitStat(man, 'speed') - speed * slow) < 1e-9);
  assert.ok(Math.abs(game.unitStat(man, 'fireRate') - fireRate * slow) < 1e-9);
  assert.strictEqual(game.unitStat(man, 'range'), game.attrValue(man.rec, 'range'), 'range unaffected');
  runFor(game, game.CONFIG.cobwebs.seconds + 0.1);
  assert.strictEqual(man.webbed, 0);
  assert.strictEqual(game.unitStat(man, 'speed'), speed);
});

test('an AI MAN hunts down an animal', () => {
  const game = emptyGame();
  addUnit(game, 'MAN');
  game.spawnAnimal('pig');
  const pig = game.world.animals[0];
  assert.ok(runFor(game, 60, () => pig.dead) !== null, 'pig killed within a minute');
  assert.strictEqual(game.state.kills.pig, 1);
});

test('the ARTILLERY sits in the middle and never moves', () => {
  const game = emptyGame();
  const art = addUnit(game, 'ARTILLERY');
  assert.strictEqual(art.x, game.world.w / 2);
  assert.strictEqual(art.y, game.world.h / 2);
  for (let i = 0; i < 5; i++) game.spawnAnimal('pig');
  runFor(game, 20);
  assert.strictEqual(art.x, game.world.w / 2);
  assert.strictEqual(art.y, game.world.h / 2);
});

test('the ARTILLERY only targets animals in range', () => {
  const game = emptyGame();
  const art = addUnit(game, 'ARTILLERY');
  game.addAnimal('bear', game.CONFIG.animals.bear, 5, 5, 0);
  game.updateTank(art, 1 / 60);
  assert.strictEqual(art.target, null);
});

test('the ARTILLERY ignores animals inside its minimum range', () => {
  const game = emptyGame();
  const art = addUnit(game, 'ARTILLERY');
  const minRange = game.pct(game.CONFIG.unitTypes.ARTILLERY.minRange);
  const near = game.addAnimal('bear', game.CONFIG.animals.bear, art.x + minRange * 0.5, art.y, 0);
  near.vx = near.vy = 0;
  for (let i = 0; i < 600; i++) {
    near.x = art.x + minRange * 0.5; // hold it still, close by
    near.y = art.y;
    game.updateTank(art, 1 / 60);
    art.cooldown = 0;
  }
  assert.strictEqual(art.target, null, 'not targeted');
  assert.strictEqual(game.world.bullets.length, 0, 'not fired at');

  // Just outside the minimum range, it's fair game.
  near.x = art.x + minRange * 1.2;
  game.updateTank(art, 1 / 60);
  assert.strictEqual(art.target, near);
});

test('the ARTILLERY drops a target that comes too close', () => {
  const game = emptyGame();
  const art = addUnit(game, 'ARTILLERY');
  const minRange = game.pct(game.CONFIG.unitTypes.ARTILLERY.minRange);
  const bear = game.addAnimal('bear', game.CONFIG.animals.bear, art.x + minRange * 1.5, art.y, 0);
  game.updateTank(art, 1 / 60);
  assert.strictEqual(art.target, bear);
  bear.x = art.x + minRange * 0.5;
  game.updateTank(art, 1 / 60);
  assert.strictEqual(art.target, null);
});

test('the TANK always has slightly less range than the ARTILLERY', () => {
  const game = emptyGame();
  const tank = game.CONFIG.unitTypes.TANK.attributes.range;
  const art = game.CONFIG.unitTypes.ARTILLERY.attributes.range;
  assert.strictEqual(tank.maxLevel, art.maxLevel);
  for (let lvl = 0; lvl <= art.maxLevel; lvl++) {
    const gap = art.base + art.perLevel * lvl - (tank.base + tank.perLevel * lvl);
    assert.ok(Math.abs(gap - 2) < 1e-9, `level ${lvl}: gap ${gap}`);
  }
  assert.ok(Math.abs(art.base + art.perLevel * art.maxLevel - 50) < 1e-9, 'ARTILLERY tops out at 50%');
});
