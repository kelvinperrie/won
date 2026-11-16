// HUD and shop panel.

const ui = {
  selected: 0, // index into state.units of the unit being upgraded
  tab: 'shop', // which side panel tab is showing: 'shop', 'achievements' or 'stats'
  els: {},
};

// The on/off buttons in the panel footer, and the setting each one flips.
const SETTING_BUTTONS = [
  { id: 'toggle-sound', key: 'sound', label: 'Sound' },
  { id: 'toggle-effects', key: 'effects', label: 'Shake & flash' },
];

function initUI() {
  const $ = id => document.getElementById(id);
  ui.els = {
    destroyed: $('destroyed'),
    points: $('points'),
    shop: $('shop'),
    tabs: $('unit-tabs'),
    detail: $('unit-detail'),
    unitBuy: $('unit-buy'),
    lures: $('lures'),
    reset: $('reset'),
  };

  ui.els.shop.addEventListener('click', onShopClick);
  ui.els.reset.addEventListener('click', onReset);
  // DEBUG: for balancing only. Remove before release (with the button in index.html).
  const debugBtn = $('debug-points');
  if (debugBtn) debugBtn.addEventListener('click', onDebugPoints);
  for (const tab of document.querySelectorAll('.panel-tab')) {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  }
  for (const b of SETTING_BUTTONS) {
    const btn = $(b.id);
    if (btn) btn.addEventListener('click', () => toggleSetting(b.key));
  }
  const vol = $('volume');
  if (vol) {
    vol.addEventListener('input', () => {
      setSetting('volume', Number(vol.value) / 100);
      // Moving the slider up while muted means "I want to hear it".
      if (!feedback.settings.sound && Number(vol.value) > 0) setSetting('sound', true);
      renderSettings();
    });
    // A blip when the slider is let go, to hear the new level.
    vol.addEventListener('change', () => sfx('buy'));
  }
  renderShop();
  renderAchievements();
  renderSettings();
}

// Switches the right-hand panel between SHOP, ACHIEVEMENTS and STATS.
function showTab(name) {
  ui.tab = name;
  for (const tab of document.querySelectorAll('.panel-tab')) {
    tab.classList.toggle('active', tab.dataset.tab === name);
    tab.setAttribute('aria-selected', tab.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.hidden = panel.dataset.panel !== name;
  }
  if (name === 'stats') renderStats();
}

// Flips sound or shake & flash on or off (also the M key, for sound).
function toggleSetting(key) {
  setSetting(key, !feedback.settings[key]);
  renderSettings();
}

function renderSettings() {
  for (const b of SETTING_BUTTONS) {
    const btn = document.getElementById(b.id);
    if (!btn) continue;
    const on = feedback.settings[b.key];
    btn.textContent = `${b.label}: ${on ? 'on' : 'off'}`;
    btn.setAttribute('aria-pressed', on);
    btn.classList.toggle('off', !on);
  }
  const vol = document.getElementById('volume');
  if (vol) {
    const pctVol = Math.round(feedback.settings.volume * 100);
    if (document.activeElement !== vol) vol.value = pctVol; // don't fight a drag in progress
    document.getElementById('volume-value').textContent = pctVol + '%';
    vol.closest('.volume').classList.toggle('off', !feedback.settings.sound);
  }
}

// The unit picked in the shop, highlighted on the battlefield.
function highlightedUnit() {
  return state.units[ui.selected] || null;
}

function onShopClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn || btn.disabled) return;
  const d = btn.dataset;
  const rec = state.units[ui.selected];

  if (d.action === 'select') {
    ui.selected = Number(d.index);
  } else if (d.action === 'upgrade') {
    if (rec && buyUpgrade(rec, d.key)) sfx('buy');
  } else if (d.action === 'buy-unit') {
    const newRec = buyUnit(d.type);
    if (newRec) {
      sfx('unlock');
      addUnitEntity(newRec);
      ui.selected = state.units.indexOf(newRec);
      toastEvent('buyUnit', unitLabel(newRec));
      checkAchievements();
    }
  } else if (d.action === 'buy-lure') {
    const wasLocked = !state.lures[d.name];
    if (buyLure(d.name)) {
      sfx(wasLocked ? 'unlock' : 'buy');
      if (wasLocked) toastEvent('unlockLure', d.name);
    }
  }
  renderShop();
}

function onReset() {
  if (!confirm('Reset all progress? Your units, upgrades, lures, score, achievements and stats will be wiped.')) return;
  resetGame();
  resetWorld();
  ui.selected = 0;
  renderShop();
  renderAchievements();
  renderStats();
}

// DEBUG: for balancing only. Remove before release.
// Gives spendable points without adding to "Amount of Nature Destroyed".
function onDebugPoints() {
  state.points += 100;
  saveGame();
}

function costButton(label, cost, attrs) {
  if (cost === null) return `<button disabled ${attrs}>MAX</button>`;
  return `<button data-cost="${cost}" ${attrs}>${label}${formatNumber(cost)}</button>`;
}

function renderShop() {
  if (ui.selected >= state.units.length) ui.selected = 0;
  const rec = state.units[ui.selected];

  // Unit tabs
  ui.els.tabs.innerHTML = state.units
    .map((u, i) => {
      const cls = [i === ui.selected ? 'active' : '', isPlayerUnit(u) ? '' : 'ai'].join(' ');
      return `<button class="${cls}" data-action="select" data-index="${i}">${unitLabel(u)}</button>`;
    })
    .join('');

  // Selected unit's attributes
  const rows = Object.keys(rec.levels)
    .map(key => {
      const a = attrDef(rec, key);
      const cost = attrCost(rec, key);
      const next = cost === null ? '' : `title="Next: ${formatAttr(rec, key, attrValueAt(rec, key, rec.levels[key] + 1))}"`;
      return `<tr>
        <td>${a.label}</td>
        <td class="val">${formatAttr(rec, key, attrValue(rec, key))}</td>
        <td class="lvl">Lv ${rec.levels[key]}</td>
        <td class="buy">${costButton('', cost, `data-action="upgrade" data-key="${key}" ${next}`)}</td>
      </tr>`;
    })
    .join('');
  ui.els.detail.innerHTML = `
    <div class="unit-sub">${unitLabel(rec)} &middot; ${isPlayerUnit(rec) ? 'you (WASD + mouse)' : 'AI controlled'}</div>
    <table class="attrs">${rows}</table>`;

  // Buy new units
  ui.els.unitBuy.innerHTML = Object.entries(CONFIG.unitTypes)
    .map(([type, def]) => {
      if (unitAtMax(type)) {
        const ai = def.maxCount - (def.startingCount || 0);
        return `<button disabled>${type}: limit reached (max ${ai})</button>`;
      }
      const label = `Buy ${type}${nextUnitNum(type)} (${def.description}) &middot; `;
      return costButton(label, unitCost(type), `data-action="buy-unit" data-type="${type}"`);
    })
    .join('');

  // Lures
  ui.els.lures.innerHTML = Object.entries(CONFIG.animals)
    .map(([name, def]) => {
      const owned = state.lures[name];
      const cost = lureCost(name);
      const stats = `${def.health} hp &middot; ${def.points} pts`;
      if (!owned) {
        return `<div class="lure locked">
          <div class="lure-name">${name}</div>
          <div class="lure-info">locked &middot; ${stats}</div>
          ${costButton('Unlock &middot; ', cost, `data-action="buy-lure" data-name="${name}"`)}
        </div>`;
      }
      const every = (spawnSeconds(name) / owned).toFixed(owned > 10 ? 2 : 1);
      const c = def.color || CONFIG.colors.animal;
      return `<div class="lure">
        <div class="lure-name" style="color: rgb(${c.join(',')})">${name} &times;${owned}</div>
        <div class="lure-info">1 every ${every}s &middot; ${stats}</div>
        ${costButton('+1 lure &middot; ', cost, `data-action="buy-lure" data-name="${name}"`)}
      </div>`;
    })
    .join('');

  refreshAffordability();
}

// Enables/disables buy buttons as points change, without rebuilding the panel.
function refreshAffordability() {
  for (const btn of ui.els.shop.querySelectorAll('button[data-cost]')) {
    btn.disabled = state.points < Number(btn.dataset.cost);
  }
}

let lastHud = { points: -1, destroyed: -1 };

function updateHUD() {
  if (state.points !== lastHud.points) {
    ui.els.points.textContent = formatNumber(state.points);
    lastHud.points = state.points;
    refreshAffordability();
  }
  if (state.destroyed !== lastHud.destroyed) {
    ui.els.destroyed.textContent = formatNumber(state.destroyed);
    lastHud.destroyed = state.destroyed;
  }
}
