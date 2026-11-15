// HUD and shop panel.

const ui = {
  selected: 0, // index into state.units of the unit being upgraded
  els: {},
};

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
  for (const tab of document.querySelectorAll('.panel-tab')) {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  }
  renderShop();
  renderAchievements();
}

// Switches the right-hand panel between SHOP and ACHIEVEMENTS.
function showTab(name) {
  for (const tab of document.querySelectorAll('.panel-tab')) {
    tab.classList.toggle('active', tab.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.hidden = panel.dataset.panel !== name;
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
    if (rec) buyUpgrade(rec, d.key);
  } else if (d.action === 'buy-unit') {
    const newRec = buyUnit(d.type);
    if (newRec) {
      addUnitEntity(newRec);
      ui.selected = state.units.indexOf(newRec);
      toastEvent('buyUnit', unitLabel(newRec));
      checkAchievements();
    }
  } else if (d.action === 'buy-lure') {
    const wasLocked = !state.lures[d.name];
    if (buyLure(d.name) && wasLocked) toastEvent('unlockLure', d.name);
  }
  renderShop();
}

function onReset() {
  if (!confirm('Reset all progress? Your units, upgrades, lures, score and achievements will be wiped.')) return;
  resetGame();
  resetWorld();
  ui.selected = 0;
  renderShop();
  renderAchievements();
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
