// Draws the battlefield. Everything is text.

// Draws a word centred on (x, y) so its FIRST letter points along `angle`
// (the direction of travel). Normal text reads left-to-right with the first
// letter on the left, so we rotate by angle + 180°.
function drawWord(ctx, text, x, y, angle, px, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI);
  ctx.font = `${opts.italic ? 'italic ' : ''}bold ${px}px ${CONFIG.text.font}`;
  ctx.fillStyle = color;
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = px * 0.9;
  }
  // A dark outline lets a word stay readable when drawn over another word.
  const outline = opts.outline
    ? (ch, x) => {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = CONFIG.colors.background;
        ctx.lineWidth = Math.max(2, px * 0.22);
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, x, 0);
        ctx.restore();
      }
    : () => {};
  if (opts.spacing) {
    // Draw letter by letter so the gap between letters can be tightened.
    const gap = opts.spacing * px;
    const widths = [...text].map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((s, w) => s + w, 0) + gap * (widths.length - 1);
    let cx = -total / 2;
    ctx.textAlign = 'left';
    const xs = widths.map((w, i) => (i === 0 ? cx : (cx += widths[i - 1] + gap)));
    [...text].forEach((ch, i) => outline(ch, xs[i]));
    [...text].forEach((ch, i) => ctx.fillText(ch, xs[i], 0));
  } else {
    outline(text, 0);
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

// Upright text (floating noises and points).
function drawLabel(ctx, text, x, y, px, color, alpha, italic) {
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${px}px ${CONFIG.text.font}`;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function animalColor(a) {
  const t = 1 - clamp(a.hp / a.def.health, 0, 1);
  return mixColor(a.def.color || CONFIG.colors.animal, CONFIG.colors.animalHurt, t);
}

function mixColor(c0, c1, t) {
  return `rgb(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))})`;
}

// How damaged a plant is, 0 (fine) to 1 (about to break).
function plantDamage(p) {
  return clamp(p.damage / Math.max(plantMaxHp(p), 0.001), 0, 1);
}

// The main word fades toward its damaged colour as it takes damage, and the
// branches and leaves wither with it.
function drawPlant(ctx, p) {
  const t = plantDamage(p);
  const dc = CONFIG.plants.decor;
  const sp = { spacing: CONFIG.plants.letterSpacing };
  const s = p.px;

  drawWord(ctx, p.type, p.x, p.y, p.angle, s, mixColor(p.def.color, p.def.damagedColor, t), sp);

  const branchColor = mixColor(dc.branchColor, p.def.damagedColor, t);
  for (const b of p.decor.branches) {
    if (b.size * s < 3) continue; // too small to see on a sapling
    drawWord(ctx, 'BRANCH', p.x + b.x * s, p.y + b.y * s, b.angle, b.size * s, branchColor, sp);
  }
  const leafColor = mixColor(dc.leafColor, p.def.damagedColor, t);
  for (const l of p.decor.leaves) {
    if (l.size * s < 3) continue;
    drawWord(ctx, 'LEAF', p.x + l.x * s, p.y + l.y * s, l.angle, l.size * s, leafColor, sp);
  }
}

function renderWorld(ctx, highlightRec) {
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, world.w, world.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Debris lies on the ground under everything.
  const dcfg = CONFIG.plants.debris;
  for (const d of world.debris) {
    // Tumbles from where it hung on the plant to where it lands, then lies still.
    const k = Math.min(1, d.t / dcfg.fallSeconds);
    const e = 1 - (1 - k) * (1 - k); // ease out
    const angle = lerp(d.startAngle, d.angle, e);
    drawWord(ctx, d.word, d.x + d.fromDx * (1 - e), d.y + d.fromDy * (1 - e), angle, fontPx(d.size), d.color, {
      spacing: CONFIG.plants.letterSpacing,
      alpha: dcfg.alpha,
    });
  }

  // Plants next, so animals and units walk in front of them.
  for (const p of world.plants) drawPlant(ctx, p);

  for (const a of world.animals) {
    drawWord(ctx, a.name, a.x, a.y, a.angle, a.px, animalColor(a), { spacing: CONFIG.text.animalLetterSpacing });
  }

  for (const u of world.units) {
    // The unit picked in the shop keeps its colour but gets a white glow.
    const selected = u.rec === highlightRec;
    const color = u.isPlayer ? CONFIG.colors.player : CONFIG.colors.ai;
    const glow = selected ? CONFIG.colors.highlight : u.isPlayer ? 'rgba(255,225,77,0.35)' : null;
    const px = fontPx(u.def.textSize || CONFIG.text.unitSize);
    drawWord(ctx, unitLabel(u.rec), u.x, u.y, u.labelAngle, px, color, { glow, spacing: unitSpacing(u) });

    if (u.def.barrel) {
      // BARREL sits on top of the tank, sticking out from its centre toward
      // where it's aimed, with its first letter at the tip.
      const b = u.def.barrel;
      const half = barrelLength(u) / 2;
      const bx = u.x + Math.cos(u.barrelAngle) * half;
      const by = u.y + Math.sin(u.barrelAngle) * half;
      drawWord(ctx, b.word, bx, by, u.barrelAngle, fontPx(b.textSize), CONFIG.colors.barrel, {
        glow: selected ? CONFIG.colors.highlight : null,
        spacing: CONFIG.text.unitLetterSpacing,
        outline: true,
      });
    }

    if (u.webbed > 0) {
      // COBWEBS drawn across the unit at a slant, fading out in the last second.
      const w = CONFIG.cobwebs;
      drawWord(ctx, w.word, u.x, u.y, Math.PI + 0.35, fontPx(w.textSize), w.color, {
        alpha: Math.min(1, u.webbed),
        outline: true,
        spacing: CONFIG.text.unitLetterSpacing,
      });
    }
  }

  for (const b of world.bullets) {
    drawWord(ctx, b.word, b.x, b.y, b.angle, fontPx(b.size), CONFIG.colors.bullet);
  }

  const floatPx = fontPx(CONFIG.text.floatSize);
  for (const e of world.effects) {
    const p = e.t / e.life;
    if (e.kind === 'boom') {
      // Size the BOOM so its width matches the blast diameter.
      const growth = lerp(0.7, 1.1, p);
      const px = Math.max(CONFIG.text.minPx, ((e.radius * 2) / textWidth('BOOM', 100)) * 100 * growth);
      ctx.save();
      ctx.font = `bold ${px}px ${CONFIG.text.font}`;
      ctx.fillStyle = CONFIG.colors.boom;
      ctx.globalAlpha = 1 - p;
      ctx.fillText('BOOM', e.x, e.y);
      ctx.restore();
    } else {
      drawLabel(ctx, e.text, e.x, e.y - p * pct(4), floatPx, e.color, 1 - p * p, e.italic);
    }
  }

  drawAim(ctx);
}

// The player's aim circle: where the next shot will explode, sized to its blast
// radius. Solid at the cursor; dashed when pulled in to the range limit.
function drawAim(ctx) {
  if (!input.mouseOnField) return;
  const u = world.units.find(x => x.isPlayer);
  if (!u) return;
  const aim = playerAim(u);
  ctx.save();
  ctx.strokeStyle = CONFIG.colors.player;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = aim.limited ? 0.45 : 0.7;
  if (aim.limited) ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, Math.max(3, aim.radius), 0, Math.PI * 2);
  ctx.stroke();
  // A small cross marks the exact centre of the blast.
  ctx.setLineDash([]);
  const c = 4;
  ctx.beginPath();
  ctx.moveTo(aim.x - c, aim.y);
  ctx.lineTo(aim.x + c, aim.y);
  ctx.moveTo(aim.x, aim.y - c);
  ctx.lineTo(aim.x, aim.y + c);
  ctx.stroke();
  ctx.restore();
}
