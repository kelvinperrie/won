// Toast popups in the bottom-left: an adviser's portrait and an inane remark.
// New toasts appear at the bottom and push older ones up.

const toasts = {
  el: null,
  nextIn: 0,
  shown: [],   // { el, life }
  recent: [],  // recently used lines, so they don't repeat too soon
};

function initToasts() {
  toasts.el = document.getElementById('toasts');
  toasts.nextIn = CONFIG.toasts.firstDelay;
  toasts.el.addEventListener('click', e => {
    const t = toasts.shown.find(s => s.el.contains(e.target));
    if (t) dismissToast(t);
  });
}

function updateToasts(dt) {
  toasts.nextIn -= dt;
  if (toasts.nextIn <= 0) {
    toasts.nextIn = rand(...CONFIG.toasts.every);
    randomToast();
  }
  for (const t of toasts.shown) {
    t.life -= dt;
    if (t.life <= 0) dismissToast(t);
  }
}

// A random remark from a random adviser.
function randomToast() {
  const ids = Object.keys(ADVISERS);
  const id = ids[Math.floor(Math.random() * ids.length)];
  const line = pickLine(ADVISERS[id].lines);
  showToast(id, line);
}

// A remark about something that just happened, e.g. toastEvent('unlockLure', 'pig').
function toastEvent(kind, name) {
  const options = [];
  for (const [id, adv] of Object.entries(ADVISERS)) {
    for (const line of (adv.on && adv.on[kind]) || []) options.push([id, line]);
  }
  if (!options.length) return;
  const [id, line] = options[Math.floor(Math.random() * options.length)];
  showToast(id, line.replaceAll('{name}', name));
  // Don't follow an event remark straight away with a random one.
  toasts.nextIn = Math.max(toasts.nextIn, CONFIG.toasts.every[0]);
}

function pickLine(lines) {
  const fresh = lines.filter(l => !toasts.recent.includes(l));
  const line = (fresh.length ? fresh : lines)[Math.floor(Math.random() * (fresh.length || lines.length))];
  toasts.recent.push(line);
  if (toasts.recent.length > 15) toasts.recent.shift();
  return line;
}

function showToast(id, text) {
  const adv = ADVISERS[id];
  text = text
    .replaceAll('{points}', formatNumber(state.points))
    .replaceAll('{destroyed}', formatNumber(state.destroyed));

  addToast(portraitSVG(adv.look), `${adv.name}, ${adv.title}`, text);
}

function showAchievementToast(a) {
  addToast(trophySVG(), 'ACHIEVEMENT UNLOCKED', `${a.title}: ${a.text}`, 'achievement-toast');
}

// faceHTML is our own SVG; who and text are set as plain text.
function addToast(faceHTML, who, text, extraClass) {
  if (!toasts.el) return;
  const el = document.createElement('div');
  el.className = 'toast' + (extraClass ? ' ' + extraClass : '');
  el.title = 'Click to dismiss';
  el.innerHTML = `${faceHTML}<div class="toast-body"><div class="toast-who"></div><div class="toast-text"></div></div>`;
  el.querySelector('.toast-who').textContent = who;
  el.querySelector('.toast-text').textContent = text;
  toasts.el.appendChild(el);

  const t = { el, life: CONFIG.toasts.showSeconds };
  toasts.shown.push(t);
  while (toasts.shown.length > CONFIG.toasts.maxShown) dismissToast(toasts.shown[0]);
}

function dismissToast(t) {
  const i = toasts.shown.indexOf(t);
  if (i < 0) return;
  toasts.shown.splice(i, 1);
  t.el.classList.add('leaving');
  setTimeout(() => t.el.remove(), 300);
}

// ---------- Portraits ----------
// 16x16 pixel grid. Each layer is a list of [x, y, w, h] rects in one colour.

function portraitSVG(look) {
  const px = [];
  const add = (color, rects) => { for (const r of rects) px.push([color, ...r]); };
  const dark = '#1a1410';

  add('#24301f', [[0, 0, 16, 16]]);                    // background
  add(look.suit, [[2, 12, 12, 4], [3, 11, 10, 1]]);    // shoulders
  add('#f2f2ea', [[6, 11, 4, 2], [7, 13, 2, 3]]);      // shirt collar
  if (look.tie) add(look.tie, [[7, 12, 2, 4]]);
  add(look.skin, [[6, 10, 4, 1]]);                     // neck
  add(look.skin, [[4, 3, 8, 7], [5, 10, 6, 1], [3, 6, 1, 2], [12, 6, 1, 2]]); // head + ears

  const hair = {
    short:   [[4, 2, 8, 2], [4, 4, 1, 2], [11, 4, 1, 2]],
    bald:    [[4, 5, 1, 2], [11, 5, 1, 2]],
    bob:     [[4, 2, 8, 2], [3, 3, 1, 7], [12, 3, 1, 7], [4, 4, 2, 1], [10, 4, 2, 1]],
    flattop: [[4, 1, 8, 3], [4, 4, 1, 1], [11, 4, 1, 1]],
    bun:     [[6, 0, 4, 2], [4, 2, 8, 2], [4, 4, 1, 2], [11, 4, 1, 2]],
  }[look.hair] || [];
  add(look.hairColor, hair);
  add(look.hairColor, [[5, 5, 2, 1], [9, 5, 2, 1]]); // eyebrows

  add(dark, [[6, 6, 1, 1], [9, 6, 1, 1]]);             // eyes
  if (look.glasses) {
    add(dark, [[5, 6, 1, 1], [7, 6, 2, 1], [10, 6, 1, 1], [5, 7, 3, 1], [8, 7, 3, 1]]);
    add('#a8d8e8', [[6, 6, 1, 1], [9, 6, 1, 1]]);      // lens glint
  }
  add('#a0604a', [[7, 9, 2, 1]]);                      // mouth
  if (look.mustache) add(look.hairColor, [[6, 8, 4, 1]]);
  if (look.earrings) add('#ffe14d', [[3, 8, 1, 1], [12, 8, 1, 1]]);

  const rects = px.map(([c, x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
  return `<svg class="toast-face" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
