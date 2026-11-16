const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('./load-game');

test('a new game starts with MAN1, one rabbit lure and no points', () => {
  const game = loadGame();
  assert.strictEqual(game.state.points, 0);
  assert.strictEqual(game.state.units.length, 1);
  assert.strictEqual(game.unitLabel(game.state.units[0]), 'MAN1');
  assert.strictEqual(game.state.lures.rabbit, 1);
});

test('progress survives a save and reload', () => {
  const first = loadGame();
  first.state.points = 5000;
  first.buyUnit('TANK');
  first.buyLure('pig');
  first.buyUpgrade(first.state.units[0], 'damage');
  first.state.kills.bear = 3;
  first.saveGame();

  const second = loadGame({ storage: first.storage });
  assert.strictEqual(second.state.points, first.state.points);
  assert.strictEqual(second.state.units.map(second.unitLabel).join(), 'MAN1,TANK1');
  assert.strictEqual(second.state.units[0].levels.damage, 1);
  assert.strictEqual(second.state.lures.pig, 1);
  assert.strictEqual(second.state.kills.bear, 3);
});

test('a broken or tampered save can never break the game', () => {
  const storage = new Map();
  const game = loadGame({ storage });
  const key = game.CONFIG.save.key;

  storage.set(key, 'not json{');
  assert.strictEqual(loadGame({ storage }).state.points, 0);

  storage.set(key, JSON.stringify({
    version: game.CONFIG.save.version,
    points: -50,
    units: [{ type: 'TANK', num: 1, levels: { speed: 999 } }, { type: 'TANK', num: 2 }, { type: 'DRAGON', num: 1 }],
    lures: { pig: 2.5, unicorn: 3 },
    achievements: { 'made-up': 123, 'first-rabbit': 'yesterday' },
  }));
  const s = loadGame({ storage }).state;
  assert.strictEqual(s.points, 0);
  assert.strictEqual(s.units.map(u => u.type + u.num).join(), 'MAN1,TANK1', 'MAN1 restored, limits kept, junk dropped');
  assert.strictEqual(s.units[1].levels.speed, game.CONFIG.unitTypes.TANK.attributes.speed.maxLevel, 'level capped');
  assert.strictEqual(s.lures.pig, 0);
  assert.strictEqual(s.lures.unicorn, undefined);
  assert.strictEqual(Object.keys(s.achievements).length, 0);
});

test('you cannot buy what you cannot afford, or past the limit', () => {
  const game = loadGame();
  assert.strictEqual(game.buyUnit('TANK'), null);
  game.state.points = 1e9;
  assert.ok(game.buyUnit('TANK'));
  assert.strictEqual(game.buyUnit('TANK'), null, 'only one TANK');
  const man = game.state.units[0];
  for (let i = 0; i < 20; i++) game.buyUpgrade(man, 'speed');
  assert.strictEqual(man.levels.speed, game.CONFIG.unitTypes.MAN.attributes.speed.maxLevel);
});

test('kill achievements unlock at the first and the 15th kill', () => {
  const game = loadGame();
  game.recordKill('deer');
  assert.ok(game.state.achievements['first-deer']);
  assert.ok(!game.state.achievements['kill15-deer']);
  for (let i = 1; i < game.CONFIG.achievements.manyKills; i++) game.recordKill('deer');
  assert.ok(game.state.achievements['kill15-deer']);
});

test('the three MANs achievement unlocks with three MANs', () => {
  const game = loadGame();
  game.state.points = 1e9;
  game.buyUnit('MAN');
  game.checkAchievements();
  assert.ok(!game.state.achievements['three-mans']);
  game.buyUnit('MAN');
  game.checkAchievements();
  assert.ok(game.state.achievements['three-mans']);
});

test('Trigger Happy unlocks at 100 player shots', () => {
  const game = loadGame();
  for (let i = 0; i < 99; i++) game.recordPlayerShot();
  assert.ok(!game.state.achievements['player-shots-100']);
  game.recordPlayerShot();
  assert.ok(game.state.achievements['player-shots-100']);
});

test('Lumberjack and Bush Whacker unlock after 50 of each are broken', () => {
  const game = loadGame();
  const n = game.CONFIG.achievements.manyPlants;
  const breakOne = type => {
    game.spawnPlant(true);
    const p = game.world.plants[game.world.plants.length - 1];
    p.type = type;
    p.def = game.CONFIG.plants.types[type];
    game.breakPlant(p);
  };
  for (let i = 0; i < n - 1; i++) breakOne('TREE');
  assert.ok(!game.state.achievements[`break${n}-TREE`]);
  breakOne('TREE');
  assert.ok(game.state.achievements[`break${n}-TREE`], 'Lumberjack');
  assert.ok(!game.state.achievements[`break${n}-BUSH`], 'trees do not count as bushes');
  for (let i = 0; i < n; i++) breakOne('BUSH');
  assert.ok(game.state.achievements[`break${n}-BUSH`], 'Bush Whacker');

  const reloaded = loadGame({ storage: game.storage });
  assert.strictEqual(reloaded.state.plantsBroken.TREE, n, 'counts are saved');
});

test('every animal has a first-kill and a 15-kill achievement', () => {
  const game = loadGame();
  const ids = new Set(game.ACHIEVEMENTS.map(a => a.id));
  for (const name of Object.keys({ ...game.CONFIG.animals, ...game.CONFIG.treeAnimals })) {
    assert.ok(ids.has(`first-${name}`), `first-${name}`);
    assert.ok(ids.has(`kill15-${name}`), `kill15-${name}`);
  }
});

test('first kills get a silver trophy, everything else gold', () => {
  const game = loadGame();
  for (const a of game.ACHIEVEMENTS) {
    const want = a.id.startsWith('first-') ? 'silver' : 'gold';
    assert.strictEqual(a.tier || 'gold', want, a.id);
  }
  assert.ok(game.trophySVG('silver').includes('#d4dae0'));
  assert.ok(game.trophySVG().includes('#ffd23a'));
});

test('achievements survive a save and reload', () => {
  const first = loadGame();
  first.recordKill('rabbit');
  const second = loadGame({ storage: first.storage });
  assert.strictEqual(second.state.achievements['first-rabbit'], first.state.achievements['first-rabbit']);
});

test('a reset wipes everything', () => {
  const game = loadGame();
  game.state.points = 1e9;
  game.buyUnit('MAN');
  game.recordKill('pig');
  game.resetGame();
  assert.strictEqual(game.state.points, 0);
  assert.strictEqual(game.state.units.length, 1);
  assert.strictEqual(Object.keys(game.state.achievements).length, 0);
});
