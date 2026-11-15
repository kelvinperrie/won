// Achievements: unlocked once, saved, announced with a popup, and listed in
// the shop panel's ACHIEVEMENTS tab.
//
// Each achievement has an id, a title, a description, and a test() that
// returns true once it has been earned. The per-animal ones are built from
// the animal config, so new animals get achievements automatically.

// Every animal that can be killed (lure animals and tree animals).
function allAnimalTypes() {
  return { ...CONFIG.animals, ...CONFIG.treeAnimals };
}

function pluralName(name) {
  return allAnimalTypes()[name].plural || name + 's';
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildAchievements() {
  const list = [];
  const killsFor = CONFIG.achievements.manyKills;

  for (const name of Object.keys(allAnimalTypes())) {
    list.push({
      id: `first-${name}`,
      title: `Hello ${name}, Goodbye ${name}`,
      text: `Kill your first ${name}.`,
      test: () => (state.kills[name] || 0) >= 1,
    });
  }
  for (const name of Object.keys(allAnimalTypes())) {
    list.push({
      id: `kill${killsFor}-${name}`,
      title: `${capitalise(name)} Exterminator`,
      text: `Kill ${killsFor} ${pluralName(name)}.`,
      test: () => (state.kills[name] || 0) >= killsFor,
    });
  }
  list.push({
    id: 'three-mans',
    title: 'Three\'s a Crowd',
    text: 'Have 3 MANs (MAN1 plus two hired hunters).',
    test: () => unitCount('MAN') >= 3,
  });
  list.push({
    id: 'player-shots-100',
    title: 'Trigger Happy',
    text: 'Personally fire 100 bullets.',
    test: () => state.playerShots >= 100,
  });
  return list;
}

const ACHIEVEMENTS = buildAchievements();

// Unlocks anything newly earned. Cheap enough to call after every kill or purchase.
function checkAchievements() {
  let any = false;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !a.test()) continue;
    state.achievements[a.id] = Date.now();
    showAchievementToast(a);
    any = true;
  }
  if (any) {
    saveGame();
    renderAchievements();
  }
}

function recordKill(name) {
  state.kills[name] = (state.kills[name] || 0) + 1;
  checkAchievements();
}

// Only shots the player fires themselves (MAN1), not AI units.
function recordPlayerShot() {
  state.playerShots++;
  checkAchievements();
}

// The ACHIEVEMENTS tab: only the ones earned so far, newest first.
function renderAchievements() {
  const el = document.getElementById('achievement-list');
  const countEl = document.getElementById('achievement-count');
  if (!el) return;
  const got = ACHIEVEMENTS
    .filter(a => state.achievements[a.id])
    .sort((p, q) => state.achievements[q.id] - state.achievements[p.id]);

  countEl.textContent = `${got.length} of ${ACHIEVEMENTS.length} unlocked`;
  el.innerHTML = got.length
    ? got.map(a => `<div class="achievement">
        ${trophySVG()}
        <div>
          <div class="achievement-title">${a.title}</div>
          <div class="achievement-text">${a.text}</div>
          <div class="achievement-date">${new Date(state.achievements[a.id]).toLocaleDateString()}</div>
        </div>
      </div>`).join('')
    : '<div class="achievement-empty">Nothing yet. Nature remains suspiciously intact.</div>';
}

// 16x16 pixel-art trophy, same style as the adviser portraits.
function trophySVG() {
  const gold = '#ffd23a';
  const shade = '#c8961e';
  const shine = '#fff3a8';
  const rects = [
    ['#24301f', 0, 0, 16, 16],
    [shade, 2, 3, 2, 1], [shade, 2, 4, 1, 2], [shade, 3, 6, 1, 1],     // left handle
    [shade, 12, 3, 2, 1], [shade, 13, 4, 1, 2], [shade, 12, 6, 1, 1],  // right handle
    [gold, 4, 2, 8, 5], [gold, 5, 7, 6, 1], [gold, 6, 8, 4, 1],        // cup
    [shine, 5, 3, 1, 3],
    [shade, 7, 9, 2, 2],                                                // stem
    [gold, 5, 11, 6, 1],                                                // base
    ['#7a5232', 4, 12, 8, 2],                                           // plinth
  ];
  const body = rects.map(([c, x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
  return `<svg class="toast-face" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}
