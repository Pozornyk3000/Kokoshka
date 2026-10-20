/* Анамнез — иллюстрации сцен.
   Плоская SVG-иллюстрация 400×225 с мягкими градиентами.
   A.art.scene(id, { slot: 0–3, season, seed }) → строка '<svg viewBox="0 0 400 225">…</svg>'.
   Освещение по времени суток: в интерьерах — полупрозрачное затемнение и свечение ламп поверх него,
   на улице — тонировка цветов и светящиеся окна/фонари. Сезон меняет деревья, землю, крыши. */
(function (A) {
  'use strict';
  const ART = (A.art = A.art || {});
  const U = A.util || {};
  const W = 400;
  const H = 225;
  let UID = 0;

  /* ---------- Числа, случайность ---------- */
  const f = (v) => Math.round(v * 10) / 10;
  const f2 = (v) => Math.round(v * 100) / 100;
  /** Шаблон для путей: все числа округляются до 0.1. */
  function P(strs) {
    let s = strs[0];
    for (let i = 1; i < arguments.length; i++) {
      const v = arguments[i];
      s += (typeof v === 'number' ? f(v) : v) + strs[i];
    }
    return s;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(str) {
    if (U.hash) return U.hash(str);
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    if (U.mulberry32) return U.mulberry32(seed);
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rr = (c, a, b) => a + c.r() * (b - a);
  const pk = (c, arr) => arr[Math.floor(c.r() * arr.length)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ESC[m]);

  /* ---------- Цвета ---------- */
  const CC = {};
  function rgb(h) {
    if (CC[h]) return CC[h];
    let x = h.replace('#', '');
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    const v = parseInt(x, 16);
    return (CC[h] = [(v >> 16) & 255, (v >> 8) & 255, v & 255]);
  }
  const hex = (c) => '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t));
  }
  const dk = (c, t) => mix(c, '#141a2e', t);
  const lt = (c, t) => mix(c, '#ffffff', t);

  /* Палитра */
  const INK = '#1E2944';
  const MINT = '#9CC3B2';
  const MINTD = '#7FAE9A';
  const CREAM = '#F1E6D2';
  const CORAL = '#E07A5F';
  const MUSTARD = '#E9B949';
  const CAT = '#E08A3C';
  const CATD = '#B5602A';
  const CATL = '#F7CC98';
  const COAT = '#F6F7F4';
  const COATD = '#D5DEDC';
  const WOOD = '#B98556';
  const WOODD = '#8A5A36';
  const LAMP = '#FFD58A';
  const SHOE = '#2A2C33';
  const SKIN = ['#F2D0B4', '#E9BE9C', '#DBA77F', '#C08861', '#93603F'];
  const HAIRC = ['#2B2220', '#433026', '#5E412E', '#8C6442', '#C49E68', '#8D8883', '#B9B4AE', '#A4532E'];
  const TOPS = ['#5B7C99', '#7FAE9A', '#C8553D', '#E9B949', '#8E5A7C', '#3F4B66', '#D98E5F', '#6A8EAE', '#A9B18F', '#B5654A'];
  const BOOKS = ['#C8553D', '#E9B949', '#5B7C99', '#7FAE9A', '#8E5A7C', '#3F4B66', '#D98E5F', '#A9B18F', '#6A8EAE', '#B5654A', '#E2C78F', '#4E6B5A', '#2F3B5C', '#E6DCC8'];
  const LITC = ['#FFD27A', '#FFC86A', '#FFE0A0', '#F9B65E', '#FFD98F'];
  const GLASS = ['#BFCFDD', '#A3C6DE', '#57527D', '#1C2645'];
  const LITP = [0.14, 0, 0.5, 0.36];
  const TINT = [['#F7B88E', 0.1], null, ['#4A3A70', 0.3], ['#0F1733', 0.6]];

  /* ---------- Примитивы ---------- */
  const X = (e) => (e ? ' ' + e : '');
  const R = (x, y, w, h, fill, e) => '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + fill + '"' + X(e) + '/>';
  const RR = (x, y, w, h, rx, fill, e) => '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(rx) + '" fill="' + fill + '"' + X(e) + '/>';
  const E = (cx, cy, rx, ry, fill, e) => '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + X(e) + '/>';
  const C = (cx, cy, r, fill, e) => '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + X(e) + '/>';
  const PA = (d, fill, e) => '<path d="' + d + '" fill="' + fill + '"' + X(e) + '/>';
  const PG = (pts, fill, e) => '<polygon points="' + pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ') + '" fill="' + fill + '"' + X(e) + '/>';
  const SK = (d, col, w, e) => '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + f2(w) + '" stroke-linecap="round" stroke-linejoin="round"' + X(e) + '/>';
  const TX = (x, y, str, size, fill, e) => '<text x="' + f(x) + '" y="' + f(y) + '" font-family="PT Mono, monospace" font-size="' + size + '" fill="' + fill + '" text-anchor="middle"' + X(e) + '>' + esc(str) + '</text>';
  const G = (inner, e) => '<g' + X(e) + '>' + inner + '</g>';
  const O = (v) => 'opacity="' + v + '"';
  const T = (x, y, s, fl) => 'transform="translate(' + f(x) + ' ' + f(y) + ')' + ((s && s !== 1) || fl ? ' scale(' + f2((s || 1) * (fl ? -1 : 1)) + ' ' + f2(s || 1) + ')' : '') + '"';
  const sh = (x, y, rx, ry, o) => E(x, y, rx, ry, INK, O(o == null ? 0.16 : o));

  /* ---------- Контекст вызова: defs, свет, случайность ---------- */
  function mkCtx(id, slot, season, seed) {
    const c = {
      id: id,
      slot: slot,
      dim: slot,
      season: season,
      seed: seed,
      pre: 'sc' + (++UID).toString(36) + '_',
      nid: 0,
      defs: [],
      lights: [],
      top: [],
      cache: {},
      kc: {},
      indoor: false,
      r: rng((seed ^ hash('scene:' + id)) >>> 0),
      winter: season === 'winter',
      autumn: season === 'autumn',
      spring: season === 'spring',
      summer: season === 'summer',
      dark: slot >= 2,
      night: slot === 3,
    };
    const t = TINT[slot];
    c.k = t ? (col) => c.kc[col] || (c.kc[col] = mix(col, t[0], t[1])) : (col) => col;
    return c;
  }
  const nid = (c, k) => c.pre + k + (c.nid++).toString(36);
  const stopS = (st) => st.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null && s[2] !== 1 ? ' stop-opacity="' + f2(s[2]) + '"' : '') + '/>').join('');
  /** Линейный градиент; v = [x1, y1, x2, y2] (по умолчанию сверху вниз), u — в координатах сцены. */
  function lin(c, st, v, u) {
    v = v || [0, 0, 0, 1];
    const key = 'l' + st.join('|') + v.join(',') + (u ? 'u' : '');
    if (c.cache[key]) return c.cache[key];
    const id = nid(c, 'g');
    c.defs.push('<linearGradient id="' + id + '" x1="' + v[0] + '" y1="' + v[1] + '" x2="' + v[2] + '" y2="' + v[3] + '"' + (u ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stopS(st) + '</linearGradient>');
    return (c.cache[key] = 'url(#' + id + ')');
  }
  /** Радиальный градиент; v = [cx, cy, r, fx, fy]. */
  function rad(c, st, v) {
    v = v || [0.5, 0.5, 0.5];
    const key = 'r' + st.join('|') + v.join(',');
    if (c.cache[key]) return c.cache[key];
    const id = nid(c, 'g');
    c.defs.push('<radialGradient id="' + id + '" cx="' + v[0] + '" cy="' + v[1] + '" r="' + v[2] + '"' + (v[3] != null ? ' fx="' + v[3] + '" fy="' + v[4] + '"' : '') + '>' + stopS(st) + '</radialGradient>');
    return (c.cache[key] = 'url(#' + id + ')');
  }
  const vg = (c, a, b) => lin(c, [[0, a], [1, b]]);
  const hg = (c, a, b) => lin(c, [[0, a], [1, b]], [0, 0, 1, 0]);
  /** Мягкое свечение: эллипс с радиальным градиентом цвет → прозрачность. */
  function glow(c, x, y, rx, ry, col, o) {
    o = o == null ? 0.6 : o;
    return E(x, y, rx, ry, rad(c, [[0, col, o], [0.35, col, o * 0.55], [0.7, col, o * 0.16], [1, col, 0]]));
  }
  function clip(c, shape) {
    const id = nid(c, 'c');
    c.defs.push('<clipPath id="' + id + '">' + shape + '</clipPath>');
    return 'clip-path="url(#' + id + ')"';
  }
  function pattern(c, w, h, inner) {
    const id = nid(c, 'p');
    c.defs.push('<pattern id="' + id + '" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse">' + inner + '</pattern>');
    return 'url(#' + id + ')';
  }
  const lampOn = (c) => c.dim >= 2;
  const LGT = (c) => (c.dim >= 3 ? 1 : c.dim === 2 ? 0.8 : 0.35);

  /* ---------- Небо ---------- */
  function skyStops(c) {
    switch (c.slot) {
      case 0:
        return c.winter ? [[0, '#8FA6C8'], [0.55, '#E2C3B4'], [1, '#F8DEC4']] : [[0, '#86A8D2'], [0.55, '#EDC2A6'], [1, '#FCE0B8']];
      case 1:
        return c.winter ? [[0, '#7FA2C6'], [0.6, '#B7CDE0'], [1, '#E3EAF0']] : [[0, '#5B9AD6'], [0.6, '#9ACAEA'], [1, '#DAEFF6']];
      case 2:
        return [[0, '#2B2A5A'], [0.42, '#6E4A85'], [0.72, '#D6765F'], [1, '#F4B46A']];
      default:
        return [[0, '#080E24'], [0.6, '#141E3D'], [1, '#283660']];
    }
  }
  function cloud(x, y, s, col, o) {
    return G(E(0, 0, 16, 5, col) + C(-6, -3, 6, col) + C(3, -5, 7.5, col) + C(10, -1.5, 5, col), T(x, y, s) + ' ' + O(o));
  }
  function stars(c, x, y, w, h, n) {
    n = n || clamp(Math.round((w * h) / 800), 5, 60);
    let a = '';
    let b = '';
    for (let i = 0; i < n; i++) {
      const sx = x + c.r() * w;
      const sy = y + Math.pow(c.r(), 1.3) * h;
      const r = rr(c, 0.35, 0.9);
      const d = P`M${sx - r} ${sy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      if (c.r() < 0.4) a += d;
      else b += d;
    }
    let s = (a ? PA(a, '#FFF6DE') : '') + (b ? PA(b, '#DDE6FF', O(0.6)) : '');
    // пара мерцающих звёзд-крестиков
    for (let i = 0; i < Math.min(3, n / 8); i++) {
      const sx = x + rr(c, 0.1, 0.9) * w;
      const sy = y + rr(c, 0.05, 0.5) * h;
      const q = rr(c, 1.6, 2.4);
      s += PA(P`M${sx} ${sy - q}L${sx + q * 0.25} ${sy - q * 0.25}L${sx + q} ${sy}L${sx + q * 0.25} ${sy + q * 0.25}L${sx} ${sy + q}L${sx - q * 0.25} ${sy + q * 0.25}L${sx - q} ${sy}L${sx - q * 0.25} ${sy - q * 0.25}Z`, '#FFF8E6');
    }
    return s;
  }
  function moon(c, x, y, r) {
    return (
      glow(c, x, y, r * 6, r * 6, '#C9D6FF', 0.28) +
      C(x, y, r, '#E9ECF5', O(0.12)) +
      PA(P`M${x} ${y - r}A${r} ${r} 0 1 1 ${x} ${y + r}A${r * 0.58} ${r} 0 1 0 ${x} ${y - r}Z`, '#FBF3D8')
    );
  }
  /** Небо по времени суток в прямоугольнике (полное небо улицы или вид из окна). */
  function sky(c, x, y, w, h, o) {
    o = o || {};
    const m = Math.min(w, h);
    let s = R(x, y, w, h, lin(c, skyStops(c)));
    const sx = x + w * (o.sx != null ? o.sx : [0.26, 0.8, 0.7, 0.78][c.slot]);
    if (c.slot === 0) {
      const sy = y + h * (o.sy || 0.84);
      s += glow(c, sx, sy, m * 1.1, m * 0.6, '#FFD7A0', 0.85) + C(sx, sy, m * 0.065 + 2, '#FFF4D8');
      if (o.clouds !== false) s += cloud(x + w * 0.66, y + h * 0.32, m / 120, '#FCE7DA', 0.75) + cloud(x + w * 0.12, y + h * 0.22, m / 170, '#FCEAE0', 0.6);
    } else if (c.slot === 1) {
      const sy = y + h * (o.sy || 0.2);
      if (!c.winter) s += glow(c, sx, sy, m * 0.5, m * 0.5, '#FFFBEA', 0.75) + C(sx, sy, m * 0.055 + 2, '#FFFCF0');
      if (o.clouds !== false) {
        s += cloud(x + w * 0.3, y + h * 0.3, m / 105, '#FFFFFF', 0.92) + cloud(x + w * 0.6, y + h * 0.5, m / 160, '#FFFFFF', 0.8);
        if (c.winter) s += cloud(x + w * 0.82, y + h * 0.22, m / 90, '#EEF2F6', 0.9) + cloud(x + w * 0.08, y + h * 0.55, m / 130, '#F2F5F8', 0.85);
      }
    } else if (c.slot === 2) {
      const sy = y + h * (o.sy || 0.93);
      s += glow(c, sx, sy, m * 1.3, m * 0.7, '#FF9A66', 0.65) + C(sx, sy, m * 0.085 + 2, '#FFD08C');
      if (o.clouds !== false) s += E(x + w * 0.28, y + h * 0.46, w * 0.2, m * 0.022 + 0.6, '#F29A84', O(0.5)) + E(x + w * 0.58, y + h * 0.63, w * 0.15, m * 0.02 + 0.5, '#FBB98F', O(0.55)) + E(x + w * 0.42, y + h * 0.3, w * 0.1, m * 0.015 + 0.4, '#C47A93', O(0.45));
    } else {
      s += stars(c, x, y, w, h * 0.75, o.stars);
      if (o.moon !== false) s += moon(c, x + w * (o.mx || 0.78), y + h * (o.my || 0.24), m * 0.06 + 2.4);
    }
    return s;
  }

  /* ---------- Окна фасадов ---------- */
  function winGrid(c, x0, y0, cols, rows, ww, wh, dx, dy, p, skip) {
    const pl = p != null ? p : LITP[c.slot];
    const glass = c.slot === 1 && c.winter ? '#B4C7D6' : GLASS[c.slot];
    const by = {};
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (skip && skip(i, j)) continue;
        const col = c.r() < pl ? pk(c, LITC) : glass;
        by[col] = (by[col] || '') + P`M${x0 + i * dx} ${y0 + j * dy}h${ww}v${wh}h${-ww}z`;
      }
    }
    let s = '';
    for (const k in by) s += PA(by[k], k);
    return s;
  }

  /* ---------- Деревья, земля, сезон ---------- */
  const LEAF = {
    summer: ['#3E7A45', '#4E8F4E', '#66A65A', '#86BE6C'],
    spring: ['#78B35E', '#8EC46A', '#A8D47C', '#C6E59C'],
    autumn: ['#C55B2C', '#DB8532', '#E8A63B', '#F0C65A'],
  };
  function bare(c, x, gy, h, trunk, wsnow) {
    const segs = [[], [], [], []];
    const r = c.r;
    function br(x0, y0, ang, len, d) {
      const x1 = x0 + Math.cos(ang) * len;
      const y1 = y0 + Math.sin(ang) * len;
      segs[d].push(P`M${x0} ${y0}L${x1} ${y1}`);
      if (d >= 3) return;
      const n = d === 0 ? 3 : r() < 0.45 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const t = d === 0 ? 0.5 + i * 0.22 : 0.45 + r() * 0.55;
        const a = clamp(ang + (i - (n - 1) / 2) * 0.75 + (r() - 0.5) * 0.5, -Math.PI + 0.35, -0.35);
        br(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, a, len * (0.5 + r() * 0.18), d + 1);
      }
    }
    br(x, gy, -Math.PI / 2 + (r() - 0.5) * 0.08, h * 0.5, 0);
    const wd = [h * 0.055, h * 0.03, h * 0.015, h * 0.008];
    let s = '';
    for (let d = 0; d < 4; d++) s += SK(segs[d].join(''), c.k(trunk), Math.max(0.45, wd[d]));
    if (wsnow) s += G(SK(segs[1].join('') + segs[2].join(''), '#F3F6FA', Math.max(0.4, wd[2] * 0.8)), 'transform="translate(0 -.7)" ' + O(0.85));
    return s;
  }
  /** Дерево по сезону. kind: round | birch | poplar | fir. */
  function tree(c, x, gy, h, o) {
    o = o || {};
    const k = c.k;
    const kind = o.kind || 'round';
    let s = o.shadow === false ? '' : sh(x, gy, h * 0.3, h * 0.04, c.winter ? 0.1 : 0.15);
    const trunk = kind === 'birch' ? '#E9E5DC' : '#6B4F3E';
    if (kind === 'fir') {
      const g = k('#2F5E46');
      const g2 = k('#3D7356');
      s += R(x - h * 0.03, gy - h * 0.2, h * 0.06, h * 0.2, k('#5A4033'));
      for (let i = 0; i < 4; i++) {
        const yb = gy - h * (0.12 + i * 0.2);
        const wb = h * (0.34 - i * 0.07);
        s += PG([[x - wb, yb], [x + wb, yb], [x, yb - h * 0.32]], i % 2 ? g2 : g);
        if (c.winter) s += PA(P`M${x - wb * 0.85} ${yb - 1}Q${x} ${yb - h * 0.08} ${x + wb * 0.85} ${yb - 1}L${x + wb * 0.6} ${yb - h * 0.08}Q${x} ${yb - h * 0.13} ${x - wb * 0.6} ${yb - h * 0.08}Z`, '#F2F6FA');
      }
      return s;
    }
    if (c.winter) return s + bare(c, x, gy, h, trunk, true) + (kind === 'birch' ? birchMarks(c, x, gy, h * 0.5, h * 0.028) : '');
    const tw = Math.max(1, h * 0.045);
    s += PA(P`M${x - tw} ${gy}L${x - tw * 0.55} ${gy - h * 0.55}H${x + tw * 0.55}L${x + tw} ${gy}Z`, k(trunk));
    if (kind === 'birch') s += birchMarks(c, x, gy, h * 0.5, tw);
    s += SK(P`M${x} ${gy - h * 0.38}L${x - h * 0.12} ${gy - h * 0.6}M${x} ${gy - h * 0.45}L${x + h * 0.11} ${gy - h * 0.64}`, k(trunk), tw * 0.6);
    const pal = LEAF[c.season] || LEAF.summer;
    const sy = kind === 'poplar' ? 1.75 : kind === 'birch' ? 1.25 : 1;
    const cr = h * (kind === 'poplar' ? 0.17 : kind === 'birch' ? 0.24 : 0.29);
    const cy = gy - h * 0.62 - (sy - 1) * cr * 0.4;
    const col = (i) => (c.autumn ? k(pal[(i + Math.floor(c.r() * 2)) % 4]) : k(pal[i]));
    s += E(x, cy, cr, cr * 0.86 * sy, col(0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + c.r() * 0.6;
      s += C(x + Math.cos(a) * cr * 0.72, cy + Math.sin(a) * cr * 0.62 * sy, cr * rr(c, 0.36, 0.5), col(i % 2));
    }
    s += C(x - cr * 0.28, cy - cr * 0.3 * sy, cr * 0.46, col(2)) + C(x - cr * 0.42, cy - cr * 0.5 * sy, cr * 0.24, col(3));
    if (c.spring && o.bloom) {
      let d = '';
      for (let i = 0; i < 14; i++) {
        const a = c.r() * Math.PI * 2;
        const q = Math.sqrt(c.r()) * cr;
        const bx = x + Math.cos(a) * q;
        const by = cy + Math.sin(a) * q * 0.85 * sy;
        d += P`M${bx - 0.9} ${by}a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0 -1.8 0`;
      }
      s += PA(d, k('#FBE7EE'));
    }
    return s;
  }
  function birchMarks(c, x, gy, h, tw) {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const y = gy - h * (0.12 + i * 0.15) - c.r() * 2;
      const side = i % 2 ? 1 : -1;
      d += P`M${x + side * tw * 0.9} ${y}h${-side * tw * rr(c, 0.6, 1.1)}`;
    }
    return SK(d, c.k('#2E2B2A'), Math.max(0.5, tw * 0.35));
  }
  /** Опавшие листья (осенью) в прямоугольной зоне. */
  function leaves(c, x, y, w, h, n) {
    if (!c.autumn) return '';
    const by = {};
    for (let i = 0; i < n; i++) {
      const col = c.k(pk(c, ['#D9772F', '#E9A93C', '#C55B2C', '#F0C65A']));
      const lx = x + c.r() * w;
      const ly = y + c.r() * h;
      const q = rr(c, 0.9, 1.7);
      by[col] = (by[col] || '') + P`M${lx - q} ${ly}q${q} ${-q * 0.8} ${2 * q} 0q${-q} ${q * 0.8} ${-2 * q} 0`;
    }
    let s = '';
    for (const k in by) s += PA(by[k], k);
    return s;
  }
  function snowfall(c, n, y1) {
    if (!c.winter) return '';
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = c.r() * W;
      const y = c.r() * (y1 || H);
      const r = rr(c, 0.5, 1.2);
      d += P`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    return PA(d, '#FFFFFF', O(0.8));
  }
  function puddle(c, x, y, w) {
    const st = skyStops(c);
    return E(x, y, w, w * 0.16, c.k('#6E7A86'), O(0.25)) + E(x, y - 0.3, w * 0.92, w * 0.12, lin(c, [[0, st[st.length - 1][1]], [1, st[0][1]]]), O(0.8)) + E(x - w * 0.3, y - 0.6, w * 0.3, w * 0.03, '#FFFFFF', O(0.5));
  }

  /* ---------- Вид из окна ---------- */
  function view(c, x, y, w, h, kind) {
    const k = c.k;
    let s = sky(c, x, y, w, h, { sx: 0.3, clouds: w > 60 });
    const gy = y + h;
    if (kind === 'city') {
      // дальний и ближний ряд домов
      let bx = x - 4;
      while (bx < x + w) {
        const bw = rr(c, 14, 26);
        const bh = h * rr(c, 0.25, 0.48);
        s += R(bx, gy - bh, bw, bh, k(pk(c, ['#B9C2CF', '#C7C2CE', '#AEB9C6'])), O(0.9));
        bx += bw + rr(c, 1, 4);
      }
      if (c.r() < 0.8) {
        const tx = x + w * rr(c, 0.55, 0.8);
        s += PG([[tx - 2.5, gy - h * 0.3], [tx + 2.5, gy - h * 0.3], [tx + 0.6, gy - h * 0.82], [tx - 0.6, gy - h * 0.82]], k('#A3AEBD')) + R(tx - 2.6, gy - h * 0.62, 5.2, 2.4, k('#A3AEBD')) + LN(tx, gy - h * 0.82, tx, gy - h * 0.92, k('#A3AEBD'), 0.6);
        if (c.dark) s += C(tx, gy - h * 0.92, 1, '#FF6B5B');
      }
      bx = x - 6;
      while (bx < x + w) {
        const bw = rr(c, 18, 34);
        const bh = h * rr(c, 0.18, 0.36);
        const col = k(pk(c, ['#8E9AAD', '#9AA0B5', '#A69F9C', '#8A97A3']));
        s += R(bx, gy - bh, bw, bh, col);
        s += winGrid(c, bx + 2.5, gy - bh + 3, Math.floor((bw - 3) / 4.5), Math.floor((bh - 4) / 5), 2.2, 2.6, 4.5, 5, LITP[c.slot] + (c.slot === 1 ? 0 : 0.05));
        bx += bw + rr(c, 0, 3);
      }
    } else if (kind === 'trees') {
      for (let i = 0; i < 4; i++) s += tree(c, x + w * (0.1 + i * 0.27) + rr(c, -4, 4), gy + 4, h * rr(c, 0.75, 1.05), { shadow: false, kind: i === 1 ? 'birch' : 'round' });
    } else if (kind === 'street') {
      // дом через дорогу
      s += R(x - 2, gy - h * 0.62, w * 0.62, h * 0.62, k('#D8B98E'));
      s += winGrid(c, x + 3, gy - h * 0.56, Math.floor((w * 0.62 - 6) / 9), 3, 5, 7, 9, h * 0.16, LITP[c.slot] + 0.15);
      s += R(x + w * 0.64, gy - h * 0.48, w * 0.5, h * 0.48, k('#B7A6A0'));
      s += winGrid(c, x + w * 0.67, gy - h * 0.43, 4, 3, 4.5, 6, 8, h * 0.13, LITP[c.slot] + 0.15);
      s += R(x, gy - h * 0.1, w, h * 0.1, k(c.winter ? '#DCE3EA' : '#6E6F76'));
      if (c.dark) s += glow(c, x + w * 0.8, gy - h * 0.3, w * 0.25, h * 0.35, LAMP, 0.6) + R(x + w * 0.8 - 0.6, gy - h * 0.3, 1.2, h * 0.3, '#2B2E3A') + C(x + w * 0.8, gy - h * 0.3, 1.8, '#FFE7B0');
    } else {
      // двор: дом напротив, дерево, земля
      const hx = x + w * 0.04;
      const hw = w * 0.7;
      const ht = gy - h * 0.58;
      s += R(x + w * 0.56, gy - h * 0.4, w * 0.5, h * 0.4, k('#C9CFD4'), O(0.95));
      s += winGrid(c, x + w * 0.6, gy - h * 0.36, 4, 4, 3.4, 4, 7, h * 0.085);
      s += R(hx, ht, hw, gy - ht, k('#DCD3C4'));
      s += R(hx, ht, hw, 2.5, k('#B8AE9F'));
      if (c.winter) s += RR(hx - 1, ht - 2, hw + 2, 3, 1.5, '#F4F7FA');
      s += winGrid(c, hx + 4, ht + 6, Math.floor((hw - 6) / 9), 5, 5, 6, 9, h * 0.1);
      s += R(x, gy - h * 0.06, w, h * 0.06, k(c.winter ? '#E8EDF2' : c.autumn ? '#9D8F5F' : '#7FA163'));
      s += tree(c, x + w * 0.84, gy + 2, h * 0.62, { shadow: false });
    }
    return s;
  }

  /* ---------- Интерьер: окно, шторы, стены, пол ---------- */
  function archD(x, y, w, h) {
    const r = w / 2;
    return P`M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
  }
  /** Окно интерьера: вид наружу по времени суток, рама, подоконник. */
  function win(c, x, y, w, h, o) {
    o = o || {};
    const fr = o.frame || '#F4F1EA';
    const ft = o.ft || 3;
    const arch = !!o.arch;
    const cl = clip(c, arch ? PA(archD(x, y, w, h), '#000') : R(x, y, w, h, '#000'));
    let s = '';
    if (o.reveal !== false) s += arch ? PA(archD(x - 5, y - 5, w + 10, h + 6), dk(o.wall || CREAM, 0.12)) : R(x - 5, y - 5, w + 10, h + 7, dk(o.wall || CREAM, 0.12));
    s += G(view(c, x, y, w, h, o.view || 'yard') + (c.slot < 2 ? PG([[x + w * 0.18, y], [x + w * 0.42, y], [x + w * 0.12, y + h], [x - w * 0.12, y + h]], '#FFFFFF', O(0.13)) + PG([[x + w * 0.5, y], [x + w * 0.58, y], [x + w * 0.28, y + h], [x + w * 0.2, y + h]], '#FFFFFF', O(0.08)) : ''), cl);
    if (o.blinds) {
      let d = '';
      for (let yy = y + 2; yy < y + h * o.blinds; yy += 4) d += P`M${x} ${yy}h${w}v2.6h${-w}z`;
      s += PA(d, o.blindCol || '#EDEBE4', O(0.96)) + LN(x + w * 0.85, y, x + w * 0.85, y + h * o.blinds + 6, '#B9B4A8', 0.5);
      s += R(x - 2, y - 1, w + 4, 3, '#DAD6CC');
    }
    const vc = o.v || [0.5];
    const hc = o.h || [0.3];
    let bars = '';
    vc.forEach((t) => (bars += P`M${x + w * t - ft * 0.4} ${arch ? y + w * 0.5 * (1 - Math.sqrt(1 - Math.pow(2 * t - 1, 2))) : y}V${y + h}h${ft * 0.8}V${arch ? y + w * 0.5 * (1 - Math.sqrt(1 - Math.pow(2 * t - 1, 2))) : y}z`));
    hc.forEach((t) => (bars += P`M${x} ${y + h * t - ft * 0.4}h${w}v${ft * 0.8}h${-w}z`));
    s += PA(bars, fr);
    s += arch ? PA(archD(x, y, w, h), 'none', 'stroke="' + fr + '" stroke-width="' + ft + '"') : R(x, y, w, h, 'none', 'stroke="' + fr + '" stroke-width="' + ft + '"');
    if (o.sill !== false) s += R(x - 8, y + h + 1.5, w + 16, 4.5, o.sillCol || '#F7F4EE') + R(x - 8, y + h + 6, w + 16, 2.5, INK, O(0.12));
    return s;
  }
  /** Солнечный блик от окна на полу (утро и день). */
  function sunPatch(c, x, w, fy, len) {
    if (c.slot > 1) return;
    const dx = c.slot === 0 ? 34 : 8;
    len = len || 36;
    c.lights.push(PG([[x + 4, fy + 2], [x + w - 4, fy + 2], [x + w + dx, fy + len], [x + dx - 6, fy + len]], lin(c, [[0, '#FFF2D0', c.slot === 0 ? 0.32 : 0.24], [1, '#FFF2D0', 0]])));
  }
  /** Штора, собранная к краю окна (side: 'l' | 'r'). */
  function curtain(c, x, y, w, h, col, side) {
    const fold = dk(col, 0.16);
    const lit = lt(col, 0.12);
    const g =
      PA(P`M0 0H${w}Q${w * 0.72} ${h * 0.42} ${w * 0.42} ${h * 0.62}Q${w * 0.68} ${h * 0.8} ${w * 0.9} ${h}H0Z`, col) +
      PA(P`M${w * 0.18} 0Q${w * 0.3} ${h * 0.35} ${w * 0.22} ${h * 0.62}Q${w * 0.3} ${h * 0.82} ${w * 0.32} ${h}H${w * 0.06}Q${w * 0.12} ${h * 0.7} ${w * 0.08} 0Z`, fold, O(0.45)) +
      PA(P`M${w * 0.55} 0Q${w * 0.55} ${h * 0.3} ${w * 0.38} ${h * 0.6}L${w * 0.32} ${h * 0.62}Q${w * 0.45} ${h * 0.3} ${w * 0.4} 0Z`, lit, O(0.5)) +
      SK(P`M${w * 0.62} ${h * 0.82}Q${w * 0.66} ${h * 0.9} ${w * 0.7} ${h}`, fold, 0.8, O(0.6)) +
      RR(w * 0.18, h * 0.6, w * 0.34, 3, 1.5, dk(col, 0.3));
    return G(g, side === 'r' ? 'transform="translate(' + f(x + w) + ' ' + f(y) + ') scale(-1 1)"' : T(x, y));
  }
  function rod(x, y, w) {
    return R(x, y, w, 1.8, '#8C7E6E') + C(x, y + 0.9, 2, '#8C7E6E') + C(x + w, y + 0.9, 2, '#8C7E6E');
  }
  function radiator(x, y, w, h) {
    let s = R(x - 6, y + h - 6, w + 12, 2.4, '#D7D2C8') + R(x, y + 2, w, h - 4, '#D9D5CC');
    let d = '';
    for (let i = 0; i + 4 <= w; i += 5) d += P`M${x + i + 0.5} ${y + 1.5}a2 2 0 0 1 4 0v${h - 3}a2 2 0 0 1 -4 0z`;
    s += PA(d, '#F1EFEA');
    let e = '';
    for (let i = 0; i + 4 <= w; i += 5) e += P`M${x + i + 3.6} ${y + 2}v${h - 4}`;
    s += SK(e, '#C9C4BA', 0.8);
    return s + sh(x + w / 2, y + h + 1, w * 0.55, 1.6, 0.12);
  }
  function wall(c, y0, y1, col, pat) {
    let s = R(0, y0, W, y1 - y0, lin(c, [[0, lt(col, 0.05)], [0.7, col], [1, dk(col, 0.06)]]));
    if (pat) s += R(0, y0, W, y1 - y0, pat);
    return s;
  }
  function floor(c, y, col, o) {
    o = o || {};
    let s = R(0, y, W, H - y, lin(c, [[0, dk(col, 0.14)], [1, lt(col, 0.04)]]));
    const vy = o.vy != null ? o.vy : 95;
    const n = o.n || 16;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const xb = -200 + (i * 800) / n;
      d += P`M${200 + ((xb - 200) * (y - vy)) / (H - vy)} ${y}L${xb} ${H}`;
    }
    if (o.cross) {
      let z = 0.2;
      while (z < 1) {
        const yy = y + (H - y) * z * z;
        d += P`M0 ${yy}H${W}`;
        z += o.cross;
      }
    }
    s += SK(d, dk(col, 0.28), 0.6, O(o.lo || 0.45));
    if (o.gloss) s += R(0, y, W, H - y, lin(c, [[0, '#FFFFFF', 0], [0.5, '#FFFFFF', 0.08], [1, '#FFFFFF', 0]], [0, 0, 1, 0]));
    if (o.base !== false) s += R(0, y - 5, W, 5, o.base || dk(col, 0.1)) + R(0, y - 5, W, 1, '#FFFFFF', O(0.25));
    return s;
  }
  function dimLayer(c) {
    const d = c.dim;
    if (d === 3) return R(0, 0, W, H, '#0A1030', O(0.56));
    if (d === 2) return R(0, 0, W, H, '#2A2152', O(0.3));
    if (d === 0) return R(0, 0, W, H, '#F6B38A', O(0.07));
    return '';
  }

  /* ---------- Лампы и свет ---------- */
  /** Настольная лампа: (x, y) — центр основания на столешнице; dir −1 — абажур влево. */
  function deskLamp(c, x, y, o) {
    o = o || {};
    const d = o.dir || -1;
    const s = o.s || 1;
    const col = o.col || '#2F3B5C';
    const on = o.on != null ? o.on : lampOn(c);
    let g = E(0, -1, 8, 2.2, dk(col, 0.25)) + RR(-7, -3.2, 14, 3, 1.5, col);
    g += SK('M0 -3L5 -21L-6 -33', '#454B5A', 1.8) + C(5, -21, 1.6, '#5A6070') + C(-6, -33, 1.6, '#5A6070');
    g += PA('M-3.5 -36.5Q-8.5 -40.5 -12 -35.5L-19.5 -26.5L-7.5 -23.5Z', col);
    g += PA('M-12 -35.5L-19.5 -26.5L-15 -25.4Z', lt(col, 0.18), O(0.6));
    g += E(-13.5, -25, 6.2, 1.8, on ? '#FFF1C8' : dk(col, 0.35), 'transform="rotate(14 -13.5 -25)"');
    const base = G(g, T(x, y, s, d > 0));
    if (on) {
      const lx = x + d * 13.5 * s;
      const px = x + d * 18 * s;
      const k = LGT(c);
      c.lights.push(glow(c, px, y - 8 * s, 95 * s, 70 * s, '#FFC66E', 0.34 * k) + glow(c, px, y, 34 * s, 7 * s, '#FFE6A8', 0.7 * k) + glow(c, lx, y - 25 * s, 12 * s, 8 * s, '#FFF4D0', 0.9));
    }
    return base;
  }
  /** Торшер: x — центр, gy — пол, h — высота. */
  function floorLamp(c, x, gy, h, o) {
    o = o || {};
    const on = o.on != null ? o.on : lampOn(c);
    const shade = o.shade || '#F2E3C4';
    const top = gy - h;
    let s = sh(x, gy, 10, 2) + E(x, gy - 1, 8, 2.2, '#3A3F4A') + R(x - 0.9, top + 12, 1.8, h - 13, '#4A4F5C');
    s += PA(P`M${x - 7} ${top}H${x + 7}L${x + 12} ${top + 16}H${x - 12}Z`, on ? '#FFE9B8' : shade);
    s += PA(P`M${x + 3} ${top}H${x + 7}L${x + 12} ${top + 16}H${x + 6}Z`, INK, O(on ? 0.05 : 0.1));
    if (on) {
      const k = LGT(c);
      c.lights.push(
        glow(c, x, top + 8, 120, 95, '#FFC870', 0.32 * k) +
          glow(c, x, top + 8, 28, 26, '#FFE7B0', 0.7 * k) +
          PA(P`M${x - 7} ${top}H${x + 7}L${x + 12} ${top + 16}H${x - 12}Z`, '#FFE9B8', O(0.85)) +
          glow(c, x, gy, 40, 7, '#FFD99A', 0.4 * k)
      );
    }
    return s;
  }
  /** Потолочная лампа дневного света. */
  function fluoro(c, x, y, w, on) {
    on = on !== false;
    let s = R(x, y, w, 3, '#D9DEE0') + R(x + 1.5, y + 3, w - 3, 2, on ? '#FFFFFF' : '#C9CED3');
    if (on) c.lights.push(glow(c, x + w / 2, y + 6, w * 1.2, 30, '#EAF6FF', c.dim >= 2 ? 0.4 : 0.3) + R(x + 1.5, y + 3, w - 3, 2, '#FFFFFF'));
    return s;
  }

  /* ---------- Предметы ---------- */
  /** Книги на полке: копятся по цветам в c.bk, выводятся flushBooks — экономит размер SVG. */
  function books(c, x, base, w, hmax, o) {
    o = o || {};
    const bk = c.bk || (c.bk = {});
    const add = (col, d) => (bk[col] = (bk[col] || '') + d);
    let cx = x;
    const end = x + w;
    while (cx < end - 2.5) {
      const roll = c.r();
      if (roll < 0.06 && end - cx > 16) {
        // лежащая стопка
        let yy = base;
        const n = 2 + Math.floor(c.r() * 2);
        for (let i = 0; i < n; i++) {
          const bw = rr(c, 9, 13);
          const th = rr(c, 1.8, 2.8);
          add(pk(c, BOOKS), P`M${cx + rr(c, 0, 1.5)} ${yy - th}h${bw}v${th}h${-bw}z`);
          yy -= th + 0.2;
        }
        cx += 15;
        continue;
      }
      if (roll < 0.1 && end - cx > 10) {
        // наклонённая книга
        const bh = hmax * rr(c, 0.75, 0.92);
        const bw = rr(c, 2.6, 4);
        const t = bh * 0.32;
        add(pk(c, BOOKS), P`M${cx} ${base}L${cx + t} ${base - bh * 0.95}l${bw} ${bw * 0.35}L${cx + bw * 1.1} ${base}z`);
        cx += t + bw + 1.5;
        continue;
      }
      if (roll < 0.14) {
        cx += rr(c, 2, 5);
        continue;
      }
      const bw = rr(c, 2.2, o.wide || 4.8);
      const bh = hmax * rr(c, 0.68, 1);
      if (cx + bw > end) break;
      const col = pk(c, BOOKS);
      add(col, P`M${cx} ${base - bh}h${bw}v${bh}h${-bw}z`);
      if (bw > 3.2 && c.r() < 0.45) add('#F3E9D2', P`M${cx + 0.5} ${base - bh * 0.78}h${bw - 1}v.8h${1 - bw}z`);
      cx += bw + rr(c, 0.1, 0.5);
    }
  }
  function flushBooks(c) {
    let s = '';
    for (const k in c.bk || {}) s += PA(c.bk[k], k);
    c.bk = {};
    return s;
  }
  /** Книжный шкаф/стеллаж. */
  function bookcase(c, x, y, w, h, o) {
    o = o || {};
    const wood = o.wood || WOODD;
    const n = o.rows || 4;
    const t = o.t || 3;
    let s = sh(x + w / 2, y + h, w * 0.56, 2.4) + R(x, y, w, h, wood) + R(x + t, y + t, w - 2 * t, h - 2 * t, dk(wood, 0.5));
    const rh = (h - t) / n;
    let boards = '';
    for (let i = 0; i < n; i++) {
      const bot = y + t + (i + 1) * rh - t;
      books(c, x + t + 0.8, bot, w - 2 * t - 1.6, rh - t - rr(c, 2, 4), o);
      boards += P`M${x} ${bot}h${w}v${t}h${-w}z`;
    }
    s += flushBooks(c) + PA(boards, lt(wood, 0.08)) + R(x, y, 1.4, h, lt(wood, 0.2), O(0.6)) + R(x, y, w, 2, lt(wood, 0.25));
    return s;
  }
  function leafD(x, y, len, wid, ang) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const p = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const a = p(len * 0.5, wid * 0.5);
    const b = p(len, 0);
    const d = p(len * 0.5, -wid * 0.5);
    return P`M${x} ${y}Q${a[0]} ${a[1]} ${b[0]} ${b[1]}Q${d[0]} ${d[1]} ${x} ${y}Z`;
  }
  /** Комнатное растение: kind = ficus | monstera | small. (x, gy) — низ горшка. */
  function plant(c, x, gy, kind, s, o) {
    o = o || {};
    s = s || 1;
    const pot = o.pot || '#C8704F';
    const greens = ['#3F7A4E', '#4E8F5A', '#5FA066', '#79B277'];
    let g = sh(0, 0, 10, 1.8);
    if (kind === 'monstera') {
      g += PA('M-9 -16H9L7 0H-7Z', pot) + R(-10, -18, 20, 3, dk(pot, 0.12));
      const lv = [
        [-2, -18, 22, 18, -2.2],
        [1, -18, 24, 20, -1.2],
        [0, -18, 26, 22, -1.75],
        [-1, -18, 18, 16, -2.75],
        [1, -18, 19, 16, -0.55],
      ];
      lv.forEach((l, i) => {
        const col = greens[i % 4];
        const tx = l[0] + Math.cos(l[4]) * l[2] * 0.85;
        const ty = l[1] + Math.sin(l[4]) * l[2] * 0.85;
        g += SK(P`M${l[0]} ${l[1]}Q${l[0]} ${l[1] - 8} ${tx} ${ty}`, '#3C6B45', 1);
        g += PA(leafD(tx, ty, l[3] * 0.9, l[3] * 1.05, l[4] + 0.3), col);
        const mx = tx + Math.cos(l[4] + 0.3) * l[3] * 0.45;
        const my = ty + Math.sin(l[4] + 0.3) * l[3] * 0.45;
        const nx = Math.cos(l[4] + 0.3 + 1.57);
        const ny = Math.sin(l[4] + 0.3 + 1.57);
        g += SK(P`M${tx} ${ty}L${tx + Math.cos(l[4] + 0.3) * l[3] * 0.85} ${ty + Math.sin(l[4] + 0.3) * l[3] * 0.85}M${mx + nx * 2} ${my + ny * 2}l${nx * 4} ${ny * 4}M${mx - nx * 2} ${my - ny * 2}l${-nx * 4} ${-ny * 4}`, dk(col, 0.25), 0.9, O(0.8));
      });
    } else if (kind === 'small') {
      g += PA('M-5 -9H5L4 0H-4Z', pot) + R(-5.6, -10, 11.2, 2, dk(pot, 0.12));
      for (let i = 0; i < 6; i++) g += PA(leafD(0, -9, rr(c, 7, 10), 4, -Math.PI / 2 + (i - 2.5) * 0.42), greens[i % 4]);
    } else {
      g += PA('M-7 -13H7L5.5 0H-5.5Z', pot) + R(-8, -14.5, 16, 2.6, dk(pot, 0.12));
      g += SK('M0 -14Q-1 -30 2 -44M0 -22Q-6 -30 -9 -36M1 -28Q7 -34 9 -40', '#5A4636', 1.2);
      for (let i = 0; i < 16; i++) {
        const ly = -16 - i * 2.2 - c.r() * 2;
        const side = i % 2 ? 1 : -1;
        g += PA(leafD(side * rr(c, 0, 3), ly, rr(c, 7, 11), 5, -Math.PI / 2 + side * rr(c, 0.6, 1.2)), greens[i % 4]);
      }
    }
    return G(g, T(x, gy, s));
  }
  function mug(x, y, col, steam) {
    let s = sh(x, y, 5, 1) + SK(P`M${x + 3.5} ${y - 7}q3.2 0 3.2 2.6t-3.2 2.6`, col, 1.3) + RR(x - 4, y - 9, 8, 9, 1.4, col) + E(x, y - 9, 4, 1, dk(col, 0.25)) + R(x - 4, y - 7.5, 8, 1.4, '#FFFFFF', O(0.25));
    if (steam) s += SK(P`M${x - 1} ${y - 11}q-1.5 -2.5 0 -5t0 -5M${x + 1.6} ${y - 11.5}q-1.2 -2 0 -4t0 -4`, '#FFFFFF', 0.8, O(0.55));
    return s;
  }
  function kettle(x, y, col) {
    col = col || '#F2F0EB';
    return (
      sh(x, y, 9, 1.5) +
      E(x, y - 1.6, 7.5, 1.8, '#3A3F4A') +
      PA(P`M${x - 6.5} ${y - 2}L${x - 5} ${y - 16}H${x + 5}L${x + 6.5} ${y - 2}Z`, col) +
      PA(P`M${x - 5} ${y - 14}L${x - 10} ${y - 15.5}L${x - 9} ${y - 13}L${x - 5.5} ${y - 10}Z`, col) +
      SK(P`M${x + 5} ${y - 14}q5 1 4.5 6q-.4 3 -3.6 4`, '#3A3F4A', 1.8) +
      RR(x - 5.4, y - 17.6, 10.8, 2.2, 1, '#3A3F4A') +
      R(x - 3.5, y - 12, 1.4, 7, '#9CC3E0', O(0.7)) +
      PA(P`M${x + 1.5} ${y - 15}L${x + 3.5} ${y - 15}L${x + 4.5} ${y - 3}H${x + 2.8}Z`, INK, O(0.06))
    );
  }
  function clockFace(x, y, r, hh, mm, frame) {
    const ha = (((hh % 12) + mm / 60) / 12) * Math.PI * 2;
    const ma = (mm / 60) * Math.PI * 2;
    let ticks = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = i % 3 ? 0.86 : 0.76;
      ticks += P`M${x + Math.sin(a) * r * q} ${y - Math.cos(a) * r * q}L${x + Math.sin(a) * r * 0.94} ${y - Math.cos(a) * r * 0.94}`;
    }
    return (
      C(x + 0.6, y + 1.2, r + 1.4, INK, O(0.14)) +
      C(x, y, r + 1.4, frame || '#3A3F4A') +
      C(x, y, r, '#FBFAF4') +
      SK(ticks, '#3A3F4A', Math.max(0.5, r * 0.07)) +
      SK(P`M${x} ${y}L${x + Math.sin(ha) * r * 0.5} ${y - Math.cos(ha) * r * 0.5}`, '#2A2F3C', Math.max(0.8, r * 0.13)) +
      SK(P`M${x} ${y}L${x + Math.sin(ma) * r * 0.78} ${y - Math.cos(ma) * r * 0.78}`, '#2A2F3C', Math.max(0.6, r * 0.08)) +
      C(x, y, Math.max(0.6, r * 0.09), CORAL)
    );
  }
  const SLOT_HM = [[8, 12], [13, 5], [18, 24], [23, 10]];
  /** Рамка с картиной/дипломом/фото. */
  function framed(x, y, w, h, inner, fr) {
    fr = fr || '#6B4E3A';
    return R(x + 1.2, y + 1.6, w, h, INK, O(0.15)) + R(x, y, w, h, fr) + G(inner, '') + R(x, y, w, h, 'none', 'stroke="' + dk(fr, 0.2) + '" stroke-width=".6"');
  }
  function diploma(x, y, w, h, fr) {
    const m = Math.max(2, w * 0.1);
    return framed(
      x,
      y,
      w,
      h,
      R(x + m, y + m, w - 2 * m, h - 2 * m, '#FBF7EC') +
        R(x + w * 0.3, y + m + 2, w * 0.4, 1.4, '#B58A3A') +
        SK(P`M${x + m + 2} ${y + h * 0.45}H${x + w - m - 2}M${x + m + 3} ${y + h * 0.58}H${x + w - m - 3}M${x + m + 4} ${y + h * 0.7}H${x + w * 0.55}`, '#9AA0AA', 0.6) +
        C(x + w - m - 3.5, y + h - m - 3.5, 2.2, '#C8553D', O(0.85)),
      fr || '#B8954E'
    );
  }

  /* ---------- Кошка Кокошка ---------- */
  /** pose: curl (спит клубком), sit (сидит анфас), back (сидит спиной), loaf (лежит «буханкой» боком). */
  function cat(c, x, y, o) {
    o = o || {};
    const pose = o.pose || 'sit';
    let g = '';
    const ear = '#F0A08A';
    if (pose === 'curl') {
      g += sh(0, 0.6, 20, 2.6, 0.2);
      g += PA('M-14 0C-18 -8 -10 -15 0 -15C11 -15 18 -9 18 -3C18 0 15 1 12 1H-10C-12 1 -13.5 .8 -14 0Z', CAT);
      g += E(8, -6, 8, 6, lt(CAT, 0.08));
      g += SK('M-2 -14.4Q0 -11 -1 -7.5M4 -14.6Q6 -11 5 -7.8M10 -12.6Q11.6 -9.6 10.6 -6.6M14.6 -9.2Q15.8 -7 15 -5', CATD, 1.4);
      g += SK('M17 -3C16.5 3 3 3.2 -6 1', CAT, 4.6) + SK('M-3 1.6L-7 .8', CATD, 4.6);
      g += C(-12.5, -6.4, 6.6, CAT);
      g += PG([[-18.2, -9.2], [-19.6, -16], [-14.4, -12]], CAT) + PG([[-10.6, -12.4], [-8.2, -17.2], [-7.2, -10.6]], CAT);
      g += PG([[-17.4, -10.4], [-18.4, -14.2], [-15.4, -11.8]], ear) + PG([[-9.8, -12.2], [-8.6, -15.2], [-8.2, -11.4]], ear);
      g += E(-14, -3.6, 3.6, 2.4, CATL);
      g += SK('M-17.4 -6.6q1.3 1 2.6 0M-12.6 -7q1.3 1 2.6 0', '#3A2A22', 0.8);
      g += C(-14.2, -4.8, 0.7, '#B9574A');
      g += SK('M-13.2 -12.2l.2 2.4M-11.2 -11.8l-.4 2.2', CATD, 0.9);
    } else if (pose === 'loaf') {
      g += sh(0, 0.6, 16, 2.2, 0.2);
      g += SK('M12 -2C17 -2 19 1 17 3', CAT, 3.6);
      g += PA('M-12 0C-13 -8 -6 -12 2 -12C10 -12 14 -7 14 -2C14 0 13 1 11 1H-10C-11.5 1 -12 .5 -12 0Z', CAT);
      g += SK('M0 -11.6Q1.5 -8 .5 -5M5 -11.4Q6.6 -8 5.6 -5M9.4 -10Q10.8 -7.4 10 -4.8', CATD, 1.3);
      g += C(-10, -11, 6.2, CAT);
      g += PG([[-15.6, -13], [-16, -19.6], [-11.6, -16]], CAT) + PG([[-8.4, -16.4], [-5.6, -20.4], [-4.8, -14]], CAT);
      g += PG([[-14.8, -14], [-15.2, -17.8], [-12.6, -15.6]], ear);
      g += E(-11.4, -8.4, 3.4, 2.3, CATL);
      g += SK('M-14.2 -11.4q1.2 .9 2.4 0M-9.8 -11.8q1.2 .9 2.4 0', '#3A2A22', 0.8);
      g += C(-11.6, -9.6, 0.65, '#B9574A');
      g += RR(-9, -3, 7, 3.6, 1.8, lt(CAT, 0.1));
    } else {
      const back = pose === 'back';
      g += sh(0, 0.6, 13, 2.4, 0.2);
      if (back && o.hang) g += SK('M6 -1.5C10 2 11 8 8.5 15', CAT, 3.6) + SK('M9.4 11.5L8.5 15', CATD, 3.6);
      else g += SK('M7 -1C17 -1 18 -11 13 -15', CAT, 3.6) + SK('M14.6 -12.4L13 -15', CATD, 3.6);
      g += PA('M-10 0C-12 -9 -8 -19 0 -20C8 -19 12 -9 10 0Z', CAT);
      if (back) {
        g += SK('M-6.5 -16q6.5 2.4 13 0M-8.6 -11q8.6 2.8 17.2 0M-9.6 -5.6q9.6 2.8 19.2 0', CATD, 1.4);
        g += C(0, -24, 7.2, CAT);
        g += PG([[-6.8, -27], [-6.4, -35], [-1.8, -30.6]], CAT) + PG([[6.8, -27], [6.4, -35], [1.8, -30.6]], CAT);
        g += SK('M-3.4 -29.4q3.4 1.4 6.8 0M-4.6 -26q4.6 1.6 9.2 0', CATD, 1);
      } else {
        g += SK('M-9.4 -6q2.6 -1 3 -3.2M-9 -11.5q2.4 -.6 2.8 -2.6M9.4 -6q-2.6 -1 -3 -3.2M9 -11.5q-2.4 -.6 -2.8 -2.6', CATD, 1.3);
        g += PA('M-4.4 -17C-3 -8.5 3 -8.5 4.4 -17C2 -15.4 -2 -15.4 -4.4 -17Z', CATL);
        g += RR(-5.8, -9, 4.4, 9, 2.2, CAT) + RR(1.4, -9, 4.4, 9, 2.2, CAT);
        g += E(-3.6, -0.9, 2.5, 1.4, CATL) + E(3.6, -0.9, 2.5, 1.4, CATL);
        g += E(0, -22, 7.8, 5, CAT) + C(0, -24.4, 7, CAT);
        g += PG([[-6.8, -27], [-6.4, -35], [-1.8, -30.6]], CAT) + PG([[6.8, -27], [6.4, -35], [1.8, -30.6]], CAT);
        g += PG([[-5.7, -28.2], [-5.6, -32.6], [-3, -30.2]], ear) + PG([[5.7, -28.2], [5.6, -32.6], [3, -30.2]], ear);
        g += SK('M-2 -30.8l.5 3M0 -31.4v3.2M2 -30.8l-.5 3', CATD, 1);
        g += E(-1.9, -20.8, 2.6, 1.9, CATL) + E(1.9, -20.8, 2.6, 1.9, CATL);
        if (o.sleepy) g += SK('M-4.4 -24.4q1.4 1 2.8 0M1.6 -24.4q1.4 1 2.8 0', '#3A2A22', 0.8);
        else g += E(-3, -24.6, 1.3, 1.6, '#3B4A2C') + E(3, -24.6, 1.3, 1.6, '#3B4A2C') + C(-2.6, -25.2, 0.45, '#FFFFFF') + C(3.4, -25.2, 0.45, '#FFFFFF');
        g += PG([[-1.1, -22.6], [1.1, -22.6], [0, -21.4]], '#C0574A');
      }
    }
    return G(g, T(x, y, o.s || 1, o.flip));
  }

  /* ---------- Люди ---------- */
  /** Упрощённая фигура. (x, y) — точка между стопами (или сиденье при sit).
     o: s, skin, hair, style (short|long|bun|bob|bald), top, pants, coat, back, sit, bust, hands (down|table|point|lap|phone), glasses, steth. */
  function person(c, x, y, o) {
    o = o || {};
    const skin = o.skin || pk(c, SKIN);
    const hair = o.hair || pk(c, HAIRC);
    const top = o.top || pk(c, TOPS);
    const pants = o.pants || pk(c, ['#3B4560', '#4A4F5C', '#5C4A3E', '#2F3B5C']);
    const style = o.style || pk(c, ['short', 'long', 'bun', 'short', 'bob']);
    const coat = !!o.coat;
    const back = !!o.back;
    const sit = !!o.sit || !!o.bust;
    const tt = sit ? -40 : -46;
    const hip = sit ? -17 : -25;
    const hy = tt - 10.5;
    let g = '';
    if (!o.bust && o.shadow !== false) g += sh(0, 0, sit ? 13 : 11, 2.4);
    if (!o.bust) {
      if (sit) {
        g += RR(-8.6, -15, 6.6, 14.6, 2.6, pants) + RR(2, -15, 6.6, 14.6, 2.6, pants);
        g += E(-5.3, -0.7, 4.4, 2, SHOE) + E(5.3, -0.7, 4.4, 2, SHOE);
        g += RR(-10, -21, 20, 8.4, 4, dk(pants, 0.1));
      } else {
        g += RR(-7, hip - 2, 6.4, 27, 2.6, pants) + RR(0.6, hip - 2, 6.4, 27, 2.6, pants);
        g += E(-4, -0.9, 4.2, 1.9, SHOE) + E(4, -0.9, 4.2, 1.9, SHOE);
      }
    }
    const body = coat ? COAT : top;
    const arm = coat ? '#E7ECEA' : dk(top, 0.08);
    const bot = coat && !sit ? hip + 11 : hip + 1;
    const tw = 10;
    if (style === 'long' || style === 'bob') g += RR(-8.8, hy - 6.5, 17.6, style === 'long' ? 22 : 13, 6.5, hair);
    const hands = o.hands || (sit ? 'lap' : 'down');
    const hand = {
      down: [[-tw - 1.6, hip + 0.5], [tw + 1.6, hip + 0.5]],
      lap: [[-5, hip - 2], [5, hip - 2]],
      table: [[-7, tt + 15], [7, tt + 15]],
      point: [[-tw - 1.6, hip + 0.5], [tw + 13, tt - 9]],
      phone: [[-2.4, tt + 13], [2.4, tt + 13]],
      lectern: [[-6, tt + 14], [6, tt + 14]],
    }[hands] || [[-tw - 1.6, hip + 0.5], [tw + 1.6, hip + 0.5]];
    if (!back || hands === 'down' || hands === 'point') g += SK(P`M${-tw + 2} ${tt + 3}L${hand[0][0]} ${hand[0][1]}M${tw - 2} ${tt + 3}L${hand[1][0]} ${hand[1][1]}`, arm, 5.4);
    g += PA(P`M${-tw} ${tt + 5}Q${-tw} ${tt} ${-tw + 5} ${tt}H${tw - 5}Q${tw} ${tt} ${tw} ${tt + 5}L${tw - 0.6} ${bot}H${-tw + 0.6}Z`, body);
    if (coat) {
      if (!back) {
        g += PG([[-3.8, tt], [3.8, tt], [0, tt + 9]], top);
        g += SK(P`M-4 ${tt}L0 ${tt + 11}L4 ${tt}M0 ${tt + 11}V${bot}M-7.6 ${hip - 3}h4.4M3.2 ${hip - 3}h4.4M3.6 ${tt + 7}h3.6`, COATD, 0.9);
        if (o.steth) g += SK(P`M-4.6 ${tt + 0.6}Q-6.4 ${tt + 10} -2 ${tt + 13.4}`, '#3A465E', 1.1) + C(-1.6, tt + 14, 1.5, '#9AA3AE');
        else g += R(5, tt + 4.2, 0.9, 3.4, '#4C6A9A');
      } else g += SK(P`M0 ${tt + 2}V${bot}`, COATD, 0.8);
    } else if (!back) g += E(0, tt + 0.6, 3.6, 2, dk(top, 0.15));
    if (back && hands !== 'down' && hands !== 'point') g += SK(P`M${-tw + 1} ${tt + 3}L${-tw - 0.5} ${tt + 15}M${tw - 1} ${tt + 3}L${tw + 0.5} ${tt + 15}`, arm, 5);
    if (!back || hands === 'down' || hands === 'point') g += C(hand[0][0], hand[0][1], 2.3, skin) + C(hand[1][0], hand[1][1], 2.3, skin);
    if (hands === 'phone' && !back) g += RR(-3, tt + 8.5, 6, 6.5, 1, '#2A2F3C');
    g += R(-2.4, tt - 4.2, 4.8, 5, dk(skin, 0.12));
    g += C(0, hy, 7.4, skin);
    if (back) {
      if (style !== 'bald') g += C(0, hy - 0.7, 7.7, hair);
      else g += E(0, hy + 2.6, 7.4, 3.4, hair, O(0.8));
      if (style === 'bun') g += C(0, hy - 7.6, 3.6, hair);
    } else {
      if (style === 'bald') g += E(-7, hy + 0.4, 1.6, 3, hair) + E(7, hy + 0.4, 1.6, 3, hair);
      else g += PA(P`M-7.7 ${hy + 1.5}C-8.6 ${hy - 10.5} 8.6 ${hy - 10.5} 7.7 ${hy + 1.5}C6.6 ${hy - 3.2} 2.6 ${hy - 4.8} -1.6 ${hy - 4.4}C-4.6 ${hy - 4} -6.8 ${hy - 2.4} -7.7 ${hy + 1.5}Z`, hair);
      if (style === 'bun') g += C(0, hy - 8.2, 3.6, hair);
      g += C(-2.6, hy + 0.8, 0.9, '#2A2530') + C(2.6, hy + 0.8, 0.9, '#2A2530');
      g += E(-4.4, hy + 3, 1.4, 0.9, CORAL, O(0.28)) + E(4.4, hy + 3, 1.4, 0.9, CORAL, O(0.28));
      if (o.glasses) g += SK(P`M-0.6 ${hy + 0.8}h1.2M-5 ${hy + 0.8}a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0M.4 ${hy + 0.8}a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0`, '#2A2F3C', 0.6);
      if (o.smile) g += SK(P`M-1.6 ${hy + 3.8}q1.6 1.2 3.2 0`, dk(skin, 0.45), 0.7);
    }
    return G(g, T(x, y, o.s || 1, o.flip));
  }

  /* ======================================================================
     СЦЕНЫ
     ====================================================================== */
  const SC = {};
  const NAMES = {};

  /* ---------- Общежитие, комната 412 ---------- */
  NAMES.dorm = 'Общежитие, комната 412';
  SC.dorm = function (c) {
    c.indoor = true;
    const fy = 168;
    let s = wall(c, 0, fy, '#EEDDC2', pattern(c, 14, 10, R(0, 0, 1.4, 10, '#C9A87C', O(0.18))));
    s += floor(c, fy, '#B98A5E', { n: 14 });
    // окно со шторой и батарея
    s += win(c, 226, 28, 90, 82, { view: 'yard', wall: '#EEDDC2', v: [0.5], h: [0.3] });
    sunPatch(c, 226, 90, fy, 44);
    s += radiator(236, 128, 70, 22);
    s += rod(204, 18, 128) + curtain(c, 206, 19, 34, 128, '#E2AF4A', 'l') + curtain(c, 304, 19, 26, 128, '#E2AF4A', 'r');
    // постер и фото над кроватью
    s += G(
      R(1.2, 1.6, 50, 64, INK, O(0.15)) +
        R(0, 0, 50, 64, '#2F3B5C') +
        C(25, 24, 11, MUSTARD) +
        PA('M0 46L12 34L22 42L33 28L50 44V64H0Z', CORAL) +
        PA('M0 54L16 44L30 52L50 40V64H0Z', '#C8553D') +
        R(6, 6, 16, 1.6, '#F3E7D3', O(0.8)) +
        R(6, 9.4, 10, 1.2, '#F3E7D3', O(0.5)) +
        C(3, 3, 1.2, '#D9D2C2') +
        C(47, 3, 1.2, '#D9D2C2'),
      'transform="translate(58 40) rotate(-2)"'
    );
    s += G(R(0, 0, 18, 21, '#FBF8F1') + R(2, 2, 14, 13, '#9CC3B2') + C(9, 9, 4, '#E9B949', O(0.8)), 'transform="translate(122 54) rotate(4)"');
    s += G(R(0, 0, 16, 19, '#FBF8F1') + R(2, 2, 12, 12, '#E07A5F', O(0.75)), 'transform="translate(144 64) rotate(-5)"');
    s += R(150, 64, 4, 2, '#F2EBDD', O(0.8)) + R(126, 53, 4, 2, '#F2EBDD', O(0.8));
    // кровать
    s += sh(98, 192, 96, 5, 0.18);
    s += R(8, 152, 182, 32, '#3B2B22', O(0.35));
    s += RR(8, 96, 10, 98, 3, '#8A5A36') + RR(5, 92, 16, 6, 3, '#A06C43');
    s += R(16, 156, 172, 10, '#8A5A36') + R(182, 156, 6, 38, '#7A4E2E') + R(18, 160, 4, 34, '#7A4E2E');
    s += PA('M18 128H186L190 141H18Z', '#F4F1EA') + R(18, 141, 172, 12, '#E6E1D6');
    s += PA('M22 124C20 118 56 116 60 122C63 128 63 138 60 141C40 143 24 142 21 139C19 134 20 128 22 124Z', '#FBFAF6') + PA('M24 136C34 139 50 139 59 136', 'none', 'stroke="#D6D0C4" stroke-width="1"');
    const plaid = pattern(
      c,
      18,
      18,
      R(0, 0, 18, 18, '#C65A44') + R(0, 6, 18, 5, '#2B3556', O(0.42)) + R(6, 0, 5, 18, '#2B3556', O(0.42)) + R(0, 14, 18, 1, MUSTARD, O(0.7)) + R(14, 0, 1, 18, MUSTARD, O(0.7)) + R(0, 2, 18, 0.6, '#F3E7D3', O(0.35))
    );
    s += PA('M66 127C100 125 150 126 188 127L193 141L194 174C170 177 120 176 64 174L62 141Z', plaid);
    s += PA('M62 141L193 141L194 174C170 177 120 176 64 174Z', INK, O(0.14));
    s += PA('M66 127L62 141L64 174', 'none', 'stroke="#A64836" stroke-width="2.4" stroke-linecap="round"');
    s += SK('M90 144Q92 160 88 174M136 144Q139 160 134 175M170 144Q172 160 168 175', '#7A3426', 1, O(0.35));
    s += cat(c, 128, 134, { pose: 'curl', s: 1.1 });
    // стол под окном
    s += sh(282, 190, 72, 4, 0.16);
    s += R(216, 134, 132, 6, '#C99A68') + R(216, 139.5, 132, 2, '#8A5A36', O(0.5));
    s += R(220, 140, 4.5, 50, '#9C6B44') + R(300, 140, 46, 48, '#B5835A') + R(303, 144, 40, 19, '#C99A68') + R(303, 166, 40, 19, '#C99A68') + R(319, 152, 8, 2, '#5E4029') + R(319, 174, 8, 2, '#5E4029');
    // стопка книг, тетрадь, кружка
    s += R(229, 128, 32, 6, '#3F4B66') + R(231, 122.4, 28, 5.6, '#7FAE9A') + R(228, 117.4, 30, 5, '#C8553D') + R(232, 112.8, 25, 4.6, '#E9B949') + R(229, 129.8, 32, 1, '#F3E9D2', O(0.6)) + R(231, 124, 28, 0.9, '#F3E9D2', O(0.6));
    s += PG([[268, 133], [296, 133], [300, 135], [272, 135]], '#F7F3EA') + LN(280, 133.4, 284, 134.8, '#C9C2B4', 0.5);
    s += mug(286, 134, CORAL, c.slot !== 1);
    s += deskLamp(c, 334, 134, { col: '#2F3B5C' });
    // тумбочка с чайником
    s += sh(376, 190, 26, 3) + R(354, 128, 44, 62, '#A8774E') + R(357, 132, 38, 24, '#BF8D60') + R(357, 160, 38, 26, '#BF8D60') + R(370, 142, 12, 2, '#5E4029') + R(370, 172, 12, 2, '#5E4029') + R(354, 126, 44, 3, '#C99A68');
    s += kettle(376, 126);
    // тапочки
    s += E(212, 200, 8, 3, '#7FAE9A') + E(228, 202, 8, 3, '#7FAE9A') + E(210, 199, 4, 1.5, '#F4F1EA', O(0.5));
    return s;
  };
  SC.home = SC.dorm;
  NAMES.home = NAMES.dorm;

  /* ---------- Комната в квартире ---------- */
  NAMES.room = 'Комната в квартире';
  SC.room = function (c) {
    c.indoor = true;
    const fy = 168;
    const wallc = '#E8D9C0';
    let s = wall(c, 0, fy, wallc, pattern(c, 16, 16, PA('M8 3L11 8L8 13L5 8Z', '#B99A72', O(0.16)) + C(0, 0, 1, '#B99A72', O(0.2)) + C(16, 16, 1, '#B99A72', O(0.2))));
    s += floor(c, fy, '#A8714A', { n: 18 });
    // ковёр на полу
    s += PA('M150 180H372L398 222H118Z', '#9E4A3E') + PA('M158 183.5H366L388 218.5H128Z', 'none', 'stroke="#E9B949" stroke-width="1.2" stroke-dasharray="3 2"') + PA('M206 192H312L326 210H190Z', '#C26A4F') + PA('M238 196H280L288 206H230Z', '#E9B949', O(0.7));
    // шкаф
    s += sh(48, 190, 46, 4) + R(8, 24, 80, 164, '#9C6A44') + R(6, 20, 84, 6, '#B07C52') + R(12, 30, 35, 150, '#AD7A50') + R(49, 30, 35, 150, '#AD7A50');
    s += R(16, 36, 27, 64, '#B98A5E', O(0.6)) + R(53, 36, 27, 64, '#B98A5E', O(0.6)) + R(16, 108, 27, 66, '#B98A5E', O(0.6)) + R(53, 108, 27, 66, '#B98A5E', O(0.6));
    s += RR(42, 96, 2.4, 12, 1.2, '#E2C078') + RR(52, 96, 2.4, 12, 1.2, '#E2C078') + R(12, 186, 6, 4, '#5E4029') + R(78, 186, 6, 4, '#5E4029');
    s += R(14, 8, 34, 12, '#D9C9A8') + R(18, 11, 26, 2, '#B8A684') + RR(54, 10, 28, 10, 2, '#5B7C99') + R(66, 8, 5, 2, '#3F4B66');
    // фикус
    s += plant(c, 108, 192, 'ficus', 1.15);
    // окно, тюль, шторы
    s += win(c, 138, 30, 72, 86, { view: 'yard', wall: wallc, v: [0.5], h: [0.32] });
    sunPatch(c, 138, 72, fy, 40);
    s += radiator(146, 128, 56, 24);
    s += R(132, 20, 84, 104, '#FFFFFF', O(0.16));
    s += rod(122, 17, 104) + curtain(c, 124, 18, 26, 114, '#6F8F7E', 'l') + curtain(c, 198, 18, 26, 114, '#6F8F7E', 'r');
    // торшер
    s += floorLamp(c, 226, 186, 128);
    // ковёр на стене
    const cx = 314;
    s += R(252, 34, 124, 70, '#7E2E2C') + R(256, 38, 116, 62, '#A2443A') + R(262, 44, 104, 50, 'none', 'stroke="#E9B949" stroke-width="1.2"');
    s += PG([[cx, 48], [cx + 34, 69], [cx, 90], [cx - 34, 69]], '#2F3B5C') + PG([[cx, 54], [cx + 24, 69], [cx, 84], [cx - 24, 69]], '#C8553D') + PG([[cx, 61], [cx + 11, 69], [cx, 77], [cx - 11, 69]], '#E9B949');
    s += PG([[262, 44], [278, 44], [262, 56]], '#2F3B5C') + PG([[366, 44], [350, 44], [366, 56]], '#2F3B5C') + PG([[262, 94], [278, 94], [262, 82]], '#2F3B5C') + PG([[366, 94], [350, 94], [366, 82]], '#2F3B5C');
    s += SK('M256 38v62M372 38v62', '#F1E6D2', 1.2, 'stroke-dasharray="1 2"');
    // диван
    s += sh(316, 186, 84, 4.5, 0.2);
    s += RR(244, 110, 144, 46, 8, '#5B7C99') + RR(250, 116, 64, 32, 6, '#6A8BA8') + RR(318, 116, 64, 32, 6, '#6A8BA8');
    s += RR(242, 146, 148, 24, 5, '#4E6D8A') + RR(248, 142, 68, 12, 5, '#6A8BA8') + RR(318, 142, 68, 12, 5, '#6A8BA8');
    s += RR(236, 126, 16, 48, 7, '#4E6D8A') + RR(380, 126, 16, 48, 7, '#4E6D8A') + R(246, 174, 4, 8, '#3A2C22') + R(382, 174, 4, 8, '#3A2C22');
    s += G(RR(-11, -10, 22, 20, 5, CORAL) + SK('M-8 -7L8 7M8 -7L-8 7', '#C8553D', 1, O(0.4)), 'transform="translate(268 132) rotate(-12)"');
    s += G(RR(-10, -9, 20, 18, 5, MUSTARD), 'transform="translate(366 132) rotate(10)"');
    s += cat(c, 338, 143, { pose: 'sit', s: 0.85 });
    return s;
  };

  /* ---------- Светлая студия ---------- */
  NAMES.studio = 'Студия';
  SC.studio = function (c) {
    c.indoor = true;
    const fy = 172;
    const wallc = '#F3EEE6';
    let s = wall(c, 0, fy, wallc);
    s += floor(c, fy, '#D7B48A', { n: 20 });
    // кухонная ниша
    s += R(0, 0, 122, fy, '#E9E3D8');
    s += R(0, 66, 120, 62, pattern(c, 10, 8, R(0, 0, 10, 8, '#F6F3EC') + R(0, 7.4, 10, 0.6, '#C9C2B4') + R(9.4, 0, 0.6, 8, '#C9C2B4')));
    s += R(0, 20, 118, 42, '#8FBAA8') + R(2, 22, 56, 38, MINT) + R(60, 22, 56, 38, MINT) + R(52, 50, 4, 1.6, '#5E7D70') + R(62, 50, 4, 1.6, '#5E7D70') + R(0, 60, 118, 3, INK, O(0.12));
    s += R(0, 130, 120, 50, '#8FBAA8') + R(2, 134, 38, 44, MINT) + R(42, 134, 38, 44, MINT) + R(82, 134, 36, 44, MINT) + R(34, 140, 4, 1.6, '#5E7D70') + R(44, 140, 4, 1.6, '#5E7D70') + R(96, 140, 8, 1.6, '#5E7D70');
    s += R(0, 126, 122, 5, '#E9DCC6') + R(0, 130.4, 122, 1.4, INK, O(0.12));
    s += R(48, 124, 30, 2.2, '#2A2F3C') + C(56, 125, 3, '#3A3F4A') + C(70, 125, 3, '#3A3F4A');
    s += kettle(22, 126, '#E07A5F');
    s += plant(c, 100, 126, 'small', 1);
    s += SK('M64 0V8', '#4A4F5C', 0.8) + PA('M56 8H72L76 16H52Z', '#2F3B5C');
    if (lampOn(c)) c.lights.push(glow(c, 64, 18, 70, 50, '#FFC870', 0.3 * LGT(c)) + E(64, 16.5, 10, 1.6, '#FFF0C8'));
    // большое окно
    s += win(c, 140, 14, 176, 116, { view: 'city', wall: wallc, frame: '#2B3245', ft: 2.4, v: [0.333, 0.666], h: [0.62], sillCol: '#D9B98E' });
    sunPatch(c, 160, 140, fy, 46);
    s += cat(c, 176, 131.5, { pose: 'back', s: 0.9, hang: true });
    s += plant(c, 296, 131.5, 'small', 0.9, { pot: '#F1E6D2' });
    // диван и торшер
    s += PA('M210 186H380L400 225H186Z', '#E9DFD0', O(0.8));
    s += sh(300, 188, 80, 4.5, 0.2);
    s += RR(226, 136, 146, 38, 8, '#E07A5F') + RR(222, 160, 154, 22, 6, '#C9654C') + RR(228, 156, 70, 12, 5, '#E58A70') + RR(300, 156, 70, 12, 5, '#E58A70');
    s += RR(216, 148, 16, 34, 7, '#C9654C') + RR(366, 148, 16, 34, 7, '#C9654C') + R(228, 182, 4, 6, '#3A2C22') + R(366, 182, 4, 6, '#3A2C22');
    s += G(RR(-10, -9, 20, 18, 5, '#9CC3B2'), 'transform="translate(250 148) rotate(-10)"') + G(RR(-9, -8, 18, 16, 5, MUSTARD), 'transform="translate(348 149) rotate(8)"');
    s += G(R(-7, -1, 14, 2, '#3F4B66') + R(-6, -3, 12, 2, '#E9B949'), 'transform="translate(300 155)"');
    s += floorLamp(c, 388, 190, 146, { shade: '#F6EEDC' });
    return s;
  };

  /* ---------- Заглушка для ещё не готовых сцен ---------- */
  function stub(c) {
    return sky(c, 0, 0, W, H) + R(0, 160, W, 65, c.k('#7FA163'));
  }

  /* Набор помощников для файлов с дополнительными сценами (scenes-*.js) */
  ART._kit = { SC, NAMES, W, H, f, f2, P, clamp, hash, rng, rr, pk, esc, rgb, hex, mix, dk, lt, INK, MINT, MINTD, CREAM, CORAL, MUSTARD, CAT, CATD, CATL, COAT, COATD, WOOD, WOODD, LAMP, SHOE, SKIN, HAIRC, TOPS, BOOKS, LITC, GLASS, LITP, TINT, X, R, RR, E, C, PA, PG, SK, TX, G, O, T, sh, mkCtx, nid, stopS, lin, rad, vg, hg, glow, clip, pattern, lampOn, LGT, skyStops, cloud, stars, moon, sky, winGrid, LEAF, bare, tree, birchMarks, leaves, snowfall, puddle, view, archD, win, sunPatch, curtain, rod, radiator, wall, floor, dimLayer, deskLamp, floorLamp, fluoro, books, flushBooks, bookcase, leafD, plant, mug, kettle, clockFace, SLOT_HM, framed, diploma, cat, person, stub, LN };

  /* ======================================================================
     Диспетчер
     ====================================================================== */
  const ALIAS = { home: 'dorm' };
  const SEASONS = ['autumn', 'winter', 'spring', 'summer'];
  ART.SCENES = ['dorm', 'room', 'studio', 'lecture', 'seminar', 'ward', 'office', 'er', 'exam', 'street', 'shop', 'cafe', 'park', 'library', 'night', 'private', 'commission', 'title'];
  ART.scene = function (id, opts) {
    opts = opts || {};
    id = ALIAS[id] || id;
    if (!SC[id]) id = SC.street ? 'street' : 'dorm';
    let slot = Math.round(Number(opts.slot));
    if (!isFinite(slot)) slot = 1;
    slot = clamp(slot, 0, 3);
    const season = SEASONS.indexOf(opts.season) >= 0 ? opts.season : 'autumn';
    let seed = opts.seed;
    seed = typeof seed === 'number' && isFinite(seed) ? Math.floor(seed) >>> 0 : hash(String(seed == null ? 1 : seed));
    const c = mkCtx(id, slot, season, seed);
    let body;
    try {
      body = SC[id](c);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('scene ' + id + ':', e);
      c.defs = [];
      c.lights = [];
      c.top = [];
      c.indoor = false;
      body = stub(c);
    }
    let out = body;
    if (c.indoor) out += dimLayer(c);
    out += c.lights.join('') + c.top.join('');
    out += R(0, 0, W, H, rad(c, [[0.6, INK, 0], [1, INK, c.dim >= 3 ? 0.34 : 0.2]], [0.5, 0.5, 0.75]));
    return (
      '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(NAMES[id] || id) +
      '">' +
      (c.defs.length ? '<defs>' + c.defs.join('') + '</defs>' : '') +
      out +
      '</svg>'
    );
  };
  ART.sceneName = (id) => NAMES[ALIAS[id] || id] || NAMES.street || '';
  // для отладки
  ART._sceneIds = () => Object.keys(SC);
  void LN;
  function LN(x1, y1, x2, y2, col, w, e) {
    return '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + col + '" stroke-width="' + f2(w) + '" stroke-linecap="round"' + X(e) + '/>';
  }
  void hg;
  void vg;
  void TX;
  void MINTD;
  void WOOD;
  void HAIRC;
  void bookcase;
  void winGrid;
  void puddle;
  void leaves;
  void snowfall;
  void framed;
  void diploma;
  void clockFace;
  void SLOT_HM;
  void person;
})((window.A = window.A || {}));
