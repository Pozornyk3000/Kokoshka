/* Анамнез — иллюстрации сцен (часть C): титул «жёлтый дом», улица, парк, кафе, магазин.
   Использует общий набор помощников A.art._kit из scenes.js. */
(function (A) {
  'use strict';
  const K = A.art && A.art._kit;
  if (!K) return;
  const { SC, NAMES, W, H, P, clamp, rr, pk, mix, dk, lt, INK, CORAL, MUSTARD, LAMP, LITC, TOPS, R, RR, E, C, PA, PG, SK, TX, G, O, T, LN, sh, lin, glow, clip, pattern, LGT, skyStops, sky, winGrid, tree, leaves, snowfall, puddle, win, wall, floor, person, cat, plant, mug, archD } = K;

  /* ---------- Общие помощники улицы ---------- */
  const GRASS = { summer: ['#8BAE68', '#6E9355'], spring: ['#A0C470', '#7FA95B'], autumn: ['#B0A464', '#8E8752'], winter: ['#F4F7FA', '#DCE4EC'] };
  /** Газон / снег от y0 до низа. */
  function lawn(c, y0, y1) {
    const g = GRASS[c.season] || GRASS.summer;
    return R(0, y0, W, (y1 || H) - y0, lin(c, [[0, c.k(g[1])], [1, c.k(g[0])]]));
  }
  /** Пучки травы (кроме зимы). */
  function tufts(c, x, y, w, h, n) {
    if (c.winter) return '';
    let d = '';
    for (let i = 0; i < n; i++) {
      const tx = x + c.r() * w;
      const ty = y + c.r() * h;
      const q = rr(c, 1.3, 2.6);
      d += P`M${tx - q * 0.6} ${ty}l${q * 0.3} ${-q}M${tx} ${ty}v${-q * 1.2}M${tx + q * 0.6} ${ty}l${-q * 0.3} ${-q}`;
    }
    return SK(d, c.k(c.autumn ? '#7A7240' : c.spring ? '#5E8C45' : '#557A44'), 0.6, O(0.55));
  }
  const skyLow = (c) => {
    const st = skyStops(c);
    return st[st.length - 1][1];
  };
  /** Дальняя полоса деревьев — силуэт крон, тонет в дымке неба. */
  function treeline(c, y, hmax, o) {
    o = o || {};
    const base = { summer: '#6B9070', spring: '#8AB07A', autumn: '#B98A58', winter: '#A3A8B6' }[c.season];
    const col = mix(c.k(o.col || base), skyLow(c), o.haze != null ? o.haze : 0.38);
    let d = P`M${W + 4} ${y}H-4V${y - hmax * 0.5}`;
    let x = -4;
    while (x < W + 4) {
      const bw = rr(c, 0.5, 1.1) * hmax;
      const ty = y - hmax * rr(c, 0.45, 1);
      d += P`Q${x} ${ty} ${x + bw * 0.5} ${ty}T${x + bw} ${y - hmax * rr(c, 0.3, 0.55)}`;
      x += bw;
    }
    d += 'Z';
    return PA(d, col);
  }
  /** Уличный фонарь: kind classic (чугунный) | modern (консоль). Светит вечером и ночью. */
  function lampPost(c, x, gy, h, o) {
    o = o || {};
    const k = c.k;
    const on = o.on != null ? o.on : c.slot >= 2;
    const top = gy - h;
    let s = sh(x, gy, 8, 1.8, 0.2);
    let hx = x;
    let hy = top + 6;
    if (o.kind === 'modern') {
      const iron = k('#5A6170');
      s += PA(P`M${x - 1.7} ${gy}L${x - 1} ${top + 6}H${x + 1}L${x + 1.7} ${gy}Z`, iron) + R(x - 2.6, gy - 5, 5.2, 5, iron);
      const d = o.dir || 1;
      s += SK(P`M${x} ${top + 9}Q${x} ${top} ${x + d * 13} ${top + 0.6}`, iron, 1.6);
      s += PA(P`M${x + d * 9} ${top - 0.8}H${x + d * 24}L${x + d * 22} ${top + 3}H${x + d * 11}Z`, k('#464C58'));
      hx = x + d * 16.5;
      hy = top + 3.4;
      s += E(hx, hy, 5.4, 1.3, on ? '#FFF1C8' : k('#C9CFD6'));
      if (c.winter) s += PA(P`M${x + d * 9} ${top - 0.8}Q${x + d * 16} ${top - 3.4} ${x + d * 24} ${top - 0.8}Z`, '#F6F9FB');
    } else {
      const iron = k('#2C313D');
      s += R(x - 3.4, gy - 6, 6.8, 6, iron) + R(x - 2.3, gy - 15, 4.6, 9, iron) + R(x - 3, gy - 16.5, 6, 1.6, iron);
      s += PA(P`M${x - 1.6} ${gy - 16}L${x - 0.9} ${top + 13}H${x + 0.9}L${x + 1.6} ${gy - 16}Z`, iron);
      s += R(x - 2.6, top + 12, 5.2, 2, iron) + SK(P`M${x - 2.6} ${top + 16}q-3 -1 -3.4 -4M${x + 2.6} ${top + 16}q3 -1 3.4 -4`, iron, 0.7);
      s += PA(P`M${x - 3.6} ${top + 11.4}L${x - 5.4} ${top + 1.4}H${x + 5.4}L${x + 3.6} ${top + 11.4}Z`, on ? '#FFE9B0' : k('#BCC7D2'));
      s += SK(P`M${x} ${top + 1.4}V${top + 11.4}M${x - 4.5} ${top + 6}H${x + 4.5}`, iron, 0.55, O(0.8));
      s += R(x - 4.2, top + 10.6, 8.4, 1.6, iron) + PG([[x - 7, top + 2], [x + 7, top + 2], [x, top - 5]], iron) + C(x, top - 6.2, 1.2, iron);
      if (c.winter) s += PA(P`M${x - 6.4} ${top + 1.2}L${x} ${top - 4.4}L${x + 6.4} ${top + 1.2}Q${x} ${top - 1.4} ${x - 6.4} ${top + 1.2}Z`, '#F6F9FB');
    }
    if (on) {
      const L = LGT(c);
      c.lights.push(glow(c, hx, hy, 46, 46, '#FFC870', 0.42 * L) + glow(c, hx, hy, 11, 11, '#FFF2CC', 0.9) + glow(c, hx, gy, 38, 7.5, '#FFD99A', 0.38 * L));
    }
    return s;
  }
  /** Стриженые кусты вдоль фасада: волнистый силуэт с бликами. */
  function hedge(c, x0, x1, gy, h) {
    const k = c.k;
    const pal = { summer: ['#3F7A45', '#5E9C55'], spring: ['#64A052', '#8EC46A'], autumn: ['#8C7A3A', '#C0973E'], winter: ['#4F6155', '#66796A'] }[c.season];
    const n = Math.max(2, Math.round((x1 - x0) / (h * 1.5)));
    const bw = (x1 - x0) / n;
    const lo = gy - h * 0.5;
    let d = P`M${x0} ${gy}V${lo}`;
    let hl = '';
    let sn = '';
    for (let i = 0; i < n; i++) {
      const bx = x0 + i * bw;
      const top = gy - h * rr(c, 0.92, 1.1);
      d += P`Q${bx + bw * 0.06} ${top} ${bx + bw * 0.5} ${top}Q${bx + bw * 0.94} ${top} ${bx + bw} ${lo}`;
      hl += P`M${bx + bw * 0.16} ${top + h * 0.3}a${bw * 0.26} ${h * 0.2} 0 1 0 ${bw * 0.52} 0a${bw * 0.26} ${h * 0.2} 0 1 0 ${-bw * 0.52} 0`;
      sn += P`M${bx + bw * 0.06} ${lo - h * 0.12}Q${bx + bw * 0.08} ${top - 1} ${bx + bw * 0.5} ${top - 1}Q${bx + bw * 0.92} ${top - 1} ${bx + bw * 0.94} ${lo - h * 0.12}Q${bx + bw * 0.5} ${top + h * 0.34} ${bx + bw * 0.06} ${lo - h * 0.12}Z`;
    }
    d += P`V${gy}Z`;
    let s = sh((x0 + x1) / 2, gy, (x1 - x0) * 0.55, 2.2, 0.16) + PA(d, k(pal[0])) + PA(hl, k(pal[1]), O(0.7));
    if (c.winter) s += PA(sn, '#F5F8FB');
    return s;
  }
  /** Стёкла окон фасада: отражают небо (не светятся). */
  const GLZ = [['#F2D3C0', '#9AAFC6'], ['#D8E9F3', '#83AACA'], ['#E59D7C', '#574876'], ['#2D3858', '#151B35']];
  function glz(c) {
    const g = c.slot === 1 && c.winter ? ['#E1E9EF', '#A5BACB'] : GLZ[c.slot];
    return lin(c, [[0, g[0]], [1, g[1]]]);
  }
  const litG = (c, v) => lin(c, v ? [[0, '#FFE2A0'], [1, '#F2A957']] : [[0, '#FFEDB8'], [1, '#F7BE68']]);
  /** Ряд одинаковых арочных окон с наличниками, замковыми камнями и подоконниками.
     Пути объединены по цветам (размер SVG). xs — центры, y — верх арки, lit — флаги «горит свет». */
  function archRow(c, xs, y, w, h, lit) {
    const k = c.k;
    const ty = y + w * 0.5 + (h - w * 0.5) * 0.28;
    const o = { tr: '', gl: '', lg: '', cu: '', fu: '', fl: '', sd: '', rf: '', sn: '' };
    xs.forEach((cx, i) => {
      const x = cx - w / 2;
      const on = lit[i];
      o.tr += archD(x - 2.4, y - 2.4, w + 4.8, h + 2.4) + P`M${cx - 2.3} ${y - 4.2}H${cx + 2.3}L${cx + 1.5} ${y + 0.8}H${cx - 1.5}ZM${x - 3.3} ${y + h}h${w + 6.6}v2.2h${-w - 6.6}z`;
      o[on ? 'lg' : 'gl'] += archD(x, y, w, h);
      o[on ? 'fl' : 'fu'] += P`M${cx - 0.55} ${y}h1.1v${h}h-1.1zM${x} ${ty - 0.55}h${w}v1.1h${-w}z`;
      if (on) {
        o.cu += P`M${x} ${ty}h${w * 0.24}q${-w * 0.12} ${(y + h - ty) * 0.5} ${w * 0.04} ${y + h - ty}H${x}ZM${x + w} ${ty}h${-w * 0.24}q${w * 0.12} ${(y + h - ty) * 0.5} ${-w * 0.04} ${y + h - ty}H${x + w}Z`;
        if (c.slot >= 2) c.lights.push(glow(c, cx, y + h * 0.55, w * 1.5, h * 0.8, '#FFC46A', 0.3 * LGT(c)));
      } else if (c.slot < 2) o.rf += P`M${x + w * 0.66} ${y + 1.6}L${x + w * 0.92} ${y + 4}L${x + w * 0.32} ${y + h}H${x + w * 0.06}Z`;
      o.sd += P`M${x - 2.4} ${y + h + 2.2}h${w + 4.8}v1.3h${-w - 4.8}z`;
      if (c.winter) o.sn += P`M${x - 3.5} ${y + h + 0.6}q0 -1.9 1.9 -1.9h${w + 3.2}q1.9 0 1.9 1.9z`;
    });
    return (
      PA(o.tr, k('#F5F0E4')) +
      (o.gl ? PA(o.gl, glz(c)) : '') +
      (o.lg ? PA(o.lg, litG(c, 0)) : '') +
      (o.cu ? PA(o.cu, '#C26A36', O(0.5)) : '') +
      (o.rf ? PA(o.rf, '#FFFFFF', O(0.2)) : '') +
      (o.fu ? PA(o.fu, k('#ECE6D8')) : '') +
      (o.fl ? PA(o.fl, '#8E6040') : '') +
      PA(o.sd, INK, O(0.14)) +
      (o.sn ? PA(o.sn, '#F8FBFD') : '')
    );
  }
  /** Чугунная ограда с пиками (узор), x0…x1, y0 — верх прутьев, y1 — низ. */
  function fence(c, x0, x1, y0, y1) {
    const iron = c.k('#2C313D');
    const pat = pattern(c, 5, H, R(2, y0 + 1.5, 1, y1 - y0 - 1.5, iron) + PA(P`M1.2 ${y0 + 2.2}H3.8L2.5 ${y0 - 1}Z`, iron));
    let s = R(x0, y0 - 1, x1 - x0, y1 - y0 + 1, pat) + R(x0, y0 + 3.4, x1 - x0, 1.2, iron) + R(x0, y1 - 5, x1 - x0, 1.2, iron) + R(x0, y1 - 1, x1 - x0, 3, c.k('#A39886'));
    if (c.winter) s += R(x0, y0 + 2.4, x1 - x0, 1.2, '#F4F7FA') + R(x0, y1 - 2.4, x1 - x0, 1.8, '#F4F7FA');
    return s;
  }
  /** Клумба: эллипс земли и цветы по сезону (зимой — сугроб). */
  function flowerbed(c, x, y, rx, ry) {
    const k = c.k;
    const dome = P`M${x - rx} ${y}A${rx} ${ry * 1.7} 0 0 1 ${x + rx} ${y}Z`;
    let s = sh(x, y + 0.6, rx + 2, ry * 0.7, 0.18) + E(x, y, rx + 1.2, ry * 0.75, k(c.winter ? '#DCE4EC' : '#C9BFAE'));
    if (c.winter) return s + PA(dome, '#F6F9FB') + PA(P`M${x - rx} ${y}A${rx} ${ry * 0.9} 0 0 0 ${x + rx} ${y}A${rx} ${ry * 0.5} 0 0 1 ${x - rx} ${y}Z`, '#D5DEE8');
    s += PA(dome, k(c.autumn ? '#6E6A3A' : '#4F7E45'));
    const cols = c.autumn ? ['#B8433A', '#E89A3C', '#8E3F6E'] : c.spring ? ['#F2D35C', '#F4F1E6', '#E9A0B8'] : ['#E25D4A', '#F2C14E', '#F4F1E6', '#B672C9'];
    const by = {};
    for (let i = 0; i < Math.round(rx * 0.9); i++) {
      const a = -c.r() * Math.PI;
      const q = Math.sqrt(c.r()) * 0.82;
      const fx = x + Math.cos(a) * rx * q;
      const fy = y + Math.sin(a) * ry * 1.6 * q - 0.6;
      const col = k(pk(c, cols));
      by[col] = (by[col] || '') + P`M${fx - 1} ${fy}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`;
    }
    for (const col in by) s += PA(by[col], col);
    return s;
  }
  /** Птицы-галочки в небе. */
  function birds(c, x, y, n, col) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const bx = x + rr(c, -18, 18);
      const by = y + rr(c, -8, 8);
      const q = rr(c, 1.6, 2.6);
      d += P`M${bx - q} ${by - q * 0.4}q${q * 0.5} ${-q * 0.5} ${q} ${q * 0.4}q${q * 0.5} ${-q * 0.9} ${q} ${-q * 0.4}`;
    }
    return SK(d, col || '#3A4458', 0.7, O(0.6));
  }
  /** Дым из трубы — клубы, сносимые ветром вправо. */
  function smoke(c, x, y) {
    const col = c.night ? '#7E869C' : c.slot === 2 ? '#D2BCC8' : '#EEF1F5';
    let a = '';
    let b = '';
    for (let i = 0; i < 6; i++) {
      const r = 2.2 + i * 1.3;
      const px = x + i * i * 0.85 + Math.sin(i * 1.7) * 1.2;
      const py = y - 1 - i * 4.6;
      const d = P`M${px - r} ${py}a${r} ${r * 0.85} 0 1 0 ${2 * r} 0a${r} ${r * 0.85} 0 1 0 ${-2 * r} 0`;
      if (i < 3) a += d;
      else b += d;
    }
    return PA(a, col, O(0.34)) + PA(b, col, O(0.16));
  }

  /* ======================================================================
     Титул: «жёлтый дом»
     ====================================================================== */
  NAMES.title = 'Жёлтый дом';
  SC.title = function (c) {
    const k = c.k;
    const gy = 166;
    const TRIM = '#F5F0E4';
    const TRIMD = '#D6CCBA';
    const YEL = '#E8BF5E';
    const YELD = '#CFA24A';
    const YELL = '#EECB72';
    const ROOF = '#6E8D7B';
    let s = sky(c, 0, 0, W, gy, { sx: [0.07, 0.8, 0.92, 0.5][c.slot], sy: [0.8, 0.18, 0.88][c.slot], mx: 0.8, my: 0.18, stars: 28 });
    if (c.slot < 2 && !c.winter) s += birds(c, 268, 50, 4);
    s += treeline(c, gy, 34);
    // крыша
    s += PG([[64, 60], [336, 60], [318, 37], [82, 37]], k(ROOF));
    s += R(84, 38, 232, 21, pattern(c, 7, 7, R(3.5, 0, 0.5, 7, k(dk(ROOF, 0.22)), O(0.55)))) + R(82, 37, 236, 1.4, k(lt(ROOF, 0.15)));
    let d;
    if (c.winter) s += PA('M66 59L83 36.6H317L334 59Q318 56.4 300 58.6Q270 55.4 240 58.2Q200 55.2 160 58.4Q120 55.6 96 58.2Q80 56 66 59Z', lin(c, [[0, '#FBFCFD'], [1, '#DCE4EC']]));
    // трубы
    const chim = (x, y) => R(x - 4, y, 8, 46 - y, k('#B4614A')) + R(x - 5.2, y - 2.6, 10.4, 3, k('#8E4A37')) + SK(P`M${x - 4} ${y + 5}h8M${x - 4} ${y + 10}h8`, k('#8E4A37'), 0.5, O(0.6)) + (c.winter ? RR(x - 5.4, y - 4, 10.8, 2, 1, '#F6F9FB') : '');
    s += chim(110, 26) + chim(292, 28);
    if (c.winter || c.autumn) s += smoke(c, 110, 22) + smoke(c, 292, 24);
    // фасад крыльев и ризалита, рустовка первого этажа
    s += R(72, 60, 256, gy - 60, k(YEL)) + R(156, 58, 88, gy - 58, k(YELL));
    d = '';
    for (let y = 118; y < 152; y += 6) d += P`M72 ${y}H156M244 ${y}H328M162 ${y}H186M214 ${y}H238`;
    s += SK(d, k(YELD), 0.6, O(0.65)) + R(244, 62, 3.4, gy - 62, INK, O(0.1)) + R(152.6, 62, 3.4, gy - 62, INK, O(0.05));
    // цоколь
    s += R(68, 152, 264, gy - 152, k('#B3A28A')) + R(68, 152, 264, 1.6, k('#D2C6B2')) + R(68, gy - 3, 264, 3, k('#9C8C76'));
    // пилястры
    let pl = '';
    let pd = '';
    [[72, 6.5, 64], [321.5, 6.5, 64], [156, 6, 62], [238, 6, 62], [186, 4.4, 62], [209.6, 4.4, 62]].forEach(([x, w, y0]) => {
      pl += P`M${x} ${y0}h${w}v${152 - y0}h${-w}zM${x - 1.1} ${y0}h${w + 2.2}v2.6h${-w - 2.2}zM${x - 1.1} 148.8h${w + 2.2}v3.2h${-w - 2.2}z`;
      pd += P`M${x + w - 1.3} ${y0 + 3.4}h1.3v${145.4 - y0}h-1.3zM${x - 1.1} ${y0 + 2.6}h${w + 2.2}v.8h${-w - 2.2}z`;
    });
    s += PA(pl, k(TRIM)) + PA(pd, k(TRIMD));
    // межэтажный пояс и карниз с сухариками
    s += R(70, 107.6, 260, 3.6, k(TRIM)) + R(72, 111.2, 256, 1.4, INK, O(0.1));
    s += R(64, 56, 272, 5, k(TRIM)) + R(66, 61, 268, 2.2, k(TRIMD)) + R(70, 63.2, 260, 2.2, pattern(c, 4, 4, R(0, 0, 2, 4, k(TRIM)))) + R(72, 65.4, 256, 2.6, INK, O(0.08));
    // фронтон
    s += PG([[147, 58], [253, 58], [200, 21]], k(TRIM)) + PG([[158, 54.4], [242, 54.4], [200, 28]], k(YELL));
    s += SK('M150 57.2L200 22.2L250 57.2', k(TRIMD), 0.8, O(0.7)) + R(152, 54.4, 96, 1.6, k(TRIMD));
    const nightOn = c.slot >= 2;
    s += C(200, 42, 6.6, k(TRIM)) + C(200, 42, 4.8, nightOn ? litG(c, 1) : glz(c)) + SK('M195.2 42H204.8M200 37.2V46.8', nightOn ? '#8E6040' : k('#ECE6D8'), 0.8);
    if (nightOn) c.lights.push(glow(c, 200, 42, 12, 10, '#FFC46A', 0.3 * LGT(c)));
    if (c.winter) s += PA('M147 58.4L200 20.4L253 58.4L249 58.4L200 23.6L151 58.4Z', '#F6F9FB');
    // тёплый свет низкого солнца на фасаде (утро — слева, закат — справа)
    if (c.slot === 0 || c.slot === 2) s += PA('M64 166V56H147L200 21L253 56H336V166Z', lin(c, c.slot === 2 ? [[0, '#FFA070', 0.02], [1, '#FF9A66', 0.3]] : [[0, '#FFC896', 0.26], [1, '#FFC896', 0.04]], [0, 0, 1, 0]));
    // окна
    const p = [0.16, 0, 0.55, 0.42][c.slot];
    const fl = (n, q) => Array.from({ length: n }, () => c.r() < q);
    const wings = [89, 115, 141, 259, 285, 311];
    s += archRow(c, wings, 72, 14, 29, fl(6, p)) + archRow(c, [174, 200, 226], 69, 14, 33, fl(3, p + 0.15)) + archRow(c, [89, 115, 141, 174, 226, 259, 285, 311], 122, 14, 25, fl(8, p));
    // дверь
    s += PA(archD(188, 118.6, 24, 40.4), k(TRIM)) + PA(archD(191, 121.6, 18, 36.4), k('#5E3E2B'));
    s += PA('M191 130.6A9 9 0 0 1 209 130.6Z', nightOn ? litG(c, 0) : glz(c)) + SK('M200 130.6V121.8M200 130.6L193.6 124.2M200 130.6L206.4 124.2', k('#5E3E2B'), 0.8);
    s += R(192.2, 132, 7, 25, k('#77513A')) + R(200.8, 132, 7, 25, k('#77513A')) + SK('M193.6 134h4.2v9h-4.2zM202.2 134h4.2v9h-4.2zM193.6 145.6h4.2v9h-4.2zM202.2 145.6h4.2v9h-4.2z', k('#5E3E2B'), 0.6);
    s += C(198.4, 145, 0.8, k('#E2C078')) + C(201.6, 145, 0.8, k('#E2C078'));
    if (nightOn) c.lights.push(glow(c, 200, 127, 14, 8, '#FFC46A', 0.3 * LGT(c)));
    // козырёк и фонарики у входа
    s += PA('M180 114.4H220L224.6 120H175.4Z', k('#56606B')) + R(175.4, 120, 49.2, 1.3, k('#3E464F')) + SK('M181 121.3q-3.4 4 0 8M219 121.3q3.4 4 0 8', k('#3E464F'), 0.8);
    if (c.winter) s += PA('M179.6 114.6Q200 110.6 220.4 114.6Z', '#F6F9FB');
    const wl = (x) => SK(P`M${x} 127v-3`, k('#3E464F'), 0.7) + PA(P`M${x - 2} 128.6L${x - 2.6} 124.4H${x + 2.6}L${x + 2} 128.6Z`, nightOn ? '#FFE9B0' : k('#BCC7D2')) + PG([[x - 3.2, 124.6], [x + 3.2, 124.6], [x, 122]], k('#3E464F')) + R(x - 2.2, 128.4, 4.4, 1, k('#3E464F'));
    s += wl(188.2) + wl(211.8);
    if (nightOn) c.lights.push(glow(c, 188.2, 126, 22, 22, '#FFC870', 0.42 * LGT(c)) + glow(c, 211.8, 126, 22, 22, '#FFC870', 0.42 * LGT(c)) + glow(c, 200, 172, 44, 14, '#FFD99A', 0.38 * LGT(c)));
    // газон, дорожка к воротам
    const FY = 198;
    s += lawn(c, gy, FY);
    const pathC = c.winter ? '#D3DBE4' : '#BDB2A0';
    s += PG([[166, 184], [234, 184], [247, FY], [153, FY]], k(pathC)) + SK(P`M166 184L153 ${FY}M234 184L247 ${FY}`, k(c.winter ? '#B9C4D0' : '#9A8F7C'), 1.2);
    s += tufts(c, 0, 172, 150, 24, 8) + tufts(c, 250, 172, 150, 24, 8);
    s += flowerbed(c, 112, 180, 20, 3.6) + flowerbed(c, 288, 180, 20, 3.6);
    // ступени крыльца
    for (let i = 0; i < 5; i++) {
      const y = 157 + i * 5.4;
      const w = 40 + i * 8;
      s += R(200 - w / 2, y, w, 1.9, k(c.winter && i > 1 ? '#EEF2F6' : '#DCD5C9')) + R(200 - w / 2, y + 1.9, w, 3.5, k('#A99D8D')) + R(200 - w / 2, y + 1.9, w, 0.9, INK, O(0.14));
    }
    s += sh(200, 184.8, 40, 1.8, 0.18);
    // кусты вдоль фасада
    s += hedge(c, 76, 178, gy + 1, 11) + hedge(c, 222, 326, gy + 1, 11);
    // кошка на ступенях
    s += cat(c, 206, 168.6, { pose: 'sit', s: 0.62 });
    // тротуар за оградой
    s += R(0, FY, W, H - FY, lin(c, c.winter ? [[0, k('#DCE3EA')], [1, k('#EEF2F6')]] : [[0, k('#A9A196')], [1, k('#BFB8AC')]]));
    s += R(0, FY + 2, W, 1, INK, O(0.12));
    if (c.spring || c.autumn) s += puddle(c, 292, 214, 22);
    // ограда и столбы ворот
    s += fence(c, -2, 147, 182, FY) + fence(c, 253, 402, 182, FY);
    const post = (x) =>
      sh(x, FY + 1, 9, 1.6, 0.2) + R(x - 5, FY - 26, 10, 27, k(TRIM)) + R(x + 3, FY - 26, 2, 27, k(TRIMD)) + R(x - 6.2, FY - 28.6, 12.4, 2.8, k(TRIM)) + R(x - 6.2, FY - 25.8, 12.4, 0.8, k(TRIMD)) + PG([[x - 4.4, FY - 28.6], [x + 4.4, FY - 28.6], [x, FY - 35]], k(TRIMD)) + C(x, FY - 35.6, 1.5, k(TRIM)) + (c.winter ? RR(x - 6.6, FY - 30, 13.2, 2.2, 1.1, '#F6F9FB') : '');
    s += post(150) + post(250);
    // деревья по краям и фонарь
    s += tree(c, 26, 206, 176, { bloom: true });
    s += tree(c, 388, 208, 166, { kind: 'birch' });
    s += lampPost(c, 342, 210, 108);
    s += leaves(c, 0, FY + 3, W, H - FY - 3, 30) + leaves(c, 0, 168, W, 26, 14);
    if (c.winter) s += snowfall(c, 32);
    return s;
  };
})((window.A = window.A || {}));
