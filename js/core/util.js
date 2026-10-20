/* Анамнез — общие утилиты: случайность, форматирование, текст. */
(function (A) {
  'use strict';
  const U = (A.util = {});

  /* ---------- Случайные числа ---------- */
  U.mulberry32 = function (seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (str) {
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  U.rnd = Math.random;
  U.int = (a, b, r) => a + Math.floor((r || Math.random)() * (b - a + 1));
  U.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
  U.chance = (p, r) => (r || Math.random)() < p;
  U.shuffle = function (arr, r) {
    const a = arr.slice();
    r = r || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  };
  U.weighted = function (items, weightFn, r) {
    r = r || Math.random;
    let total = 0;
    const ws = items.map((it) => {
      const w = Math.max(0, weightFn(it) || 0);
      total += w;
      return w;
    });
    if (total <= 0) return null;
    let x = r() * total;
    for (let i = 0; i < items.length; i++) {
      x -= ws[i];
      if (x < 0) return items[i];
    }
    return items[items.length - 1];
  };
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /* ---------- Числа ---------- */
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.round = (v) => Math.round(v);
  U.groups = (n) => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  U.money = (n) => (n < 0 ? '−' : '') + U.groups(n) + ' ₽';
  U.signedMoney = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + U.groups(n) + ' ₽';
  U.signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n));
  U.plural = function (n, forms) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };

  /* ---------- Текст ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  /**
   * Подстановки в тексте:
   *  {пришёл|пришла} — форма по полу игрока;
   *  {name} — имя игрока; {P}, {age} и любые ключи из extra.
   */
  U.t = function (str, extra) {
    if (str == null) return '';
    const s = A.state;
    const female = !!(s && s.player && s.player.gender === 'f');
    let out = String(str).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (m, a, b) => (female ? b : a));
    out = out.replace(/\{([A-Za-z_][\w]*)\}/g, (m, k) => {
      if (extra && Object.prototype.hasOwnProperty.call(extra, k)) return extra[k];
      if (k === 'name') return U.esc(s && s.player ? s.player.name : 'Саша');
      return m;
    });
    return out;
  };

  /** Мини-разметка: абзацы, **жирный**, *курсив*, списки «• », ссылки на глоссарий [[ключ]]. */
  U.md = function (str, extra) {
    const txt = U.t(str, extra).trim();
    if (!txt) return '';
    const blocks = txt.split(/\n\s*\n/);
    return blocks
      .map((b) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[•\-–]\s+/.test(l))) {
          return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[•\-–]\s+/, '')) + '</li>').join('') + '</ul>';
        }
        return '<p>' + inline(lines.join('<br>')) + '</p>';
      })
      .join('');
  };
  function inline(s) {
    return s
      .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0')
      .replace(/ (₽|%)/g, '\u00a0$1')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(«])\*([^*\s][^*]*?)\*(?=[\s).,:;!?»]|$)/g, '$1<em>$2</em>');
  }
  U.inline = inline;

  /** Короткий текст без абзацев. */
  U.line = (str, extra) => inline(U.t(str, extra));

  U.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  U.list = function (arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' и ' + arr[arr.length - 1];
  };
  U.deepCopy = (o) => JSON.parse(JSON.stringify(o));
})((window.A = window.A || {}));
