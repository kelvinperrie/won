const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('./load-game');

function emptyGame(opts) {
  const game = loadGame(opts);
  for (const name of Object.keys(game.state.lures)) game.state.lures[name] = 0;
  return game;
}

test('kills are credited to the unit that fired, and multi-kills are tracked', () => {
  const game = emptyGame();
  for (let i = 0; i < 3; i++) game.addAnimal('rabbit', game.CONFIG.animals.rabbit, 500 + i * 5, 400, 0);
  game.explode({ x: 505, y: 400, radius: 60, damage: 5, shooter: 'MAN1', byPlayer: true });
  assert.strictEqual(game.state.stats.killsByUnit.MAN1, 3);
  assert.strictEqual(game.state.stats.bestMultiKill, 3);
  assert.strictEqual(game.state.stats.playerHits, 1);

  game.explode({ x: 100, y: 100, radius: 5, damage: 5, shooter: 'MAN1', byPlayer: true });
  assert.strictEqual(game.state.stats.playerHits, 1, 'a miss is not a hit');
});

test('AI shots and points spent are counted', () => {
  const game = emptyGame();
  game.state.points = 1000;
  const rec = game.buyUnit('MAN');
  assert.strictEqual(game.state.stats.pointsSpent, game.CONFIG.unitTypes.MAN.cost);
  game.addUnitEntity(rec);
  const ai = game.world.units[game.world.units.length - 1];
  game.fireBullet(ai, 0);
  assert.strictEqual(game.state.stats.aiShots, 1);
  assert.strictEqual(game.world.bullets[0].shooter, 'MAN2');
});

test('stats survive a save and reload, and a reset wipes them', () => {
  const first = emptyGame();
  Object.assign(first.state.stats, { timePlayed: 125.5, escaped: 4, webbed: 2 });
  first.state.stats.killsByUnit.TANK1 = 7;
  first.saveGame();

  const second = loadGame({ storage: first.storage });
  assert.strictEqual(second.state.stats.timePlayed, 125.5);
  assert.strictEqual(second.state.stats.escaped, 4);
  assert.strictEqual(second.state.stats.webbed, 2);
  assert.strictEqual(second.state.stats.killsByUnit.TANK1, 7);

  second.resetGame();
  assert.strictEqual(second.state.stats.timePlayed, 0);
  assert.strictEqual(Object.keys(second.state.stats.killsByUnit).length, 0);
});

test('tampered stats are ignored', () => {
  const storage = new Map();
  const game = loadGame({ storage });
  storage.set(game.CONFIG.save.key, JSON.stringify({
    version: game.CONFIG.save.version,
    stats: { timePlayed: -5, escaped: 1.5, webbed: 'lots', killsByUnit: { MAN1: 3, '<b>x</b>': 9, TANK1: -1 } },
  }));
  const s = loadGame({ storage }).state.stats;
  assert.strictEqual(s.timePlayed, 0);
  assert.strictEqual(s.escaped, 0);
  assert.strictEqual(s.webbed, 0);
  assert.deepStrictEqual(Object.keys(s.killsByUnit), ['MAN1']);
});

test('getting webbed brings Knockoff Spidey, and 10 webbings earn Sticky Situation', () => {
  const game = emptyGame();
  const said = [];
  game.showToast = (id, text) => said.push([id, text]);
  const man = game.world.units[0];
  const n = game.CONFIG.achievements.manyWebbed;
  for (let i = 0; i < n - 1; i++) {
    game.releaseTreeAnimal('spider', man.x - 200, man.y - 200);
    const t = runFor(game, 30, () => game.state.stats.webbed === i + 1);
    assert.ok(t !== null, `webbing ${i + 1}`);
    man.x = 600; // stay put, away from the edges
  }
  assert.strictEqual(said.length, n - 1, 'one popup per webbing');
  assert.ok(said.every(([id, text]) => id === 'spidey' && text.includes('MAN1')), 'Knockoff Spidey names the unit');
  for (let i = 1; i < 5; i++) assert.notStrictEqual(said[i][1], said[i - 1][1], 'no line twice in a row');
  assert.ok(!game.state.achievements[`webbed${n}`]);
  game.recordWebbed('MAN1');
  assert.ok(game.state.achievements[`webbed${n}`], 'Sticky Situation');
});

test('Knockoff Spidey never pipes up at random', () => {
  const game = loadGame();
  const ids = game.randomAdviserIds();
  assert.ok(!ids.includes('spidey'));
  assert.ok(ids.length >= 5, 'the usual advisers still do');
});

test('time played reads nicely', () => {
  const game = loadGame();
  assert.strictEqual(game.formatDuration(42), '42s');
  assert.strictEqual(game.formatDuration(75), '1m 15s');
  assert.strictEqual(game.formatDuration(4000), '1h 06m');
});

test('sound and shake settings are kept apart from the save, so a reset keeps them', () => {
  const first = loadGame();
  first.setSetting('sound', false);
  first.setSetting('effects', false);
  first.resetGame();
  const second = loadGame({ storage: first.storage });
  assert.strictEqual(second.feedback.settings.sound, false);
  assert.strictEqual(second.feedback.settings.effects, false);
});

test('the volume setting is saved, kept within 0-100%, and louder at the top than before', () => {
  const first = loadGame();
  const v = first.CONFIG.feedback.volume;
  assert.strictEqual(first.feedback.settings.volume, v.default, 'starts at the default');
  assert.ok(first.volumeGain(v.default) > 0.35 * 2, 'the default is well over twice the old fixed level');
  assert.strictEqual(first.volumeGain(1), v.maxGain);
  assert.strictEqual(first.volumeGain(0), 0);

  first.setSetting('volume', 1.7);
  assert.strictEqual(first.feedback.settings.volume, 1, 'capped at 100%');
  first.setSetting('volume', 0.45);
  first.resetGame();
  assert.strictEqual(loadGame({ storage: first.storage }).feedback.settings.volume, 0.45, 'kept through a reset and reload');

  first.storage.set(first.CONFIG.feedback.settingsKey, JSON.stringify({ volume: 'loud' }));
  assert.strictEqual(loadGame({ storage: first.storage }).feedback.settings.volume, v.default, 'junk ignored');
});

test('with shake & flash off, hits do not shake the screen or flash', () => {
  const game = emptyGame();
  game.setSetting('effects', false);
  const pig = game.addAnimal('pig', game.CONFIG.animals.pig, 500, 400, 0);
  game.explode({ x: 500, y: 400, radius: 30, damage: 1, isShell: true });
  assert.strictEqual(game.feedback.shake, 0);
  assert.strictEqual(game.flashOf(pig), 0);

  game.setSetting('effects', true);
  game.explode({ x: 500, y: 400, radius: 30, damage: 1, isShell: true });
  assert.ok(game.feedback.shake > 0, 'shakes when on');
  assert.ok(game.flashOf(pig) > 0, 'flashes when on');
});
