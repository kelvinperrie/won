const test = require('node:test');
const assert = require('node:assert');
const { loadGame, runFor } = require('./load-game');

function emptyGame() {
  const game = loadGame();
  for (const name of Object.keys(game.state.lures)) game.state.lures[name] = 0;
  return game;
}

test('a lure brings in its animal', () => {
  const game = emptyGame();
  game.state.lures.pig = 1;
  const t = runFor(game, 15, () => game.world.animals.some(a => a.name === 'pig'));
  assert.ok(t !== null, 'a pig arrived');
});

test('the animal cap holds spawns back', () => {
  const game = emptyGame();
  game.state.lures.rabbit = 1000;
  runFor(game, 5);
  assert.ok(game.world.animals.length <= game.CONFIG.spawn.maxAnimals);
});

test('wandering animals stay on the battlefield', () => {
  const game = emptyGame();
  game.world.units = []; // nobody shooting
  for (let i = 0; i < 10; i++) game.spawnAnimal('ferret');
  runFor(game, 30);
  assert.strictEqual(game.world.animals.length, 10, 'none escaped');
  for (const a of game.world.animals) {
    assert.ok(a.entered, `${a.name} came on screen`);
    assert.ok(a.x >= 0 && a.x <= game.world.w && a.y >= 0 && a.y <= game.world.h, `${a.name} at ${a.x},${a.y}`);
  }
});

test('a possum stays for a while, then leaves the screen', () => {
  const game = emptyGame();
  game.world.units = [];
  game.releaseTreeAnimal('possum', 600, 400);
  const possum = game.world.animals[0];
  const [minStay] = game.CONFIG.treeAnimals.possum.staySeconds;
  runFor(game, minStay - 0.5);
  assert.ok(!possum.dead && !possum.leaving, 'still wandering');
  assert.ok(runFor(game, 30, () => possum.dead) !== null, 'gone eventually');
  assert.strictEqual(game.state.points, 0, 'no points for one that got away');
});

test('a spider webs the nearest unit and then leaves', () => {
  const game = emptyGame();
  const man = game.world.units[0];
  game.releaseTreeAnimal('spider', man.x - 300, man.y - 300);
  const spider = game.world.animals[0];
  assert.ok(runFor(game, 30, () => man.webbed > 0) !== null, 'MAN1 got webbed');
  assert.ok(spider.leaving, 'spider is leaving');
  assert.ok(runFor(game, 30, () => spider.dead) !== null, 'spider left the screen');
});

test('killing an animal pays out its points and counts the kill', () => {
  const game = emptyGame();
  const goose = game.addAnimal('goose', game.CONFIG.animals.goose, 100, 100, 0);
  game.killAnimal(goose);
  assert.strictEqual(game.state.points, game.CONFIG.animals.goose.points);
  assert.strictEqual(game.state.destroyed, game.CONFIG.animals.goose.points);
  assert.strictEqual(game.state.kills.goose, 1);
  const texts = game.world.effects.map(e => e.text);
  assert.ok(texts.includes('honk!'), 'goose noise is not doubled to honk!!');
});

test('spiders are worth nothing', () => {
  const game = emptyGame();
  const spider = game.addAnimal('spider', game.CONFIG.treeAnimals.spider, 100, 100, 0);
  game.killAnimal(spider);
  assert.strictEqual(game.state.points, 0);
  assert.ok(!game.world.effects.some(e => e.text === '+0'), 'no "+0" text');
});

test('a mole digs up, scurries about, then digs back down and is gone', () => {
  const game = emptyGame();
  game.world.units = []; // nobody shooting
  const burrow = game.CONFIG.animals.mole.burrow;
  game.spawnAnimal('mole');
  const mole = game.world.animals[0];
  assert.ok(mole.hidden, 'underground while digging out');
  assert.ok(mole.x > 0 && mole.x < game.world.w && mole.y > 0 && mole.y < game.world.h, 'digs up inside the battlefield');
  assert.strictEqual(game.world.holes.length, 1, 'leaves a HOLE');
  assert.ok(game.world.effects.some(e => e.kind === 'dirt'), 'throws up dirt');

  runFor(game, burrow.emergeSeconds + 0.05);
  assert.ok(!mole.hidden && mole.phase === 'up', 'out of the ground');
  const start = { x: mole.x, y: mole.y };
  runFor(game, burrow.surfaceSeconds[0] - 0.5);
  assert.ok(!mole.hidden, 'still up');
  assert.ok(Math.hypot(mole.x - start.x, mole.y - start.y) > 1, 'it moved');

  assert.ok(runFor(game, 10, () => mole.hidden) !== null, 'digs back down');
  assert.ok(game.world.holes.some(h => h.t < 0.1 && h.x === mole.x && h.y === mole.y), 'a new HOLE where it went down');
  assert.ok(runFor(game, 5, () => mole.dead) !== null, 'gone');
  assert.strictEqual(game.state.points, 0, 'no points for one that got away');
  assert.strictEqual(game.state.stats.escaped, 1, 'counted as got away');
});

test('a mole can only be hit or targeted once it is out of the ground', () => {
  const game = emptyGame();
  game.spawnAnimal('mole');
  const mole = game.world.animals[0];
  const blast = () => game.explode({ x: mole.x, y: mole.y, radius: 50, damage: 1000, shooter: 'MAN1', byPlayer: true });

  assert.strictEqual(game.closestTo(game.world.animals, mole.x, mole.y), null, 'AI units ignore it underground');
  assert.ok(!game.hitsSomething(mole.x, mole.y), 'bullets pass over it');
  blast();
  assert.strictEqual(mole.hp, game.CONFIG.animals.mole.health, 'no damage underground');

  runFor(game, game.CONFIG.animals.mole.burrow.emergeSeconds + 0.05);
  assert.strictEqual(game.closestTo(game.world.animals, mole.x, mole.y), mole, 'targetable once up');
  blast();
  assert.ok(mole.dead);
  assert.strictEqual(game.state.points, game.CONFIG.animals.mole.points);
  assert.strictEqual(game.state.kills.mole, 1);
});

test('the mole is the toughest lure animal', () => {
  const game = emptyGame();
  const { mole, ...others } = game.CONFIG.animals;
  for (const [name, def] of Object.entries(others)) assert.ok(mole.health > def.health, `tougher than a ${name}`);
});

test('the goose honks as often as its config says', () => {
  const game = emptyGame();
  const goose = game.addAnimal('goose', game.CONFIG.animals.goose, 600, 400, 0);
  goose.entered = true;
  let honks = 0;
  for (let i = 0; i < 60 * 20; i++) {
    game.world.effects = [];
    game.updateAnimal(goose, 1 / 60);
    if (game.world.effects.some(e => e.text === 'honk!')) honks++;
  }
  const [fastest, slowest] = game.CONFIG.animals.goose.noiseEvery;
  assert.ok(honks >= Math.floor(20 / slowest) - 1 && honks <= Math.ceil(20 / fastest), `${honks} honks in 20 s`);
});
