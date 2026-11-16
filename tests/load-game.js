// Loads the game's scripts into a sandbox so they can be tested in Node,
// without a browser. Each call gives a fresh, separate copy of the game.
//
//   const game = loadGame();
//   game.state.points = 100;     // `state`, `world`, `CONFIG` etc. work as in the game
//   game.updateWorld(1 / 60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

// The scripts in the order index.html loads them, minus main.js (which
// needs a real canvas and starts the game loop).
function gameScripts() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(src => !src.endsWith('main.js'));
}

// Just enough of a browser for the game logic. Text is measured as 0.6 of
// the font size per letter, roughly what a monospace font does.
function fakeBrowser(storage) {
  const fakeCanvasCtx = {
    font: '',
    measureText(text) {
      const px = Number((this.font.match(/(\d+)px/) || [0, 10])[1]);
      return { width: text.length * px * 0.6 };
    },
  };
  return {
    console,
    document: {
      getElementById: () => null,
      createElement: () => ({ getContext: () => fakeCanvasCtx }),
    },
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  };
}

// storage (optional) is a Map standing in for localStorage, so a test can
// load a second copy of the game from the first one's save.
function loadGame({ storage = new Map(), width = 1200, height = 800 } = {}) {
  const sandbox = vm.createContext(fakeBrowser(storage));
  const run = code => vm.runInContext(code, sandbox);
  for (const src of gameScripts()) {
    vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), sandbox, { filename: src });
  }

  // Top-level const/let (world, state, CONFIG...) aren't properties of the
  // sandbox, so expose them as getters (and a setter for `state`).
  for (const name of ['world', 'input', 'CONFIG', 'ACHIEVEMENTS', 'ADVISERS', 'DEG', 'feedback']) {
    Object.defineProperty(sandbox, name, { get: () => run(name) });
  }
  Object.defineProperty(sandbox, 'state', {
    get: () => run('state'),
    set: v => {
      sandbox.__value = v;
      run('state = __value');
    },
  });

  // No popups in tests.
  run('showAchievementToast = () => {}; showToast = () => {};');

  sandbox.storage = storage;
  sandbox.state = run('loadGame()');
  run(`resizeWorld(${width}, ${height})`);
  run('resetWorld()');
  return sandbox;
}

// Runs the world for `seconds` in 60 fps steps, stopping early if until() returns true.
function runFor(game, seconds, until = () => false) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    game.updateWorld(dt);
    if (until()) return t + dt;
  }
  return null;
}

module.exports = { loadGame, runFor };
