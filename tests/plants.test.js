const test = require('node:test');
const assert = require('node:assert');
const { loadGame, runFor } = require('./load-game');

function emptyGame() {
  const game = loadGame();
  for (const name of Object.keys(game.state.lures)) game.state.lures[name] = 0;
  return game;
}

// Breaks `n` plants of a type at a given growth (0..1) and counts what jumps out.
function breakMany(game, type, growth, n) {
  const def = game.CONFIG.plants.types[type];
  const counts = {};
  for (let i = 0; i < n; i++) {
    game.world.animals = [];
    game.world.plants = [];
    game.spawnPlant();
    const p = game.world.plants[0];
    Object.assign(p, { type, def, size: def.maxSize * growth, decor: game.createPlantDecor(type, def) });
    game.breakPlant(p);
    for (const a of game.world.animals) counts[a.name] = (counts[a.name] || 0) + 1;
  }
  return counts;
}

test('possums only come out of trees over 75% grown', () => {
  const game = emptyGame();
  assert.strictEqual(breakMany(game, 'TREE', 0.7, 200).possum, undefined);
  assert.strictEqual(breakMany(game, 'TREE', 1, 200).possum, 200);
  assert.strictEqual(breakMany(game, 'BUSH', 1, 200).possum, undefined);
});

test('spiders come out of about 30% of trees and 75% of bushes', () => {
  const game = emptyGame();
  const n = 2000;
  const trees = (breakMany(game, 'TREE', 0.5, n).spider || 0) / n;
  const bushes = (breakMany(game, 'BUSH', 0.5, n).spider || 0) / n;
  assert.ok(Math.abs(trees - 0.3) < 0.05, `tree rate ${trees}`);
  assert.ok(Math.abs(bushes - 0.75) < 0.05, `bush rate ${bushes}`);
});

test('broken plants leave debris, capped with the oldest removed first', () => {
  const game = emptyGame();
  const max = game.CONFIG.plants.debris.max;
  game.breakPlant(game.world.plants[0]);
  assert.ok(game.world.debris.length > 0, 'debris dropped');
  const first = game.world.debris[0];
  for (let i = 0; i < 100; i++) {
    game.spawnPlant(true);
    game.breakPlant(game.world.plants[game.world.plants.length - 1]);
  }
  assert.strictEqual(game.world.debris.length, max);
  assert.ok(!game.world.debris.includes(first), 'oldest piece removed');
});

test('a bare battlefield starts growing a plant straight away', () => {
  const game = emptyGame();
  for (const p of game.world.plants) p.broken = true;
  runFor(game, 1 / 60);
  assert.strictEqual(game.world.plants.length, 1);
});

test('plants grow up to their full size', () => {
  const game = emptyGame();
  game.world.plants = [];
  game.spawnPlant();
  const p = game.world.plants[0];
  assert.strictEqual(p.size, p.def.startSize);
  game.world.plantIn = 1e9; // no new plants
  runFor(game, p.def.growSeconds + 1);
  assert.strictEqual(p.size, p.def.maxSize);
  assert.ok(p.halfW > 0 && p.halfH > 0, 'has a hit box');
});
