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
