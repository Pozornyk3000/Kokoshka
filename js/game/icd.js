/* МКБ-10: поиск по каталогу (js/data/icd.js) и оценка диагноза, выбранного из полного списка.
   Вариант ответа задачи сопоставляется с записью каталога по коду в начале текста («F32.1 …»), а если кода нет
   или под одним кодом несколько записей — по описанию (поле m записи). Верная рубрика с неверным уточнением
   (F32.0 вместо F32.1) засчитывается наполовину. */
(function (A) {
  'use strict';
  const D = () => A.data;
  const I = (A.icd = {});
  const CODE = /^([A-Z]\d\d(?:\.\d{1,2})?)(?=[\s,;:)]|$)/;

  I.norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
  I.code = function (text) {
    const m = String(text || '').trim().match(CODE);
    return m ? m[1] : null;
  };

  let idx = null;
  function index() {
    const list = D().icd || [];
    if (idx && idx.n === list.length) return idx;
    const byKey = {};
    const byCode = {};
    list.forEach((e) => {
      byKey[e.k] = e;
      (byCode[e.c] = byCode[e.c] || []).push(e);
      e.n = I.norm(e.c + ' ' + e.t);
    });
    idx = { n: list.length, byKey, byCode };
    return idx;
  }
  I.get = (k) => index().byKey[k] || null;
  I.label = (k) => {
    const e = I.get(k);
    return e ? e.c + ' ' + e.t : '';
  };

  /** Запись каталога для текста варианта ответа. */
  I.entryFor = function (text) {
    const ix = index();
    const c = I.code(text);
    if (c) {
      const list = ix.byCode[c] || [];
      if (list.length <= 1) return list[0] || null;
      return list.find((e) => e.m && e.m.test(text)) || list.find((e) => !e.m) || list[0];
    }
    return (D().icd || []).find((e) => e.m && e.m.test(text)) || null;
  };

  const okDefault = (o) => (o.ok === true ? 1 : typeof o.part === 'number' ? o.part : o.part || o.ok === 'part' ? 0.5 : 0);

  /** Оценка выбора: { score 0..1, opt — вариант задачи, если выбранный диагноз среди них, right — верный вариант, cat — та же рубрика }. */
  I.judge = function (opts, key, okOf) {
    okOf = okOf || okDefault;
    const right = opts.find((o) => okOf(o) === 1) || null;
    const e = I.get(key);
    if (!e) return { score: 0, right, entry: null };
    const i = opts.findIndex((o) => {
      const oe = I.entryFor(o.t);
      return oe && oe.k === e.k;
    });
    if (i >= 0) return { score: okOf(opts[i]), opt: opts[i], right, entry: e };
    const re = right ? I.entryFor(right.t) : null;
    const rc = re ? re.c : right ? I.code(right.t) : null;
    if (rc && e.c && rc[0] === 'F' && e.c.slice(0, 3) === rc.slice(0, 3)) return { score: 0.5, cat: true, right, entry: e };
    return { score: 0, right, entry: e };
  };

  /** Поиск по коду и словам. block — 'F0'…'F9' или 'X'. */
  I.search = function (q, block) {
    index();
    const words = I.norm(q)
      .split(/[\s,;]+/)
      .map((w) => w.replace(/^[«"(]+|[»")]+$/g, ''))
      .filter(Boolean);
    const list = D().icd || [];
    if (!words.length) return block ? list.filter((e) => e.b === block) : [];
    const res = list.filter((e) => (!block || e.b === block) && words.every((w) => e.n.indexOf(w) >= 0));
    // сначала точный код, затем рубрики с этим кодом, затем названия, которые начинаются с первого слова запроса
    const code = words[0].toUpperCase();
    const rank = (e) => (e.c === code ? 0 : e.c.indexOf(code) === 0 ? 1 : I.norm(e.t).indexOf(words[0]) === 0 ? 2 : 3);
    return res.map((e, i) => [rank(e), i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
  };

  /** Все ли варианты ответа задач находятся в каталоге (для проверки данных). */
  I.unmatched = function (opts) {
    return opts.filter((o) => !I.entryFor(o.t)).map((o) => o.t);
  };
})((window.A = window.A || {}));
