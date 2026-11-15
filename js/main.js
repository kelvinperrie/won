// Entry point: sets up the canvas, input, saving, and the game loop.

const canvas = document.getElementById('battlefield');
const ctx = canvas.getContext('2d');

// The battlefield is the canvas's own size (the window minus the shop).
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resizeWorld(w, h);
}

function setupInput() {
  window.addEventListener('keydown', e => input.keys.add(e.code));
  window.addEventListener('keyup', e => input.keys.delete(e.code));

  // Mouse position in battlefield coordinates.
  const setMouse = e => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  };

  // Only the battlefield canvas starts firing, so clicks in the shop never shoot.
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    setMouse(e);
    input.firing = true;
  });
  window.addEventListener('mousemove', setMouse);
  // The aim circle only shows while the cursor is over the battlefield.
  canvas.addEventListener('mouseenter', () => { input.mouseOnField = true; });
  canvas.addEventListener('mousemove', () => { input.mouseOnField = true; });
  canvas.addEventListener('mouseleave', () => { input.mouseOnField = false; });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) input.firing = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Don't leave keys "stuck" down when the window loses focus.
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.firing = false;
  });
}

function setupSaving() {
  setInterval(saveGame, CONFIG.save.autosaveSeconds * 1000);
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame();
  });
}

let lastTime = null;

function frame(now) {
  // Cap the step so returning to a background tab doesn't award catch-up kills.
  const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, CONFIG.maxFrameSeconds);
  lastTime = now;

  updateWorld(dt);
  renderWorld(ctx, highlightedUnit());
  updateHUD();
  updateToasts(dt);

  requestAnimationFrame(frame);
}

function start() {
  state = loadGame();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  resetWorld();
  setupInput();
  initUI();
  initToasts();
  checkAchievements(); // e.g. an older save that already has 3 MANs
  setupSaving();
  requestAnimationFrame(frame);
}

start();
