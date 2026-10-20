/* Анамнез — портреты персонажей.
   Плоская SVG-иллюстрация «по пояс», анфас: фон, плечи и одежда, шея, голова, причёска, мимика.
   A.art.portrait(look, emotion, { seed }) → строка <svg viewBox="0 0 120 140">;
   A.art.randomLook(seed, { sex, age }) → полный объект внешности (детерминирован по seed). */
(function (A) {
  'use strict';
  const ART = (A.art = A.art || {});
  const U = A.util || {};

  /* ---------- Числа, случайность, цвета ---------- */
  const r1 = (v) => Math.round(v * 10) / 10;
  /** Шаблон для путей: все числа округляются до 0.1. */
  function P(strs) {
    let s = strs[0];
    for (let i = 1; i < arguments.length; i++) {
      const v = arguments[i];
      s += (typeof v === 'number' ? r1(v) : v) + strs[i];
    }
    return s;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hashStr(str) {
    if (U.hash) return U.hash(str);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry(seed) {
    if (U.mulberry32) return U.mulberry32(seed);
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedNum(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return seed >>> 0;
    return hashStr(String(seed == null ? '' : seed));
  }
  const rngOf = (seed, salt) => mulberry((seedNum(seed) ^ hashStr(salt || 'look')) >>> 0);
  function wpick(r, table) {
    let tot = 0;
    for (let i = 0; i < table.length; i++) tot += table[i][1];
    let x = r() * tot;
    for (let i = 0; i < table.length; i++) {
      x -= table[i][1];
      if (x < 0) return table[i][0];
    }
    return table[table.length - 1][0];
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  function rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const hex = (c) => '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t));
  }
  const darken = (c, t) => mix(c, '#000000', t);
  const lighten = (c, t) => mix(c, '#ffffff', t);
  function lum(c) {
    const x = rgb(c);
    return (0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]) / 255;
  }
  const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const color = (c, fb) => (typeof c === 'string' && HEX_RE.test(c.trim()) ? hex(rgb(c.trim())) : fb);

  /* ---------- Палитры ---------- */
  const SKIN = ['#F6DCC9', '#EEC7A8', '#DCAD85', '#C28C65', '#996545', '#68422C'];
  const HAIR = {
    black: '#201B1D', dark: '#3A2A22', brown: '#5B3D2B', chestnut: '#7A4E32', light: '#9A7350',
    dblond: '#B8935F', blond: '#D8BB80', ginger: '#B0582D', auburn: '#7C3626',
    saltpep: '#77716C', gray: '#A39E98', silver: '#C6C2BC', white: '#E2DED6',
    wine: '#7B2E3A', copper: '#B4592F', ash: '#CDBF9F',
  };
  const CLOTH = ['#5E7E6B', '#3F4B66', '#8C5A4A', '#A35D6A', '#6C6F8E', '#7D8257', '#4F6F7F', '#B08B57', '#7A6A5C', '#2F4A55', '#9C6B53', '#586E8C', '#6E5872', '#8F9C8A', '#B9876F', '#4A5A4A'];
  const SHIRT = ['#BCD0E2', '#E6EAEC', '#CFE0D6', '#D9D3E6', '#F0E4CF'];
  const BG = [['#D7E9E0', '#B9D6C8'], ['#F4DED1', '#E8C1AF'], ['#F2E5C4', '#E4CE9B'], ['#DAE0ED', '#BCC7DD'], ['#E4DDEF', '#CBC1E1'], ['#DFE6DB', '#C3D1C0'], ['#EBDAD5', '#D7BBB3']];
  const IRIS = { brown: '#5A3826', dbrown: '#3B2418', hazel: '#7A6034', green: '#5E7F55', blue: '#5A80A8', gray: '#7B8C96' };
  const FRAMES = ['#2D2A2C', '#6B4632', '#8E939A', '#7A2F3B', '#3E4C6E'];
  const SCARF = ['#A2483F', '#3F4C78', '#4F7A5F', '#B98F38', '#78496D', '#5C6F8A'];
  const HAIRS = ['short', 'side', 'buzz', 'bald', 'long', 'bob', 'bun', 'ponytail', 'curly', 'messy', 'kerchief'];
  const CLOTHES = ['coat', 'sweater', 'hoodie', 'shirt', 'tshirt', 'gown', 'scrubs', 'cardigan', 'blazer'];
  ART.HAIRS = HAIRS;
  ART.CLOTHES = CLOTHES;

  /* ---------- Случайная внешность ---------- */
  ART.randomLook = function (seed, o) {
    o = o || {};
    const r = rngOf(seed, 'look');
    const sex = o.sex === 'f' || o.sex === 'm' ? o.sex : r() < 0.5 ? 'f' : 'm';
    const f = sex === 'f';
    let age = Number(o.age);
    if (o.age == null || !isFinite(age)) age = Math.round(wpick(r, [[8, 6], [15, 8], [25, 24], [38, 25], [52, 20], [68, 17]]) + (r() - 0.5) * 9);
    age = clamp(Math.round(age), 2, 99);
    const kid = age < 12;
    const teen = age >= 12 && age < 18;

    const skin = wpick(r, [[0, 25], [1, 30], [2, 19], [3, 13], [4, 8], [5, 5]]);

    // Волосы: естественный цвет зависит от тона кожи; у пожилых — седина.
    let base;
    if (skin <= 1) {
      base = wpick(r, [['black', 7], ['dark', 22], ['brown', 22], ['chestnut', 12], ['light', 13], ['dblond', 11], ['blond', kid ? 14 : 7], ['ginger', 5], ['auburn', 4]]);
    } else if (skin === 2) {
      base = wpick(r, [['black', 30], ['dark', 34], ['brown', 20], ['chestnut', 8], ['light', 5], ['auburn', 3]]);
    } else {
      base = wpick(r, [['black', 58], ['dark', 32], ['brown', 10]]);
    }
    if (f && age >= 20 && r() < 0.12) base = pick(r, ['wine', 'copper', 'ash']);
    let hairColor = HAIR[base];
    const grayP = age >= 70 ? 0.92 : age >= 60 ? 0.75 : age >= 50 ? 0.38 : age >= 42 ? 0.12 : 0;
    const keepsDye = f && age >= 50 && r() < 0.4;
    if (!keepsDye && r() < grayP) {
      hairColor = age >= 72 ? pick(r, [HAIR.white, HAIR.silver]) : age >= 60 ? pick(r, [HAIR.silver, HAIR.gray, HAIR.saltpep]) : pick(r, [HAIR.saltpep, HAIR.gray]);
    }

    let hair;
    if (!f) {
      if (kid) hair = wpick(r, [['short', 34], ['messy', 28], ['buzz', 14], ['side', 12], ['curly', 12]]);
      else if (teen) hair = wpick(r, [['messy', 30], ['short', 24], ['side', 20], ['buzz', 10], ['curly', 10], ['long', 4]]);
      else if (age < 45) hair = wpick(r, [['short', 30], ['side', 20], ['buzz', 15], ['messy', 12], ['curly', 7], ['bald', age >= 30 ? 8 : 2], ['long', 4], ['ponytail', 2]]);
      else if (age < 60) hair = wpick(r, [['short', 30], ['side', 26], ['bald', 24], ['buzz', 12], ['curly', 5], ['messy', 3]]);
      else hair = wpick(r, [['bald', 34], ['side', 30], ['short', 26], ['buzz', 10]]);
    } else {
      if (kid) hair = wpick(r, [['ponytail', 30], ['long', 26], ['bob', 20], ['bun', 10], ['curly', 14]]);
      else if (teen) hair = wpick(r, [['long', 34], ['ponytail', 24], ['bob', 15], ['curly', 10], ['bun', 10], ['messy', 5]]);
      else if (age < 45) hair = wpick(r, [['long', 30], ['bob', 20], ['bun', 15], ['ponytail', 12], ['curly', 10], ['short', 8], ['messy', 5]]);
      else if (age < 62) hair = wpick(r, [['bob', 34], ['bun', 20], ['short', 16], ['long', 11], ['curly', 13], ['ponytail', 6]]);
      else hair = wpick(r, [['bob', 28], ['bun', 28], ['short', 20], ['curly', 10], ['kerchief', age >= 66 ? 22 : 8]]);
    }

    const gP = kid ? 0.07 : teen ? 0.15 : age < 40 ? 0.22 : age < 55 ? 0.36 : 0.56;
    const glasses = r() < gP ? (r() < 0.45 ? 'round' : 'rect') : null;

    let beard = null;
    let stubble = false;
    if (!f && age >= 18) {
      beard = wpick(r, [[null, 70], ['short', 10], ['full', age >= 25 ? 7 : 1], ['mustache', age >= 45 ? 14 : 5]]);
      if (!beard) stubble = r() < 0.26;
    } else if (!f && age >= 16) stubble = r() < 0.12;

    let clothes;
    if (kid) clothes = wpick(r, [['tshirt', 34], ['sweater', 30], ['hoodie', 26], ['shirt', 10]]);
    else if (teen) clothes = wpick(r, [['hoodie', 34], ['tshirt', 28], ['sweater', 22], ['shirt', 16]]);
    else if (age < 60)
      clothes = wpick(r, [['sweater', 24], ['shirt', 20], ['tshirt', age < 35 ? 14 : 7], ['hoodie', age < 35 ? 12 : 3], ['cardigan', f ? 12 : 5], ['blazer', 12], ['gown', 5], ['scrubs', 2]]);
    else clothes = wpick(r, [['cardigan', 30], ['sweater', 28], ['shirt', 18], ['blazer', 10], ['gown', 10]]);
    const clothesColor = pick(r, CLOTH);

    let accessory = null;
    if (f && !kid && r() < 0.36) accessory = 'earrings';
    else if (f && age >= 45 && r() < 0.14) accessory = 'brooch';
    else if (f && kid && r() < 0.08) accessory = 'earrings';

    const eye = skin <= 1 ? wpick(r, [['blue', 24], ['gray', 20], ['green', 14], ['hazel', 16], ['brown', 26]]) : skin === 2 ? wpick(r, [['brown', 55], ['hazel', 25], ['green', 10], ['gray', 10]]) : wpick(r, [['dbrown', 70], ['brown', 30]]);
    const v = () => r1(r() * 2 - 1);
    const face = {
      w: v(), jaw: v(), chin: v(), eyes: v(), nose: v(), mouth: v(), brow: v(),
      part: r() < 0.5 ? -1 : 1, variant: Math.floor(r() * 3),
      recede: !f && age >= 32 ? r1(clamp((age - 30) / 40 + r() * 0.5 - 0.25, 0, 1)) : 0,
      freckles: skin <= 1 && age < 40 && r() < 0.16,
    };
    return {
      sex, age, skin, hair, hairColor, glasses, beard, stubble, clothes, clothesColor, accessory,
      eyeColor: IRIS[eye], frameColor: pick(r, FRAMES), scarfColor: pick(r, SCARF), shirtColor: pick(r, SHIRT),
      tie: !f && r() < 0.35, collar: r() < 0.35, bg: Math.floor(r() * BG.length), face,
    };
  };

  /* ---------- Эмоции ----------
     b/bL/bR: брови [смещение внутреннего конца, наружного, изгиб]; bx — свести к переносице; bt — толщина.
     e/eL/eR: глаза { up — раскрытие верхнего века, lo — подъём нижнего (−: шире), tilt — опущенный наружный (+) / внутренний (−) край века,
              ir — размер радужки, pu — зрачка, gx/gy — взгляд, shine — блик }.
     m — рот; x — детали. */
  const EMO = {
    neutral: { b: [0, 0, 1.2], e: { up: 1, lo: 0.05 }, m: 'neutral' },
    smile: { b: [-0.9, -0.5, 1.7], e: { up: 0.9, lo: 0.42 }, m: 'smile', x: { blush: 0.28 } },
    sad: { b: [-3.6, 1.8, -0.3], bx: 0.6, e: { up: 0.82, tilt: 0.4, gy: 1.1 }, m: 'sad', x: { bags: 0.6, worry: 1 } },
    anxious: { b: [-3.2, -0.8, 0.3], bx: 1.4, e: { up: 1.3, lo: -0.15, ir: 0.86, gx: 1.3 }, m: 'anxious', x: { sweat: 1, worry: 1 } },
    elated: { b: [-4.4, -3.8, 2.6], e: { up: 1.12, lo: 0.32, shine: 2 }, m: 'elated', x: { blush: 0.55 } },
    flat: { b: [0.7, 0.7, 0], e: { up: 0.5, lo: 0.05, gx: 2.3, gy: 0.7, shine: 0 }, m: 'flat' },
    suspicious: { bL: [2.6, 1.6, -0.1], bR: [-1.6, -2.4, 1.5], e: { up: 0.55, lo: 0.48, gx: -2.3 }, m: 'suspicious' },
    confused: { bL: [-3.4, -4.2, 2.2], bR: [1.6, 0.2, 0.4], eL: { up: 1.12, gx: -0.4, gy: -1.2 }, eR: { up: 0.86, gx: 1.3, gy: -0.5 }, e: {}, m: 'confused', x: { tilt: -6 } },
    angry: { b: [3.8, -1.4, -0.7], bx: 1.5, bt: 1.12, e: { up: 0.86, tilt: -0.5, lo: 0.22 }, m: 'angry', x: { flush: 1, furrow: 1 } },
    tired: { b: [-1.4, 2.1, 0.6], e: { up: 0.4, gy: 1.2, shine: 0.6 }, m: 'tired', x: { bags: 1, tilt: 3.5 } },
    stern: { b: [2.1, 1.3, 0.1], bt: 1.18, e: { up: 0.74, lo: 0.26 }, m: 'stern', x: { furrow: 0.7 } },
    smirk: { bL: [0.2, 0.5, 1], bR: [-1.8, -2.8, 1.9], e: { up: 0.86, lo: 0.32, gx: 0.7 }, m: 'smirk' },
    fear: { b: [-5.2, -2.8, 0.6], bx: 1.1, e: { up: 1.52, lo: -0.38, ir: 0.74, pu: 0.5 }, m: 'fear', x: { pale: 1, sweat: 0.7, worry: 1 } },
  };
  ART.EMOTIONS = Object.keys(EMO);

  /* ---------- Геометрия головы и тела ---------- */
  function geometry(L) {
    const age = L.age;
    const f = L.sex === 'f';
    const kid = age < 12;
    const teen = age >= 12 && age < 18;
    const old = age >= 60;
    const F = L.face || {};
    const g = { cx: 60, kid, teen, old, f, age };
    if (kid) {
      Object.assign(g, { top: 25, hw: 22.6, wy: 60, jw: 16.4, jy: 80, chin: 90, cw: 7.6, eyeY: 65.5, eyeDx: 10.2, eyeW: 5.7, eyeH: 4.6, irisR: 3.5, noseY: 74.8, mouthY: 81.6, mouthW: 5.2, nw: 6.2, sy: 104, sw: 38 });
    } else if (f) {
      Object.assign(g, { top: 26.5, hw: 20.6, wy: 57, jw: 15.4, jy: 80, chin: 92.5, cw: 6, eyeY: 62, eyeDx: 10, eyeW: 5.4, eyeH: 3.9, irisR: 2.95, noseY: 73.2, mouthY: 82, mouthW: 6.3, nw: 7, sy: 104, sw: 47 });
    } else {
      Object.assign(g, { top: 25.5, hw: 21.4, wy: 57, jw: 17.6, jy: 81, chin: 94, cw: 7, eyeY: 62, eyeDx: 10.2, eyeW: 5.2, eyeH: 3.6, irisR: 2.8, noseY: 74, mouthY: 83, mouthW: 7, nw: 8.6, sy: 104, sw: 53 });
    }
    if (teen) {
      g.jw -= 0.9; g.chin -= 1; g.eyeW += 0.2; g.eyeH += 0.3; g.irisR += 0.15; g.sw -= 4; g.nw -= 0.6;
    }
    if (old) {
      g.eyeH -= 0.3; g.jw += 0.6; g.sw -= 2;
    }
    if (kid && age < 6) {
      g.eyeW += 0.2; g.eyeH += 0.3; g.mouthW -= 0.4; g.sw -= 3;
    }
    g.hw += (F.w || 0) * 1.1;
    g.jw += (F.jaw || 0) * 1.3;
    g.chin += (F.chin || 0) * 1.1;
    g.eyeDx += (F.eyes || 0) * 0.45;
    g.mouthW += (F.mouth || 0) * 0.7;
    g.noseW = (kid ? 2.1 : f ? 2.6 : 3.1) + (F.nose || 0) * 0.5;
    g.browY = g.eyeY - g.eyeH - (kid ? 4.3 : 3.6);
    g.earY = g.eyeY + 3.5;
    g.ry = g.wy - g.top;
    g.hl = g.top + (g.eyeY - g.top) * 0.4;
    g.fy = g.browY - 6.3; // нижний край чёлки: выше поднятых бровей
    g.sh = g.sw - g.nw;
    return g;
  }

  function facePath(g) {
    const { cx, hw, wy, jw, jy, chin, cw, ry } = g;
    return (
      P`M${cx - hw} ${wy}A${hw} ${ry} 0 0 1 ${cx + hw} ${wy}` +
      P`C${cx + hw} ${wy + (jy - wy) * 0.55} ${cx + jw + (hw - jw) * 0.45} ${jy - 3} ${cx + jw} ${jy}` +
      P`C${cx + jw - 2.4} ${jy + (chin - jy) * 0.62} ${cx + cw + 2} ${chin} ${cx} ${chin}` +
      P`C${cx - cw - 2} ${chin} ${cx - jw + 2.4} ${jy + (chin - jy) * 0.62} ${cx - jw} ${jy}` +
      P`C${cx - jw - (hw - jw) * 0.45} ${jy - 3} ${cx - hw} ${wy + (jy - wy) * 0.55} ${cx - hw} ${wy}Z`
    );
  }
  /** Дуга по контуру черепа, раздутому на v (по бокам) и v+vt (сверху), слева направо. */
  function capArc(g, v, vt) {
    return P`M${g.cx - g.hw - v} ${g.wy}A${g.hw + v} ${g.ry + v + vt} 0 0 1 ${g.cx + g.hw + v} ${g.wy}`;
  }
  const MIRROR = '<g transform="matrix(-1 0 0 1 120 0)">';
  const sym = (s) => s + MIRROR + s + '</g>';

  /* ---------- Причёски ----------
     Каждая возвращает { back, mid, front, det, noEars }: back — за шеей и телом, mid — за лицом, front — поверх лица,
     det — штрихи и блики поверх front. Чёлки не опускаются ниже g.fy (над поднятыми бровями). */
  function hairShape(style, g, L, C, r) {
    const { cx, hw, earY, wy } = g;
    const F = L.face || {};
    const sb = earY - 3.5;
    const H = C.hair;
    const hs = C.hairS;
    const hi = C.hairH;
    const out = { back: '', mid: '', front: '', det: '', noEars: false, mirror: false };
    const strand = (d, op) => '<path d="' + d + '" fill="none" stroke="' + hs + '" stroke-width="0.9" stroke-linecap="round" opacity="' + (op || 0.55) + '"/>';
    const shine = (d, w) => '<path d="' + d + '" fill="none" stroke="' + hi + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" opacity=".5"/>';
    const topShine = (v) => shine(P`M${cx - hw * 0.66} ${g.top + 5 - v * 0.3}Q${cx - hw * 0.35} ${g.top - v * 0.6} ${cx + hw * 0.05} ${g.top - v * 0.75}`);

    if (style === 'short') {
      const rec = F.recede || 0;
      const v = 3;
      const hl = g.hl - rec * 3.5;
      const k = rec * 3;
      out.front =
        capArc(g, v, 2) +
        P`L${cx + hw + 0.8} ${sb}L${cx + hw - 2.4} ${sb}Q${cx + hw - 2.6} ${hl + 7} ${cx + hw - 6 - k} ${hl + 1 - k}` +
        P`C${cx + 6} ${hl + 3.2} ${cx - 6} ${hl + 3.2} ${cx - hw + 6 + k} ${hl + 1 - k}` +
        P`Q${cx - hw + 2.6} ${hl + 7} ${cx - hw + 2.4} ${sb}L${cx - hw - 0.8} ${sb}Z`;
      out.det = strand(P`M${cx - 9} ${hl + 1.5}Q${cx - 4} ${hl - 4} ${cx + 4} ${hl - 3.5}`) + strand(P`M${cx + 2} ${hl + 2}Q${cx + 8} ${hl - 2} ${cx + 13} ${hl - 1}`) + topShine(v);
    } else if (style === 'side' || (style === 'short' && g.f)) {
      // обработано ниже
    }
    if (style === 'side') {
      const rec = (F.recede || 0) * 0.7;
      const v = g.f ? 3.6 : 3.2;
      const hl = g.hl - rec * 3;
      const fyb = Math.min(hl + 7.5, g.fy - 0.4);
      const sbb = g.f ? earY + 1 : sb;
      out.front =
        capArc(g, v, 3) +
        P`L${cx + hw + 1} ${sbb}L${cx + hw - 2.3} ${sbb}Q${cx + hw - 2.4} ${hl + 9} ${cx + hw - 5} ${hl + 6}` +
        P`C${cx + 9} ${fyb + 2.2} ${cx - 1} ${fyb + 0.2} ${cx - 9} ${hl + 0.5}` +
        P`Q${cx - hw + 4} ${hl + 1} ${cx - hw + 2.6} ${hl + 7}L${cx - hw + 2.4} ${sbb}L${cx - hw - 1} ${sbb}Z`;
      out.det =
        '<path d="' + P`M${cx - 9} ${hl + 0.6}Q${cx - 8.6} ${g.top + 5} ${cx - 6} ${g.top - 1.5}` + '" fill="none" stroke="' + hs + '" stroke-width="1.1" stroke-linecap="round"/>' +
        strand(P`M${cx - 6.5} ${hl - 1}Q${cx + 5} ${hl - 3.5} ${cx + hw - 5.5} ${hl + 4.5}`) +
        strand(P`M${cx - 4} ${hl + 3}Q${cx + 4} ${hl + 2} ${cx + 9} ${fyb - 0.5}`) +
        shine(P`M${cx - hw * 0.25} ${g.top + 1}Q${cx + hw * 0.25} ${g.top - 1} ${cx + hw * 0.6} ${g.top + 4}`);
      out.mirror = F.part > 0;
    } else if (style === 'buzz') {
      const v = 1.3;
      const hl = g.hl + 0.5 - (F.recede || 0) * 2;
      out.front =
        capArc(g, v, 0.6) +
        P`L${cx + hw - 0.1} ${earY - 4.5}L${cx + hw - 2.4} ${earY - 4.5}Q${cx + hw - 3} ${hl + 5} ${cx + hw - 6} ${hl + 1.4}` +
        P`Q${cx} ${hl - 0.6} ${cx - hw + 6} ${hl + 1.4}Q${cx - hw + 3} ${hl + 5} ${cx - hw + 2.4} ${earY - 4.5}L${cx - hw + 0.1} ${earY - 4.5}Z`;
      out.buzz = true;
    } else if (style === 'bald') {
      const side = P`M${cx - hw - 1.4} ${wy - 8}Q${cx - hw - 3} ${wy + 1} ${cx - hw - 0.6} ${earY - 2}L${cx - hw + 2} ${earY - 2.6}Q${cx - hw + 0.4} ${wy - 1} ${cx - hw + 1.3} ${wy - 9}Z`;
      out.front = side + P`M${cx + hw + 1.4} ${wy - 8}Q${cx + hw + 3} ${wy + 1} ${cx + hw + 0.6} ${earY - 2}L${cx + hw - 2} ${earY - 2.6}Q${cx + hw - 0.4} ${wy - 1} ${cx + hw - 1.3} ${wy - 9}Z`;
      out.det = '<ellipse cx="' + r1(cx - 7) + '" cy="' + r1(g.top + 7) + '" rx="7" ry="3.2" transform="rotate(-18 ' + r1(cx - 7) + ' ' + r1(g.top + 7) + ')" fill="#fff" opacity=".28"/>';
      out.bald = true;
    } else if (style === 'long') {
      const v = 3.6;
      const vt = 2.4;
      const p = F.variant === 2 ? 0 : (F.part || 1) * 5;
      const Ry = g.ry + v + vt;
      const Rx = hw + v;
      const ty = wy - Ry * Math.sqrt(1 - Math.pow(p / Rx, 2));
      const bot = g.kid ? 116 : 122;
      out.back =
        capArc(g, v + 0.4, vt) +
        P`C${cx + hw + v + 1.5} ${wy + 22} ${cx + hw + 8} ${96} ${cx + hw + 9} ${bot - 4}L${cx - hw - 9} ${bot - 4}C${cx - hw - 8} 96 ${cx - hw - v - 1.5} ${wy + 22} ${cx - hw - v - 0.4} ${wy}Z`;
      const side = (s) => {
        const X = (dx) => cx + s * dx;
        return (
          P`M${cx + p} ${ty}C${cx + p + s * 7} ${ty + 3} ${X(hw - 3)} ${g.hl - 3} ${X(hw - 2.6)} ${g.fy + 2}` +
          P`C${X(hw - 2.2)} ${g.eyeY + 6} ${X(g.jw + 1.2)} ${g.jy - 6} ${X(g.jw + 0.4)} ${g.jy + 2}` +
          P`C${X(g.jw)} ${g.jy + 12} ${X(g.nw + 5)} ${g.sy} ${X(g.nw + 9)} ${bot}L${X(hw + 11)} ${bot}` +
          P`C${X(hw + 8)} ${100} ${X(hw + v + 1)} ${wy + 16} ${X(hw + v)} ${wy}A${Rx} ${Ry} 0 0 ${s < 0 ? 1 : 0} ${cx + p} ${ty}Z`
        );
      };
      out.front = side(-1) + side(1);
      out.det =
        strand(P`M${cx + p} ${ty + 1}Q${cx + p - 6} ${g.top + 6} ${cx - hw + 0.5} ${g.fy}`) +
        strand(P`M${cx + p} ${ty + 1}Q${cx + p + 6} ${g.top + 6} ${cx + hw - 0.5} ${g.fy}`) +
        strand(P`M${cx - hw - 1} ${wy + 14}Q${cx - hw - 2} ${g.jy + 8} ${cx - hw - 4} ${bot - 6}`) +
        strand(P`M${cx + hw + 1} ${wy + 14}Q${cx + hw + 2} ${g.jy + 8} ${cx + hw + 4} ${bot - 6}`) +
        shine(P`M${cx - hw * 0.62} ${g.top + 4}Q${cx - hw * 0.3} ${g.top - 1.5} ${cx + p - 1.5} ${ty + 1.5}`);
      out.noEars = true;
    } else if (style === 'bob') {
      const v = 3.4;
      const bt = g.chin - 1.5;
      out.back = capArc(g, v + 0.3, 2.6) + P`C${cx + hw + v + 1.4} ${wy + 12} ${cx + hw + 4.4} ${bt - 8} ${cx + hw + 3.4} ${bt}L${cx - hw - 3.4} ${bt}C${cx - hw - 4.4} ${bt - 8} ${cx - hw - v - 1.4} ${wy + 12} ${cx - hw - v - 0.3} ${wy}Z`;
      const bangs = F.variant !== 1;
      let d = capArc(g, v, 2.6) + P`C${cx + hw + v + 1.2} ${wy + 12} ${cx + hw + 4} ${bt - 8} ${cx + hw + 3} ${bt}Q${cx + hw} ${bt + 1.4} ${cx + g.jw + 1.4} ${g.jy + 1.5}` + P`C${cx + hw - 1.6} ${g.jy - 6} ${cx + hw - 2.2} ${g.eyeY + 2} ${cx + hw - 2.6} ${g.fy + 2}`;
      if (bangs) {
        const fb = g.fy - 0.8;
        const xa = cx + hw - 5;
        const xb = cx - hw + 5;
        const n = 5;
        const st = (xa - xb) / n;
        d += P`Q${cx + hw - 3} ${fb} ${xa} ${fb}`;
        for (let i = 0; i < n; i++) d += P`Q${xa - st * (i + 0.5)} ${fb + 1.5} ${xa - st * (i + 1)} ${fb}`;
        d += P`Q${cx - hw + 3} ${fb} ${cx - hw + 2.6} ${g.fy + 2}`;
        out.det = strand(P`M${cx - 8} ${g.top}Q${cx - 9} ${g.hl} ${cx - 10} ${fb - 1}`) + strand(P`M${cx + 6} ${g.top}Q${cx + 7} ${g.hl} ${cx + 8} ${fb - 1}`);
      } else {
        const px = cx + (F.part || 1) * 6;
        d += P`C${cx + hw - 4} ${g.hl - 1} ${px + 3} ${g.hl - 3} ${px} ${g.top + 3}C${px - 4} ${g.hl - 2} ${cx - hw + 4} ${g.hl + 2} ${cx - hw + 2.6} ${g.fy + 2}`;
        out.det = '<path d="' + P`M${px} ${g.top + 3}L${px - 0.5} ${g.top - 2}` + '" stroke="' + hs + '" stroke-width="1"/>';
      }
      d += P`C${cx - hw + 2.2} ${g.eyeY + 2} ${cx - hw + 1.6} ${g.jy - 6} ${cx - g.jw - 1.4} ${g.jy + 1.5}Q${cx - hw} ${bt + 1.4} ${cx - hw - 3} ${bt}C${cx - hw - 4} ${bt - 8} ${cx - hw - v - 1.2} ${wy + 12} ${cx - hw - v} ${wy}Z`;
      out.front = d;
      out.det += topShine(v);
      out.noEars = true;
    } else if (style === 'bun' || style === 'ponytail') {
      const v = 2.2;
      const hl = g.hl - 1;
      const tb = earY - 4;
      out.front =
        capArc(g, v, 1.4) +
        P`L${cx + hw + 0.4} ${tb}L${cx + hw - 1.8} ${tb}C${cx + hw - 2} ${hl + 3} ${cx + 9} ${hl - 1.4} ${cx} ${hl - 1.2}` +
        P`C${cx - 9} ${hl - 1.4} ${cx - hw + 2} ${hl + 3} ${cx - hw + 1.8} ${tb}L${cx - hw - 0.4} ${tb}Z`;
      out.det =
        strand(P`M${cx - 11} ${hl + 2}Q${cx - 9} ${g.top + 4} ${cx - 3} ${g.top - 1}`) +
        strand(P`M${cx + 11} ${hl + 2}Q${cx + 9} ${g.top + 4} ${cx + 3} ${g.top - 1}`) +
        strand(P`M${cx - 3} ${hl - 0.6}Q${cx - 2} ${g.top + 3} ${cx} ${g.top - 1.6}`, 0.4) +
        topShine(v);
      if (style === 'bun') {
        const by = g.top - (g.kid ? 3 : 3.6);
        const br = g.kid ? 7 : 7.8;
        out.back =
          '<circle cx="' + cx + '" cy="' + r1(by) + '" r="' + br + '" fill="' + H + '"/>' +
          '<path d="' + P`M${cx - br * 0.6} ${by + 1}Q${cx} ${by - br * 0.9} ${cx + br * 0.6} ${by + 1.5}M${cx - br * 0.3} ${by + 3}Q${cx + 2} ${by - 1} ${cx + br * 0.75} ${by - 2.5}` + '" fill="none" stroke="' + hs + '" stroke-width="1" stroke-linecap="round" opacity=".6"/>' +
          '<path d="' + P`M${cx - br * 0.7} ${by - br * 0.35}Q${cx - br * 0.3} ${by - br * 0.85} ${cx + br * 0.2} ${by - br * 0.85}` + '" fill="none" stroke="' + hi + '" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>';
        out.det += '<path d="' + P`M${cx - 4.5} ${g.top - 1.4}Q${cx} ${g.top + 0.2} ${cx + 4.5} ${g.top - 1.4}` + '" fill="none" stroke="' + C.accent + '" stroke-width="2" stroke-linecap="round"/>';
      } else {
        const s = 1;
        const X = (dx) => cx + s * dx;
        const tail =
          P`M${X(hw - 5)} ${g.top + 4}C${X(hw + 9)} ${g.top + 2} ${X(hw + 12)} ${wy + 10} ${X(hw + 8.5)} ${g.kid ? 96 : 104}` +
          P`C${X(hw + 6.5)} ${g.kid ? 101 : 110} ${X(hw + 2.5)} ${g.kid ? 99 : 106} ${X(hw + 3.2)} ${g.kid ? 92 : 98}C${X(hw + 5)} ${wy + 10} ${X(hw + 3)} ${g.top + 10} ${X(hw - 4)} ${g.top + 10}Z`;
        out.back = '<path d="' + tail + '" fill="' + H + '"/>' + strand(P`M${X(hw + 4)} ${g.top + 8}Q${X(hw + 9)} ${wy + 6} ${X(hw + 6.5)} ${g.kid ? 94 : 100}`) + '<path d="' + P`M${X(hw + 2)} ${g.top + 3.5}l1.6 4.2` + '" stroke="' + C.accent + '" stroke-width="2.4" stroke-linecap="round"/>';
        out.mirror = F.part < 0;
      }
    } else if (style === 'curly') {
      const v = 4.2;
      let back = '';
      const R = (a) => 4.6 + ((Math.sin(a * 7.3 + (F.w || 0) * 3) + 1) / 2) * 1.6;
      for (let a = 160; a <= 380; a += 15) {
        const t = (a * Math.PI) / 180;
        back += P`<circle cx="${cx + (hw + 4.6) * Math.cos(t)}" cy="${wy + (g.ry + 5.2) * Math.sin(t)}" r="${R(a)}"/>`;
      }
      const lower = g.f ? 3 : 1;
      for (let k = 0; k < lower; k++) {
        const y = wy + 7 + k * 8;
        back += P`<circle cx="${cx - hw - 3.6 + k * 0.6}" cy="${y}" r="${5 - k * 0.4}"/><circle cx="${cx + hw + 3.6 - k * 0.6}" cy="${y}" r="${5 - k * 0.4}"/>`;
      }
      out.back = '<g fill="' + hs + '">' + back + '</g>';
      out.mid = '';
      const hl = g.hl + 0.4;
      let front = capArc(g, v, 3) + P`L${cx + hw + 1.6} ${earY - 5}L${cx + hw - 2} ${earY - 5}C${cx + hw - 2.4} ${hl + 3} ${cx + 9} ${hl} ${cx} ${hl}C${cx - 9} ${hl} ${cx - hw + 2.4} ${hl + 3} ${cx - hw + 2} ${earY - 5}L${cx - hw - 1.6} ${earY - 5}Z`;
      let bumps = '';
      for (let i = 0; i <= 6; i++) {
        const x = cx - hw + 5 + ((2 * hw - 10) * i) / 6;
        const dx = (x - cx) / (hw - 1);
        const y = hl + 0.6 + dx * dx * 4.5;
        bumps += P`<circle cx="${x}" cy="${y}" r="3.1"/>`;
      }
      bumps += P`<circle cx="${cx - hw + 0.6}" cy="${hl + 8}" r="3.1"/><circle cx="${cx + hw - 0.6}" cy="${hl + 8}" r="3.1"/><circle cx="${cx - hw - 0.4}" cy="${hl + 13}" r="2.9"/><circle cx="${cx + hw + 0.4}" cy="${hl + 13}" r="2.9"/>`;
      out.front = front;
      out.bumps = bumps;
      let curls = '';
      for (let i = 0; i < 5; i++) {
        const x = cx - hw * 0.6 + i * hw * 0.3;
        const y = g.top + 2 + Math.abs(i - 2) * 2.5;
        curls += P`M${x - 2} ${y + 1}q2 -3 4 0`;
      }
      out.det = '<path d="' + curls + '" fill="none" stroke="' + hs + '" stroke-width="1" stroke-linecap="round" opacity=".6"/>' + topShine(v);
      out.noEars = g.f;
    } else if (style === 'messy') {
      const v = 3;
      const hl = g.hl;
      let d = P`M${cx - hw - v} ${wy}`;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (Math.PI * i) / n;
        const a1 = Math.PI + (Math.PI * (i + 1)) / n;
        const am = (a0 + a1) / 2 + 0.06;
        const tip = 3.4 + ((i * 37) % 5) * 0.4;
        d += P`Q${cx + (hw + v + tip) * Math.cos(am)} ${wy + (g.ry + v + 2 + tip) * Math.sin(am)} ${cx + (hw + v) * Math.cos(a1)} ${wy + (g.ry + v + 2) * Math.sin(a1)}`;
      }
      d += P`L${cx + hw + 0.8} ${sb}L${cx + hw - 2.4} ${sb}Q${cx + hw - 2.6} ${hl + 8} ${cx + hw - 4.5} ${hl + 3.5}`;
      const tips = [
        [cx + hw - 7.5, g.fy - 1.2], [cx + hw - 10.5, hl + 3.2], [cx + 5.5, g.fy - 0.4], [cx + 2, hl + 3.5],
        [cx - 3, g.fy - 0.6], [cx - 6.5, hl + 3], [cx - 11, g.fy - 1.6], [cx - hw + 7, hl + 2.5],
      ];
      for (let i = 0; i < tips.length; i++) d += P`L${tips[i][0]} ${Math.min(tips[i][1], g.fy - 0.4)}`;
      d += P`L${cx - hw + 4.5} ${hl + 3.5}Q${cx - hw + 2.6} ${hl + 8} ${cx - hw + 2.4} ${sb}L${cx - hw - 0.8} ${sb}Z`;
      out.front = d;
      out.join = 'round';
      out.det = strand(P`M${cx - 7} ${hl - 2}L${cx - 3} ${hl + 3}M${cx + 3} ${hl - 3}L${cx + 5} ${hl + 2}M${cx + 9} ${hl - 2}L${cx + 12} ${hl + 3}`) + topShine(v);
      out.mirror = F.part < 0;
    } else if (style === 'kerchief') {
      const K = C.scarf;
      const KS = darken(K, 0.22);
      const outer = capArc(g, 5, 1.2);
      out.mid =
        '<path d="' + outer + P`C${cx + hw + 6} ${wy + 18} ${cx + g.jw + 7.5} ${g.jy + 8} ${cx + 6} ${g.chin + 5}L${cx - 6} ${g.chin + 5}C${cx - g.jw - 7.5} ${g.jy + 8} ${cx - hw - 6} ${wy + 18} ${cx - hw - 5} ${wy}Z` + '" fill="' + KS + '"/>';
      const band = outer + P`L${cx + hw - 0.6} ${wy + 2}A${hw - 0.6} ${wy + 2 - g.hl - 1} 0 0 0 ${cx - hw + 0.6} ${wy + 2}Z`;
      out.front = band;
      out.scarf = true;
      const dots = '<pattern id="' + C.id + 'kp" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.9" fill="' + lighten(K, 0.55) + '"/><circle cx="4.5" cy="4.5" r="0.9" fill="' + lighten(K, 0.35) + '"/></pattern>';
      out.defs = dots;
      out.det =
        '<path d="' + band + '" fill="url(#' + C.id + 'kp)"/>' +
        '<path d="' + P`M${cx + hw - 0.6} ${wy + 2}A${hw - 0.6} ${wy + 2 - g.hl - 1} 0 0 0 ${cx - hw + 0.6} ${wy + 2}` + '" fill="none" stroke="' + lighten(K, 0.25) + '" stroke-width="1.6"/>';
      const kn = g.chin + 3.4;
      out.knot =
        '<path d="' + P`M${cx - 1} ${kn}L${cx - 7.5} ${kn + 10}L${cx - 2} ${kn + 9}ZM${cx + 1} ${kn}L${cx + 6.5} ${kn + 11}L${cx + 1.6} ${kn + 9}Z` + '" fill="' + K + '"/>' +
        '<circle cx="' + cx + '" cy="' + r1(kn) + '" r="2.8" fill="' + K + '"/>';
      out.noEars = true;
    }
    return out;
  }

  /* ---------- Глаз ---------- */
  function eyeSvg(g, s, p, C, defs) {
    const ex = g.cx + s * g.eyeDx;
    const ey = g.eyeY;
    const w = g.eyeW;
    const H = g.eyeH;
    const xi = ex - s * w;
    const xo = ex + s * w;
    const oy = ey - 0.5;
    const tilt = p.tilt || 0;
    const up = p.up == null ? 1 : p.up;
    const k = 1.33;
    const uIn = H * up * (1 - Math.max(0, -tilt));
    const uOut = H * up * (1 - Math.max(0, tilt));
    const lo = H * 0.7 * (1 - (p.lo || 0));
    const upper = (a, b) => P`M${xi} ${ey}C${xi + s * w * 0.45} ${ey - a * k} ${xo - s * w * 0.42} ${oy - b * k} ${xo} ${oy}`;
    const lowerBack = P`C${xo - s * w * 0.45} ${oy + lo * k} ${xi + s * w * 0.45} ${ey + lo * k} ${xi} ${ey}Z`;
    const shape = upper(uIn, uOut) + lowerBack;
    const id = C.id + (s < 0 ? 'l' : 'r');
    defs.push('<clipPath id="' + id + '"><path d="' + shape + '"/></clipPath>');
    const gx = p.gx || 0;
    const gy = p.gy || 0;
    const ir = g.irisR * (p.ir || 1);
    const ix = ex + gx;
    const iy = ey + gy + 0.3;
    const sh = p.shine == null ? 1 : p.shine;
    let o = '';
    // веко-складка: при опущенном веке — видимая кожа века
    if (up < 0.8 || tilt) {
      o += '<path d="' + upper(H, H) + P`C${xo - s * w * 0.42} ${oy - uOut * k} ${xi + s * w * 0.45} ${ey - uIn * k} ${xi} ${ey}Z` + '" fill="' + C.lid + '"/>';
    }
    if (!g.kid) {
      const hh = Math.max(H, H * up) + 1.7;
      o += '<path d="' + P`M${xi + s * 0.6} ${ey - 1.3}C${xi + s * w * 0.45} ${ey - hh * k} ${xo - s * w * 0.42} ${oy - hh * k + 0.4} ${xo + s * 0.4} ${oy - 1}` + '" fill="none" stroke="' + C.shade + '" stroke-width="0.8" opacity=".45"/>';
    }
    o += '<path d="' + shape + '" fill="#FBF8F3"/>';
    o += '<g clip-path="url(#' + id + ')">';
    o += P`<circle cx="${ix}" cy="${iy}" r="${ir}" fill="${C.iris}"/>`;
    o += P`<circle cx="${ix}" cy="${iy}" r="${ir * 0.48 * (p.pu || 1)}" fill="#1B1416"/>`;
    o += '<path d="' + upper(uIn, uOut) + P`L${xo} ${oy - 4}L${xi} ${ey - 4}Z` + '" fill="#000" opacity=".08" transform="translate(0 1.1)"/>';
    if (sh > 0) {
      o += P`<circle cx="${ix - ir * 0.32}" cy="${iy - ir * 0.38}" r="${sh > 1 ? 1.25 : 0.95}" fill="#fff" opacity="${sh < 1 ? 0.6 : 1}"/>`;
      if (sh > 1) o += P`<circle cx="${ix + ir * 0.38}" cy="${iy + ir * 0.32}" r="0.6" fill="#fff"/>`;
    }
    o += '</g>';
    o += '<path d="' + upper(uIn, uOut) + '" fill="none" stroke="' + C.lash + '" stroke-width="' + (g.f ? 1.75 : 1.5) + '" stroke-linecap="round"/>';
    if (g.f && !g.kid) o += '<path d="' + P`M${xo - s * 0.3} ${oy - 0.2}l${s * 1.7} ${-1.1}` + '" stroke="' + C.lash + '" stroke-width="1.2" stroke-linecap="round"/>';
    o += '<path d="' + P`M${xo} ${oy}` + lowerBack.replace(/Z$/, '') + '" fill="none" stroke="' + C.shade + '" stroke-width="0.7" opacity=".5"/>';
    return { svg: o, xi, xo, ex, ey, oy, lo };
  }

  /* ---------- Бровь ---------- */
  function browSvg(g, s, bp, bx, bt, C) {
    const ex = g.cx + s * g.eyeDx;
    const ix = ex - s * (g.eyeW * 0.78 + (bx || 0));
    const ox = ex + s * (g.eyeW + 1.7);
    const iy = g.browY + bp[0] + 0.5;
    const oy = g.browY + bp[1] + 0.9;
    const mx = (ix + ox) / 2 + s * 1.2;
    const my = (iy + oy) / 2 - bp[2] - 1;
    const t = (g.kid ? 1.9 : g.f ? 2.15 : 2.6) * (bt || 1) * (1 + ((g.face && g.face.brow) || 0) * 0.12);
    const d = P`M${ix} ${iy + t / 2}Q${mx} ${my + t * 0.32} ${ox} ${oy + t * 0.12}Q${mx} ${my - t * 0.62} ${ix} ${iy - t / 2}Z`;
    return '<path d="' + d + '" fill="' + C.brow + '" stroke="' + C.brow + '" stroke-width="0.7" stroke-linejoin="round"/>';
  }

  /* ---------- Рот ---------- */
  function mouthSvg(g, type, C, defs) {
    const cx = g.cx;
    const my = g.mouthY;
    const mw = g.mouthW;
    const L = C.lipLine;
    const st = (d, w) => '<path d="' + d + '" fill="none" stroke="' + L + '" stroke-width="' + (w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    const lowerLip = (dy, rx) => P`<ellipse cx="${cx}" cy="${my + (dy || 2.4)}" rx="${rx || mw * 0.55}" ry="1.15" fill="${C.lip}" opacity=".55"/>`;
    const open = (d, teeth) => {
      const id = C.id + 'm';
      defs.push('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>');
      return '<path d="' + d + '" fill="#5B2329"/><g clip-path="url(#' + id + ')">' + teeth + '</g><path d="' + d + '" fill="none" stroke="' + L + '" stroke-width="1.2" stroke-linejoin="round"/>';
    };
    switch (type) {
      case 'smile':
        return lowerLip(2.6, mw * 0.6) + st(P`M${cx - mw - 1.6} ${my - 1.4}Q${cx} ${my + 4} ${cx + mw + 1.6} ${my - 1.4}`, 1.8) + st(P`M${cx - mw - 2.3} ${my - 2}l0.9 1.1M${cx + mw + 2.3} ${my - 2}l-0.9 1.1`, 1);
      case 'elated': {
        const W = mw + 3;
        const d = P`M${cx - W} ${my - 1.6}Q${cx} ${my - 0.4} ${cx + W} ${my - 1.6}C${cx + W - 0.8} ${my + 5} ${cx + 4} ${my + 7.6} ${cx} ${my + 7.6}C${cx - 4} ${my + 7.6} ${cx - W + 0.8} ${my + 5} ${cx - W} ${my - 1.6}Z`;
        return open(d, P`<rect x="${cx - W}" y="${my - 3}" width="${2 * W}" height="${4.3}" fill="#FBF7F0"/><ellipse cx="${cx}" cy="${my + 7.4}" rx="4.6" ry="2.8" fill="#D9686A"/>`);
      }
      case 'sad':
        return lowerLip(2.2, mw * 0.45) + st(P`M${cx - mw} ${my + 1.6}Q${cx} ${my - 2.6} ${cx + mw} ${my + 1.6}`, 1.8);
      case 'anxious': {
        const W = mw + 0.8;
        const d = P`M${cx - W} ${my + 0.6}Q${cx - W} ${my - 1.6} ${cx - W + 2} ${my - 1.5}L${cx + W - 2} ${my - 1.5}Q${cx + W} ${my - 1.6} ${cx + W} ${my + 0.6}Q${cx + W} ${my + 2.9} ${cx + W - 2} ${my + 2.8}L${cx - W + 2} ${my + 2.8}Q${cx - W} ${my + 2.9} ${cx - W} ${my + 0.6}Z`;
        return open(d, P`<rect x="${cx - W}" y="${my - 2}" width="${2 * W}" height="5.5" fill="#FBF7F0"/><path d="M${cx - W} ${my + 0.65}H${cx + W}M${cx - 2.4} ${my - 2}v5M${cx + 2.4} ${my - 2}v5" stroke="#C9BFB4" stroke-width="0.7"/>`);
      }
      case 'flat':
        return lowerLip(2.3, mw * 0.4) + st(P`M${cx - mw + 0.6} ${my + 0.4}L${cx + mw - 0.6} ${my + 0.4}`, 1.6);
      case 'suspicious':
        return lowerLip(2.3, mw * 0.4) + st(P`M${cx - mw + 1.2} ${my - 0.4}Q${cx + 1} ${my + 0.2} ${cx + mw - 0.2} ${my + 1.4}`, 1.7);
      case 'confused': {
        const x0 = cx - mw + 0.6;
        const Lw = (2 * mw - 0.6) / 3;
        return st(P`M${x0} ${my + 1}Q${x0 + Lw / 2} ${my - 1.2} ${x0 + Lw} ${my + 0.2}T${x0 + 2 * Lw} ${my}T${x0 + 3 * Lw} ${my - 1}`, 1.6);
      }
      case 'angry': {
        const W = mw + 0.6;
        const d = P`M${cx - W} ${my + 2.4}Q${cx - W * 0.4} ${my - 1.6} ${cx} ${my - 1.4}Q${cx + W * 0.4} ${my - 1.6} ${cx + W} ${my + 2.4}Q${cx} ${my + 5.6} ${cx - W} ${my + 2.4}Z`;
        return open(d, P`<rect x="${cx - W}" y="${my - 2}" width="${2 * W}" height="2.5" fill="#FBF7F0"/><rect x="${cx - W}" y="${my + 3.5}" width="${2 * W}" height="3" fill="#FBF7F0"/>`);
      }
      case 'tired':
        return lowerLip(2.2, mw * 0.45) + st(P`M${cx - mw + 1} ${my + 0.9}Q${cx} ${my - 0.6} ${cx + mw - 1} ${my + 0.9}`, 1.6);
      case 'stern':
        return st(P`M${cx - mw} ${my + 1}L${cx - mw + 1.6} ${my + 0.2}L${cx + mw - 1.6} ${my + 0.2}L${cx + mw} ${my + 1}`, 2) + st(P`M${cx - 2.6} ${my + 3.2}Q${cx} ${my + 2.4} ${cx + 2.6} ${my + 3.2}`, 0.9).replace('stroke-width', 'opacity=".55" stroke-width');
      case 'smirk':
        return lowerLip(2.3, mw * 0.45) + st(P`M${cx - mw + 0.6} ${my + 0.6}Q${cx + 1.5} ${my + 1.6} ${cx + mw + 1.6} ${my - 2}`, 1.8) + st(P`M${cx + mw + 1.4} ${my - 3}q1.1 1 0.4 2.3`, 1);
      case 'fear': {
        const d = P`M${cx} ${my - 1.6}C${cx + 3.6} ${my - 1.6} ${cx + 3.8} ${my + 5.6} ${cx} ${my + 5.6}C${cx - 3.8} ${my + 5.6} ${cx - 3.6} ${my - 1.6} ${cx} ${my - 1.6}Z`;
        return open(d, P`<rect x="${cx - 4}" y="${my - 2.6}" width="8" height="2.4" fill="#FBF7F0"/>`);
      }
      default:
        return lowerLip(2.4, mw * 0.5) + st(P`M${cx - mw} ${my}Q${cx} ${my + 1.6} ${cx + mw} ${my - 0.2}`, 1.7);
    }
  }

  /* ---------- Одежда ---------- */
  function clothesSvg(g, L, C) {
    const { cx, sy, sw, nw, sh } = g;
    const type = CLOTHES.indexOf(L.clothes) >= 0 ? L.clothes : 'sweater';
    const halfL = P`M${cx - sw} 142C${cx - sw} ${sy + 15} ${cx - sw + sh * 0.12} ${sy + 5} ${cx - sw + sh * 0.38} ${sy + 3.2}C${cx - sw + sh * 0.64} ${sy + 1.6} ${cx - nw - 6} ${sy} ${cx - nw - 2.5} ${sy - 1.5}`;
    const torso =
      halfL +
      P`Q${cx} ${sy + 1.5} ${cx + nw + 2.5} ${sy - 1.5}C${cx + nw + 6} ${sy} ${cx + sw - sh * 0.64} ${sy + 1.6} ${cx + sw - sh * 0.38} ${sy + 3.2}C${cx + sw - sh * 0.12} ${sy + 5} ${cx + sw} ${sy + 15} ${cx + sw} 142Z`;
    const coatW = '#F2F5F3';
    let c = C.cloth;
    if (type === 'coat') c = coatW;
    const cS = type === 'coat' ? '#CCD6D2' : darken(c, 0.2);
    const cL = lighten(c, 0.12);
    const shirt = C.shirt;
    const shirtS = darken(shirt, 0.16);
    const neck = C.neck;
    let back = '';
    let o = '<path d="' + torso + '" fill="' + c + '"/>';
    const tid = C.id + 't';
    const defs = '<clipPath id="' + tid + '"><path d="' + torso + '"/></clipPath>';
    // тени: правая рука в тени, тень от головы на груди
    let shade =
      '<g clip-path="url(#' + tid + ')"><path d="' + P`M${cx + sw - sh * 0.42} ${sy + 3}C${cx + sw - sh * 0.28} ${sy + 16} ${cx + sw - sh * 0.3} 128 ${cx + sw - sh * 0.26} 142H${cx + sw + 4}V${sy}Z` + '" fill="#1E2944" opacity=".13"/>' +
      P`<ellipse cx="${cx}" cy="${sy + 1}" rx="${nw + 7}" ry="5" fill="#1E2944" opacity=".12"/>` +
      '<path d="' + P`M${cx - sw + sh * 0.42} ${sy + 4}C${cx - sw + sh * 0.3} ${sy + 16} ${cx - sw + sh * 0.32} 128 ${cx - sw + sh * 0.28} 142` + '" fill="none" stroke="' + cS + '" stroke-width="1" opacity=".7"/></g>';
    const vneck = (depth, wide) => '<path d="' + P`M${cx - nw - (wide || 1.5)} ${sy - 2}L${cx} ${sy + depth}L${cx + nw + (wide || 1.5)} ${sy - 2}Z` + '" fill="' + neck + '"/>';
    const crew = (depth, rib, col) =>
      '<path d="' + P`M${cx - nw - 1.2} ${sy - 2}Q${cx} ${sy + depth} ${cx + nw + 1.2} ${sy - 2}Z` + '" fill="' + neck + '"/>' +
      '<path d="' + P`M${cx - nw - 1.8} ${sy - 2.2}Q${cx} ${sy + depth + 1.2} ${cx + nw + 1.8} ${sy - 2.2}` + '" fill="none" stroke="' + (col || cS) + '" stroke-width="' + rib + '" stroke-linecap="round"/>';
    const collarBand = (col) => '<path d="' + P`M${cx - nw - 2.6} ${sy + 1}L${cx - nw - 1.3} ${sy - 7}Q${cx} ${sy - 9} ${cx + nw + 1.3} ${sy - 7}L${cx + nw + 2.6} ${sy + 1}Z` + '" fill="' + col + '"/>';
    const wings = (col, colS, sc) => {
      sc = sc || 1;
      const w = P`M${cx - nw - 1.2} ${sy - 6.5}L${cx - nw - 4 * sc} ${sy + 3.6 * sc}L${cx - 1} ${sy + 8 * sc}L${cx - nw + 1.6} ${sy - 1}Z`;
      return sym('<path d="' + w + '" fill="' + col + '" stroke="' + colS + '" stroke-width="0.8" stroke-linejoin="round"/>');
    };
    const pen = (x, y) => P`<rect x="${x}" y="${y}" width="1.9" height="7" rx="0.9" fill="#24408E"/><rect x="${x + 0.5}" y="${y + 0.6}" width="0.8" height="4" fill="#9DB6FF"/>`;
    const tie = (y0, y1) => '<path d="' + P`M${cx - 2} ${y0}H${cx + 2}L${cx + 1.2} ${y0 + 2.6}L${cx + 3} ${y1}L${cx} ${y1 + 3}L${cx - 3} ${y1}L${cx - 1.2} ${y0 + 2.6}Z` + '" fill="' + C.tie + '"/>';

    if (type === 'coat') {
      back = collarBand(shirtS);
      o += '<path d="' + P`M${cx - nw - 3} ${sy - 1.5}L${cx} ${sy + 25}L${cx + nw + 3} ${sy - 1.5}Z` + '" fill="' + shirt + '"/>';
      o += vneck(6.5, -1.5);
      if (L.tie && !g.f) o += tie(sy + 5.5, sy + 22);
      o += wings(shirt, shirtS, 0.85);
      const lap = P`M${cx - nw - 3} ${sy - 1.5}L${cx - nw - 9.5} ${sy + 8.5}L${cx - nw - 6.6} ${sy + 11}L${cx - nw - 9.8} ${sy + 13.4}L${cx - 0.4} ${sy + 26}Z`;
      o += sym('<path d="' + lap + '" fill="#FAFCFB" stroke="#B5C2BD" stroke-width="0.8" stroke-linejoin="round"/>');
      o += '<path d="' + P`M${cx} ${sy + 26}L${cx + 0.4} 142` + '" stroke="#B5C2BD" stroke-width="0.9"/>';
      o += P`<circle cx="${cx + 2.6}" cy="${sy + 32}" r="1.1" fill="#E3E9E6" stroke="#B5C2BD" stroke-width="0.6"/>`;
      const px = cx - sw * 0.5;
      o += '<path d="' + P`M${px - 6} ${sy + 18}h12` + '" stroke="#B5C2BD" stroke-width="0.9"/>' + pen(px - 3, sy + 12.4);
      const bx = cx + sw * 0.26;
      o +=
        P`<rect x="${bx}" y="${sy + 13}" width="13" height="9" rx="1.4" fill="#fff" stroke="#9FB0AA" stroke-width="0.7"/>` +
        P`<path d="M${bx + 0.4} ${sy + 15.6}h12.2V${sy + 14.3}a1 1 0 0 0 -1 -1h-10.2a1 1 0 0 0 -1 1z" fill="#9CC3B2"/>` +
        P`<rect x="${bx + 1.4}" y="${sy + 16.7}" width="3.2" height="4" fill="#C9D6D1"/>` +
        P`<path d="M${bx + 5.8} ${sy + 17.6}h5.6M${bx + 5.8} ${sy + 19.8}h4" stroke="#9FB0AA" stroke-width="0.8"/>`;
    } else if (type === 'blazer') {
      const inner = g.f && L.tie === false && !L.collar ? lighten(c, 0.7) : shirt;
      back = g.f ? '' : collarBand(darken(inner, 0.12));
      o += '<path d="' + P`M${cx - nw - 3} ${sy - 1.5}L${cx} ${sy + 24}L${cx + nw + 3} ${sy - 1.5}Z` + '" fill="' + inner + '"/>';
      if (g.f) o += crew(5, 1.2, darken(inner, 0.15));
      else {
        o += vneck(6, -1.5);
        if (L.tie) o += tie(sy + 5, sy + 21);
        o += wings(inner, darken(inner, 0.16), 0.85);
      }
      const lap = P`M${cx - nw - 3} ${sy - 1.5}L${cx - nw - 9.5} ${sy + 8.5}L${cx - nw - 6.6} ${sy + 11}L${cx - nw - 9.8} ${sy + 13.4}L${cx - 0.4} ${sy + 25}Z`;
      o += sym('<path d="' + lap + '" fill="' + cL + '" stroke="' + cS + '" stroke-width="0.8" stroke-linejoin="round"/>');
      o += '<path d="' + P`M${cx} ${sy + 25}L${cx + 0.4} 142` + '" stroke="' + cS + '" stroke-width="0.9"/>' + P`<circle cx="${cx + 2.4}" cy="${sy + 30}" r="1.1" fill="${cS}"/>`;
      o += '<path d="' + P`M${cx + sw * 0.28} ${sy + 15}h10` + '" stroke="' + cS + '" stroke-width="1"/>';
    } else if (type === 'shirt') {
      back = collarBand(cS);
      o += vneck(7.5, -1.3);
      o += '<path d="' + P`M${cx} ${sy + 7}V142` + '" stroke="' + cS + '" stroke-width="0.9"/>';
      o += P`<circle cx="${cx + 1.4}" cy="${sy + 15}" r="0.9" fill="${cS}"/><circle cx="${cx + 1.4}" cy="${sy + 25}" r="0.9" fill="${cS}"/><circle cx="${cx + 1.4}" cy="${sy + 35}" r="0.9" fill="${cS}"/>`;
      o += wings(cL, cS, 1);
      o += '<path d="' + P`M${cx - sw * 0.5 - 5} ${sy + 17}h10v8.5q-5 2 -10 0z` + '" fill="none" stroke="' + cS + '" stroke-width="0.9"/>';
    } else if (type === 'sweater') {
      o += crew(7, 3);
      if (L.collar) o += wings(shirt, shirtS, 0.7);
    } else if (type === 'tshirt') {
      o += crew(8.5, 1.8);
      o += sym('<path d="' + P`M${cx - sw + sh * 0.34} ${sy + 4}Q${cx - sw + sh * 0.22} ${sy + 18} ${cx - sw + 3} ${sy + 30}` + '" fill="none" stroke="' + cS + '" stroke-width="0.9" opacity=".8"/>');
    } else if (type === 'hoodie') {
      back = '<path d="' + P`M${cx - nw - 11} ${sy + 5}C${cx - nw - 10} ${sy - 10} ${cx + nw + 10} ${sy - 10} ${cx + nw + 11} ${sy + 5}Z` + '" fill="' + cS + '"/>';
      o += crew(5, 1.4);
      o += '<path d="' + P`M${cx - nw - 8} ${sy - 1}Q${cx} ${sy + 15} ${cx + nw + 8} ${sy - 1}` + '" fill="none" stroke="' + cL + '" stroke-width="4.6" stroke-linecap="round"/>';
      o += '<path d="' + P`M${cx - nw - 8} ${sy - 1}Q${cx} ${sy + 15} ${cx + nw + 8} ${sy - 1}` + '" fill="none" stroke="' + cS + '" stroke-width="0.8" transform="translate(0 2.4)" opacity=".7"/>';
      o += '<path d="' + P`M${cx - 3.6} ${sy + 8}l-0.8 13M${cx + 3.6} ${sy + 8}l0.6 11` + '" stroke="#EEECE6" stroke-width="1.2" stroke-linecap="round"/>';
      o += P`<rect x="${cx - 5.4}" y="${sy + 20.4}" width="2" height="3" rx="0.6" fill="#D8D4CC"/><rect x="${cx + 3.2}" y="${sy + 18.4}" width="2" height="3" rx="0.6" fill="#D8D4CC"/>`;
      o += '<path d="' + P`M${cx - 15} 142L${cx - 12} ${128}H${cx + 12}L${cx + 15} 142` + '" fill="none" stroke="' + cS + '" stroke-width="1"/>';
    } else if (type === 'gown') {
      const pid = C.id + 'st';
      const stripe = lighten(c, 0.35);
      const pip = darken(c, 0.28);
      back = '';
      o += '<pattern id="' + pid + '" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M1.2 0v5" stroke="' + stripe + '" stroke-width="1.5"/></pattern>';
      o += '<path d="' + torso + '" fill="url(#' + pid + ')"/>';
      o += vneck(14, 1.5);
      o += '<path d="' + P`M${cx - nw - 2.4} ${sy - 2}L${cx} ${sy + 15.4}L${cx + nw + 2.4} ${sy - 2}` + '" fill="none" stroke="' + pip + '" stroke-width="2.2" stroke-linejoin="round"/>';
      o += '<path d="' + P`M${cx} ${sy + 15.4}V142` + '" stroke="' + pip + '" stroke-width="1"/>';
      o += P`<circle cx="${cx + 2}" cy="${sy + 22}" r="1" fill="${pip}"/><circle cx="${cx + 2}" cy="${sy + 31}" r="1" fill="${pip}"/>`;
      o += '<path d="' + P`M${cx - sw * 0.5 - 5} ${sy + 18}h10v8h-10z` + '" fill="' + c + '" stroke="' + pip + '" stroke-width="1"/>';
    } else if (type === 'scrubs') {
      o += vneck(12, 1.5);
      o += '<path d="' + P`M${cx - nw - 2.6} ${sy - 2}L${cx} ${sy + 13.6}L${cx + nw + 2.6} ${sy - 2}` + '" fill="none" stroke="' + cS + '" stroke-width="2.4" stroke-linejoin="round"/>';
      const px = cx - sw * 0.5;
      o += '<path d="' + P`M${px - 6} ${sy + 16}h12v9q-6 1.5 -12 0z` + '" fill="' + cL + '" stroke="' + cS + '" stroke-width="0.9"/>' + pen(px - 2.6, sy + 10.6);
    } else if (type === 'cardigan') {
      const inner = lighten(mix(c, '#EFE9DD', 0.75), 0.15);
      o = '<path d="' + torso + '" fill="' + inner + '"/>';
      o += crew(6, 1.4, darken(inner, 0.14));
      const panel = halfL + P`C${cx - nw - 1} ${sy + 8} ${cx - 8} ${sy + 18} ${cx - 7.5} 142Z`;
      o += sym('<path d="' + panel + '" fill="' + c + '"/><path d="' + P`M${cx - nw - 2.5} ${sy - 1.5}C${cx - nw - 1} ${sy + 8} ${cx - 8} ${sy + 18} ${cx - 7.5} 142` + '" fill="none" stroke="' + cS + '" stroke-width="2"/>');
      o += P`<circle cx="${cx - 9.6}" cy="${sy + 26}" r="1.2" fill="${cS}"/><circle cx="${cx - 9.8}" cy="${sy + 35}" r="1.2" fill="${cS}"/>`;
    }
    return { back, front: o + shade, defs };
  }

  /* ---------- Борода, щетина, усы ---------- */
  function beardSvg(g, L, C) {
    const { cx, hw, jw, jy, chin, mouthY: my, mouthW: mw, noseY, eyeY } = g;
    const out = { under: '', over: '' };
    const H = C.beard;
    const mustache = (thick) =>
      '<path d="' + P`M${cx} ${noseY + 2.4}C${cx - 3} ${noseY + 1.4} ${cx - mw - 1.6} ${noseY + 2.4 - thick * 0.3} ${cx - mw - 2.6} ${my + 0.8}C${cx - mw} ${my - 0.4} ${cx - 3} ${my - 1.1} ${cx} ${my - 0.7}C${cx + 3} ${my - 1.1} ${cx + mw} ${my - 0.4} ${cx + mw + 2.6} ${my + 0.8}C${cx + mw + 1.6} ${noseY + 2.4 - thick * 0.3} ${cx + 3} ${noseY + 1.4} ${cx} ${noseY + 2.4}Z` + '" fill="' + H + '"/>';
    const region = (top, ext, full) =>
      P`M${cx - hw - 0.5} ${eyeY + top}C${cx - hw + 0.4} ${jy - 2} ${cx - jw - (full ? 2.5 : 1)} ${jy + 3 + ext * 0.3} ${cx - 8} ${chin + ext * 0.6}Q${cx} ${chin + ext + 1.5} ${cx + 8} ${chin + ext * 0.6}C${cx + jw + (full ? 2.5 : 1)} ${jy + 3 + ext * 0.3} ${cx + hw - 0.4} ${jy - 2} ${cx + hw + 0.5} ${eyeY + top}` +
      P`L${cx + hw - 2.5} ${eyeY + top + (full ? 2 : 3)}Q${cx + hw - 6} ${my} ${cx + mw + 1.8} ${my + 1.6}Q${cx} ${my + 4.2} ${cx - mw - 1.8} ${my + 1.6}Q${cx - hw + 6} ${my} ${cx - hw + 2.5} ${eyeY + top + (full ? 2 : 3)}Z`;
    if (L.beard === 'short' || L.beard === 'full') {
      const full = L.beard === 'full';
      out.under = '<path d="' + region(full ? 6 : 8, full ? 7 : 2.5, full) + '" fill="' + H + '"/>' + '<path d="' + P`M${cx - 5} ${chin + (full ? 4 : 1)}q5 2 10 0` + '" fill="none" stroke="' + C.hairS + '" stroke-width="0.9" opacity=".6"/>';
      out.over = mustache(full ? 2 : 1);
    } else if (L.beard === 'mustache') {
      out.over = mustache(2);
    } else if (L.stubble) {
      out.under = '<path d="' + region(8, 0, false) + P`M${cx - mw - 2} ${my - 0.5}C${cx - mw} ${noseY + 3} ${cx + mw} ${noseY + 3} ${cx + mw + 2} ${my - 0.5}Q${cx} ${my - 1.6} ${cx - mw - 2} ${my - 0.5}Z` + '" fill="' + H + '" opacity=".2"/>';
    }
    return out;
  }

  /* ---------- Портрет ---------- */
  let uid = 0;
  ART.portrait = function (look, emotion, opts) {
    look = look && typeof look === 'object' ? look : {};
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : hashStr(JSON.stringify(look));
    const base = ART.randomLook(seed, { sex: look.sex, age: look.age });
    const L = {};
    for (const k in base) L[k] = look[k] === undefined ? base[k] : look[k];
    L.face = Object.assign({}, base.face, look.face || {});
    L.age = clamp(Number(L.age) || 30, 1, 110);
    if (L.sex !== 'f') L.sex = 'm';
    const E = EMO[emotion] || EMO.neutral;
    const g = geometry(L);
    g.face = L.face;
    const id = 'p' + (++uid).toString(36) + (seedNum(seed) % 1296).toString(36) + '-';

    // Цвета
    const skin = typeof L.skin === 'string' ? color(L.skin, SKIN[1]) : SKIN[clamp(Math.round(Number(L.skin) || 0), 0, 5)];
    const shade = mix(skin, '#5A2620', 0.2);
    const hair = color(L.hairColor, HAIR.brown);
    const style = HAIRS.indexOf(L.hair) >= 0 ? L.hair : 'short';
    const C = {
      id, skin, shade,
      deep: mix(skin, '#3A140E', 0.36),
      light: lighten(skin, 0.35),
      neck: mix(skin, '#5A2620', 0.12),
      lid: mix(skin, '#5A2620', 0.1),
      hair, hairS: darken(hair, lum(hair) > 0.6 ? 0.2 : 0.3), hairH: lighten(hair, 0.28),
      brow: lum(hair) > 0.55 ? mix(hair, '#4B3A30', g.kid ? 0.25 : 0.4) : hair,
      lash: mix(hair, '#1C1416', 0.78),
      beard: lum(hair) > 0.6 ? darken(hair, 0.06) : lighten(hair, 0.04),
      iris: color(L.eyeColor, IRIS.brown),
      lipLine: mix(skin, '#3E1216', 0.6),
      lip: mix(skin, '#B5474B', 0.32),
      cloth: color(L.clothesColor, L.clothes === 'scrubs' ? '#5E9E96' : L.clothes === 'gown' ? '#9FBBC8' : CLOTH[1]),
      shirt: L.clothes === 'coat' && look.clothesColor ? color(look.clothesColor, SHIRT[0]) : color(L.shirtColor, SHIRT[0]),
      tie: '#7A2F3B',
      scarf: color(L.scarfColor, SCARF[0]),
      frame: color(L.frameColor, FRAMES[0]),
      accent: '#E07A5F',
    };
    if (L.clothes === 'scrubs' && !look.clothesColor) C.cloth = '#5E9E96';
    if (L.clothes === 'gown' && !look.clothesColor) C.cloth = '#9FBBC8';
    if (L.clothes === 'coat') C.tie = darken(C.cloth, 0.1);

    const defs = [];
    const bg = BG[clamp(Math.floor(Number(L.bg) || 0), 0, BG.length - 1)];
    defs.push('<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient>');
    defs.push('<clipPath id="' + id + 'c"><rect width="120" height="140" rx="12"/></clipPath>');
    const face = facePath(g);
    defs.push('<clipPath id="' + id + 'f"><path d="' + face + '"/></clipPath>');

    const Hs = hairShape(style, g, L, C, null);
    if (Hs.defs) defs.push(Hs.defs);
    const cl = clothesSvg(g, L, C);
    defs.push(cl.defs);
    const ex = E.x || {};
    const tilt = ex.tilt || 0;
    const rot = tilt ? ' transform="rotate(' + tilt + ' 60 ' + r1(g.jy + 8) + ')"' : '';
    const wrapM = (s) => (Hs.mirror ? MIRROR + s + '</g>' : s);
    const hairFill = Hs.buzz ? mix(hair, skin, 0.32) : hair;

    let s = '<g clip-path="url(#' + id + 'c)">';
    s += '<rect width="120" height="140" fill="url(#' + id + 'g)"/>';
    s += '<circle cx="60" cy="60" r="46" fill="#fff" opacity=".22"/>';
    // Волосы за головой
    if (Hs.back) s += '<g' + rot + '>' + wrapM(Hs.back.charAt(0) === '<' ? Hs.back : '<path d="' + Hs.back + '" fill="' + C.hairS + '"/>') + '</g>';
    // Шея
    s += cl.back;
    s += P`<path d="M${g.cx - g.nw} ${g.jy - 4}V${g.sy + 4}H${g.cx + g.nw}V${g.jy - 4}Z" fill="${C.neck}"/>`;
    s += '<path d="' + P`M${g.cx - g.nw} ${g.jy - 2}C${g.cx - g.nw} ${g.chin + 2} ${g.cx - 4} ${g.chin + 4.5} ${g.cx} ${g.chin + 4.5}C${g.cx + 4} ${g.chin + 4.5} ${g.cx + g.nw} ${g.chin + 2} ${g.cx + g.nw} ${g.jy - 2}Z` + '" fill="' + C.deep + '" opacity=".45"/>';
    // Тело и одежда
    s += cl.front;

    // Голова
    let h = '';
    if (Hs.mid) h += Hs.mid;
    if (!Hs.noEars) {
      for (const sd of [-1, 1]) {
        const x = g.cx + sd * (g.hw + 0.6);
        h += P`<ellipse cx="${x}" cy="${g.earY}" rx="3.7" ry="5.8" fill="${skin}"/><path d="M${x + sd * 1.3} ${g.earY - 3}q${sd * 1.2} 2.6 ${-sd * 0.2} 5.4" fill="none" stroke="${shade}" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
      }
    }
    h += '<path d="' + face + '" fill="' + shade + '"/>';
    h += '<path d="' + face + '" fill="' + skin + '" transform="translate(-2.4 -1.6)" clip-path="url(#' + id + 'f)"/>';
    h += '<g clip-path="url(#' + id + 'f)">';
    h += P`<ellipse cx="${g.cx - g.hw * 0.5}" cy="${g.eyeY + 7}" rx="4.4" ry="2.8" fill="${C.light}" opacity=".35"/>`;
    if (ex.flush) h += '<path d="' + face + '" fill="#E0503F" opacity=".12"/>';
    if (ex.pale) h += '<path d="' + face + '" fill="#BFD8E2" opacity=".28"/>';
    h += '</g>';

    // Возрастные черты
    const wr = g.kid || g.teen ? 0 : clamp((L.age - 46) / 26, 0, 1);
    const ws = (d, op, w) => '<path d="' + d + '" fill="none" stroke="' + C.deep + '" stroke-width="' + (w || 0.9) + '" stroke-linecap="round" opacity="' + r1(op * 100) / 100 + '"/>';
    if (wr > 0) {
      const { cx, browY, eyeY, noseY, mouthY, mouthW } = g;
      h += ws(P`M${cx - 4.6} ${noseY - 1}Q${cx - mouthW - 3.4} ${mouthY - 3} ${cx - mouthW - 2.6} ${mouthY + 2.6}M${cx + 4.6} ${noseY - 1}Q${cx + mouthW + 3.4} ${mouthY - 3} ${cx + mouthW + 2.6} ${mouthY + 2.6}`, 0.25 + wr * 0.35, 1);
      h += ws(P`M${cx - 8} ${browY - 6}Q${cx} ${browY - 7.4} ${cx + 8} ${browY - 6}M${cx - 6} ${browY - 9.4}Q${cx} ${browY - 10.6} ${cx + 6} ${browY - 9.4}`, 0.15 + wr * 0.3, 0.8);
      for (const sd of [-1, 1]) {
        const xo = cx + sd * (g.eyeDx + g.eyeW);
        h += ws(P`M${xo + sd * 1.5} ${eyeY - 0.4}l${sd * 2.2} -1M${xo + sd * 1.4} ${eyeY + 1.2}l${sd * 2.2} 1`, 0.2 + wr * 0.35, 0.7);
      }
      if (L.age >= 64) h += ws(P`M${cx - mouthW - 2} ${mouthY + 3}q0.6 3 -0.4 5.5M${cx + mouthW + 2} ${mouthY + 3}q-0.6 3 0.4 5.5`, 0.3, 0.8);
    }
    if (L.face.freckles) {
      let fr = '';
      const pts = [[-9, 9], [-12, 8], [-10.5, 11], [-6.5, 10], [9, 9], [12, 8], [10.5, 11], [6.5, 10], [-2, 6.5], [2, 6.5]];
      for (const p of pts) fr += P`<circle cx="${g.cx + p[0]}" cy="${g.eyeY + p[1]}" r="0.55"/>`;
      h += '<g fill="' + C.deep + '" opacity=".4">' + fr + '</g>';
    }
    const blush = ex.blush || (g.kid ? 0.18 : 0) || (ex.flush ? 0 : 0);
    if (blush || ex.flush) {
      const op = ex.flush ? 0.42 : blush;
      const bc = ex.flush ? '#D9493A' : '#EF7F70';
      h += P`<ellipse cx="${g.cx - g.eyeDx - 2}" cy="${g.eyeY + 8.4}" rx="4.4" ry="2.5" fill="${bc}" opacity="${op}"/><ellipse cx="${g.cx + g.eyeDx + 2}" cy="${g.eyeY + 8.4}" rx="4.4" ry="2.5" fill="${bc}" opacity="${op}"/>`;
    }

    // Нос
    {
      const { cx, noseY, noseW: nw } = g;
      if (!g.kid) h += ws(P`M${cx + 1.6} ${g.eyeY + 1.6}Q${cx + 3.4} ${noseY - 4.5} ${cx + nw * 0.85} ${noseY - 0.8}`, 0.35, 1);
      h += '<path d="' + P`M${cx - nw} ${noseY - 0.6}Q${cx - nw - 0.6} ${noseY + 1.6} ${cx - nw * 0.4} ${noseY + 1.4}Q${cx} ${noseY + 2.5} ${cx + nw * 0.4} ${noseY + 1.4}Q${cx + nw + 0.6} ${noseY + 1.6} ${cx + nw} ${noseY - 0.6}` + '" fill="none" stroke="' + C.deep + '" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>';
      h += P`<ellipse cx="${cx - 0.5}" cy="${noseY - 1}" rx="1.4" ry="1" fill="${C.light}" opacity=".5"/>`;
    }

    // Глаза, брови
    const eyeDefs = [];
    let bagsS = '';
    for (const sd of [-1, 1]) {
      const p = Object.assign({}, E.e || {}, (sd < 0 ? E.eL : E.eR) || {});
      const ey = eyeSvg(g, sd, p, C, eyeDefs);
      h += ey.svg;
      const bags = ex.bags || (L.age >= 58 ? 0.35 : 0);
      if (bags) {
        bagsS += ws(P`M${ey.xi + sd * 0.6} ${ey.ey + ey.lo + 1.6}Q${ey.ex} ${ey.ey + ey.lo + 3.8} ${ey.xo - sd * 0.4} ${ey.oy + ey.lo + 0.9}`, 0.25 + bags * 0.35, 0.9);
        if (bags >= 0.6) bagsS += P`<path d="M${ey.xi + sd * 0.6} ${ey.ey + ey.lo + 0.9}Q${ey.ex} ${ey.ey + ey.lo + 4} ${ey.xo - sd * 0.4} ${ey.oy + ey.lo + 0.4}Q${ey.ex} ${ey.ey + ey.lo + 1.8} ${ey.xi + sd * 0.6} ${ey.ey + ey.lo + 0.9}Z" fill="#6E4A6A" opacity="${0.12 + bags * 0.1}"/>`;
      }
    }
    defs.push.apply(defs, eyeDefs);
    h += bagsS;
    h += browSvg(g, -1, E.bL || E.b, E.bx, E.bt, C) + browSvg(g, 1, E.bR || E.b, E.bx, E.bt, C);
    if (ex.furrow) h += ws(P`M${g.cx - 1.7} ${g.browY + 0.4}l0.6 3.2M${g.cx + 1.7} ${g.browY + 0.4}l-0.6 3.2`, 0.4 + ex.furrow * 0.3, 0.9);
    if (ex.worry) h += ws(P`M${g.cx - 5} ${g.browY - 4.6}Q${g.cx} ${g.browY - 6.4} ${g.cx + 5} ${g.browY - 4.6}`, 0.45, 0.9);

    // Борода и рот
    const bd = beardSvg(g, L, C);
    h += bd.under;
    const mDefs = [];
    h += mouthSvg(g, E.m, C, mDefs);
    defs.push.apply(defs, mDefs);
    h += bd.over;

    // Волосы спереди: тень на лбу, масса, завитки, штрихи
    if (Hs.front) {
      const fill = Hs.scarf ? C.scarf : hairFill;
      const join = Hs.join ? ' stroke="' + fill + '" stroke-width="0.6" stroke-linejoin="round"' : '';
      let hf = '';
      if (!Hs.bald && !Hs.scarf) hf += '<g clip-path="url(#' + id + 'f)"><path d="' + Hs.front + '" fill="' + C.deep + '" opacity=".3" transform="translate(0.6 1.8)"/></g>';
      hf += '<path d="' + Hs.front + '" fill="' + fill + '"' + join + '/>';
      if (Hs.bumps) hf += '<g fill="' + fill + '">' + Hs.bumps + '</g>';
      if (Hs.buzz) hf += '<path d="' + Hs.front + '" fill="none" stroke="' + mix(hair, skin, 0.15) + '" stroke-width="0.8" opacity=".6"/>';
      hf += Hs.det || '';
      h += Hs.mirror && !Hs.scarf ? MIRROR + hf.replace('clip-path="url(#' + id + 'f)"', 'clip-path="url(#' + id + 'f)"') + '</g>' : hf;
      if (Hs.knot) h += Hs.knot;
    }

    // Очки
    if (L.glasses === 'round' || L.glasses === 'rect') {
      let fr = '';
      let gl = '';
      const fc = C.frame;
      const metal = fc === '#8E939A';
      for (const sd of [-1, 1]) {
        const x = g.cx + sd * g.eyeDx;
        const y = g.eyeY + 0.5;
        if (L.glasses === 'round') fr += P`<circle cx="${x}" cy="${y}" r="${g.eyeW + 2.4}"/>`;
        else fr += P`<rect x="${x - g.eyeW - 3}" y="${y - g.eyeH - 2.3}" width="${2 * g.eyeW + 6}" height="${2 * g.eyeH + 4.4}" rx="2.4"/>`;
        const ox = x + sd * (g.eyeW + (L.glasses === 'round' ? 2.4 : 3));
        fr += P`<path d="M${ox} ${y - 1.4}L${g.cx + sd * (g.hw + 0.2)} ${y - 2.2}"/>`;
        gl += P`M${x - 3.2} ${y - 1.4}l2.6 -2.6M${x - 1.6} ${y + 1}l4 -4`;
      }
      const gap = g.eyeDx - g.eyeW - (L.glasses === 'round' ? 2.4 : 3);
      fr += P`<path d="M${g.cx - gap} ${g.eyeY - 0.4}Q${g.cx} ${g.eyeY - 2.4} ${g.cx + gap} ${g.eyeY - 0.4}"/>`;
      h += '<g fill="#fff" fill-opacity=".14" stroke="' + fc + '" stroke-width="' + (metal ? 1.1 : 1.5) + '">' + fr + '</g>';
      h += '<path d="' + gl + '" stroke="#fff" stroke-width="0.9" stroke-linecap="round" opacity=".55"/>';
    }

    s += '<g' + rot + '>' + h + '</g>';

    // Аксессуары
    const acc = L.accessory;
    if (acc === 'earrings' && style !== 'kerchief') {
      const ox = Hs.noEars ? g.hw - 0.4 : g.hw + 0.9;
      s += '<g' + rot + '>' + P`<circle cx="${g.cx - ox}" cy="${g.earY + 6.2}" r="1.4" fill="#E9B949" stroke="#A97F22" stroke-width="0.5"/><circle cx="${g.cx + ox}" cy="${g.earY + 6.2}" r="1.4" fill="#E9B949" stroke="#A97F22" stroke-width="0.5"/>` + '</g>';
    } else if (acc === 'brooch') {
      const bx = g.cx + (L.clothes === 'coat' || L.clothes === 'blazer' ? g.nw + 7 : g.sw * 0.34);
      const by = g.sy + (L.clothes === 'coat' || L.clothes === 'blazer' ? 7 : 13);
      s += P`<ellipse cx="${bx}" cy="${by}" rx="3.2" ry="2.6" fill="#E9B949" stroke="#A97F22" stroke-width="0.7"/><circle cx="${bx}" cy="${by}" r="1.3" fill="#E07A5F"/>`;
    }
    // Капля пота
    if (ex.sweat) {
      const x = g.cx + g.hw - 3.6;
      const y = g.browY - 1.6;
      s += '<g' + rot + '><path d="' + P`M${x} ${y - 5}C${x + 1.4} ${y - 2.6} ${x + 3} ${y - 0.8} ${x + 3} ${y + 1}A3 3 0 0 1 ${x - 3} ${y + 1}C${x - 3} ${y - 0.8} ${x - 1.4} ${y - 2.6} ${x} ${y - 5}Z` + '" fill="#D2EEF8" stroke="#4F93B4" stroke-width="0.9" stroke-linejoin="round"/>' + P`<path d="M${x - 1.4} ${y + 0.4}q0 1.4 1.2 1.8" fill="none" stroke="#fff" stroke-width="0.9" stroke-linecap="round"/>` + '</g>';
    }
    s += '</g>';
    return '<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Портрет"><defs>' + defs.join('') + '</defs>' + s + '</svg>';
  };
})((window.A = window.A || {}));
