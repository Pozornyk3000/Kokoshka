/* Анамнез — иллюстрации сцен, часть B: больница и медцентры.
   ward — коридор отделения, er — приёмное отделение, night — ночное дежурство,
   private — кабинет частной клиники, commission — коридор медкомиссии.
   Общие помощники и стиль — в scenes.js (A.art._kit). */
(function (A) {
  'use strict';
  const K = A.art && A.art._kit;
  if (!K) return;
  const { SC, NAMES, P, f, rr, pk, dk, lt, mix, INK, MINT, MINTD, CREAM, CORAL, MUSTARD, COAT, WOODD, SKIN, HAIRC, R, RR, E, C, PA, PG, SK, TX, G, O, T, LN, sh, lin, rad, glow, clip, pattern, lampOn, LGT, sky, win, sunPatch, curtain, rod, radiator, wall, floor, deskLamp, floorLamp, fluoro, bookcase, books, flushBooks, leafD, plant, mug, clockFace, SLOT_HM, framed, diploma, person } = K;

  /* ---------- Одноточечная перспектива ----------
     X — поперёк (м), Y — вверх от пола (м), Z — вглубь (м). (vx, vy) — точка схода, eye — высота глаз, cx — смещение камеры. */
  function persp(vx, vy, eye, cx, F, z0) {
    const q = (Z) => F / (Z + z0);
    const p = (X, Y, Z) => {
      const k = q(Z);
      return [vx + (X - cx) * k, vy - (Y - eye) * k];
    };
    p.q = q;
    /** Полигон по 3D-точкам. */
    p.poly = (pts, fill, e) => PG(pts.map((a) => p(a[0], a[1], a[2])), fill, e);
    /** Прямоугольник на боковой стене X = const. */
    p.wall = (X, y0, y1, z0, z1, fill, e) => p.poly([[X, y0, z0], [X, y0, z1], [X, y1, z1], [X, y1, z0]], fill, e);
    /** Прямоугольник на горизонтали Y = const (пол, потолок, столешница). */
    p.flat = (Y, x0, x1, z0, z1, fill, e) => p.poly([[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], fill, e);
    /** Прямоугольник лицом к зрителю, Z = const. */
    p.front = (Z, x0, x1, y0, y1, fill, e) => p.poly([[x0, y0, Z], [x1, y0, Z], [x1, y1, Z], [x0, y1, Z]], fill, e);
    return p;
  }

  /** Полоски на пижаме поверх фигуры person (стоя, без халата). */
  function pajama(x, y, s, col, flip) {
    return G(SK('M-6.5 -44.5v20M-2.2 -46v21.5M2.2 -46v21.5M6.5 -44.5v20M-4.8 -25v23M-2.4 -25v23M2.4 -25v23M4.8 -25v23', col, 0.9, O(0.55)), T(x, y, s, flip));
  }

  /* ======================================================================
     Коридор отделения
     ====================================================================== */
  NAMES.ward = 'Отделение, коридор';
  SC.ward = function (c) {
    c.indoor = true;
    const p = persp(176, 100, 1.55, -0.3, 400, 2);
    const q = p.q;
    const XL = -1.35;
    const XR = 1.35;
    const HT = 3;
    const ZF = 16;
    const PL = 1.4;
    const LOW = '#A3CBB9';
    const UP = '#F2F0E8';
    const night = c.slot === 3;
    const fv = p(0, 0, ZF);
    let s = '';
    // потолок, пол, торцевая стена
    s += p.flat(HT, XL, XR, 0, ZF, lin(c, [[0, '#C9CDC9'], [1, '#E8E7E1']], [0, -20, 0, 70], true));
    s += p.flat(0, XL, XR, 0.6, ZF, lin(c, [[0, '#D6C6A8'], [0.35, '#C1A985'], [1, '#9C8160']], [0, fv[1], 0, 225], true));
    const fl = p(XL, 0, ZF);
    const fr = p(XR, HT, ZF);
    s += R(fl[0], fr[1], fr[0] - fl[0], fl[1] - fr[1], UP);
    const pz = p(XL, PL, ZF);
    s += R(fl[0], pz[1], fr[0] - fl[0], fl[1] - pz[1], LOW);
    // окно в торце: небо по времени суток
    const w0 = p(-0.72, 2.75, ZF);
    const w1 = p(0.72, 0.85, ZF);
    s += win(c, w0[0], w0[1], w1[0] - w0[0], w1[1] - w0[1], { view: 'trees', frame: '#F7F6F1', ft: 1.3, reveal: false, sill: false, v: [0.5], h: [0.36] });
    s += R(w0[0] - 1.5, w1[1], w1[0] - w0[0] + 3, 1.6, '#F7F6F1');
    // стены: низ мятный, верх белый; к зрителю темнее
    const shadeL = (col) => lin(c, [[0, dk(col, 0.16)], [1, lt(col, 0.06)]], [0, 0, fl[0], 0], true);
    const shadeR = (col) => lin(c, [[0, lt(col, 0.06)], [1, dk(col, 0.1)]], [fr[0], 0, 400, 0], true);
    s += p.wall(XL, 0, PL, 0, ZF, shadeL(LOW)) + p.wall(XL, PL, HT, 0, ZF, shadeL(UP));
    s += p.wall(XR, 0, PL, 0, ZF, shadeR(LOW)) + p.wall(XR, PL, HT, 0, ZF, shadeR(UP));
    // плинтус и полоса по краю краски
    s += p.wall(XL, 0, 0.12, 0, ZF, '#6F927F') + p.wall(XR, 0, 0.12, 0, ZF, '#6F927F');
    s += p.wall(XL, PL - 0.03, PL + 0.03, 0, ZF, '#7FA593') + p.wall(XR, PL - 0.03, PL + 0.03, 0, ZF, '#7FA593');
    s += R(fl[0], fl[1] - 0.12 * q(ZF), fr[0] - fl[0], 0.12 * q(ZF), '#6F927F') + R(fl[0], pz[1] - 0.7, fr[0] - fl[0], 1.4, '#7FA593');
    // двери палат
    const base = 10 + 2 * Math.floor(c.r() * 6);
    const doors = [
      { X: XL, z: 1.2, w: 1.25, n: base },
      { X: XL, z: 6.6, w: 1.1, n: base + 2 },
      { X: XL, z: 11, w: 1.1, n: base + 4 },
      { X: XR, z: 7.4, w: 1.1, n: base + 1 },
      { X: XR, z: 11.6, w: 1.1, n: base + 3 },
    ];
    const litDoor = Math.floor(c.r() * 4) + 1;
    let signs = [];
    doors.forEach((d, i) => {
      const a = d.z;
      const b = d.z + d.w;
      const left = d.X < 0;
      s += p.wall(d.X, 0, 2.22, a - 0.1, b + 0.1, '#C3CFCA');
      s += p.wall(d.X, 0, 2.1, a, b, left ? '#E6EBE7' : '#EEF2EF');
      s += p.wall(d.X, 0.04, 0.34, a + 0.04, b - 0.04, '#C7CDCF');
      const lit = c.dark && i === litDoor;
      s += p.wall(d.X, 1.22, 1.86, a + 0.28, b - 0.28, lit ? '#F2C980' : c.dark ? '#3D4A63' : '#BCD0DA');
      if (!c.dark) s += p.poly([[d.X, 1.86, a + 0.28], [d.X, 1.86, a + 0.5], [d.X, 1.22, a + 0.4], [d.X, 1.22, a + 0.28]], '#FFFFFF', O(0.5));
      if (lit) c.lights.push(p.wall(d.X, 1.22, 1.86, a + 0.28, b - 0.28, '#FFD796', O(0.9)) + glow(c, p(d.X, 1.5, a + d.w / 2)[0], p(d.X, 1.5, a + d.w / 2)[1], 0.9 * q(a), 0.8 * q(a), '#FFC870', 0.35));
      s += p.wall(d.X, 0.93, 1.0, b - 0.2, b - 0.06, '#8A9298');
      signs.push({ X: d.X, z: a - 0.04, n: d.n, left: left });
    });
    // поручни вдоль стен
    const rail = (X, zs) => {
      let r = '';
      for (let i = 0; i < zs.length; i += 2) r += p.wall(X, 0.9, 0.97, zs[i], zs[i + 1], '#C29A6B') + p.wall(X, 0.86, 0.9, zs[i], zs[i + 1], '#5E7C6E', O(0.35));
      return r;
    };
    s += rail(XL, [0, 1.06, 2.6, 6.46, 7.86, 10.86, 12.26, ZF]);
    s += rail(XR, [5.9, 7.26, 8.66, 11.46, 12.86, ZF]);
    // стенд на посту
    s += p.wall(XR, 1.62, 2.28, 2.9, 5.2, '#B98A5E') + p.wall(XR, 1.66, 2.24, 2.98, 5.12, '#D9B98A');
    [[3.1, 3.6, 1.9, 2.18, '#FBF8F0'], [3.75, 4.3, 1.74, 2.12, '#F3E7C9'], [4.45, 4.95, 1.82, 2.16, '#FBF8F0'], [3.3, 3.9, 1.7, 1.86, '#E07A5F']].forEach((a) => (s += p.wall(XR - 0.01, a[2], a[3], a[0], a[1], a[4])));
    // потолочные лампы
    const lampZ = [3.4, 6.6, 9.8, 13];
    lampZ.forEach((z, i) => {
      const on = night ? i % 2 === 1 : true;
      s += p.flat(HT, -0.36, 0.36, z, z + 1.3, '#D5D9DA') + p.front(z, -0.36, 0.36, HT - 0.07, HT, '#BFC5C8');
      s += p.flat(HT - 0.07, -0.3, 0.3, z + 0.06, z + 1.24, on ? '#FFFFFF' : '#C3C9CE');
      if (on) {
        const m = p(0, HT - 0.07, z + 0.65);
        const k = q(z + 0.65);
        const a = c.dark ? (night ? 0.5 : 0.42) : 0.26;
        const g = p(0, 0, z + 0.65);
        c.lights.push(
          glow(c, m[0], m[1] + k * 0.25, k * 1.9, k * 0.9, '#EAF4FF', a) +
            p.flat(HT - 0.07, -0.3, 0.3, z + 0.06, z + 1.24, '#FFFFFF') +
            glow(c, g[0], g[1], k * 1.35, k * 0.42, '#F1F7FF', a * 0.7)
        );
      }
    });
    // блики на линолеуме: отражение окна и продольная полоса
    const r0 = p(0, -1.7, ZF);
    s += E(r0[0], r0[1], 0.72 * q(ZF), 1.05 * q(ZF), rad(c, [[0, '#FFFFFF', c.dark ? 0.12 : 0.38], [0.6, '#FFFFFF', c.dark ? 0.05 : 0.16], [1, '#FFFFFF', 0]]));
    s += p.poly([[-0.34, 0, ZF], [0.34, 0, ZF], [0.6, 0, 2.2], [-0.6, 0, 2.2]], lin(c, [[0, '#FFFFFF', 0.22], [1, '#FFFFFF', 0]], [0, fv[1], 0, 225], true));
    let seams = '';
    for (let z = 2.5; z < ZF; z += 1.5) {
      const a = p(XL, 0, z);
      const b = p(XR, 0, z);
      seams += P`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
    }
    [-0.45, 0.45].forEach((x) => {
      const a = p(x, 0, ZF);
      const b = p(x, 0, 1.6);
      seams += P`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
    });
    s += SK(seams, '#7D6448', 0.5, O(0.35));
    // пациент с капельницей вдали
    {
      const z = 11.2;
      const k = q(z);
      const sc = k / 37.6;
      const pp = p(0.42, 0, z);
      const ip = p(0.78, 0, z);
      s += SK(P`M${ip[0]} ${ip[1] - 1}V${ip[1] - 1.95 * k}M${ip[0] - 4 * sc} ${ip[1] - 1.95 * k}h${8 * sc}M${ip[0] - 4 * sc} ${ip[1]}h${8 * sc}`, '#8F989E', 0.9);
      s += RR(ip[0] - 4.2 * sc, ip[1] - 1.92 * k, 4 * sc, 7 * sc, 1, '#E3F0F4', O(0.9)) + SK(P`M${ip[0] - 2.2 * sc} ${ip[1] - 1.92 * k + 7 * sc}Q${ip[0] - 6 * sc} ${ip[1] - 1.2 * k} ${pp[0] + 8 * sc} ${pp[1] - 1.1 * k}`, '#E3F0F4', 0.5, O(0.8));
      const pj = '#A9C2DA';
      s += person(c, pp[0], pp[1], { s: sc, back: true, top: pj, pants: pj, style: 'short', hair: '#8D8883', skin: SKIN[1] });
      s += pajama(pp[0], pp[1], sc, '#6F8FB3');
    }
    // скамья у левой стены
    {
      const z0 = 3.2;
      const z1 = 5.5;
      const x0 = XL;
      const x1 = XL + 0.42;
      s += p.poly([[x0, 0.01, z0 + 0.1], [x1, 0.01, z0 + 0.1], [x1, 0.01, z1], [x0, 0.01, z1]], INK, O(0.12));
      let legs = '';
      [z0 + 0.12, z1 - 0.12].forEach((z) => {
        const a = p(x1 - 0.04, 0.45, z);
        const b = p(x1 - 0.04, 0, z);
        legs += P`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
      });
      s += SK(legs, '#5A6270', 1.6);
      s += p.wall(x0 + 0.02, 0.55, 0.88, z0, z1, '#B98A5E') + p.wall(x0 + 0.02, 0.7, 0.73, z0, z1, '#8A5A36', O(0.5));
      s += p.flat(0.45, x0, x1, z0, z1, '#C99A68') + p.wall(x1, 0.4, 0.45, z0, z1, '#8A5A36') + p.front(z0, x0, x1, 0.4, 0.45, '#9C6B44');
      // газета на скамье
      s += p.flat(0.455, x0 + 0.08, x0 + 0.34, z0 + 0.7, z0 + 1.1, '#F1EEE6') + p.flat(0.46, x0 + 0.12, x0 + 0.3, z0 + 0.78, z0 + 0.86, '#9AA0AA');
    }
    // пост медсестры: стойка у правой стены
    {
      const z0 = 2.5;
      const z1 = 5.9;
      const x0 = 0.5;
      const top = 1.08;
      const pc = '#E9E5DA';
      const xi = x0 + 0.36;
      const zn = z0 + 0.4;
      // внутренний стол поста
      s += p.flat(0.78, xi, XR, zn, z1, '#CFC6B4') + p.front(z1, xi, XR, 0.7, 0.78, '#B7AD99');
      // медсестра за стойкой (кроме ночи)
      if (!night) {
        const nz = 4.7;
        const ns = q(nz) / 37.6;
        const np = p(1.02, 0.22, nz);
        s += person(c, np[0], np[1], { s: ns, bust: true, coat: true, hands: 'table', style: 'short', hair: '#5E412E', skin: SKIN[0] });
        s += G(PA('M-6.6 -54.5Q-7 -62 0 -62.5Q7 -62 6.6 -54.5Z', '#FFFFFF') + R(-0.6, -60.4, 1.2, 3.6, CORAL) + R(-1.8, -59.2, 3.6, 1.2, CORAL), T(np[0], np[1], ns));
      }
      // стойка: ближний торец + бортик вдоль прохода
      s += p.front(z0, x0, XR, 0, top, '#DCD7CB') + p.front(z0, x0 + 0.08, XR - 0.08, 0.16, top - 0.1, '#E7E3D9');
      s += p.wall(x0, 0, top, z0, z1, lin(c, [[0, '#9CC3B2'], [1, '#B4D3C5']], [p(x0, 0, z0)[0], 0, p(x0, 0, z1)[0], 0], true));
      s += p.wall(x0, 0.16, top - 0.12, z0 + 0.15, z1 - 0.15, '#FFFFFF', O(0.16));
      s += p.wall(x0, 0, 0.1, z0, z1, '#6F927F') + p.front(z0, x0, XR, 0, 0.1, '#6F927F');
      s += p.flat(top, x0 - 0.06, xi, zn, z1, pc) + p.flat(top, x0 - 0.06, XR, z0 - 0.06, zn, pc);
      s += p.wall(x0 - 0.06, top - 0.05, top, z0 - 0.06, z1, '#C8C2B4') + p.front(z0 - 0.06, x0 - 0.06, XR, top - 0.05, top, '#BDB6A7') + p.front(z1, x0 - 0.06, xi, top - 0.05, top, '#BDB6A7');
      // на стойке: бумаги, телефон, папки
      s += p.flat(top + 0.002, x0, x0 + 0.3, z0 + 0.7, z0 + 1.15, '#FBFAF6') + p.flat(top + 0.004, x0 + 0.05, x0 + 0.25, z0 + 0.82, z0 + 0.86, '#9AA0AA');
      const ph = p(x0 + 0.15, top, z0 + 1.75);
      const ks = q(z0 + 1.75) / 60;
      s += RR(ph[0] - 7 * ks, ph[1] - 4 * ks, 14 * ks, 5 * ks, 1.5, '#3A3F4A') + RR(ph[0] - 8 * ks, ph[1] - 7 * ks, 16 * ks, 3.2 * ks, 1.5, '#2A2F3C');
      const fd = p(x0 + 0.14, top, z0 + 2.6);
      const fs = q(z0 + 2.6) / 60;
      s += R(fd[0] - 9 * fs, fd[1] - 3 * fs, 18 * fs, 3 * fs, '#5B7C99') + R(fd[0] - 8 * fs, fd[1] - 5.6 * fs, 16 * fs, 2.6 * fs, '#E9B949') + R(fd[0] - 9.5 * fs, fd[1] - 8 * fs, 17 * fs, 2.4 * fs, '#C8553D');
      const lp = p(XR - 0.3, top, z0 + 0.2);
      s += deskLamp(c, lp[0], lp[1], { s: q(z0 + 0.2) / 80, col: '#2F6B5A', on: c.dark });
      // огнетушитель у стены
      const ex = p(XR - 0.1, 0.5, 1.75);
      const es = q(1.75) / 100;
      s += G(RR(-6, -48, 12, 48, 5, '#C8453A') + R(-6, -30, 12, 10, '#F1E6D2') + R(-3, -55, 6, 8, '#2A2F3C') + SK('M3 -52q10 2 7 20', '#2A2F3C', 2) + R(-4.5, -44, 2.5, 36, '#FFFFFF', O(0.25)), T(ex[0], ex[1], es));
    }
    // таблички над дверями — перпендикулярно стене, от дальних к ближним
    signs.push({ X: XR, z: 2.42, n: 'ПОСТ', left: false });
    signs.sort((a, b) => b.z - a.z);
    signs.forEach((g) => {
      const x0 = g.left ? g.X : g.X - 0.46;
      const x1 = g.left ? g.X + 0.46 : g.X;
      const a = p(x0, 2.62, g.z);
      const b = p(x1, 2.3, g.z);
      const k = q(g.z);
      const wd = b[0] - a[0];
      const ht = b[1] - a[1];
      const txt = String(g.n);
      s += R(a[0], a[1], wd, ht, '#FFFFFF') + R(a[0], a[1] + ht * 0.78, wd, ht * 0.22, g.n === 'ПОСТ' ? CORAL : MINTD) + R(a[0], a[1], wd, ht, 'none', 'stroke="#AEB8B4" stroke-width="' + f(Math.max(0.3, k * 0.006)) + '"');
      s += TX(a[0] + wd / 2, a[1] + ht * 0.66, txt, f(Math.min(ht * 0.62, (wd * 1.5) / txt.length)), '#2F3B5C', 'font-weight="bold"');
    });
    if (lampOn(c) || c.slot === 0) {
      // мягкий отсвет окна в торце
      c.lights.push(glow(c, (w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2, 30, 26, c.slot === 0 ? '#FFD7A8' : '#9FB4E0', c.slot === 0 ? 0.35 : 0.22));
    }
    return s;
  };

  /* ======================================================================
     Приёмное отделение
     ====================================================================== */
  /** Каталка: x — левый край, gy — пол, w — длина. */
  function gurney(x, gy, w) {
    const mt = gy - 44;
    let s = sh(x + w / 2, gy, w * 0.55, 3, 0.2);
    let d = '';
    [x + 10, x + w - 10].forEach((wx) => (d += P`M${wx} ${mt + 8}V${gy - 6}`));
    d += P`M${x + 10} ${gy - 14}H${x + w - 10}M${x + 4} ${mt + 6}H${x + w - 4}`;
    s += SK(d, '#8D979E', 2.2);
    s += SK(P`M${x + 10} ${gy - 14}L${x + w * 0.5} ${mt + 8}L${x + w - 10} ${gy - 14}`, '#A7B0B6', 1.4);
    [x + 10, x + w - 10].forEach((wx) => (s += C(wx, gy - 3.5, 3.5, '#2A2F3C') + C(wx, gy - 3.5, 1.3, '#9AA3AE')));
    // поручни по бокам
    s += SK(P`M${x + 14} ${mt - 6}H${x + w - 22}M${x + 16} ${mt - 6}V${mt + 2}M${x + w - 24} ${mt - 6}V${mt + 2}`, '#B9C1C6', 1.6);
    // матрас, простыня, подушка, плед
    s += RR(x, mt, w, 7, 3, '#5D7F9C') + RR(x + 1, mt - 1, w - 2, 5, 2.5, '#F4F6F4') + R(x + 2, mt + 3, w - 4, 1, '#D5DEDC');
    s += PA(P`M${x + 3} ${mt - 1}Q${x + 2} ${mt - 9} ${x + 12} ${mt - 9}H${x + 22}Q${x + 28} ${mt - 8} ${x + 26} ${mt - 1}Z`, '#FFFFFF') + SK(P`M${x + 8} ${mt - 4}q6 -1.5 13 0`, '#D5DEDC', 0.8);
    s += PA(P`M${x + w * 0.52} ${mt - 1}V${mt - 4.5}Q${x + w * 0.52} ${mt - 6} ${x + w * 0.55} ${mt - 6}H${x + w - 6}Q${x + w - 3} ${mt - 6} ${x + w - 3} ${mt - 3}V${mt + 6}H${x + w * 0.52}Z`, '#7FAE9A') + SK(P`M${x + w * 0.62} ${mt - 6}V${mt + 6}M${x + w * 0.74} ${mt - 6}V${mt + 6}`, '#6A9886', 0.8);
    // штатив капельницы у изголовья
    s += SK(P`M${x + 6} ${mt + 6}V${mt - 46}M${x + 1} ${mt - 46}h10`, '#9AA3AE', 1.3) + RR(x + 7.5, mt - 45, 6, 10, 2, '#E3F0F4', O(0.9)) + R(x + 8.5, mt - 40, 4, 4, '#F2C9C2', O(0.8));
    return s;
  }
  /** Скорая помощь боком (вид через окно), (x, gy) — левый край, уровень колёс. */
  function ambulance(c, x, gy, s, flash) {
    let g = sh(36, 0, 38, 2.6, 0.25);
    g += PA('M0 -6V-34Q0 -37 3 -37H52L62 -24H70Q73 -24 73 -21V-6Z', '#F4F5F2');
    g += PA('M52 -35L60 -25H52Z', '#3B4A63') + R(4, -31, 10, 8, '#3B4A63') + R(17, -31, 10, 8, '#3B4A63');
    g += R(0, -20, 73, 4, '#D63D3A') + R(0, -14.6, 73, 1.4, '#D63D3A');
    g += C(37, -27, 4.8, '#FFFFFF') + R(36, -30.4, 2, 6.8, '#D63D3A') + R(33.6, -28, 6.8, 2, '#D63D3A');
    g += RR(16, -40, 22, 3.4, 1.4, flash ? '#9ED0FF' : '#5D8FC9');
    g += C(14, -5, 5.4, '#2A2F3C') + C(14, -5, 2, '#9AA3AE') + C(58, -5, 5.4, '#2A2F3C') + C(58, -5, 2, '#9AA3AE');
    g += R(70, -18, 3, 3, '#FFE7A8');
    return G(g, T(x, gy, s));
  }
  NAMES.er = 'Приёмное отделение';
  SC.er = function (c) {
    c.indoor = true;
    const fy = 172;
    const wallc = '#E4ECEC';
    const flash = c.dark;
    let s = wall(c, 0, fy, wallc);
    // нижняя часть стены — кафель
    s += R(0, 112, 400, fy - 112, pattern(c, 12, 9, R(0, 0, 12, 9, '#D3E3E3') + R(0, 8.4, 12, 0.6, '#B5C9C9') + R(11.4, 0, 0.6, 9, '#B5C9C9')));
    s += R(0, 110, 400, 3, '#5B7C99') + R(0, 113, 400, 1, INK, O(0.1));
    s += floor(c, fy, '#B8B6AC', { n: 18, gloss: true, base: '#6E8796' });
    // окно с жалюзи; на улице — скорая
    const wx = 22;
    const wy = 34;
    const ww = 96;
    const wh = 94;
    s += R(wx - 5, wy - 5, ww + 10, wh + 7, dk(wallc, 0.12));
    const cl = clip(c, R(wx, wy, ww, wh, '#000'));
    s += G(K.view(c, wx, wy, ww, wh, 'street') + ambulance(c, wx + 22, wy + wh - 5, 0.72, flash) + (c.slot < 2 ? PG([[wx + 18, wy], [wx + 40, wy], [wx + 12, wy + wh], [wx - 10, wy + wh]], '#FFFFFF', O(0.12)) : ''), cl);
    let bl = '';
    for (let yy = wy + 2; yy < wy + wh * 0.3; yy += 4) bl += P`M${wx} ${yy}h${ww}v2.6h${-ww}z`;
    s += PA(bl, '#EDEBE4', O(0.96)) + R(wx - 2, wy - 1, ww + 4, 3, '#DAD6CC') + LN(wx + ww * 0.82, wy, wx + ww * 0.82, wy + wh * 0.3 + 8, '#B9B4A8', 0.5);
    s += PA(P`M${wx + ww * 0.5 - 1.2} ${wy}h2.4v${wh}h-2.4zM${wx} ${wy + wh * 0.3 - 1.2}h${ww}v2.4h${-ww}z`, '#F4F1EA') + R(wx, wy, ww, wh, 'none', 'stroke="#F4F1EA" stroke-width="3"');
    s += R(wx - 8, wy + wh + 1.5, ww + 16, 4.5, '#F7F4EE') + R(wx - 8, wy + wh + 6, ww + 16, 2.5, INK, O(0.12));
    sunPatch(c, wx, ww, fy, 40);
    // потолочные лампы
    s += fluoro(c, 34, 0, 70) + fluoro(c, 172, 0, 76) + fluoro(c, 300, 0, 70);
    // вывеска над дверями
    const sx = 138;
    const sw = 144;
    s += R(sx + 6, 44, 1.4, 6, '#8D979E') + R(sx + sw - 7.4, 44, 1.4, 6, '#8D979E');
    s += RR(sx + 1, 51.5, sw, 20, 2, INK, O(0.15)) + RR(sx, 50, sw, 20, 2, '#C8453A') + RR(sx + 2, 52, sw - 4, 16, 1.5, 'none', 'stroke="#F6D9D2" stroke-width=".6"');
    s += C(sx + 12, 60, 6, '#FFFFFF') + R(sx + 10.8, 55.6, 2.4, 8.8, '#C8453A') + R(sx + 7.6, 58.8, 8.8, 2.4, '#C8453A');
    s += TX(sx + sw / 2 + 7, 63, 'ПРИЁМНОЕ ОТДЕЛЕНИЕ', 7.6, '#FFFFFF', 'font-weight="bold"');
    if (lampOn(c)) c.lights.push(glow(c, sx + sw / 2, 60, 110, 38, '#FF6A55', 0.24 * LGT(c)) + G(RR(sx, 50, sw, 20, 2, '#D9503F') + C(sx + 12, 60, 6, '#FFFFFF') + R(sx + 10.8, 55.6, 2.4, 8.8, '#C8453A') + R(sx + 7.6, 58.8, 8.8, 2.4, '#C8453A') + TX(sx + sw / 2 + 7, 63, 'ПРИЁМНОЕ ОТДЕЛЕНИЕ', 7.6, '#FFFFFF', 'font-weight="bold"'), O(c.night ? 0.8 : 0.6)));
    // двустворчатые двери с круглыми окошками
    const dx = 158;
    const dw = 104;
    const dy = 76;
    s += R(dx - 6, dy - 6, dw + 12, fy - dy + 6, '#9AA6AE') + R(dx - 3, dy - 3, dw + 6, fy - dy + 3, '#C3CCD1');
    s += R(dx, dy, dw, fy - dy, '#3E4A5C');
    [dx, dx + dw / 2 + 0.8].forEach((lx, i) => {
      const lw = dw / 2 - 0.8;
      s += R(lx, dy, lw, fy - dy, i ? '#E9EEEE' : '#E1E7E8') + R(lx, fy - 18, lw, 16, '#B9C2C7') + R(lx, fy - 18, lw, 1, '#FFFFFF', O(0.5));
      const ox = lx + lw / 2;
      const oy = dy + 28;
      s += C(ox, oy, 11, '#AEB8BE') + C(ox, oy, 9, lin(c, [[0, '#FFF8E4'], [1, '#E7EEF0']])) + PA(P`M${ox - 6} ${oy - 4}A7 7 0 0 1 ${ox + 2} ${oy - 7.4}L${ox + 3} ${oy - 5.6}A5 5 0 0 0 ${ox - 4.4} ${oy - 3}Z`, '#FFFFFF', O(0.8));
      if (lampOn(c)) c.lights.push(C(ox, oy, 9, '#FFF2C8', O(0.75)) + glow(c, ox, oy, 22, 22, '#FFE7B0', 0.3));
      s += R(i ? lx + 4 : lx + lw - 8, dy + 48, 4, 26, '#AEB8BE');
    });
    s += R(dx + dw / 2 - 0.8, dy, 1.6, fy - dy, '#2A2F3C');
    // антисептик и часы
    s += RR(272, 92, 9, 15, 2, '#F4F5F2') + R(273.5, 98, 6, 5, '#7FB0D6') + R(275.2, 107, 2.6, 2.4, '#8D979E');
    const hm = SLOT_HM[c.slot];
    s += clockFace(304, 38, 11, hm[0], hm[1]);
    // памятка на стене
    s += framed(338, 26, 46, 60, R(341, 29, 40, 54, '#FBFAF4') + R(345, 33, 32, 7, '#5B7C99') + SK('M346 46h30M346 51h26M346 56h28M346 61h20M346 66h27M346 71h22', '#9AA0AA', 1.2) + C(370, 76, 4, CORAL, O(0.8)), '#C3CCD1');
    // ряд стульев с ожидающим
    const cy = 184;
    s += sh(338, cy, 62, 3, 0.18) + R(286, cy - 16, 106, 2.6, '#6C757D');
    let legs = '';
    [292, 338, 386].forEach((lx) => (legs += P`M${lx} ${cy - 15}V${cy}M${lx - 5} ${cy}h10`));
    s += SK(legs, '#5A6270', 1.8);
    for (let i = 0; i < 4; i++) {
      const x = 286 + i * 27;
      s += RR(x, cy - 46, 24, 26, 5, '#3E7CA8') + RR(x + 2, cy - 44, 20, 22, 4, '#4C8DBA') + RR(x - 0.5, cy - 22, 25, 6, 3, '#356E96');
    }
    s += person(c, 326, cy, { sit: true, s: 1.15, top: '#C8553D', pants: '#3B4560', style: 'bald', hair: '#B9B4AE', skin: SKIN[1], hands: 'lap' });
    s += G(RR(-7.9, -56, 15.8, 4.2, 1.8, '#FFFFFF') + SK('M-6.5 -53.8h13', '#D5DEDC', 0.6) + PA('M5.5 -55l4 -2.5l.6 2.2z', '#FFFFFF'), T(326, cy, 1.15));
    s += RR(360, cy - 26, 13, 9, 2, '#8E5A7C') + SK(P`M362.5 ${cy - 26}q4 -6 8 0`, '#6E4560', 1.2);
    // отражение дверей в глянцевом полу
    s += R(dx, fy, dw, 26, lin(c, [[0, '#E9EEEE', 0.35], [1, '#E9EEEE', 0]]));
    // каталка
    s += gurney(24, 202, 120);
    // табличка «Мокрый пол»
    s += G(sh(0, 0, 13, 2.2, 0.2) + PG([[-10, 0], [-4, -30], [4, -30], [10, 0], [7.4, 0], [2.4, -24], [-2.4, -24], [-7.4, 0]], '#C99A1E') + PG([[-8.4, -1], [-3.4, -29], [3.4, -29], [8.4, -1]], MUSTARD) + PG([[0, -24], [5.4, -14], [-5.4, -14]], '#2A2F3C') + PG([[0, -21.6], [3.6, -15.2], [-3.6, -15.2]], MUSTARD) + R(-0.5, -20.4, 1, 3, '#2A2F3C') + C(0, -16.2, 0.6, '#2A2F3C') + SK('M-5 -9h10M-4 -6h8', '#2A2F3C', 1), T(236, 214, 1));
    // синие отсветы мигалки
    if (flash) {
      const k = c.night ? 1 : 0.75;
      c.lights.push(
        glow(c, wx + ww * 0.5, wy + wh * 0.55, 120, 90, '#3D7BFF', 0.36 * k) +
          glow(c, wx + 22 + 27 * 0.72, wy + wh - 5 - 38 * 0.72, 16, 8, '#BFE0FF', 0.9) +
          PG([[wx, wy + wh], [wx + ww, wy + wh], [wx + ww + 90, 225], [wx - 10, 225]], lin(c, [[0, '#4D8BFF', 0.3 * k], [1, '#4D8BFF', 0]])) +
          glow(c, 220, 30, 80, 26, '#4D8BFF', 0.18 * k) +
          glow(c, 84, 150, 70, 20, '#6AA2FF', 0.25 * k)
      );
    }
    return s;
  };

  /* ======================================================================
     Ночное дежурство: ординаторская
     ====================================================================== */
  /** Офисный стул; (x, gy) — центр основания на полу; coat — накинутый халат. */
  function officeChair(x, gy, col, coat) {
    let s = sh(x, gy, 16, 2.4, 0.2);
    s += SK(P`M${x - 13} ${gy - 2}L${x} ${gy - 6}L${x + 13} ${gy - 2}M${x - 6} ${gy}L${x} ${gy - 6}L${x + 7} ${gy}`, '#3A3F4A', 2);
    [x - 13, x + 13, x - 6, x + 7].forEach((wx) => (s += C(wx, gy - 1.2, 1.6, '#2A2F3C')));
    s += R(x - 1.4, gy - 24, 2.8, 18, '#5A6070') + RR(x - 15, gy - 28, 30, 6, 3, col) + R(x - 12, gy - 24, 24, 2, INK, O(0.2));
    s += R(x + 9, gy - 50, 3, 24, '#3A3F4A') + RR(x - 2, gy - 66, 22, 24, 6, col) + RR(x, gy - 64, 18, 6, 3, '#FFFFFF', O(0.1));
    if (coat) {
      // халат, наброшенный на спинку
      s += PA(P`M${x - 3} ${gy - 62}Q${x + 9} ${gy - 70} ${x + 22} ${gy - 62}L${x + 24} ${gy - 34}Q${x + 18} ${gy - 30} ${x + 15} ${gy - 34}L${x + 13} ${gy - 46}L${x + 5} ${gy - 46}L${x + 2} ${gy - 30}Q${x - 2} ${gy - 27} ${x - 5} ${gy - 31}Z`, COAT);
      s += SK(P`M${x + 9} ${gy - 66}V${gy - 46}M${x + 2} ${gy - 61}l4 7M${x + 16} ${gy - 61}l-3 7`, '#C9D3D1', 0.9);
      s += PA(P`M${x + 22} ${gy - 60}Q${x + 28} ${gy - 46} ${x + 26} ${gy - 30}L${x + 22} ${gy - 30}Q${x + 23} ${gy - 46} ${x + 19} ${gy - 58}Z`, '#E4E9E7');
      s += R(x + 14, gy - 58, 5, 0.8, '#4C6A9A') + RR(x - 4, gy - 40, 7, 8, 1, '#E4E9E7');
      s += SK(P`M${x + 4} ${gy - 62}Q${x - 1} ${gy - 52} ${x + 3} ${gy - 46}`, '#3A465E', 1.1) + C(x + 3.4, gy - 45, 1.6, '#9AA3AE');
    }
    return s;
  }
  NAMES.night = 'Ночное дежурство';
  SC.night = function (c) {
    c.indoor = true;
    // настроение ночное при любом окне: днём — задёрнутые шторы и сумрак
    c.dim = Math.max(2, c.slot);
    const fy = 170;
    const wallc = '#DCE3D4';
    let s = wall(c, 0, fy, wallc);
    s += R(0, 108, 400, fy - 108, '#BFD0BE') + R(0, 106, 400, 3, '#9DB59F');
    s += floor(c, fy, '#9C8670', { n: 16, gloss: true });
    // окно со шторами, чайник на подоконнике
    const wx = 26;
    const wy = 24;
    const ww = 90;
    const wh = 86;
    s += win(c, wx, wy, ww, wh, { view: 'city', wall: wallc, v: [0.5], h: [0.3] });
    s += rod(10, 13, 122) + curtain(c, 12, 14, c.slot === 1 ? 40 : 24, 108, '#5C7F8F', 'l') + curtain(c, c.slot === 1 ? 92 : 108, 14, c.slot === 1 ? 38 : 22, 108, '#5C7F8F', 'r');
    s += K.kettle(104, wy + wh + 1.5, '#F2F0EB');
    if (c.slot === 3) c.lights.push(PG([[wx + 6, wy + wh + 8], [wx + ww - 6, wy + wh + 8], [wx + ww + 56, 225], [wx + 30, 225]], lin(c, [[0, '#BFD3FF', 0.1], [1, '#BFD3FF', 0]])));
    // кушетка под окном
    s += sh(66, 190, 60, 3.5, 0.2);
    s += SK('M16 162V188M116 162V188', '#8D979E', 2.4) + SK('M18 188h-6M118 188h-6', '#8D979E', 2);
    s += RR(8, 150, 116, 12, 3, '#6E5848') + RR(8, 148, 116, 6, 3, '#86705E') + R(10, 160, 112, 2, INK, O(0.2));
    s += PA('M10 148Q8 136 18 136H34Q42 137 40 148Z', '#F4F2EC') + SK('M16 143q8 -1.5 18 0', '#D5DEDC', 0.8);
    s += RR(72, 140, 46, 9, 3, '#C65A44') + R(72, 143, 46, 1.4, MUSTARD, O(0.7)) + R(90, 140, 1.4, 9, '#2B3556', O(0.4));
    // часы 3:07 и график дежурств
    s += clockFace(184, 48, 12.5, 3, 7);
    s += R(218, 32, 82, 58, '#9C6A44') + R(221, 35, 76, 52, '#C9A06C');
    s += R(226, 39, 38, 44, '#FBF8F0') + TX(245, 46, 'ГРАФИК', 5.6, '#2F3B5C', 'font-weight="bold"');
    let grid = 'M228 49h34M228 55h34M228 61h34M228 67h34M228 73h34M228 79h34M236 49v32M244 49v32M252 49v32';
    s += SK(grid, '#9AA0AA', 0.5) + R(244.5, 55.5, 7, 5, CORAL, O(0.6));
    s += G(R(0, 0, 22, 18, '#F3E7C9') + SK('M3 5h16M3 9h12M3 13h14', '#A08A60', 0.7), 'transform="translate(270 40) rotate(4)"') + G(R(0, 0, 20, 16, '#BFD9E6') + SK('M3 5h13M3 9h10', '#5B7C99', 0.7), 'transform="translate(268 64) rotate(-5)"');
    s += C(281, 41.5, 1.4, CORAL) + C(277, 65, 1.4, '#5B7C99') + C(245, 40, 1.2, '#E9B949');
    // стол
    s += sh(212, 172, 98, 3.5, 0.22);
    s += R(124, 133, 6, 37, '#7A4E2E') + R(130, 136, 118, 26, '#8A5A36') + R(248, 133, 54, 37, '#9C6B44');
    s += R(251, 137, 48, 14, '#B5835A') + R(251, 154, 48, 14, '#B5835A') + R(270, 143, 10, 2, '#5E4029') + R(270, 160, 10, 2, '#5E4029');
    s += R(118, 124, 188, 7, '#B98A5E') + R(118, 131, 188, 3, '#7A4E2E');
    // телефон, журнал наблюдения, кружка, истории болезни
    s += RR(122, 119, 18, 6, 2, '#3A3F4A') + RR(120, 115, 22, 4.6, 2.3, '#2A2F3C') + C(131, 121.5, 1.6, '#5A6070');
    const jx = 158;
    s += PA(P`M${jx} 129L${jx + 2} 121Q${jx + 13} 119 ${jx + 25} 122L${jx + 25} 129Z`, '#F6F2E6') + PA(P`M${jx + 25} 129V122Q${jx + 37} 119 ${jx + 49} 121L${jx + 51} 129Z`, '#FBF8EE');
    s += PA(P`M${jx - 2} 129.5L${jx} 128H${jx + 51}L${jx + 53} 129.5Z`, '#2F5E46');
    s += SK(P`M${jx + 4} 124h18M${jx + 3.6} 126h18.4M${jx + 29} 123.6h18M${jx + 29} 126h19M${jx + 37} 122v6`, '#8E97A6', 0.45);
    s += LN(jx + 40, 127, jx + 52, 123, '#2F3B5C', 1.1);
    s += mug(224, 128, '#E9B949', true);
    const fc = ['#E2D3B0', '#C9D8E0', '#E8DDC4', '#D9C29A', '#E8DDC4'];
    for (let i = 0; i < 5; i++) s += R(236 + (i % 2) * 1.5, 124 - i * 2.4, 34, 2.2, fc[i]) + R(236 + (i % 2) * 1.5, 124 - i * 2.4 + 1.9, 34, 0.4, INK, O(0.15));
    s += R(242, 112.6, 14, 1.6, '#FFFFFF', O(0.8));
    s += deskLamp(c, 146, 124, { dir: 1, s: 1.05, col: '#2F6B5A', on: true });
    c.lights.push(glow(c, jx + 26, 126, 44, 12, '#FFE3A0', 0.5));
    // стул с халатом
    s += officeChair(318, 192, '#3F4B66', true);
    // дверь в тёмный коридор
    const dx = 336;
    const dw = 50;
    const dt = 64;
    s += R(dx - 5, dt - 5, dw + 10, fy - dt + 5, '#C3CCC4');
    const cl = clip(c, R(dx, dt, dw, fy - dt, '#000'));
    let cor = R(dx, dt, dw, fy - dt, '#1F2738');
    cor += PG([[dx, fy], [dx + dw, fy], [dx + 34, 136], [dx + 18, 136]], '#3A3530') + PG([[dx, dt], [dx + 18, 104], [dx + 18, 136], [dx, fy]], '#2C3A3A') + PG([[dx + dw, dt], [dx + 34, 104], [dx + 34, 136], [dx + dw, fy]], '#33433F');
    cor += PG([[dx, 128], [dx + 18, 124], [dx + 18, 136], [dx, fy]], '#2A4A3E', O(0.6)) + PG([[dx + dw, 128], [dx + 34, 124], [dx + 34, 136], [dx + dw, fy]], '#2F5246', O(0.6));
    cor += R(dx + 18, 104, 16, 32, '#3B4352') + PG([[dx + 4, fy - 4], [dx + 20, 150], [dx + 32, 150], [dx + 44, fy - 4]], '#6A7A8E', O(0.25));
    s += G(cor, cl);
    s += R(dx + 19.5, 99, 13, 5, '#2E9A5A') + TX(dx + 26, 102.8, 'ВЫХОД', 3.4, '#E8FFF0');
    c.lights.push(R(dx + 19.5, 99, 13, 5, '#38B56C', O(0.9)) + TX(dx + 26, 102.8, 'ВЫХОД', 3.4, '#F0FFF5') + glow(c, dx + 26, 102, 22, 14, '#4CE08A', 0.4) + glow(c, dx + 26, 160, 22, 8, '#8FB4D8', 0.25));
    s += PG([[dx + dw, dt], [dx + dw + 13, dt - 6], [dx + dw + 13, fy + 12], [dx + dw, fy]], '#DDE2DC') + PG([[dx + dw + 13, dt - 6], [dx + dw + 14.5, dt - 5], [dx + dw + 14.5, fy + 11], [dx + dw + 13, fy + 12]], '#AEB8B4') + R(dx + dw + 4, 118, 4, 2, '#8A9298');
    s += PG([[dx, fy], [dx + dw, fy], [dx + dw + 22, 225], [dx - 26, 225]], lin(c, [[0, '#9FB8D8', 0.18], [1, '#9FB8D8', 0]]));
    // выключенная лампа дневного света
    s += fluoro(c, 160, 0, 90, false);
    return s;
  };
})((window.A = window.A || {}));
