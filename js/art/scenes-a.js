/* Анамнез — иллюстрации сцен, часть A: учёба и работа.
   lecture — лекционная аудитория, seminar — учебная комната кафедры, exam — экзамен,
   library — библиотека, office — кабинет врача ПНД.
   Использует общие помощники из scenes.js (A.art._kit). */
(function (A) {
  'use strict';
  const K = A.art && A.art._kit;
  if (!K) return;
  const { SC, NAMES, W, H, P, rr, pk, dk, lt, INK, MINT, CORAL, MUSTARD, COAT, COATD, SKIN, HAIRC, TOPS, R, RR, E, C, PA, PG, SK, TX, G, O, T, LN, sh, lin, rad, glow, clip, pattern, lampOn, LGT, sky, tree, win, sunPatch, curtain, rod, radiator, wall, floor, fluoro, books, flushBooks, bookcase, plant, mug, kettle, clockFace, SLOT_HM, framed, diploma, person } = K;

  /* ---------- Общие помощники этого файла ---------- */
  const YOUNG = HAIRC.slice(0, 5).concat(['#A4532E']);

  /* Пути для пакетной отрисовки: фигуры одного цвета собираются в один <path>.
     Все контуры обходятся по часовой стрелке, чтобы перекрытия не давали дыр. */
  const cD = (x, y, r) => P`M${x - r} ${y}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0`;
  const eD = (x, y, rx, ry) => P`M${x - rx} ${y}a${rx} ${ry} 0 1 1 ${2 * rx} 0a${rx} ${ry} 0 1 1 ${-2 * rx} 0`;
  const rD = (x, y, w, h) => P`M${x} ${y}h${w}v${h}h${-w}z`;
  const rrD = (x, y, w, h, r) => P`M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
  /** Пакет слоёв: add(слой, цвет, путь); flush() выводит слои по порядку. */
  function batch(order) {
    const L = {};
    return {
      add(layer, col, d) {
        const m = L[layer] || (L[layer] = {});
        m[col] = (m[col] || '') + d;
      },
      flush(strokes) {
        let s = '';
        order.forEach((k) => {
          for (const col in L[k] || {}) s += strokes && strokes[k] ? SK(L[k][col], col, strokes[k][0], strokes[k][1]) : PA(L[k][col], col);
          L[k] = {};
        });
        return s;
      },
    };
  }

  /** Сидящий человек со спины, только плечи и голова, в пакет b (слои t, c, k, h, x).
     (x, y) — низ туловища, s — масштаб. Фигуры в одном пакете не должны перекрываться. */
  function bust(c, b, x, y, s, o) {
    o = o || {};
    const hair = o.hair || pk(c, YOUNG);
    const top = o.top || pk(c, TOPS);
    const skin = o.skin || pk(c, SKIN);
    const st = o.style || pk(c, ['short', 'long', 'bun', 'short', 'bob', 'pony', 'long']);
    const w = 11.5 * s;
    const h = 21 * s;
    const hy = y - h - 8.4 * s;
    b.add('t', top, rrD(x - w, y - h, 2 * w, h + (o.ext || 0), 6.5 * s));
    if (s > 0.8) b.add('c', dk(top, 0.2), P`M${x - 3.6 * s} ${y - h}Q${x} ${y - h + 2.4 * s} ${x + 3.6 * s} ${y - h}Z`);
    b.add('k', dk(skin, 0.12), rD(x - 2.7 * s, hy + 3 * s, 5.4 * s, 6.4 * s));
    if (st === 'short' || st === 'bun' || st === 'pony') b.add('k', skin, eD(x - 7.2 * s, hy + 1.2 * s, 1.7 * s, 2.5 * s) + eD(x + 7.2 * s, hy + 1.2 * s, 1.7 * s, 2.5 * s));
    let d = cD(x, hy, 7.6 * s);
    if (st === 'bun') d += cD(x, hy - 7.6 * s, 3.5 * s);
    else if (st === 'long') d += rrD(x - 7.9 * s, hy - 1 * s, 15.8 * s, 18 * s, 5 * s);
    else if (st === 'bob') d += rrD(x - 8.3 * s, hy - 2 * s, 16.6 * s, 11.5 * s, 4.5 * s);
    else if (st === 'pony') d += P`M${x + 2.4 * s} ${hy + 4 * s}Q${x + 3.4 * s} ${hy + 12 * s} ${x} ${hy + 17 * s}Q${x - 3.4 * s} ${hy + 12 * s} ${x - 2.4 * s} ${hy + 4 * s}Z`;
    b.add('h', hair, d);
    if (s > 0.8) b.add('x', lt(hair, 0.25), P`M${x - 4.6 * s} ${hy - 4.4 * s}Q${x - 1 * s} ${hy - 6.6 * s} ${x + 2.6 * s} ${hy - 5.8 * s}`);
  }
  const bustBatch = () => batch(['t', 'c', 'k', 'h', 'x']);
  const bustFlush = (b, s) => b.flush({ x: [1.1 * s, O(0.55)] });

  /** Ряд окон дальнего здания в узком проёме. */
  function winGridSmall(c, x, y, w) {
    let d = '';
    let lit = '';
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i + 4 <= w; i += 6) {
        const q = rD(x + i + 0.5, y + j * 8, 3, 4.5);
        if (c.r() < [0.1, 0, 0.5, 0.4][c.slot]) lit += q;
        else d += q;
      }
    }
    return (d ? PA(d, c.k(c.slot >= 2 ? '#3A4266' : '#A9BACB')) : '') + (lit ? PA(lit, '#FFD27A') : '');
  }

  /** Короткая надпись-табличка: (x, y) — центр. */
  function plate(x, y, w, h, str, size, bg, fg, e) {
    return R(x - w / 2 + 0.8, y - h / 2 + 1, w, h, INK, O(0.18)) + RR(x - w / 2, y - h / 2, w, h, 1, bg) + TX(x, y + size * 0.36, str, size, fg, e);
  }

  /** Стул (вид спереди или сзади): x — центр, gy — пол. */
  function chair(x, gy, s, col, back) {
    s = s || 1;
    col = col || '#6B4E3A';
    const d = dk(col, 0.25);
    let g = sh(0, 0, 13, 2.2, 0.16);
    g += R(-11, -24, 2.6, 24, d) + R(8.4, -24, 2.6, 24, d);
    if (!back) g += RR(-12, -27, 24, 5, 1.5, lt(col, 0.1));
    g += R(-11, -52, 2.6, 28, col) + R(8.4, -52, 2.6, 28, col);
    g += RR(-11.5, -52, 23, 12, 2, col) + R(-9, -38, 18, 2.2, col);
    if (back) g += RR(-12, -27, 24, 4, 1.5, lt(col, 0.06)) + R(-9, -22, 18, 1.6, d);
    g += R(-11.5, -51, 23, 1.2, '#FFFFFF', O(0.18));
    return G(g, T(x, gy, s));
  }

  /* ======================================================================
     Лекционная аудитория
     ====================================================================== */
  NAMES.lecture = 'Лекционная аудитория';
  SC.lecture = function (c) {
    c.indoor = true;
    const VP = [250, 92];
    const XW = 70;
    const TOPY = 20;
    const FLY = 142;
    const ly = (x, y0) => VP[1] + ((y0 - VP[1]) * (VP[0] - x)) / (VP[0] - XW);
    const wallc = '#E8DFCC';
    let s = '';
    // потолок
    s += R(0, 0, W, TOPY + 1, lin(c, [[0, '#D8D2C6'], [1, '#EAE5DB']]));
    // фронтальная стена и деревянная панель
    s += R(XW, TOPY, W - XW, FLY - TOPY, lin(c, [[0, lt(wallc, 0.06)], [1, dk(wallc, 0.06)]]));
    s += R(XW, 110, W - XW, FLY - 110, '#A87A50') + R(XW, 110, W - XW, 2.2, '#C99A68') + R(XW, 112.2, W - XW, 1, '#6E4A2E', O(0.5));
    let pd = '';
    for (let x = XW + 26; x < W; x += 34) pd += P`M${x} 114V${FLY}`;
    s += SK(pd, '#7E5636', 0.8, O(0.6));
    // боковая стена с высокими окнами
    s += PG([[0, ly(0, TOPY)], [XW, TOPY], [XW, FLY], [0, ly(0, FLY)]], lin(c, [[0, '#CFC3AD'], [1, '#DDD3BF']], [0, 0, 1, 0]));
    s += PG([[0, ly(0, 110)], [XW, 110], [XW, FLY], [0, ly(0, FLY)]], '#946A44');
    s += SK(P`M0 ${ly(0, 110)}L${XW} 110`, '#B98A5E', 1.6);
    s += SK(P`M${XW} ${TOPY}V${FLY}`, dk(wallc, 0.18), 0.8);
    const wins = [[5, 29], [40, 59]];
    wins.forEach((wx, wi) => {
      const [x0, x1] = wx;
      const q = (x, yy) => [x, ly(x, yy)];
      const yt = 30;
      const yb = 102;
      // проём (откос) и стекло
      s += PG([q(x0 - 2, yt - 3), q(x1 + 2, yt - 3), q(x1 + 2, yb + 2), q(x0 - 2, yb + 2)], '#B9AC94');
      const gl = [q(x0, yt), q(x1 - 3, yt), q(x1 - 3, yb), q(x0, yb)];
      const top = Math.min(gl[0][1], gl[1][1]);
      const bot = Math.max(gl[2][1], gl[3][1]);
      let v = sky(c, x0, top, x1 - x0, bot - top, { sx: 0.5, sy: c.slot === 1 ? 0.15 : undefined, mx: 0.55, my: 0.18, moon: wi === 0, clouds: true });
      // крыло здания напротив и верхушки деревьев
      v += R(x0, bot - 22, x1 - x0, 22, c.k('#C9B9A6')) + R(x0, bot - 23.5, x1 - x0, 2, c.k(c.winter ? '#F2F5F8' : '#9E8E80'));
      v += winGridSmall(c, x0 + 2, bot - 18, x1 - x0 - 4);
      const lc = c.winter ? '#8C8F98' : c.autumn ? '#D98A35' : c.spring ? '#8EC46A' : '#4E8F4E';
      v += PA(cD(x0 + (x1 - x0) * 0.3, bot - 4, 9) + cD(x0 + (x1 - x0) * 0.75, bot - 2, 8), c.k(lc), c.winter ? O(0.55) : '');
      s += G(v, clip(c, PG(gl, '#000')));
      if (c.slot < 2) s += PG([gl[0], [gl[0][0] + 6, gl[0][1]], [gl[3][0] + 1, gl[3][1]], [gl[3][0] - 3, gl[3][1]]], '#FFFFFF', O(0.14));
      const xm = (x0 + x1 - 3) / 2;
      const yq = (x) => ly(x, yt + (yb - yt) * 0.3);
      s += SK(P`M${xm} ${ly(xm, yt)}V${ly(xm, yb)}M${x0} ${yq(x0)}L${x1 - 3} ${yq(x1 - 3)}`, '#F1EEE6', 1.6);
      s += PG(gl, 'none', 'stroke="#F1EEE6" stroke-width="2"');
      // подоконник
      s += PG([q(x0 - 4, yb + 2), q(x1 + 3, yb + 2), [x1 + 4, ly(x1 + 3, yb + 2) + 3], [x0 - 4, ly(x0 - 4, yb + 2) + 3.5]], '#F4F1EA');
      // лучи из окна
      if (c.slot < 2) {
        const dx = c.slot === 0 ? 120 : 70;
        const dy = 110;
        c.lights.push(PG([gl[0], gl[1], [gl[2][0] + dx, gl[2][1] + dy], [gl[3][0] + dx, gl[3][1] + dy]], lin(c, [[0, '#FFF0C8', c.slot === 0 ? 0.26 : 0.18], [1, '#FFF0C8', 0]], [x0, 60, x0 + dx, 200], true)));
      }
    });
    // лампы дневного света и проектор
    const on = c.slot !== 1;
    s += fluoro(c, 110, 4, 64, on) + fluoro(c, 300, 4, 64, on) + fluoro(c, 150, 13, 40, on) + fluoro(c, 270, 13, 40, on);
    s += R(239, 0, 1.6, 9, '#8C8C88') + RR(228, 8, 24, 8, 2, '#DADAD4') + R(228, 14, 24, 2, '#B8B8B2') + C(240, 12, 2.4, '#2A2F3C');
    if (c.slot >= 2) c.lights.push(glow(c, 240, 12.5, 9, 6, '#DDEBFF', 0.9));
    // экран со слайдом
    const sx = 158;
    const sy = 28;
    const sw = 164;
    const shh = 80;
    s += R(sx + 2, sy + 2, sw, shh, INK, O(0.12));
    let sl = R(sx, sy, sw, shh, '#FBFBF7');
    sl += R(sx + 6, sy + 5, sw - 12, 12, '#2F3B5C') + TX(sx + sw / 2, sy + 13.2, 'ДЕПРЕССИВНАЯ ТРИАДА', 6.4, '#FFFFFF');
    sl += C(sx + 12, sy + 11, 3, MUSTARD);
    sl += RR(sx + 54, sy + 24, 56, 12, 2, MUSTARD) + TX(sx + 82, sy + 32.3, 'депрессия', 6, INK);
    sl += SK(P`M${sx + 82} ${sy + 36}V${sy + 42}M${sx + 28} ${sy + 42}H${sx + 136}M${sx + 28} ${sy + 42}V${sy + 48}M${sx + 82} ${sy + 42}V${sy + 48}M${sx + 136} ${sy + 42}V${sy + 48}`, '#3A3F4A', 0.8);
    const kids = [['настроение', MINT], ['мышление', '#F2B8A6'], ['моторика', '#BFD1E5']];
    kids.forEach((kd, i) => {
      const cx = sx + 28 + i * 54;
      sl += PG([[cx - 2, sy + 46.5], [cx + 2, sy + 46.5], [cx, sy + 49]], '#3A3F4A');
      sl += RR(cx - 24, sy + 49, 48, 12, 2, kd[1]) + TX(cx, sy + 56.9, kd[0], 5.2, INK);
      sl += R(cx - 18, sy + 65, 36, 1.4, '#B9BEC6') + R(cx - 13, sy + 68.6, 26, 1.4, '#C9CDD3');
    });
    sl += TX(sx + sw - 8, sy + shh - 4, '12', 4.4, '#9AA0AA');
    sl += R(sx, sy + shh - 2, sw, 3, '#3A3F4A');
    // в темноте экран светится поверх затемнения
    if (c.slot >= 2) c.lights.push(glow(c, sx + sw / 2, sy + shh / 2, sw * 0.95, shh * 1.1, '#DDE8FF', c.slot === 3 ? 0.3 : 0.2) + sl + R(sx, sy, sw, shh, '#2A2F4A', O(c.slot === 3 ? 0.22 : 0.16)));
    else s += sl;
    s += RR(sx - 5, sy - 5, sw + 10, 5, 2, '#D6D6D0') + R(sx - 5, sy - 1.6, sw + 10, 1.4, '#A9A9A3');
    // доска справа
    const bx = 340;
    s += R(bx - 3, 38, 70, 70, '#6E4A2E') + R(bx, 41, 70, 64, '#2E4A3E') + R(bx, 41, 70, 64, lin(c, [[0, '#FFFFFF', 0.08], [1, '#FFFFFF', 0]], [0, 0, 1, 1]));
    s += SK(P`M${bx + 8} 54q6 -5 12 0t12 0M${bx + 8} 64h22M${bx + 8} 72h16M${bx + 36} 70l8 -8l8 8M${bx + 40} 86q8 -10 16 0`, '#E8EEE6', 0.9, O(0.75));
    s += TX(bx + 46, 56, 'F32', 7, '#F2F4EE', O(0.85)) + R(bx - 3, 104, 70, 3, '#7E5636') + R(bx + 12, 102.4, 6, 1.6, '#FFFFFF');
    // часы над кафедрой
    s += clockFace(118, 52, 7.5, SLOT_HM[c.slot][0], SLOT_HM[c.slot][1]);
    // сцена-подиум
    s += PG([[XW, FLY], [W, FLY], [W, H], [0, H], [0, ly(0, FLY)]], '#9C7350');
    s += R(0, 147, W, 6, '#6E4A2E') + R(0, 146, W, 1.4, '#C99A68');
    // растение и профессор за кафедрой
    s += plant(c, 86, 147, 'ficus', 0.78);
    s += person(c, 118, 147, { s: 0.92, coat: true, style: 'bun', hair: '#D3CEC7', skin: '#EBC6A8', glasses: true, hands: 'point', top: '#7B5A8E', pants: '#4A4F5C', shadow: false });
    s += sh(118, 147, 24, 2.4, 0.2);
    s += PA('M98 123H138L136 147H100Z', '#8A5A36') + PA('M100 126H136L135 145H101Z', '#A06C43');
    s += PA('M94 117H142L139 124H97Z', '#C99A68') + R(97, 123.6, 42, 1.4, '#6E4A2E');
    s += C(118, 134, 4.6, '#E9B949') + C(118, 134, 3.2, '#A06C43') + C(118, 134, 1.4, '#E9B949');
    s += SK('M131 118Q133 110 127 107', '#3A3F4A', 0.9) + E(126.4, 106.6, 1.6, 1.2, '#2A2F3C');
    s += R(102, 114.6, 14, 2.4, '#F7F3EA') + R(103, 112.6, 12, 2, '#E9E3D6');
    // ряды студентов (от дальних к ближним)
    const dy = [150, 163, 186];
    const sc = [0.62, 0.86, 1.2];
    for (let i = 0; i < 3; i++) {
      const s0 = sc[i];
      const y0 = dy[i];
      // стол: столешница и тень под ней
      s += R(-5, y0, W + 10, 2.4 * s0 + 0.6, '#C99A68') + R(-5, y0 + 2.4 * s0 + 0.6, W + 10, 1.2, '#7E5636') + R(-5, y0 + 2.4 * s0 + 1.8, W + 10, 18 * s0, '#4A3528');
      // тетради на столе
      for (let k = 0; k < 3 + i; k++) {
        const nx = rr(c, 0, W);
        s += PG([[nx, y0 + 0.4], [nx + 12 * s0, y0 + 0.4], [nx + 13 * s0, y0 + 2.2 * s0 + 0.4], [nx - 1 * s0, y0 + 2.2 * s0 + 0.4]], pk(c, ['#F7F3EA', '#F7F3EA', '#E9DFC9', '#BFD1E5']));
      }
      if (i === 2) {
        // ноутбук: экран виден из-за плеча
        const lx = 300;
        s += PG([[lx - 2, y0 + 3], [lx + 30, y0 + 3], [lx + 27, y0 - 1], [lx + 1, y0 - 1]], '#B8BCC4');
        s += RR(lx, y0 - 21, 26, 20, 1.5, '#3A3F4A');
        const scr = R(lx + 2, y0 - 19, 22, 16, '#DCE8F2') + R(lx + 4, y0 - 17, 12, 2, '#5B7C99') + R(lx + 4, y0 - 13, 18, 1.2, '#9AA8B8') + R(lx + 4, y0 - 10.5, 15, 1.2, '#9AA8B8') + R(lx + 4, y0 - 8, 17, 1.2, '#9AA8B8');
        if (c.slot >= 2) c.lights.push(glow(c, lx + 13, y0 - 11, 30, 22, '#CFE2FF', 0.35) + G(scr, O(0.85)));
        else s += scr;
      }
      // студенты
      const bot = i < 2 ? dy[i + 1] + 1 : 234;
      const bb = bustBatch();
      let x = rr(c, -6, 14) * s0;
      while (x < W + 12) {
        if (c.r() > 0.22 && !(i === 2 && x > 286 && x < 342)) bust(c, bb, x, bot, s0);
        x += 33 * s0 * rr(c, 1, 1.25);
      }
      s += bustFlush(bb, s0);
    }
    return s;
  };

  /* ======================================================================
     Учебная комната кафедры
     ====================================================================== */
  NAMES.seminar = 'Учебная комната кафедры';
  SC.seminar = function (c) {
    c.indoor = true;
    const fy = 170;
    const wallc = '#EFE7D6';
    const panel = '#9DBFAE';
    let s = wall(c, 0, fy, wallc);
    s += R(0, 104, W, fy - 104, lin(c, [[0, panel], [1, '#8BB09E']])) + R(0, 102, W, 2.4, '#7E9F8E') + R(0, 104.4, W, 1, '#FFFFFF', O(0.3));
    s += floor(c, fy, '#B58C64', { n: 18, cross: 0.22 });
    // лампы дневного света под потолком
    s += fluoro(c, 60, 2, 90, c.slot !== 1) + fluoro(c, 250, 2, 90, c.slot !== 1);
    // окно с жалюзи, батарея, цветок
    s += win(c, 20, 34, 66, 74, { view: 'trees', wall: wallc, v: [0.5], h: [0.34], blinds: 0.3 });
    sunPatch(c, 20, 66, fy, 40);
    s += radiator(26, 124, 54, 22);
    s += plant(c, 74, 109.5, 'small', 0.85, { pot: '#E9DCC6' });
    // доска со схемой
    const bx = 116;
    const by = 36;
    const bw = 166;
    const bh = 86;
    s += R(bx + 2, by + 2.5, bw, bh, INK, O(0.14)) + RR(bx - 3, by - 3, bw + 6, bh + 6, 2, '#B9BEC4') + R(bx, by, bw, bh, '#F8F9F6');
    s += R(bx, by, bw, bh, lin(c, [[0, '#FFFFFF', 0], [0.5, '#E6EAEE', 0.5], [1, '#FFFFFF', 0]], [0, 0, 1, 1]));
    s += TX(bx + 20, by + 13, 'F31', 8, '#2F5D9A') + SK(P`M${bx + 8} ${by + 16}h24`, '#2F5D9A', 0.9);
    // график настроения: ось, волна, подписи
    const ax = bx + 44;
    const ay = by + 46;
    s += SK(P`M${ax} ${by + 14}V${by + 76}M${ax - 3} ${by + 17}L${ax} ${by + 13}L${ax + 3} ${by + 17}M${ax} ${ay}H${bx + bw - 10}M${bx + bw - 14} ${ay - 3}L${bx + bw - 10} ${ay}L${bx + bw - 14} ${ay + 3}`, '#2A2F3C', 1);
    s += SK(P`M${ax} ${ay}C${ax + 10} ${ay - 34} ${ax + 22} ${ay - 34} ${ax + 30} ${ay}S${ax + 50} ${ay + 34} ${ax + 60} ${ay}S${ax + 74} ${ay - 22} ${ax + 84} ${ay}S${ax + 98} ${ay + 26} ${ax + 108} ${ay}`, '#C8553D', 1.6);
    s += TX(ax - 16, by + 26, 'мания', 5.4, '#C8553D') + TX(ax - 18, by + 68, 'депрессия', 5.4, '#2F5D9A');
    s += SK(P`M${ax + 15} ${ay - 30}v-4M${ax + 45} ${ay + 30}v4`, '#2F5D9A', 0.8);
    s += SK(P`M${bx + 8} ${by + 78}h20M${bx + 8} ${by + 82}h14`, '#9AA0AA', 0.8);
    // стикеры и полочка с маркерами
    s += G(R(0, 0, 13, 13, '#F6D86B') + R(2, 3, 9, 1, '#B89A3A', O(0.6)) + R(2, 6, 7, 1, '#B89A3A', O(0.6)), 'transform="translate(' + (bx + bw - 22) + ' ' + (by + 5) + ') rotate(4)"');
    s += G(R(0, 0, 12, 12, '#9CD3C0') + R(2, 3, 8, 1, '#4E7D6A', O(0.6)), 'transform="translate(' + (bx + bw - 38) + ' ' + (by + 6) + ') rotate(-3)"');
    s += R(bx - 2, by + bh + 3, bw + 4, 3, '#A9AEB4') + R(bx + 20, by + bh + 1.4, 9, 1.8, '#2F5D9A') + R(bx + 32, by + bh + 1.4, 9, 1.8, '#C8553D') + RR(bx + 46, by + bh + 0.4, 12, 3, 1, '#3A3F4A');
    // дверь с табличкой
    const dx = 324;
    s += R(dx - 5, 46, 66, fy - 46, '#E3D9C6') + R(dx, 51, 56, fy - 51, '#B98556') + R(dx + 5, 57, 46, 50, '#C99A68') + R(dx + 5, 112, 46, 52, '#C99A68');
    s += R(dx + 5, 57, 46, 2, '#FFFFFF', O(0.2)) + R(dx + 5, 112, 46, 2, '#FFFFFF', O(0.2));
    s += RR(dx + 44, 108, 9, 3, 1.5, '#E2C078') + R(dx + 46, 112, 2.6, 5, '#D2B068');
    s += RR(dx + 7, 70, 42, 17, 1.2, '#2F3B5C') + R(dx + 8.2, 71.2, 39.6, 14.6, 'none', 'stroke="#E2C078" stroke-width=".5"');
    s += TX(dx + 28, 77.2, 'КАФЕДРА', 4.6, '#F3E7C4') + TX(dx + 28, 83.2, 'ПСИХИАТРИИ', 4.6, '#F3E7C4');
    s += clockFace(dx + 28, 30, 7.5, SLOT_HM[c.slot][0], SLOT_HM[c.slot][1]);
    // доцент у доски, с указкой
    s += person(c, 306, 177, { s: 1.2, coat: true, style: 'short', hair: '#8D8883', skin: '#E4B994', glasses: true, hands: 'point', flip: true, top: '#5B7C99', pants: '#3B4560' });
    s += SK('M279 111L246 76', '#6E4A2E', 1.3) + C(278.4, 110.6, 2.6, '#E4B994');
    // ординатор за дальним краем стола, лицом к нам
    s += person(c, 104, 165, { bust: true, s: 0.95, style: 'bob', hair: '#2B2220', skin: '#E9BE9C', hands: 'table', top: '#D98E5F', smile: true });
    // стол
    s += sh(164, 206, 124, 5, 0.2);
    s += PG([[56, 146], [272, 146], [284, 160], [44, 160]], '#D4B48A') + R(44, 160, 240, 6, '#9C6B44') + R(44, 166, 240, 1.4, INK, O(0.2));
    s += R(50, 166, 5, 40, '#8A5A36') + R(273, 166, 5, 40, '#8A5A36') + R(62, 166, 3, 22, '#6E4A2E') + R(263, 166, 3, 22, '#6E4A2E');
    // на столе: тетради, папки, кружки
    s += PG([[90, 150], [116, 150], [119, 156], [89, 156]], '#F7F3EA') + SK('M103 150.4L103.6 155.6', '#C9C2B4', 0.5) + SK('M110 151L122 148', '#2F5D9A', 0.8);
    s += PG([[160, 148], [186, 148], [188, 153], [158, 153]], '#5B7C99') + PG([[161, 146.5], [185, 146.5], [187, 151.5], [159, 151.5]], '#E9B949');
    s += mug(136, 154, CORAL, c.slot !== 1) + mug(256, 153, '#5B7C99', false);
    s += PG([[204, 151], [230, 151], [232, 157], [202, 157]], '#F7F3EA') + PG([[216, 151], [230, 151], [232, 157], [217, 157]], '#EFE9DC');
    // рюкзак у ножки стола
    s += sh(30, 214, 14, 2.4) + RR(18, 186, 24, 28, 7, '#C8553D') + RR(21, 198, 18, 12, 3, '#B5482F') + R(21, 197, 18, 1.2, '#8E3A26') + SK('M24 187Q30 178 36 187', '#8E3A26', 2);
    // ординаторы с ближней стороны, спиной к нам, на стульях
    const bb = bustBatch();
    bust(c, bb, 136, 216, 1.5, { style: 'short', hair: '#433026', top: '#3F4B66', skin: '#E9BE9C', ext: 12 });
    bust(c, bb, 228, 216, 1.5, { style: 'pony', hair: '#8C6442', top: '#7FAE9A', skin: '#F2D0B4', ext: 12 });
    s += bustFlush(bb, 1.5);
    s += chair(136, 258, 1.2, '#6B4E3A', true) + chair(228, 258, 1.2, '#6B4E3A', true);
    // стул у двери со стопкой книг
    s += chair(362, 204, 1.05, '#7A5A44', false);
    s += R(352, 170, 22, 4, '#5B7C99') + R(354, 166.5, 19, 3.5, '#E9B949') + R(351, 163, 21, 3.5, '#C8553D') + R(353, 170.8, 20, 0.8, '#F3E9D2', O(0.6));
    return s;
  };

  /** Подвесной светильник-шар: x — центр, y — центр шара. */
  function globeLamp(c, x, y, r) {
    const on = lampOn(c);
    let s = R(x - 0.4, 0, 0.8, y - r + 1, '#6A6A66') + RR(x - 2.4, y - r - 1.5, 4.8, 3, 1, '#8C7E6E');
    s += C(x, y, r, on ? '#FFF1C8' : '#F4F1EA') + C(x - r * 0.35, y - r * 0.35, r * 0.3, '#FFFFFF', O(0.6)) + E(x, y + r * 0.7, r * 0.7, r * 0.25, INK, O(on ? 0 : 0.08));
    if (on) c.lights.push(glow(c, x, y, 120, 95, '#FFC870', 0.3 * LGT(c)) + glow(c, x, y, r * 3, r * 3, '#FFF4D0', 0.85) + C(x, y, r, '#FFF3D2', O(0.9)));
    return s;
  }

  /** Сидящий за столом человек анфас (бюст) с бородой по желанию. */
  function sitter(c, x, y, o) {
    let s = person(c, x, y, Object.assign({ bust: true }, o));
    if (o.beard) {
      const hy = -50.5;
      const bc = o.beard;
      const g =
        PA(`M-7.3 ${hy + 0.6}C-7.8 ${hy + 9.5} -3.4 ${hy + 13.6} 0 ${hy + 13.8}C3.4 ${hy + 13.6} 7.8 ${hy + 9.5} 7.3 ${hy + 0.6}C6 ${hy + 4.4} 3.4 ${hy + 5.2} 0 ${hy + 5}C-3.4 ${hy + 5.2} -6 ${hy + 4.4} -7.3 ${hy + 0.6}Z`, bc) +
        PA(`M-3.6 ${hy + 4.6}Q0 ${hy + 2.6} 3.6 ${hy + 4.6}Q2 ${hy + 5.6} 0 ${hy + 4.9}Q-2 ${hy + 5.6} -3.6 ${hy + 4.6}Z`, dk(bc, 0.12)) +
        SK(`M-1.4 ${hy + 7}q1.4 .8 2.8 0`, dk(bc, 0.4), 0.6);
      s += G(g, T(x, y, o.s || 1));
    }
    return s;
  }

  /* ======================================================================
     Экзамен
     ====================================================================== */
  NAMES.exam = 'Экзамен';
  SC.exam = function (c) {
    c.indoor = true;
    const fy = 178;
    const wallc = '#E9DDC5';
    let s = wall(c, 0, fy, wallc, pattern(c, 24, 24, R(11.5, 0, 1, 24, '#C9AE84', O(0.22))));
    s += R(0, 112, W, fy - 112, '#B58F62') + R(0, 110, W, 3, '#8A6440') + R(0, 113, W, 1, '#FFFFFF', O(0.25));
    s += floor(c, fy, '#8E5E3A', { n: 22, cross: 0.3, gloss: true });
    // окно с тяжёлыми шторами
    s += win(c, 30, 30, 58, 92, { view: 'yard', wall: wallc, v: [0.5], h: [0.3] });
    sunPatch(c, 30, 58, fy, 40);
    s += rod(8, 20, 102) + curtain(c, 10, 21, 26, 136, '#8E3B3B', 'l') + curtain(c, 84, 21, 26, 136, '#8E3B3B', 'r');
    // застеклённый шкаф справа
    const cx0 = 344;
    s += sh(372, fy + 4, 34, 3) + R(cx0, 36, 60, fy - 32, '#6E4A2E') + R(cx0 + 4, 40, 52, 92, '#3A2A20');
    for (let i = 0; i < 3; i++) books(c, cx0 + 5, 68 + i * 30, 50, 24);
    s += flushBooks(c) + SK(`M${cx0 + 4} 70H${cx0 + 56}M${cx0 + 4} 100H${cx0 + 56}`, '#8A5A36', 2);
    s += R(cx0 + 4, 40, 52, 92, lin(c, [[0, '#FFFFFF', 0.18], [0.5, '#FFFFFF', 0.04], [1, '#FFFFFF', 0.14]], [0, 0, 1, 1])) + SK(`M${cx0 + 30} 40V132`, '#6E4A2E', 2) + R(cx0, 136, 60, fy - 136, '#7E5636') + R(cx0 + 4, 140, 52, 30, '#8A5A36');
    // портрет в раме
    const pw = 44;
    const ph = 54;
    const px = 200 - pw / 2;
    const py = 18;
    const inner =
      R(px + 4, py + 4, pw - 8, ph - 8, lin(c, [[0, '#5A4636'], [1, '#2E241D']])) +
      PA(P`M${px + 8} ${py + ph - 4}Q${px + 10} ${py + 36} ${px + 22} ${py + 34}Q${px + 34} ${py + 36} ${px + 36} ${py + ph - 4}Z`, '#1F1A17') +
      PG([[px + 19, py + 35], [px + 25, py + 35], [px + 22, py + 42]], '#E9E3D6') +
      C(px + 22, py + 24, 7.4, '#D8B08E') +
      PA(P`M${px + 15} ${py + 24}Q${px + 15} ${py + 37} ${px + 22} ${py + 39}Q${px + 29} ${py + 37} ${px + 29} ${py + 24}Q${px + 26} ${py + 29} ${px + 22} ${py + 29}Q${px + 18} ${py + 29} ${px + 15} ${py + 24}Z`, '#ECE6DC') +
      E(px + 15.4, py + 21, 2, 3.6, '#ECE6DC') +
      E(px + 28.6, py + 21, 2, 3.6, '#ECE6DC') +
      C(px + 19.4, py + 23.4, 0.7, '#2A2530') +
      C(px + 24.6, py + 23.4, 0.7, '#2A2530') +
      R(px + 4, py + 4, pw - 8, ph - 8, rad(c, [[0.5, '#000000', 0], [1, '#000000', 0.35]]));
    s += framed(px, py, pw, ph, inner, '#B8954E') + R(px + 3, py + 3, pw - 6, ph - 6, 'none', 'stroke="#8E6E34" stroke-width="1"');
    s += RR(188, py + ph + 4, 24, 4.6, 1, '#C9A85E') + R(192, py + ph + 6, 16, 0.8, '#8E6E34');
    // светильники
    s += globeLamp(c, 118, 22, 7) + globeLamp(c, 282, 22, 7);
    // экзаменаторы
    s += sitter(c, 148, 156, { s: 1.05, coat: true, style: 'bun', hair: '#5E412E', skin: '#EBC6A8', glasses: true, hands: 'table', top: '#8E5A7C', smile: true });
    s += sitter(c, 254, 156, { s: 1.08, coat: true, style: 'bald', hair: '#8D8883', skin: '#E2B48F', hands: 'table', top: '#3F4B66', beard: '#9C958E' });
    // стол с зелёным сукном
    const cloth = '#3F7A55';
    s += sh(200, 196, 170, 6, 0.22);
    s += PG([[54, 138], [346, 138], [356, 148], [44, 148]], '#4E8F62');
    s += R(44, 148, 312, 44, lin(c, [[0, cloth], [1, '#2F5E42']]));
    let fd = '';
    for (let x = 64; x < 350; x += 26) fd += P`M${x} 150Q${x + 2} 170 ${x - 1} 191`;
    s += SK(fd, '#2A5039', 1.2, O(0.55)) + R(44, 148, 312, 2, '#2A5039', O(0.6)) + R(44, 189, 312, 3, '#E9B949', O(0.7));
    // веер билетов
    let fan = '';
    for (let i = 0; i < 9; i++) fan += G(R(-4.5, -16, 9, 14, '#FBF8F0', 'stroke="#B9B2A4" stroke-width=".4"') + R(-2.5, -13.5, 5, 1, '#8A93A3'), 'transform="rotate(' + (-64 + i * 16) + ')"');
    s += G(fan, 'transform="translate(200 146) scale(1 .5)"');
    // зачётки, бумаги, ручка
    s += PG([[98, 141], [118, 141], [119, 146], [96, 146]], '#2F3B5C') + PG([[99, 139], [117, 139], [118, 143.5], [97, 143.5]], '#3F4B66') + PG([[100, 137], [116, 137], [117, 141], [99, 141]], '#2F3B5C');
    s += PG([[222, 140], [246, 140], [248, 146], [220, 146]], '#F7F3EA') + SK('M226 142.4H242M226 144H238', '#9AA0AA', 0.5) + SK('M250 141L262 139', '#2A2F3C', 0.9);
    // графин и стакан
    const gx = 306;
    s += E(gx, 146, 10, 2, INK, O(0.15));
    s += PA(P`M${gx - 2.6} ${116}H${gx + 2.6}V${124}C${gx + 10} ${128} ${gx + 10} ${144} ${gx + 6} ${146}H${gx - 6}C${gx - 10} ${144} ${gx - 10} ${128} ${gx - 2.6} ${124}Z`, '#CFE3EC', O(0.75));
    s += PA(P`M${gx - 8.4} ${133}H${gx + 8.4}C${gx + 8.6} ${140} ${gx + 7.6} ${144.6} ${gx + 6} ${146}H${gx - 6}C${gx - 7.6} ${144.6} ${gx - 8.6} ${140} ${gx - 8.4} ${133}Z`, '#9CC4D6', O(0.8));
    s += SK(P`M${gx - 5} ${130}Q${gx - 7} ${136} ${gx - 5} ${142}`, '#FFFFFF', 1, O(0.7)) + RR(gx - 2.4, 111, 4.8, 5.4, 1.6, '#BFD8E2') + C(gx, 110.5, 2.4, '#D5E7EE');
    s += PA(P`M${gx + 13} ${134}H${gx + 21}L${gx + 20} ${146}H${gx + 14}Z`, '#D7E9F0', O(0.75)) + R(gx + 13.6, 139, 6.8, 6.6, '#9CC4D6', O(0.7)) + R(gx + 14.6, 135, 1, 9, '#FFFFFF', O(0.6));
    // пустой стул студента на переднем плане
    s += chair(200, 244, 1.5, '#6B4E3A', true);
    return s;
  };

  void [W, H, CORAL, COAT, COATD, E, PA, LN, pattern, lampOn, LGT, win, sunPatch, curtain, rod, radiator, wall, floor, books, flushBooks, bookcase, mug, kettle, framed, diploma, plate, chair];
})((window.A = window.A || {}));
