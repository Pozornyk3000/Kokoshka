/* Выбор диагноза из полного списка МКБ-10: поиск по коду и словам, разделы класса V и другие классы.
   UI.icd.picker({ act, sel }) — act: обработчик выбора (data-act), sel — ключ выбранной записи. На экране одновременно
   бывает один такой список; текст поиска хранится в UI.view.icdQ, раздел — в UI.view.icdBlock. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = A.data;
  const UI = A.ui;
  const esc = U.esc;
  const MAX = 60;

  UI.icd = {};
  UI.icd.reset = function () {
    UI.view.icdQ = '';
    UI.view.icdBlock = null;
  };

  function items(act, sel) {
    const q = UI.view.icdQ || '';
    const block = UI.view.icdBlock || null;
    const res = A.icd.search(q, block);
    if (!q.trim() && !block) return '<p class="small dim icd-hint">Начните вводить код (например, F32) или слова из названия (например, «паническое»), или выберите раздел.</p>';
    if (!res.length) return '<p class="small dim icd-hint">Ничего не нашлось. Попробуйте другое слово или часть кода.</p>';
    let out = res.length > 4 ? '<p class="small dim icd-hint">Найдено: ' + res.length + ' — список прокручивается.</p>' : '';
    out += res
      .slice(0, MAX)
      .map(
        (e) =>
          '<button type="button" class="opt icd-item" data-act="' + act + '" data-arg="' + esc(e.k) + '" aria-pressed="' + (sel === e.k) + '">' +
          '<span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t"><b class="mono">' + esc(e.c) + '</b> ' + esc(e.t) + '</span></span></button>'
      )
      .join('');
    if (res.length > MAX) out += '<p class="small dim icd-hint">Показаны первые ' + MAX + ' из ' + res.length + ' — уточните запрос.</p>';
    return out;
  }

  UI.icd.picker = function (o) {
    const act = o.act;
    const sel = o.sel || null;
    const block = UI.view.icdBlock || null;
    const chosen = sel ? A.icd.get(sel) : null;
    UI.view.icdAct = act;
    UI.view.icdSel = sel;
    return (
      '<div class="icd">' +
      (chosen ? '<p class="icd-sel"><span class="eyebrow">Ваш выбор</span><span class="hand">' + esc(chosen.c + ' ' + chosen.t) + '</span></p>' : '') +
      '<label class="field" for="icd-q"><span class="label">Поиск по МКБ-10 — код или слова</span><input id="icd-q" type="search" value="' + esc(UI.view.icdQ || '') + '" placeholder="например, F41 или тревожное" autocomplete="off" spellcheck="false"></label>' +
      '<div class="chipbar icd-blocks" role="group" aria-label="Разделы">' +
      D.icdBlocks
        .map((b) => '<button type="button" class="chipbtn" data-act="icd-block" data-arg="' + b.id + '" aria-pressed="' + (block === b.id) + '" title="' + esc(b.t) + '">' + esc(b.id === 'X' ? 'другие' : b.code) + '</button>')
        .join('') +
      '</div>' +
      (block ? '<p class="small dim">' + esc((D.icdBlocks.find((b) => b.id === block) || {}).t || '') + '</p>' : '') +
      '<div id="icd-list" class="opts icd-list">' + items(act, sel) + '</div>' +
      '</div>'
    );
  };

  document.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'icd-q') return;
    UI.view.icdQ = e.target.value;
    const list = document.getElementById('icd-list');
    if (list && UI.view.icdAct) list.innerHTML = items(UI.view.icdAct, UI.view.icdSel);
  });
  UI.on('icd-block', (b) => {
    UI.view.icdBlock = UI.view.icdBlock === b ? null : b;
    const inp = document.getElementById('icd-q');
    if (inp) UI.view.icdQ = inp.value;
    UI.render();
  });
})((window.A = window.A || {}));
