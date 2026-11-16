const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('./load-game');

const game = loadGame();

test('angleDiff gives the shortest signed turn', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  close(game.angleDiff(0, Math.PI / 2), Math.PI / 2);
  close(game.angleDiff(0, -Math.PI / 2), -Math.PI / 2);
  close(game.angleDiff(170 * game.DEG, -170 * game.DEG), 20 * game.DEG); // across the wrap
  close(game.angleDiff(0, Math.PI), Math.PI);
  close(game.angleDiff(0, 4 * Math.PI), 0);
});

test('turnToward never overshoots', () => {
  assert.strictEqual(game.turnToward(0, 1, 0.25), 0.25);
  assert.strictEqual(game.turnToward(0, 0.1, 0.25), 0.1);
  assert.strictEqual(game.turnToward(0, -1, 0.25), -0.25);
});

test('randInt stays within its bounds, inclusive', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(game.randInt(2, 4));
  assert.deepStrictEqual([...seen].sort(), [2, 3, 4]);
});

test('formatNumber abbreviates large numbers', () => {
  assert.strictEqual(game.formatNumber(9999), '9,999');
  assert.strictEqual(game.formatNumber(12345), '12.35K');
  assert.strictEqual(game.formatNumber(2500000), '2.50M');
  assert.strictEqual(game.formatNumber(12.9), '12');
});

test('mixColor blends two colours', () => {
  assert.strictEqual(game.mixColor([0, 0, 0], [255, 100, 10], 0.5), 'rgb(128,50,5)');
});
