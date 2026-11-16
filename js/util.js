// Small helpers shared by the other scripts.

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatNumber(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return n.toFixed(n < 100 ? 2 : 1) + units[i];
}

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0;
}

// Whole number from lo to hi, inclusive.
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// An [r, g, b] colour part-way (t = 0..1) from c0 to c1, as an [r, g, b] array.
function mixRGB(c0, c1, t) {
  return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
}

// The same, as a CSS colour.
function mixColor(c0, c1, t) {
  return `rgb(${mixRGB(c0, c1, t).map(Math.round).join(',')})`;
}

// ---------- Angles ----------

const DEG = Math.PI / 180;

// Signed shortest turn from angle a to angle b, in (-PI, PI].
function angleDiff(a, b) {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d === -Math.PI ? Math.PI : d;
}

// Turns angle a toward b by at most maxStep radians.
function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}
