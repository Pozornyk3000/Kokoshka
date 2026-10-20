/* Анамнез — иллюстрации сцен (часть C): титул «жёлтый дом», улица, парк, кафе, магазин.
   Использует общий набор помощников A.art._kit из scenes.js. */
(function (A) {
  'use strict';
  const K = A.art && A.art._kit;
  if (!K) return;
  const { SC, NAMES, W, H, P, clamp, rr, pk, mix, dk, lt, INK, CORAL, MUSTARD, LAMP, LITC, LITP, TOPS, R, RR, E, C, PA, PG, SK, TX, G, O, T, LN, sh, lin, glow, clip, pattern, LGT, skyStops, sky, winGrid, tree, leaves, snowfall, puddle, win, sunPatch, wall, floor, fluoro, person, cat, plant, mug, archD } = K;

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

  /* ---------- Машина (вид сбоку). (x, y) — середина низа колёс, dir 1 — едет вправо. ---------- */
  function car(c, x, y, col, dir) {
    const k = c.k;
    const d = dir || 1;
    const on = c.slot >= 2;
    let g = sh(0, 0.4, 25, 2.2, 0.25);
    g += PA('M-23 -4.5Q-23.6 -10.6 -18 -11.4L-11.6 -12.2L-6 -18.4Q-4.6 -19.6 -2.4 -19.6H8.8Q11.2 -19.6 12.8 -18L17.8 -12.4L21.4 -11.6Q24.6 -10.8 24.4 -6.6L24 -4.5Z', k(col));
    g += PA('M-10.2 -12.4L-5.4 -17.6Q-4.6 -18.4 -3.4 -18.4H2.2V-12.4ZM3.8 -18.4H8.6Q10.4 -18.4 11.4 -17.2L15.6 -12.4H3.8Z', on ? k('#3A4258') : k('#BFD3E2'));
    g += R(-22, -9.4, 46, 1, '#FFFFFF', O(0.25)) + SK('M2.9 -12.2V-5M-10.4 -12.2Q-11.4 -8 -10.8 -5', k(dk(col, 0.3)), 0.6);
    g += R(-3, -10.4, 3, 0.8, k(dk(col, 0.35))) + R(8, -10.4, 3, 0.8, k(dk(col, 0.35)));
    g += C(-13, -3.6, 4.2, '#23262E') + C(14, -3.6, 4.2, '#23262E') + C(-13, -3.6, 1.8, k('#9AA1AC')) + C(14, -3.6, 1.8, k('#9AA1AC'));
    g += E(23.4, -8.6, 1.2, 1.1, on ? '#FFF6D8' : k('#F3EEDC')) + R(-23.4, -9.6, 1.4, 2.4, on ? '#FF5A4A' : k('#C8553D'));
    let s = G(g, T(x, y, 1, d < 0));
    if (on) {
      const L = LGT(c);
      c.lights.push(PG([[x + d * 23, y - 9.6], [x + d * 62, y - 13], [x + d * 66, y + 2], [x + d * 23, y - 7.6]], lin(c, [[0, '#FFF2C8', 0.5 * L], [1, '#FFF2C8', 0]], d > 0 ? [0, 0, 1, 0] : [1, 0, 0, 0])) + glow(c, x + d * 23.4, y - 8.6, 6, 5, '#FFF6D8', 0.9) + glow(c, x - d * 23.4, y - 8.4, 6, 4, '#FF5A4A', 0.6));
    }
    return s;
  }

  /* ======================================================================
     Улица города N
     ====================================================================== */
  NAMES.street = 'Улица города N';
  SC.street = function (c) {
    const k = c.k;
    const gy = 168;
    const nightOn = c.slot >= 2;
    let s = sky(c, 0, 0, W, gy, { sx: [0.58, 0.14, 0.58, 0.5][c.slot], sy: [0.5, 0.06, 0.62][c.slot], mx: 0.24, my: 0.08, stars: 18 });
    // дальние высотки в просвете и над крышей
    const far = mix(c.k('#A9B3C3'), skyLow(c), 0.35);
    s += R(112, 12, 44, gy - 12, far) + R(204, 46, 66, gy - 46, far) + R(160, 22, 30, gy - 22, mix(c.k('#B9B9C6'), skyLow(c), 0.4));
    s += R(204, 42, 66, 4, mix(c.k('#8E98AA'), skyLow(c), 0.35));
    const fp = [0.06, 0, 0.5, 0.42][c.slot];
    s += winGrid(c, 116, 17, 8, 3, 2.6, 3.2, 5, 6, fp) + winGrid(c, 208, 52, 11, 18, 2.6, 3.2, 5, 6, fp);
    // панельная пятиэтажка с магазином
    const ax = -6;
    const aw = 222;
    const AC = c.winter ? '#D5D3CE' : '#DCD6CB';
    s += R(ax, 32, aw, gy - 32, k(AC)) + R(ax, 29, aw, 4, k('#A9A296')) + R(ax, 33, aw, 1.4, INK, O(0.12));
    s += R(ax + 30, 22, 26, 8, k('#C2BBAF')) + R(ax + 150, 24, 18, 6, k('#C2BBAF'));
    s += SK('M60 22V6M54 10H66M56 14H64M188 24V12M184 15H192', k('#5E6370'), 0.6);
    if (c.winter) s += R(ax, 27.6, aw, 2.4, '#F4F7FA') + R(ax + 30, 20.6, 26, 2, '#F4F7FA');
    let d = '';
    for (let y = 56; y <= 128; y += 24) d += P`M${ax} ${y}H${ax + aw}`;
    for (let x = ax + 22; x < ax + aw; x += 22) d += P`M${x} 34V130`;
    s += SK(d, k('#B4AC9F'), 0.6, O(0.8));
    s += winGrid(c, 0, 36, 10, 4, 11, 12, 22, 24);
    s += R(0, 36, 210, 96, pattern(c, 22, 24, R(5.05, 12, 0.9, 12, k('#F4F1EA')) + R(0, 16, 11, 0.9, k('#F4F1EA')) + R(-1, 23.2, 13, 0.8, k('#B4AC9F'))));
    // балконы
    d = '';
    let bd = '';
    [2, 7].forEach((i) => {
      for (let j = 0; j < 4; j++) {
        const bx = 22 * i - 3.5;
        const by = 36 + 24 * j + 8;
        d += P`M${bx} ${by}h18v8.4h-18z`;
        bd += P`M${bx} ${by}h18v1.2h-18z`;
      }
    });
    s += PA(d, k('#C9C1B3')) + PA(bd, k('#A9A193'));
    if (c.winter) s += PA(bd, '#F4F7FA', 'transform="translate(0 -1)"');
    // первый этаж: магазин «ПРОДУКТЫ 24»
    s += R(ax, 130, aw, gy - 130, k('#CBC3B5')) + R(ax, 130, aw, 2, k('#A9A193'));
    s += R(12, 133, 190, 13.4, k('#2E6A4E')) + R(12, 145.4, 190, 1.6, INK, O(0.25));
    s += TX(90, 143, 'ПРОДУКТЫ', 9.6, nightOn ? '#FFF6DA' : k('#FFFFFF'), 'font-weight="700" letter-spacing="1.2"');
    s += RR(152, 134.6, 26, 10.2, 2.4, k(MUSTARD)) + TX(165, 142.8, '24', 9, k('#2E3A2E'), 'font-weight="700"');
    if (nightOn) c.lights.push(glow(c, 106, 140, 110, 16, '#D9FFE8', 0.22 * LGT(c)));
    // витрины с полками товаров
    const vit = (x, w) => P`M${x} 149h${w}v17h${-w}z`;
    const vits = vit(16, 54) + vit(76, 54) + vit(174, 30);
    s += PA(vits, nightOn ? '#FFF1CF' : k('#E8EEF0'));
    const goods = pattern(c, 14, 6, R(0, 5.2, 14, 0.8, '#9C8C76') + R(1, 1.8, 2.6, 3.4, '#C8553D') + R(4.2, 2.6, 2.4, 2.6, '#E9B949') + R(7.2, 1.4, 2.2, 3.8, '#5B7C99') + R(10, 2.4, 3, 2.8, '#7FAE9A'));
    s += PA(vits, goods, nightOn ? '' : O(0.55));
    if (!nightOn) s += PA(vits, glz(c), O(0.45)) + SK('M28 149L20 166M52 149L44 166M96 149L88 166M120 149L112 166M188 149L181 166', '#FFFFFF', 2, O(0.2));
    s += PA(vits, 'none', 'stroke="' + k('#3E464F') + '" stroke-width="1.6"') + SK('M43 149V166M103 149V166', k('#3E464F'), 1);
    s += RR(20, 151, 19, 7.4, 1, CORAL) + TX(29.5, 156.6, 'АКЦИЯ', 4.4, '#FFFFFF', 'font-weight="700"');
    s += RR(110, 151, 16, 7.4, 1, MUSTARD) + TX(118, 156.4, '−20%', 4.4, '#2E3A2E', 'font-weight="700"');
    // дверь
    s += R(136, 147, 32, 21, k('#3E464F')) + R(138, 149, 13, 19, nightOn ? '#FFF1CF' : glz(c)) + R(153, 149, 13, 19, nightOn ? '#FFF1CF' : glz(c)) + R(148, 156, 1.2, 5, k('#C9CFD6')) + R(155, 156, 1.2, 5, k('#C9CFD6'));
    s += R(134, 166, 36, 2.4, k('#9C968C'));
    if (nightOn) c.lights.push(glow(c, 96, 158, 120, 24, '#FFE7B0', 0.3 * LGT(c)) + glow(c, 100, 174, 100, 9, '#FFE7B0', 0.38 * LGT(c)));
    // кирпичная девятиэтажка справа (уходит за кадр)
    const BC = '#C58C6C';
    s += R(262, -2, 148, gy + 2, k(BC)) + R(262, -2, 148, gy + 2, pattern(c, 8, 4, R(0, 3.4, 8, 0.6, k(dk(BC, 0.12))) + R(3.6, 0, 0.6, 3.4, k(dk(BC, 0.1))), O(0.6)));
    s += R(262, -2, 3, gy + 2, INK, O(0.12));
    s += winGrid(c, 276, 6, 6, 6, 12, 13, 23, 23);
    s += R(275, 6, 140, 138, pattern(c, 23, 23, R(5.55, 6, 0.9, 13, k('#F4F1EA')) + R(0, 10.4, 12, 0.9, k('#F4F1EA')) + R(-1, 19, 14, 1.8, k('#E8DCCB')) + (c.winter ? R(-1, 18, 14, 1, '#F6F9FB') : '')));
    s += R(262, 144, 148, gy - 144, k(dk(BC, 0.08)));
    s += R(270, 146, 18, 22, k('#4A3A32')) + R(272, 148, 14, 20, k('#6B4F3E')) + PA('M266 143H292L294 146H264Z', k('#5A6170'));
    if (nightOn) c.lights.push(glow(c, 279, 145, 12, 8, '#FFE7B0', 0.6));
    // тротуар, бордюр, дорога
    s += R(0, gy, W, 18, k(c.winter ? '#E6EBF0' : '#B9B3A9')) + R(0, gy, W, 18, pattern(c, 12, 6, R(0, 5.4, 12, 0.6, k(c.winter ? '#D2DAE3' : '#A59E93')) + R(11.4, 0, 0.6, 6, k(c.winter ? '#D2DAE3' : '#A59E93'))), O(0.7));
    s += R(0, gy, W, 1.4, INK, O(0.15));
    s += R(0, 186, W, 3, k(c.winter ? '#F2F5F8' : '#D4CFC5')) + R(0, 189, W, 1, INK, O(0.25));
    s += R(0, 189, W, H - 189, lin(c, [[0, k(c.winter ? '#7E8592' : '#5A5E68')], [1, k(c.winter ? '#8F96A2' : '#686C76')]]));
    d = '';
    for (let x = -6; x < W; x += 26) if (x < 176 || x > 236) d += P`M${x} 206.6h14v1.4h-14z`;
    s += PA(d, k('#ECEAE2'), O(0.85));
    d = '';
    for (let y = 192; y < 225; y += 6) d += P`M182 ${y}h50v3h-50z`;
    s += PA(d, k('#ECEAE2'), O(c.winter ? 0.6 : 0.9));
    if (c.winter) {
      s += PA('M0 190Q20 186 40 190T80 190T120 189.6T160 190T200 189.8T240 190T280 189.6T320 190T360 189.8T400 190V193H0Z', '#F2F5F8');
      s += SK('M0 216H180M236 216H400M0 199H180M236 199H400', '#A9B1BD', 3, O(0.35));
    }
    if (c.autumn || c.spring) s += puddle(c, 92, 214, 20) + puddle(c, 330, 197, 14);
    // остановка
    const bx = 290;
    s += sh(bx + 38, 182, 44, 2.4, 0.2);
    s += R(bx + 2, 136, 72, 32, k('#BFD3E0'), O(0.4)) + R(bx + 2, 136, 72, 32, 'none', 'stroke="' + k('#5A6170') + '" stroke-width=".8"');
    s += R(bx + 2.5, 137, 20, 30, nightOn ? '#FFF4DE' : k('#F2EBDD')) + R(bx + 5, 140, 15, 11, k('#E07A5F')) + C(bx + 12.5, 145.5, 3.4, k('#F7D06A')) + R(bx + 5, 154, 15, 1.6, k('#3F4B66')) + R(bx + 5, 157.4, 10, 1.2, k('#3F4B66'));
    if (nightOn) c.lights.push(glow(c, bx + 12.5, 152, 20, 22, '#FFF1D2', 0.5 * LGT(c)));
    s += R(bx, 134, 2.6, 48, k('#4E5562')) + R(bx + 73.4, 134, 2.6, 48, k('#4E5562'));
    s += R(bx - 3, 130, 82, 4.6, k('#3F4B66')) + R(bx - 3, 134.6, 82, 1.2, INK, O(0.25));
    if (c.winter) s += RR(bx - 3.6, 128.4, 83.2, 2.6, 1.3, '#F4F7FA');
    s += R(bx + 28, 167, 42, 2.6, k('#B5835A')) + R(bx + 31, 169.6, 1.6, 8, k('#4E5562')) + R(bx + 65, 169.6, 1.6, 8, k('#4E5562'));
    // знак остановки
    s += R(378, 132, 1.8, 52, k('#5A6170')) + RR(371.6, 122, 14.6, 14.6, 1.6, k('#F4F1EA')) + RR(373, 123.4, 11.8, 11.8, 1, k('#2F5DA8')) + TX(378.9, 132.6, 'А', 9, k('#FFFFFF'), 'font-weight="700"');
    // люди
    s += person(c, 350, 182, { s: 0.46, hands: 'phone', top: '#5B7C99', style: 'bun', coat: false });
    s += person(c, 322, 177, { s: 0.46, sit: true, top: c.winter ? '#8E5A7C' : '#C8553D', style: 'short' });
    s += person(c, 64, 184, { s: 0.48, top: c.winter ? '#3F4B66' : pk(c, TOPS), style: 'long', flip: true });
    // фонарь, деревья
    s += lampPost(c, 236, 188, 104, { kind: 'modern', dir: -1 });
    s += tree(c, 10, 190, 132, { kind: 'birch' });
    s += tree(c, 396, 190, 120);
    s += car(c, 300, 203, pk(c, ['#E9B949', '#C8553D', '#5B7C99', '#E8E6E0']), -1);
    s += leaves(c, 0, gy + 2, W, 18, 22);
    if (c.winter) s += snowfall(c, 30);
    return s;
  };

  /* ---------- Парк: утка, скамейка, урна ---------- */
  function duck(c, x, y, s, o) {
    o = o || {};
    const k = c.k;
    const he = o.hen;
    let g = E(-0.5, 0.4, 9, 1.5, '#FFFFFF', O(0.3)) + E(-0.5, 0.3, 6, 0.9, k('#2B3F4C'), O(0.25));
    g += PG([[-5, -3.4], [-9, -5], [-6.4, -1.6]], k(he ? '#7A5E44' : '#3A3A3E'));
    g += PA('M-6.6 -2.6Q-6.4 -6 -1 -6H2.6Q5.4 -6 5.6 -2.8Q5.6 -0.2 2 0H-4.4Q-6.6 -0.2 -6.6 -2.6Z', k(he ? '#A08262' : '#B9AFA0'));
    g += PA('M-4.6 -3.6Q-3 -5.6 1.6 -5.2Q-0.4 -2.6 -4.6 -3.6Z', k(he ? '#7A5E44' : '#8A7A66'));
    if (!he) g += PA('M2.6 -6Q5.4 -6 5.6 -2.8L4.4 -2.4Q3.6 -5 2.4 -5.4Z', k('#7A4E3A'));
    g += SK('M3.4 -5.4Q3.6 -8 4.6 -9', k(he ? '#8E7052' : '#2F6B4F'), 2.6) + C(5, -9.4, 2.3, k(he ? '#8E7052' : '#2F6B4F'));
    if (!he) g += SK('M3 -6.2q1 .5 2 0', '#FFFFFF', 0.7);
    g += PA('M6.6 -9.8L9.8 -9L6.8 -8.2Z', k(he ? '#E08A3C' : '#E9B949')) + C(5.6, -10, 0.45, '#16181E');
    return G(g, T(x, y, s || 1, o.flip));
  }
  function bench(c, x, gy, w) {
    const k = c.k;
    const iron = k('#2F3440');
    const wood = k('#A86F45');
    const wl = k('#C08452');
    let s = sh(x + w / 2, gy, w * 0.6, 2.2, 0.2);
    s += R(x + 3, gy - 24, 1.8, 24, iron) + R(x + w - 4.8, gy - 24, 1.8, 24, iron);
    s += R(x, gy - 23.6, w, 2.6, wl) + R(x, gy - 20, w, 2.6, wl) + R(x, gy - 16.4, w, 2.6, wl) + R(x, gy - 13.6, w, 0.8, INK, O(0.2));
    s += R(x - 1, gy - 11.8, w + 2, 2.4, wl) + R(x - 1, gy - 9.4, w + 2, 1.8, wood);
    s += SK(P`M${x + 2} ${gy}q-2 -5 0 -10M${x + w - 2} ${gy}q2 -5 0 -10M${x - 1} ${gy - 12}q-1.8 -4 1.4 -6.4M${x + w + 1} ${gy - 12}q1.8 -4 -1.4 -6.4`, iron, 1.4);
    if (c.winter) s += RR(x - 1.4, gy - 25.4, w + 2.8, 2.2, 1.1, '#F6F9FB') + RR(x - 1.6, gy - 13.4, w + 3.2, 2, 1, '#F6F9FB');
    return s;
  }
  function bin(c, x, gy) {
    const k = c.k;
    return sh(x, gy, 6, 1.2, 0.2) + PA(P`M${x - 4} ${gy - 12}H${x + 4}L${x + 3.2} ${gy}H${x - 3.2}Z`, k('#4E6B5A')) + R(x - 4.6, gy - 13.4, 9.2, 2, k('#3B5446')) + SK(P`M${x - 1.4} ${gy - 10}V${gy - 2}M${x + 1.4} ${gy - 10}V${gy - 2}`, k('#3B5446'), 0.6) + (c.winter ? RR(x - 4.8, gy - 15, 9.6, 2, 1, '#F6F9FB') : '');
  }
  /** Камыш у берега (зимой — сухой, со снегом). */
  function reeds(c, x, y, w, n) {
    const k = c.k;
    let a = '';
    let b = '';
    for (let i = 0; i < n; i++) {
      const rx = x + c.r() * w;
      const h = rr(c, 8, 16);
      const lean = rr(c, -2.5, 2.5);
      a += P`M${rx} ${y}q${lean * 0.3} ${-h * 0.5} ${lean} ${-h}`;
      if (c.r() < 0.45) b += P`M${rx + lean - 0.9} ${y - h + 1}h1.8v4.4h-1.8z`;
    }
    const st = c.winter || c.autumn ? '#B39A62' : c.spring ? '#7FAA58' : '#5E8F48';
    return SK(a, k(st), 0.8) + (b ? PA(b, k('#6B4A32')) : '');
  }

  /* ======================================================================
     Парк
     ====================================================================== */
  NAMES.park = 'Парк';
  SC.park = function (c) {
    const k = c.k;
    const hz = 134;
    let s = sky(c, 0, 0, W, hz + 2, { sx: 0.32, sy: [0.84, 0.2, 0.86][c.slot], mx: 0.3, my: 0.22, stars: 30 });
    if (c.slot < 2 && !c.winter) s += birds(c, 300, 36, 3);
    s += treeline(c, hz + 2, 28) + treeline(c, hz + 3, 18, { haze: 0.18 });
    s += lawn(c, hz);
    // пруд
    const cx = 132;
    const cy = 156;
    const rx = 106;
    const ry = 18;
    const pond = (ex, ey) => P`M${cx - rx - ex} ${cy}C${cx - rx - ex} ${cy - ry - ey} ${cx - rx * 0.3} ${cy - ry - ey} ${cx} ${cy - ry - ey}C${cx + rx * 0.5} ${cy - ry - ey} ${cx + rx + ex} ${cy - ry * 0.8 - ey} ${cx + rx + ex} ${cy}C${cx + rx + ex} ${cy + ry + ey} ${cx + rx * 0.2} ${cy + ry + ey} ${cx - rx * 0.2} ${cy + ry * 0.95 + ey}C${cx - rx * 0.7} ${cy + ry * 0.9 + ey} ${cx - rx - ex} ${cy + ry * 0.8 + ey} ${cx - rx - ex} ${cy}Z`;
    s += PA(pond(5, 3.4), k(c.winter ? '#E6ECF2' : '#B9A98A'));
    const pc = clip(c, PA(pond(0, 0), '#000'));
    const st = skyStops(c);
    let w = '';
    if (c.winter) {
      w += R(cx - rx, cy - ry, rx * 2, ry * 2 + 2, lin(c, [[0, k('#E8EFF5')], [1, k('#BCCDDC')]]));
      w += SK(P`M${cx - 60} ${cy - 4}l14 3l10 -4l16 5M${cx + 10} ${cy + 6}l12 -3l9 4l14 -2M${cx - 20} ${cy + 10}l8 -5l12 2`, k('#9DB2C6'), 0.6, O(0.8));
      w += SK(P`M${cx + 30} ${cy - 2}c10 -6 26 -4 22 2s-24 6 -20 0M${cx - 50} ${cy + 6}c8 -4 20 -3 18 1`, '#FFFFFF', 0.7, O(0.8));
      w += PA(P`M${cx - rx} ${cy - ry}H${cx + rx}V${cy - ry + 5}Q${cx + 60} ${cy - ry + 9} ${cx + 20} ${cy - ry + 5}Q${cx - 30} ${cy - ry + 10} ${cx - 70} ${cy - ry + 5}Q${cx - 90} ${cy - ry + 8} ${cx - rx} ${cy - ry + 6}Z`, '#F7FAFC', O(0.85)) + E(cx - 30, cy + 4, 26, 3.4, '#FFFFFF', O(0.4)) + E(cx + 52, cy - 2, 20, 2.6, '#FFFFFF', O(0.4));
    } else {
      w += R(cx - rx, cy - ry, rx * 2, ry * 2 + 2, lin(c, [[0, mix(st[st.length - 1][1], '#3E6E78', 0.25)], [1, mix(st[0][1], '#2E5662', 0.3)]]));
      // отражения деревьев и светила
      w += PA(P`M${cx - rx} ${cy - ry}H${cx + rx}V${cy - ry + 7}Q${cx + 70} ${cy - ry + 12} ${cx + 40} ${cy - ry + 8}Q${cx} ${cy - ry + 14} ${cx - 40} ${cy - ry + 9}Q${cx - 80} ${cy - ry + 13} ${cx - rx} ${cy - ry + 8}Z`, k(c.autumn ? '#7A5A3A' : '#2F5A42'), O(0.35));
      const lx = 0.32 * W;
      if (c.slot !== 1) w += PA(P`M${lx - 9} ${cy - 13}h18v1.6h-18zM${lx - 7} ${cy - 8}h14v1.4h-14zM${lx - 10} ${cy - 3}h20v1.4h-20zM${lx - 6} ${cy + 2}h12v1.2h-12zM${lx - 8} ${cy + 7}h16v1.2h-16z`, c.night ? '#FBF3D8' : '#FFD9A0', O(c.night ? 0.5 : 0.6));
      w += SK(P`M${cx - 80} ${cy + 4}h18M${cx - 44} ${cy + 10}h24M${cx + 20} ${cy + 2}h22M${cx + 50} ${cy + 11}h16M${cx - 10} ${cy - 6}h14`, '#FFFFFF', 0.7, O(0.35));
    }
    s += G(w, pc);
    s += reeds(c, cx - rx - 4, cy + 6, 22, 12) + reeds(c, cx + rx - 18, cy + 4, 24, 12);
    if (c.summer || c.spring) s += duck(c, 92, 160, 0.9) + duck(c, 112, 165, 0.8, { hen: true }) + duck(c, 170, 158, 0.85, { flip: true });
    else if (c.autumn) s += duck(c, 150, 162, 0.85, { flip: true });
    // деревья за прудом
    s += tree(c, 40, 140, 92, { kind: 'fir', shadow: false }) + tree(c, 76, 139, 72, { shadow: false, bloom: true }) + tree(c, 188, 140, 100, { kind: 'birch', shadow: false }) + tree(c, 156, 138, 50, { shadow: false });
    s += tree(c, 318, 138, 86, { shadow: false }) + tree(c, 362, 140, 98, { kind: 'fir', shadow: false }) + tree(c, 280, 137, 52, { kind: 'birch', shadow: false });
    // дорожка: S-образная, сужается к горизонту
    const pts = [];
    const B = (t, a, b, cc, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * cc + t ** 3 * d;
    const L = [];
    const Rr = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const px = B(t, 268, 200, 380, 300);
      const py = B(t, 228, 190, 150, hz + 1);
      const hw = (1 - t) * 42 + 2.5;
      L.push([px - hw, py]);
      Rr.push([px + hw, py]);
    }
    pts.push(...L, ...Rr.reverse());
    s += PG(pts, k(c.winter ? '#D9E1E9' : '#C9B994'));
    s += PG(pts.map((p) => [p[0], p[1]]), 'none', 'stroke="' + k(c.winter ? '#C3CDD8' : '#A8976F') + '" stroke-width="1"');
    // скамейка, урна, фонарь, человек
    s += lampPost(c, 236, 184, 98);
    s += bench(c, 312, 186, 50);
    s += person(c, 344, 186, { s: 0.5, sit: true, hands: c.slot === 3 ? 'phone' : 'lap', top: c.winter ? '#3F4B66' : '#5B7C99', style: 'bob' });
    s += bin(c, 374, 187);
    // крупные деревья переднего плана
    s += tree(c, 20, 214, 190, { bloom: true }) + tree(c, 394, 206, 150, { kind: 'birch' });
    s += tufts(c, 40, 176, 190, 46, 14) + tufts(c, 330, 196, 70, 26, 6);
    if (c.summer || c.spring) {
      const by = {};
      for (let i = 0; i < 26; i++) {
        const fx = rr(c, 40, 230);
        const fy = rr(c, 182, 222);
        const col = k(pk(c, c.spring ? ['#F7F4EA', '#F2D35C', '#F7F4EA'] : ['#F7F4EA', '#F2D35C', '#E9A0B8', '#B9A3E0']));
        by[col] = (by[col] || '') + P`M${fx - 1} ${fy}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`;
      }
      for (const col in by) s += PA(by[col], col);
    }
    s += leaves(c, 30, 180, 360, 44, 46);
    if (c.winter) s += snowfall(c, 36);
    return s;
  };

  /* ---------- Гирлянда лампочек: провисающие дуги между точками ---------- */
  function garland(c, pts, sag, step) {
    const L = LGT(c);
    let wire = '';
    let bulbs = '';
    let gl = '';
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x2, y2] = pts[i + 1];
      const x1 = (x0 + x2) / 2;
      const y1 = (y0 + y2) / 2 + sag * 2;
      wire += P`M${x0} ${y0}Q${x1} ${y1} ${x2} ${y2}`;
      const n = Math.max(2, Math.round((x2 - x0) / step));
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
        const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2 + 2.2;
        bulbs += P`M${bx - 1.5} ${by}a1.5 1.8 0 1 0 3 0a1.5 1.8 0 1 0 -3 0`;
        gl += glow(c, bx, by, 7, 7, '#FFC870', 0.5 + 0.3 * L);
      }
    }
    c.lights.push(gl + PA(bulbs, '#FFF0C4'));
    return SK(wire, '#2A2420', 0.6, O(0.8));
  }

  /* ======================================================================
     Кафе-бар
     ====================================================================== */
  NAMES.cafe = 'Кафе-бар';
  SC.cafe = function (c) {
    c.indoor = true;
    const fy = 178;
    const TEAL = '#2F5652';
    const L = LGT(c);
    let s = R(0, 0, W, fy, lin(c, [[0, '#2A4D49'], [1, TEAL]]));
    // кирпичная стена за стойкой
    s += R(0, 0, 222, fy, pattern(c, 16, 8, R(0, 0, 16, 8, '#A95C42') + R(0, 0, 7.4, 3.5, '#994F38', O(0.7)) + R(8, 4, 7.4, 3.5, '#B96B4F', O(0.7)) + R(0, 3.5, 16, 0.6, '#CDA58C') + R(0, 7.5, 16, 0.6, '#CDA58C') + R(15.4, 0, 0.6, 3.5, '#CDA58C') + R(7.4, 4, 0.6, 3.5, '#CDA58C')));
    s += R(0, 0, 222, fy, lin(c, [[0, INK, 0.25], [0.5, INK, 0], [1, INK, 0.15]]));
    s += R(222, 0, 3, fy, INK, O(0.3));
    // деревянные панели справа
    s += R(225, 126, 175, fy - 126, '#5A3D2B') + R(225, 126, 175, 2.6, '#7E5539') + R(225, 128.6, 175, 1, INK, O(0.25)) + R(225, 126, 175, fy - 126, pattern(c, 22, 60, R(0, 0, 1, 60, '#3E2A1E', O(0.6)) + R(1, 0, 1, 60, '#7E5539', O(0.4))));
    s += floor(c, fy, '#7A5236', { n: 18 });
    // меню-доска
    s += R(18, 12, 76, 46, '#7A5238') + R(21, 15, 70, 40, '#262C2A') + R(21, 15, 70, 40, '#FFFFFF', O(0.03));
    s += TX(56, 25.4, 'МЕНЮ', 7.4, '#F4EFE4', 'font-weight="700" letter-spacing="1"') + SK('M36 28.6H76', '#E9E3D3', 0.4, O(0.6));
    s += TX(56, 35, 'КОФЕ  150', 4.8, '#E9E3D3') + TX(56, 42, 'ЧАЙ    90', 4.8, '#E9E3D3') + TX(56, 49, 'ПИРОГ 180', 4.8, '#E9E3D3');
    s += SK('M80 20q2 3 0 5M83 20q2 3 0 5M78 26h9l-1.4 4.6h-6.2zM87 27q2.4 0 1.6 2.4', '#F4EFE4', 0.5, O(0.75));
    // неон «БАР» с бокалом
    const neon = TX(150, 46, 'БАР', 19, 'none', 'stroke="#FF8CC6" stroke-width="1.5" font-weight="700" letter-spacing="2"') + SK('M184 24h16l-8 9zM192 33v10M187 43h10', '#7FE3E0', 1.3);
    s += neon;
    c.lights.push(glow(c, 162, 34, 58, 26, '#FF6FB0', 0.22 + 0.2 * L) + neon + TX(150, 46, 'БАР', 19, 'none', 'stroke="#FFE3F1" stroke-width=".5" font-weight="700" letter-spacing="2"'));
    // полки с бутылками
    const by = {};
    const add = (col, d) => (by[col] = (by[col] || '') + d);
    const BOT = ['#3E7A55', '#8C3B2E', '#C9A13B', '#5B7C99', '#E8E1CF', '#6E4A7E', '#2F4E3E', '#B5654A'];
    let sh2 = '';
    [68, 96].forEach((yb) => {
      let x = 14 + c.r() * 4;
      while (x < 198) {
        const roll = c.r();
        if (roll < 0.62) {
          const h = rr(c, 13, 18);
          const w = rr(c, 4, 5.4);
          const col = pk(c, BOT);
          add(col, P`M${x} ${yb}v${-h * 0.62}q0 -2 ${w * 0.3} -2.6v${-h * 0.3}h${w * 0.4}v${h * 0.3}q${w * 0.3} .6 ${w * 0.3} 2.6v${h * 0.62}z`);
          sh2 += P`M${x + 0.8} ${yb - 1.5}v${-h * 0.5}h.9v${h * 0.5}z`;
          if (c.r() < 0.5) add('#F1E6D2', P`M${x + 0.4} ${yb - h * 0.45}h${w - 0.8}v${h * 0.2}h${0.8 - w}z`);
          x += w + rr(c, 0.8, 2.2);
        } else if (roll < 0.85) {
          add('#D9E6EA', P`M${x} ${yb - 8}h5l-1 8h-3z`);
          x += 6.5;
        } else {
          add('#C8C2B4', P`M${x} ${yb}v-6h6v6z`);
          add(pk(c, ['#E07A5F', '#E9B949', '#9CC3B2']), P`M${x + 0.6} ${yb - 0.6}v-3.4h4.8v3.4z`);
          x += 8;
        }
      }
    });
    for (const col in by) s += PA(by[col], col);
    s += PA(sh2, '#FFFFFF', O(0.3));
    s += R(10, 68, 196, 3.2, '#6B4630') + R(10, 96, 196, 3.2, '#6B4630') + R(10, 71.2, 196, 1.4, INK, O(0.3)) + R(10, 99.2, 196, 1.4, INK, O(0.3));
    // бармен
    s += person(c, 92, 136, { bust: true, s: 0.66, top: '#2F3B5C', hands: 'table', style: 'short', hair: '#433026' });
    s += R(84.4, 113.2, 15.2, 6, '#F1E6D2', O(0.9));
    // стойка
    s += sh(100, 193, 106, 4.4, 0.25);
    s += R(0, 124, 200, 66, '#6E4A33') + R(0, 124, 200, 66, pattern(c, 14, 70, R(0, 0, 1, 70, '#4E3324', O(0.7)) + R(1, 0, 1, 70, '#8A5E40', O(0.5))));
    s += R(0, 186, 200, 4, '#3A281C') + SK('M0 178H198', '#D2A956', 1.6) + SK('M40 178v8M120 178v8M190 178v8', '#D2A956', 1);
    s += R(-2, 115, 206, 9, '#C99A68') + R(-2, 115, 206, 1.4, '#E2B884') + R(-2, 124, 206, 2, '#7A4E30');
    // кофемашина, краны, витрина с пирогом
    s += sh(36, 117, 18, 1.6, 0.25) + R(22, 95, 30, 22, '#C9CFD6') + R(22, 95, 30, 4, '#9AA3AE') + R(25, 101, 24, 3, '#2A2F3C') + R(30, 104, 2, 5, '#3A3F4A') + R(42, 104, 2, 5, '#3A3F4A');
    s += RR(28, 110, 5, 5, 1, '#FBFAF4') + RR(40, 110, 5, 5, 1, '#FBFAF4') + C(26, 98, 1, '#E07A5F') + C(48, 98, 1, '#7FAE9A');
    s += R(118, 100, 26, 3, '#B8BEC6') + R(122, 103, 2, 8, '#B8BEC6') + R(130, 103, 2, 8, '#B8BEC6') + R(138, 103, 2, 8, '#B8BEC6') + RR(121, 92, 4, 9, 1.4, '#2A2F3C') + RR(129, 92, 4, 9, 1.4, '#C8553D') + RR(137, 92, 4, 9, 1.4, '#E9B949');
    s += PA('M120 115V105h7v10zM130 115V105h7v10z', '#E9B949', O(0.85)) + R(120, 104, 7, 2.2, '#FBF6E6') + R(130, 104, 7, 2.2, '#FBF6E6');
    s += E(172, 115, 14, 1.6, '#D9DEE3') + PA('M161 114Q161 98 172 98Q183 98 183 114Z', '#DDEBF0', O(0.45)) + PA('M164 114V107L176 104L180 107V114Z', '#F1E6D2') + PA('M164 107L176 104L180 107L168 110Z', '#C8553D') + R(164, 110, 16, 1.4, '#8A5A36', O(0.6)) + PA('M164 101Q166 99 168 101', 'none', 'stroke="#FFFFFF" stroke-width=".8" opacity=".7"');
    s += R(190, 106, 7, 9, '#DDEBF0', O(0.6)) + R(190.6, 111, 5.8, 3.4, '#9CC3B2', O(0.8));
    c.lights.push(glow(c, 100, 112, 150, 60, '#FFC870', 0.18 + 0.14 * L));
    // высокие табуреты
    const stool = (x) =>
      sh(x, 199, 11, 1.8, 0.22) + SK(P`M${x - 7} 199L${x - 3} 152M${x + 7} 199L${x + 3} 152M${x} 199V152`, '#2F333C', 1.4) + E(x, 180, 6.4, 1.6, 'none', 'stroke="#2F333C" stroke-width="1.1"') + RR(x - 10, 148, 20, 4.4, 2, '#3A2C26') + E(x, 148, 10, 2.4, '#8A3B2E') + E(x - 3, 147.6, 4, 0.8, '#FFFFFF', O(0.2));
    s += stool(34) + stool(96) + stool(158);
    // окно на улицу и диванчик
    s += win(c, 246, 24, 112, 84, { view: 'street', wall: TEAL, frame: '#2A2F2E', ft: 2.4, v: [0.5], h: [0.64], sillCol: '#7A5238' });
    sunPatch(c, 246, 112, fy, 36);
    s += sh(303, 186, 66, 3.4, 0.22) + RR(240, 116, 126, 46, 6, '#3F4F70') + RR(244, 120, 118, 36, 5, '#4B5E84') + SK('M262 122v32M282 122v32M302 122v32M322 122v32M342 122v32', '#3F4F70', 0.8, O(0.7));
    s += RR(238, 154, 130, 12, 4, '#3F4F70') + R(242, 166, 122, 18, '#2E3A54');
    // друзья за столиком
    s += person(c, 282, 182, { sit: true, s: 0.7, hands: 'table', top: '#C8553D', style: 'long', hair: '#8C6442', smile: true });
    s += person(c, 326, 182, { sit: true, s: 0.7, hands: 'table', top: '#7FAE9A', style: 'short', glasses: true, smile: true });
    s += sh(304, 200, 34, 2.6, 0.25) + R(302, 162, 4, 36, '#2F333C') + E(304, 198, 14, 2.4, '#2F333C') + RR(264, 158, 80, 5, 2, '#8A5A36') + R(264, 158, 80, 1.4, '#B07C52');
    s += mug(274, 158, '#F1E6D2', c.slot !== 1) + PA('M318 158V145h8v13z', '#E9B949', O(0.9)) + R(318, 143, 8, 3, '#FBF6E6') + R(319, 147, 1.2, 9, '#FFFFFF', O(0.4));
    s += E(298, 157.4, 8, 1.6, '#F4F1EA') + PA('M294 156.6L302 154.4L303 156.6Z', '#C8553D') + R(334, 155, 5, 3, '#2A2F3C');
    c.lights.push(glow(c, 304, 152, 70, 34, '#FFC870', 0.12 + 0.16 * L));
    // часы, картина, растение
    s += K.clockFace(379, 40, 9, K.SLOT_HM[c.slot][0], K.SLOT_HM[c.slot][1]);
    s += K.framed(366, 62, 26, 34, R(368.6, 64.6, 20.8, 28.8, '#E9DCC4') + C(379, 74, 6, '#E07A5F') + PA('M368.6 93.4L376 82L382 88L389.4 80V93.4Z', '#7FAE9A'), '#2A2420');
    s += plant(c, 384, 204, 'monstera', 1.15, { pot: '#C9A04A' });
    // гирлянда под потолком
    s += garland(c, [[-4, 3], [132, 7], [268, 4], [404, 6]], 7, 12);
    return s;
  };

  /* ---------- Магазин у дома ---------- */
  NAMES.shop = 'Магазин «Продукты 24»';
  SC.shop = function (c) {
    c.indoor = true;
    const fy = 172;
    let s = wall(c, 0, fy, '#EDEFE6');
    s += R(0, 0, W, 22, '#2F6B4F') + TX(130, 15, 'ПРОДУКТЫ 24', 10, '#F6F2E6', 'font-weight="700" letter-spacing="2"');
    s += floor(c, fy, '#C9C2B2', { n: 12, cross: 0.22, gloss: true });
    // окно-витрина справа
    s += win(c, 300, 30, 88, 52);
    // стеллажи
    const PROD = ['#C8553D', '#E9B949', '#5B7C99', '#7FAE9A', '#8E5A7C', '#F1E6D2', '#D98E5F', '#3F4B66', '#E07A5F', '#A9B18F'];
    for (let u = 0; u < 3; u++) {
      const x0 = 10 + u * 82;
      s += R(x0, 34, 76, fy - 34, '#9AA3A6') + R(x0 + 3, 37, 70, fy - 40, '#D9DEDA');
      for (let k = 0; k < 4; k++) {
        const sy = 66 + k * 27;
        s += R(x0 + 2, sy, 72, 3, '#7D878B');
        let x = x0 + 5;
        while (x < x0 + 68) {
          const w = rr(c, 5, 10);
          const h = rr(c, 9, 20);
          const col = pk(c, PROD);
          s += RR(x, sy - h, w, h, 1.2, col) + R(x + 1, sy - h + 2, w - 2, 2, '#FFFFFF', O(0.35));
          x += w + rr(c, 1, 2.5);
        }
        if (c.r() < 0.4) s += R(x0 + 10 + c.r() * 40, sy + 3, 14, 6, '#FFD84A');
      }
      s += RR(x0 + 18, 40, 40, 11, 2, CORAL) + TX(x0 + 38, 48.5, 'АКЦИЯ', 7, '#FFFFFF', 'font-weight="700"');
    }
    s += fluoro(c, 40, 24, 70) + fluoro(c, 160, 24, 70) + fluoro(c, 290, 24, 70);
    // касса
    s += R(262, 128, 132, 44, '#8A5A36') + R(262, 124, 132, 6, '#B98556') + R(270, 118, 70, 6, '#3A3F44');
    s += RR(346, 104, 26, 18, 2, '#2A2C33') + R(349, 107, 20, 12, '#9CD3E6') + R(357, 122, 4, 4, '#2A2C33');
    s += RR(300, 124, 22, 5, 1, '#E9B949');
    s += person(c, 318, 124, { bust: true, s: 0.62, top: '#C8553D', hands: 'table', style: 'bun', hair: '#5E412E' });
    // ящики с фруктами на переднем плане
    const FR = [['#D9442E', '#F06A4F'], ['#F2A13A', '#FFC266'], ['#9BBF4A', '#C1DD6E'], ['#E9C94A', '#FFE27A']];
    for (let b = 0; b < 4; b++) {
      const bx = 14 + b * 46;
      const [fc, fl] = FR[b];
      s += R(bx, 196, 42, 26, '#A9744F') + R(bx, 196, 42, 4, '#C99364') + R(bx + 2, 206, 38, 2, '#8A5A36', O(0.6)) + R(bx + 2, 214, 38, 2, '#8A5A36', O(0.6));
      for (let k = 0; k < 7; k++) {
        const fx = bx + 6 + (k % 4) * 10 + (k > 3 ? 5 : 0);
        const fy2 = k > 3 ? 188 : 194;
        s += C(fx, fy2, 5, fc) + C(fx - 1.5, fy2 - 1.5, 1.6, fl);
      }
      s += R(bx + 12, 200, 18, 8, '#FFFFFF') + TX(bx + 21, 206.5, (59 + b * 40) + '₽', 5.5, INK, 'font-weight="700"');
    }
    // покупатель с корзиной
    s += person(c, 236, 214, { s: 0.78, top: c.season === 'winter' ? '#3F4B66' : '#7FAE9A', style: 'short', flip: true });
    s += RR(204, 176, 20, 13, 2, '#C8553D') + SK(P`M206 176Q214 166 222 176`, '#8A2E22', 1.4) + R(207, 173, 5, 4, '#E9B949') + R(214, 172, 5, 5, '#7FAE9A');
    if (c.slot >= 2) c.lights.push(glow(c, 359, 113, 40, 22, '#BFE6F5', 0.3));
    return s;
  };
})((window.A = window.A || {}));
