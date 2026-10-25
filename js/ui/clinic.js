/* Интерфейс амбулаторного приёма: список дня (звонки, записанные, первичные), визит — жалобы, осмотр, шкала, беседа,
   назначения с дозой и временем приёма, анализы, следующий визит; амбулаторная карта (записи, лечение, анализы, анамнез),
   направление в стационар и перевод на редкие визиты с разбором. Картотека участка — в справочнике и профиле. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = A.game;
  const UI = A.ui;
  const ACT = UI.act;
  const W = A.ward;
  const P = A.pharma;
  const M = A.clinic;
  const H = UI.ward.h;

  const esc = U.esc;
  const btn = H.btn;
  const years = H.years;
  const fill = (pt, t) => U.line(M.fill(pt, t));
  const mdFill = (pt, t) => U.md(M.fill(pt, t));
  const pv = (pt, m, f) => W.pv(pt, m, f);

  const PLACE = {
    pnd: {
      title: 'Амбулаторный приём',
      tag: 'ПНД №2, кабинет 14',
      scene: 'office',
      intro: 'Медсестра Нина Аркадьевна раскладывает амбулаторные карты: «Сначала звонки, потом записанные. Новенькие — в конце. Чай остывает, доктор».',
    },
    private: {
      title: 'Приём в клинике',
      tag: 'Клиника «Ясный ум»',
      scene: 'private',
      intro: 'Администратор присылает расписание на день. Кофе для пациентов готов, карты — в медицинской системе, отзывы — после каждого приёма.',
    },
    uni: {
      title: 'Консультативный приём',
      tag: 'Университетская клиника',
      scene: 'seminar',
      intro: 'Консультации кафедры: пациенты, направленные из поликлиник и ПНД. Корсакова просила вести каждого так, будто за спиной стоят студенты.',
    },
  };
  const place = (s) => PLACE[M.place(s)] || PLACE.pnd;
  const KIND = { first: 'Первичный приём', follow: 'Повторный приём', urgent: 'Внеплановый приём', return: 'Приём после выписки из стационара', auto: 'Приём без изменений', noshow: 'Неявка', hospital: 'Выписка из стационара', past: 'Запись' };
  const WHO = { pt: 'Пациент', rel: 'Родственник', chart: 'Из документов' };

  function cur() {
    const s = A.state;
    const step = s && s.activity && s.activity.steps[s.activity.i];
    if (!step || step.type !== 'amb' || !step.p) return {};
    const p = step.p;
    return { s, step, p, pt: p.open ? M.byUid(s, p.open) : null };
  }
  const save = () => {
    G.save();
    UI.render();
  };
  const own = (v) => ['past', 'noshow', 'auto', 'hospital'].indexOf(v.kind) < 0;
  const isNew = (pt) => M.tpl(pt).kind === 'new';
  const visitToday = (s, pt) => (pt.vis && pt.vis.day === s.day ? pt.vis : null);
  const lastScale = (pt) => (pt.scaleHist && pt.scaleHist.length ? pt.scaleHist[pt.scaleHist.length - 1] : null);
  const relName = (pt) => pt.rel || 'Родственник';

  /** Динамика по шкале: выше — хуже; пунктир — граница стабильного состояния. */
  function scaleSpark(pt, w, h) {
    const sc = P.SCALES[pt.group];
    const pts = (pt.scaleHist || []).map((x) => x.v);
    if (!sc || pts.length < 2) return '';
    const min = sc.min || 0;
    const norm = (v) => (sc.rev ? (sc.max - v) / (sc.max - min) : (v - min) / (sc.max - min));
    const n = pts.length;
    const X = (i) => 2 + (i / (n - 1)) * (w - 4);
    const Y = (v) => 2 + (1 - U.clamp(norm(v), 0, 1)) * (h - 4);
    const d = pts.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const th = Y(P.scale(pt, M.stableTh(pt)).value);
    return (
      '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<line x1="0" x2="' + w + '" y1="' + th.toFixed(1) + '" y2="' + th.toFixed(1) + '" class="sp-th"/>' +
      '<path d="' + d + '" class="sp-line"/>' +
      '<circle cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(pts[n - 1]).toFixed(1) + '" r="2.6" class="sp-dot"/>' +
      '</svg>'
    );
  }

  /* ================= Шаг «приём» ================= */
  ACT.amb = function (s, step) {
    if (!step.p) {
      const day = step.list ? { list: step.list, fresh: step.fresh || [] } : M.beginDay(s);
      step.p = { amb: true, list: day.list.slice(), fresh: day.fresh || [], done: {}, open: null, tab: 'visit', sheet: null, fb: null, summary: null, next: {}, calls: 0, pay: 0, closed: 0, file: false, last: null };
      G.save();
    }
    const p = step.p;
    if (p.summary) return summaryView(s, p, M.byUid(s, p.summary));
    const pt = p.open ? M.byUid(s, p.open) : null;
    if (pt && !pt.done) return visitView(s, p, pt);
    return listView(s, p);
  };

  function listView(s, p) {
    const pl = place(s);
    const all = M.active(s);
    const calls = all.filter((x) => x.pending);
    const today = p.list.map((u) => M.byUid(s, u)).filter((x) => x && !x.done && !x.pending);
    const waiting = today.filter((x) => p.done[x.uid] == null && !x.away).length;
    let out = UI.sceneFig(pl.scene, s, pl.tag);
    out += '<section class="story"><span class="eyebrow">Приём · ' + esc(C.fmtDate(s.day)) + '</span><h1 class="display">' + esc(pl.title) + '</h1><p>' + U.line(pl.intro) + '</p></section>';
    if (p.last) out += lastCard(s, p);
    if (calls.length) out += '<h2 class="step-h">Звонки и сообщения</h2><div class="wlist">' + calls.map((x) => card(s, p, x)).join('') + '</div>';
    out += '<h2 class="step-h">Записаны на сегодня' + (waiting ? ' <span class="dim small">· ждут ' + waiting + '</span>' : '') + '</h2>';
    if (!today.length) out += '<p class="empty">На сегодня никто не записан.</p>';
    else out += '<div class="wlist">' + today.map((x) => card(s, p, x)).join('') + '</div>';
    const rest = all.filter((x) => p.list.indexOf(x.uid) < 0 && !x.pending).sort((a, b) => a.next - b.next);
    if (rest.length) {
      out += '<button type="button" class="link file-link" data-act="am-file" aria-expanded="' + !!p.file + '">' + UI.icon('book') + ' Картотека участка: ещё ' + rest.length + ' ' + U.plural(rest.length, ['пациент', 'пациента', 'пациентов']) + ' ' + (p.file ? '▲' : '▼') + '</button>';
      if (p.file) out += '<div class="wlist">' + rest.map((x) => card(s, p, x, true)).join('') + '</div>';
    }
    const closed = ((s.amb && s.amb.done) || []).filter((x) => x.end === s.day && x.how === 'rare');
    if (closed.length) out += '<p class="note">Переведены на редкие визиты: ' + closed.map((x) => esc(x.name) + ' — ' + x.score + ' баллов').join('; ') + '.</p>';
    out += '<p class="small dim">На участке время сжато: один день в календаре — два дня лечения. Сроки в карте и в рекомендациях — в днях лечения.</p>';
    out += '<div class="next-row">' + btn('Завершить приём', 'am-done', null, 'primary wide') + '</div>';
    return out;
  }

  function lastCard(s, p) {
    const x = p.last;
    const order = { err: 0, warn: 1, info: 2, ok: 3 };
    const msgs = (x.msgs || []).slice().sort((a, b) => order[a.lvl] - order[b.lvl]);
    const bossId = M.bossNpc(s) || 'director';
    return (
      '<section class="fb visit-fb" data-last>' +
      '<div class="fb-head">' + UI.npcPortrait(bossId, msgs.some((m) => m.lvl === 'err') ? 'stern' : x.score >= 85 ? 'smile' : 'neutral', 'mini') +
      '<div><span class="eyebrow">' + esc(x.title || 'Приём завершён') + '</span><b>' + esc(x.name) + (x.score != null ? ' · ' + x.score + ' из 100' : '') + '</b>' +
      (x.next ? '<span class="small dim"> · следующий визит ' + esc(M.intervalName(x.next)) + ' (' + esc(C.fmtDate(s.day + x.next)) + ')</span>' : '') + '</div>' +
      '<button type="button" class="x" data-act="am-last-close" aria-label="Скрыть">' + UI.icon('x') + '</button></div>' +
      (msgs.length ? '<ul class="fb-list">' + msgs.map((m) => '<li class="fb-' + m.lvl + '"><b>' + H.LVL[m.lvl] + '.</b> ' + U.inline(esc(m.text)) + '</li>').join('') + '</ul>' : '<p class="small">Замечаний нет.</p>') +
      (x.pay ? '<p class="small">Оплата приёма: ' + U.money(x.pay) + (x.stars ? ' · отзыв ' + '★'.repeat(x.stars) + '☆'.repeat(5 - x.stars) : '') + '</p>' : '') +
      '</section>'
    );
  }

  function card(s, p, pt, fromFile) {
    const chips = [];
    const done = p.done[pt.uid];
    if (pt.pending) chips.push(UI.chip(esc(M.EVENTS[pt.pending.k].title.replace(/^Звонок[^:]*: /, '').replace(/^Сообщение: /, '')), 'warn'));
    if (done === 'hosp') chips.push(UI.chip('направлен' + pv(pt, '', 'а') + ' в стационар', 'off'));
    else if (done != null) chips.push(UI.chip('принят' + pv(pt, '', 'а') + ' · ' + done, done >= 85 ? 'pos' : done < 60 ? 'neg' : ''));
    else if (pt.away) chips.push(UI.chip('в стационаре до ' + esc(C.fmtDate(pt.away.until)), 'off'));
    else if (fromFile) chips.push(UI.chip(pt.next <= s.day ? 'визит сегодня' : 'визит ' + esc(C.fmtDate(pt.next)), ''));
    else if (!pt.visits.some(own)) chips.push(UI.chip(isNew(pt) ? 'первичный' : 'принят' + pv(pt, '', 'а') + ' с участка', ''));
    else if (pt.urgent) chips.push(UI.chip('внеплановый', 'warn'));
    else chips.push(UI.chip('повторный', ''));
    const sc = lastScale(pt);
    if (sc && P.SCALES[pt.group] && !(isNew(pt) && pt.dxOk == null)) chips.push(UI.chip(esc(P.SCALES[pt.group].name.split(/[ ,(]/)[0]) + ': ' + sc.v, ''));
    if (P.dueTests(s, pt).some((x) => x.overdue)) chips.push(UI.chip('просрочен контроль', 'neg'));
    const lastV = pt.visits.filter((v) => v.kind !== 'past').pop();
    const dx = pt.dxOk == null && isNew(pt) ? 'диагноз не установлен' : H.shortDx(pt.dx);
    return (
      '<button type="button" class="wcard' + (pt.pending ? ' alarm' : '') + (done != null ? ' seen' : '') + '" data-act="am-open" data-arg="' + pt.uid + '">' +
      '<span class="wc-photo">' + H.portrait(pt) + '</span>' +
      '<span class="wc-main"><b>' + esc(pt.name) + ', ' + years(pt.age) + '</b>' +
      (lastV ? '<span class="dim small">последний визит — ' + esc(C.fmtDate(lastV.day)) + '</span>' : '') +
      '<span class="wc-dx">' + esc(dx) + '</span>' +
      '<span class="act-chips">' + chips.join('') + '</span></span>' +
      '<span class="wc-spark">' + scaleSpark(pt, 84, 34) + '</span>' +
      '</button>'
    );
  }

  /* ---------- Амбулаторная карта ---------- */
  function visitView(s, p, pt) {
    const v = visitToday(s, pt);
    const done = p.done[pt.uid] != null;
    const live = v && !done;
    const tabs = (live ? [['visit', 'Приём']] : []).concat([
      ['rx', 'Лечение'],
      ['tests', 'Анализы'],
      ['card', 'Записи'],
      ['info', 'Анамнез'],
    ]);
    const tab = tabs.some((t) => t[0] === p.tab) ? p.tab : tabs[0][0];
    const due = live && P.dueTests(s, pt).length;
    const n = pt.visits.filter(own).length + (live ? 1 : 0);
    const sc = lastScale(pt);
    const chips = [];
    if (sc && P.SCALES[pt.group] && !(isNew(pt) && pt.dxOk == null)) chips.push(UI.chip(esc(P.SCALES[pt.group].name.split(/[ ,(]/)[0]) + ': ' + sc.v + ' из ' + P.SCALES[pt.group].max, ''));
    if (pt.away) chips.push(UI.chip('в стационаре', 'off'));
    if (!live && !pt.pending) chips.push(UI.chip(done ? 'приём окончен' : 'только просмотр', 'off'));
    let out = '<button type="button" class="link back-link" data-act="am-back">← Список приёма</button>';
    out +=
      '<div class="chart"><div class="chart-top mono">Амбулаторная карта № ' + (2000 + parseInt(pt.uid.slice(1), 10) * 13 + (pt.seed % 11)) + (n ? ' · визит ' + n : '') + '</div>' +
      '<div class="patient"><div class="pt-photo">' + H.portrait(pt) + '</div><div class="pt-info">' +
      '<span class="eyebrow">' + esc(isNew(pt) && pt.dxOk == null ? 'Первичный приём' : P.group(pt).name) + '</span>' +
      '<b class="pt-name">' + esc(pt.name) + ', ' + years(pt.age) + '</b>' +
      '<span class="small">' + esc(isNew(pt) && pt.dxOk == null ? 'Диагноз не установлен' : pt.dx) + '</span>' +
      (chips.length ? '<span class="act-chips">' + chips.join('') + '</span>' : '') +
      '</div></div></div>';
    if (pt.pending) out += urgentCard(s, pt);
    if (p.fb && p.fb.uid === pt.uid) out += H.feedback(p);
    out +=
      '<div class="tabs" role="tablist" aria-label="Разделы амбулаторной карты">' +
      tabs.map((t) => '<button type="button" class="tab" role="tab" data-act="am-tab" data-arg="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (t[0] === 'tests' && due ? ' •' : '') + '</button>').join('') +
      '</div><div class="folder pad">';
    if (tab === 'visit') out += visitTab(s, p, pt, v);
    else if (tab === 'rx') out += H.rxTab(s, p, pt, !live);
    else if (tab === 'tests') out += H.testsTab(s, p, pt, !live);
    else if (tab === 'card') out += recordsTab(s, p, pt);
    else out += infoTab(s, p, pt);
    out += '</div>';
    if (live) out += endBlock(s, p, pt, v);
    if (p.sheet && live) out += H.sheet(s, p, pt);
    return out;
  }

  function urgentCard(s, pt) {
    const ev = M.EVENTS[pt.pending.k];
    const from = ev.from === 'rel' ? relName(pt) : ev.from || 'Звонок';
    return (
      '<section class="urgent" data-last><span class="eyebrow">' + esc(from) + ' · ' + esc(C.fmtShort(pt.pending.day)) + '</span><h2 class="h2">' + esc(ev.title) + '</h2><p>' + fill(pt, ev.q(s, pt)) + '</p>' +
      '<div class="choices">' +
      ev.opts.map((o, i) => '<button type="button" class="opt choice" data-act="am-decide" data-arg="' + i + '"><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + fill(pt, o.t) + '</span></span></button>').join('') +
      '</div></section>'
    );
  }

  const sec = (h, body) => (body ? '<h3 class="step-h">' + h + '</h3>' + body : '');

  function visitTab(s, p, pt, v) {
    const t = M.tpl(pt);
    let out = '';
    const lastV = pt.visits.filter((x) => x.kind !== 'past' && x.kind !== 'noshow').pop();
    out += '<p class="eyebrow">' + esc(KIND[v.kind] || 'Приём') + (v.kind === 'first' && !isNew(pt) ? ' у вас' : '') + (lastV ? ' · прошлый визит ' + esc(C.fmtDate(lastV.day)) : '') + '</p>';
    if (v.kind === 'first') {
      if (isNew(pt)) {
        out += sec('Направление', '<p>' + fill(pt, t.referral) + '</p>');
        out += sec('Жалобы', mdFill(pt, t.complaints));
        out += sec('Анамнез', mdFill(pt, t.history));
        out += sec('Соматически', mdFill(pt, t.somatic));
        out += sec('Психический статус', mdFill(pt, t.status));
      } else {
        out += sec('Участок', '<p>' + fill(pt, t.referral) + '</p>');
        out += sec('Жалобы', mdFill(pt, t.complaints));
        const past = pt.visits.filter((x) => x.kind === 'past').slice(-2);
        if (past.length) out += sec('Из амбулаторной карты', '<div class="diary">' + past.map((x) => '<div class="dnote"><span class="mono dim small">' + esc(M.dayText(s, x.day)) + ' · ' + esc(x.who || '') + '</span><p>' + fill(pt, x.text) + '</p></div>').join('') + '</div>');
        out += sec('Психический статус', mdFill(pt, t.status));
      }
    } else {
      const rep = v.report.filter((x) => x.text);
      out +=
        '<h3 class="step-h">Как прошли дни после визита</h3>' +
        (rep.length
          ? '<div class="diary">' + rep.map((x) => '<div class="dnote' + (x.lvl === 'warn' ? ' l-warn' : '') + '"><span class="mono dim small">' + esc(x.who === 'rel' ? relName(pt) : WHO[x.who] || '') + '</span><p>' + (x.who === 'chart' ? fill(pt, x.text) : '<span class="quote">' + fill(pt, x.text) + '</span>') + '</p></div>').join('') + '</div>'
          : '<p><span class="quote">«Всё по-прежнему, доктор».</span></p>');
    }
    // осмотр
    const o = v.obj || {};
    const objLine = 'Масса тела ' + String(o.weight).replace('.', ',') + ' кг' + (Math.abs(o.gain || 0) >= 0.5 ? ' (' + (o.gain > 0 ? '+' : '') + String(o.gain).replace('.', ',') + ' кг с начала лечения)' : '') + ', ИМТ ' + String(o.bmi).replace('.', ',') + '. АД ' + o.bp + ', ЧСС ' + o.hr + ' в мин.';
    out += sec('Осмотр', '<p>' + esc(objLine) + '</p>' + (o.finds && o.finds.length ? '<p>' + esc(U.cap(o.finds.join('; '))) + '.</p>' : ''));
    if (v.kind !== 'first') out += sec('Психический статус', '<p>' + fill(pt, o.status || '') + '</p>');
    if (v.scale && !(isNew(pt) && pt.dxOk == null)) {
      const prev = pt.scaleHist.length >= 2 ? pt.scaleHist[pt.scaleHist.length - 2] : null;
      const d = prev ? v.scale.value - prev.v : 0;
      const better = v.scale.rev ? d > 0 : d < 0;
      out +=
        '<div class="scale-box"><span class="eyebrow">' + esc(v.scale.name) + '</span><b class="scale-v">' + v.scale.value + '<span class="dim small"> из ' + v.scale.max + '</span></b>' +
        (prev ? '<span class="small ' + (d === 0 ? '' : better ? 'pos' : 'neg') + '">' + (d === 0 ? 'без изменений' : (d > 0 ? '+' : '') + d + ' с ' + esc(C.fmtDate(prev.day))) + '</span>' : '') +
        '<span class="small dim">' + esc(v.scale.cut || '') + '</span></div>';
    }
    if (v.labs && v.labs.length) out += sec('Готовые результаты', '<ul class="results">' + v.labs.map((x) => '<li' + (x.flag ? ' class="flag"' : '') + '><b>' + esc(P.TESTS[x.test].name) + '</b>: ' + esc(x.text) + '</li>').join('') + '</ul>');
    if (v.injected) out += '<p class="note">' + UI.icon('check') + ' Процедурный кабинет: инъекция ' + esc(P.drug(v.injected).name.toLowerCase()) + ' выполнена.</p>';
    // предварительный диагноз
    if (isNew(pt) && t.dxq && t.dxq.opts) {
      if (pt.dxOk == null) {
        const order = t.dxq.opts.map((o2, i) => i).sort((a, b) => U.hash(pt.seed + ':' + a) - U.hash(pt.seed + ':' + b));
        out +=
          '<h3 class="step-h">Предварительный диагноз</h3><div class="choices">' +
          order.map((i) => '<button type="button" class="opt choice" data-act="am-dx" data-arg="' + i + '"><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + esc(t.dxq.opts[i].t) + '</span></span></button>').join('') +
          '</div>';
      }
      else if (v.kind === 'first') {
        const o2 = t.dxq.opts[pt.dxPick] || {};
        out += '<div class="pearl plain dx-res ' + (pt.dxOk === true ? 'ok' : pt.dxOk === 'part' ? 'part' : 'bad') + '"><span class="eyebrow">' + (pt.dxOk === true ? 'Диагноз верный' : pt.dxOk === 'part' ? 'Частично верно' : 'Диагноз поправил заведующий') + '</span><p><b>' + esc(pt.dx) + '.</b> ' + esc(o2.why || '') + '</p></div>';
      }
    }
    // беседа
    const outs = v.out || [];
    out +=
      '<h3 class="step-h">Беседа</h3><div class="talks">' +
      M.talksFor(pt)
        .map((k) => {
          const doneT = v.talks.indexOf(k) >= 0;
          return '<button type="button" class="chipbtn" data-act="am-talk" data-arg="' + k + '" aria-pressed="' + doneT + '"' + (doneT ? ' aria-disabled="true"' : '') + '>' + esc(M.talkName(pt, k)) + '</button>';
        })
        .join('') +
      '</div>';
    if (outs.length) out += '<ul class="fb-list talk-out">' + outs.map((m) => '<li class="fb-' + m.lvl + '">' + U.inline(esc(m.text)) + '</li>').join('') + '</ul>';
    // нежелательные явления (то, что видно на осмотре и со слов)
    const SEEN = ['eps', 'akathisia', 'sedation', 'tremor', 'orthostatic', 'anticholinergic'];
    const se = Object.keys(pt.sx || {})
      .filter((k) => SEEN.indexOf(k) >= 0 && (pt.sx[k] || 0) >= 0.8 && H.SE_NAME[k])
      .sort((a, b) => pt.sx[b] - pt.sx[a])
      .map((k) => UI.chip(H.SE_NAME[k] + ': ' + (pt.sx[k] >= 2.5 ? 'выражено' : pt.sx[k] >= 1.5 ? 'умеренно' : 'слабо'), pt.sx[k] >= 1.5 ? 'warn' : ''));
    if (se.length) out += sec('Видно на осмотре', '<div class="delta">' + se.join('') + '</div>');
    const due = P.dueTests(s, pt);
    if (due.length) out += sec('Пора проверить', '<ul class="due">' + due.map((x) => '<li class="' + (x.overdue ? 'over' : '') + '">' + esc(P.TESTS[x.test].name) + ' <span class="dim small">— ' + esc(x.why) + '</span> ' + btn(pt.tests.some((r) => r.test === x.test && r.day === s.day) ? 'Назначено' : 'Назначить', 'wd-order', x.test, 'small', pt.tests.some((r) => r.test === x.test && r.day === s.day)) + '</li>').join('') + '</ul>');
    out += '<div class="row-btns">' + btn(UI.icon('plus') + ' Назначить препарат', 'am-rx', 'drug', '') + btn('Без лекарств', 'am-rx', 'int', '') + '</div>';
    return out;
  }

  function endBlock(s, p, pt, v) {
    const n = p.next[pt.uid] || 7;
    const can = M.canClose(s, pt);
    const needDx = isNew(pt) && pt.dxOk == null;
    return (
      '<section class="card end-visit"><h3 class="step-h">Следующий визит</h3>' +
      '<div class="seg segb" role="group" aria-label="Следующий визит">' +
      M.INTERVALS.map((d) => '<button type="button" class="seg-b" data-act="am-next" data-arg="' + d + '" aria-pressed="' + (d === n) + '">' + esc(M.intervalName(d)) + '</button>').join('') +
      '</div><p class="small dim">В календаре — ' + esc(C.fmt(s.day + n)) + '.</p>' +
      '<div class="next-row col">' +
      btn('Завершить приём', 'am-end', null, 'primary wide', needDx || !!pt.pending) +
      (needDx ? '<p class="small dim">Сначала поставьте предварительный диагноз.</p>' : '') +
      btn('Перевести на редкие визиты', 'am-close', null, 'wide', !can.ok) +
      (can.ok ? '' : '<p class="small dim">Редкие визиты: ' + esc(can.why) + '</p>') +
      '<div class="row-btns">' + btn('Дневной стационар', 'am-dayhosp', null, 'small', pt.rx.some((r) => r.id === 'day_hospital')) + btn('Направить в стационар', 'am-hosp', null, 'small ghost') + '</div>' +
      '</div></section>'
    );
  }

  function recordsTab(s, p, pt) {
    let out = '';
    const sp = scaleSpark(pt, 300, 70);
    if (sp) out += '<div class="dyn">' + sp + '<p class="small dim">' + esc(P.SCALES[pt.group].name) + ' на визитах: выше — тяжелее. Пунктир — граница стабильного состояния.</p></div>';
    const items = [];
    pt.visits.forEach((x) => items.push({ day: x.day, k: 'visit', x }));
    (pt.diary || []).forEach((x) => {
      if (x.k === 'call' || x.k === 'hosp' || x.k === 'relapse' || x.k === 'withdrawal') items.push({ day: x.day, k: 'diary', x });
    });
    items.sort((a, b) => b.day - a.day || (a.k === 'visit' ? -1 : 1));
    if (!items.length) return out + '<p class="empty">Записей пока нет.</p>';
    out += '<div class="diary">';
    items.slice(0, 40).forEach((it) => {
      const x = it.x;
      if (it.k === 'diary') {
        out += '<div class="dnote l-warn"><span class="mono dim small">' + esc(M.dayText(s, x.day)) + ' · ' + (x.k === 'call' ? 'звонок' : x.k === 'hosp' ? 'стационар' : 'между визитами') + '</span><p>' + fill(pt, x.text) + '</p></div>';
        return;
      }
      if (x.kind === 'past' || x.kind === 'hospital' || x.kind === 'noshow' || x.kind === 'auto') {
        out += '<div class="dnote' + (x.kind === 'noshow' ? ' l-warn' : '') + '"><span class="mono dim small">' + esc(M.dayText(s, x.day)) + ' · ' + esc(x.who || KIND[x.kind] || '') + '</span><p>' + fill(pt, x.text || KIND[x.kind]) + '</p></div>';
        return;
      }
      const lines = [];
      if (x.scale) lines.push(esc(x.scale.name) + ': ' + x.scale.v + ' из ' + x.scale.max + '.');
      if (x.complaints && x.complaints.length) lines.push('<span class="quote">' + x.complaints.slice(0, 2).map((c) => fill(pt, c)).join(' ') + '</span>');
      if (x.changes && x.changes.length) lines.push('Назначения: ' + x.changes.map((c) => esc(c.replace(/\.$/, ''))).join('; ') + '.');
      const tests = (x.tests || []).filter((tt) => tt !== 'weight');
      if (tests.length) lines.push('Анализы: ' + tests.map((tt) => esc(P.lc(P.TESTS[tt].name))).join(', ') + '.');
      if (x.talks && x.talks.length) lines.push('Беседа: ' + x.talks.map((k) => esc(M.TALKS[k].short.toLowerCase())).join(', ') + '.');
      if (x.hosp) lines.push('Направлен' + pv(pt, '', 'а') + ' на госпитализацию.');
      else if (x.next) lines.push('Следующий визит — ' + esc(C.fmtDate(x.next)) + '.');
      out += '<div class="dnote"><span class="mono dim small">' + esc(C.fmtShort(x.day)) + ' · ' + esc(KIND[x.kind] || 'приём') + (x.score != null ? ' · ' + x.score + ' баллов' : '') + '</span><p>' + lines.join('<br>') + '</p></div>';
    });
    out += '</div>';
    return out;
  }

  function infoTab(s, p, pt) {
    const t = M.tpl(pt);
    let out = '';
    out += sec(isNew(pt) ? 'Направление' : 'Участок', t.referral ? '<p>' + fill(pt, t.referral) + '</p>' : '');
    out += sec('Жалобы при первом визите', mdFill(pt, t.complaints));
    out += sec('Анамнез', mdFill(pt, t.history));
    out += sec('Соматически', mdFill(pt, t.somatic));
    out += sec('Психический статус при первом визите', mdFill(pt, t.status));
    const tags = (pt.traits || []).filter((x) => P.TAG_NAMES[x]).map((x) => UI.chip(esc(P.TAG_NAMES[x]), ''));
    const derived = P.tags(pt);
    ['elderly', 'woman_childbearing', 'qt_long', 'renal', 'liver'].forEach((x) => {
      if (derived[x] && (pt.traits || []).indexOf(x) < 0) tags.push(UI.chip(esc(P.TAG_NAMES[x]), 'warn'));
    });
    if (tags.length) out += '<h3 class="step-h">Важно для назначений</h3><div class="delta">' + tags.join('') + '</div>';
    if ((pt.intolerant || []).length) out += '<p class="small"><b>Плохо переносил' + pv(pt, '', 'а') + ':</b> ' + pt.intolerant.map((id) => esc((P.drug(id) || { name: id }).name.toLowerCase())).join(', ') + '.</p>';
    if ((pt.failed || []).length) out += '<p class="small"><b>Ранее неэффективно в адекватной дозе:</b> ' + pt.failed.map((id) => esc((P.drug(id) || { name: id }).name.toLowerCase())).join(', ') + '.</p>';
    if (pt.dxOk != null || !isNew(pt)) {
      const g = P.gl(pt);
      const std = P.standardFor(pt, g);
      if (g) out += '<p class="small dim">Опора для лечения: ' + esc(P.citeFull(g)) + (std ? '; ' + esc(std.title) + ' (' + esc(std.order) + ')' : '') + '. Подробно — во вкладке «КР» справочника.</p>';
    }
    return out;
  }

  /* ---------- Разбор при переводе на редкие визиты ---------- */
  function summaryView(s, p, pt) {
    if (!pt || !pt.result) {
      p.summary = null;
      return listView(s, p);
    }
    const sc = pt.result;
    const t = M.tpl(pt);
    const grade = sc.total >= 85 ? 'Отлично' : sc.total >= 70 ? 'Хорошо' : sc.total >= 50 ? 'Удовлетворительно' : 'Плохо';
    const bar = (l, v) => '<div class="part"><span>' + l + '</span><div class="mini-track"><div style="width:' + v + '%"></div></div><b>' + v + '</b></div>';
    let out = '<section class="result-card"><div class="stamp' + (sc.total < 50 ? ' bad' : '') + '"><b>' + sc.total + '</b><span>' + grade + '</span></div>';
    out += '<p class="mono small">' + esc(pt.name) + ' · ' + (pt.how === 'rare' ? 'переведен' + pv(pt, '', 'а') + ' на редкие визиты' : 'передан' + pv(pt, '', 'а') + ' коллеге') + ' · ' + sc.visits + ' ' + U.plural(sc.visits, ['визит', 'визита', 'визитов']) + '</p>';
    out += '<div class="parts wide">' + bar('Исход', sc.outcome) + bar('Соответствие КР', sc.kr) + bar('Безопасность', sc.safety) + bar('Мониторинг', sc.mon) + bar('Ведение', sc.care) + '</div>';
    if (sc.issues && sc.issues.length) out += '<ul class="fb-list">' + sc.issues.map((x) => '<li class="fb-' + (x.ok ? 'ok' : 'err') + '"><b>' + (x.ok ? 'Верно' : 'Упущено') + '.</b> ' + esc(x.msg) + '</li>').join('') + '</ul>';
    out += '<p class="small dim">Приверженность лечению за всё время: ' + sc.adh + '%.</p>';
    out += '</section><section class="review">';
    const bad = pt.rev.list.filter((m) => m.lvl === 'err' || m.lvl === 'warn').slice(-8);
    if (bad.length) out += '<h2 class="step-h">Замечания по ходу лечения</h2><ul class="fb-list">' + bad.map((m) => '<li class="fb-' + m.lvl + '"><span class="mono dim small">' + esc(C.fmtShort(m.day)) + '</span> ' + esc(m.text) + (m.cite ? ' <span class="cite">' + esc(m.cite) + '</span>' : '') + '</li>').join('') + '</ul>';
    const ev = pt.events.filter((e) => e.resolved);
    if (ev.length)
      out +=
        '<h2 class="step-h">Звонки и осложнения</h2><ul class="marks">' +
        ev.map((e) => '<li class="' + (e.auto ? 'm-miss' : e.ok === true ? 'm-ok' : 'm-bad') + '">' + esc(M.EVENTS[e.k].title) + (e.preventable ? ' <span class="chip neg">можно было предотвратить</span>' : '') + (e.auto ? ' <span class="dim">— решал дежурный врач</span>' : '') + '</li>').join('') +
        '</ul>';
    if (t.pitfall) out += '<h2 class="step-h">В чём был подвох</h2><div class="prose">' + mdFill(pt, t.pitfall) + '</div>';
    if (t.ideal) out += '<div class="pearl plain"><span class="eyebrow">Как вести по клиническим рекомендациям</span>' + mdFill(pt, t.ideal) + '</div>';
    const g = P.gl(pt);
    const std = P.standardFor(pt, g);
    if (g) out += '<p class="small dim">' + esc(P.citeFull(g)) + (std ? '. ' + esc(std.title) + ', ' + esc(std.order) : '') + '.</p>';
    out += '</section><div class="next-row">' + btn('К списку приёма', 'am-sum-close', null, 'primary wide') + '</div>';
    return out;
  }

  /* ---------- Обработчики ---------- */
  UI.on('am-open', (uid) => {
    const { s, p } = cur();
    if (!p) return;
    const pt = M.byUid(s, uid);
    if (!pt) return;
    p.open = uid;
    p.sheet = null;
    if (p.fb && p.fb.uid !== uid) p.fb = null;
    const canVisit = p.list.indexOf(uid) >= 0 && p.done[uid] == null && !pt.away && !pt.pending;
    if (canVisit) {
      M.beginVisit(s, pt);
      p.tab = 'visit';
    } else p.tab = 'card';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('am-back', () => {
    const { p } = cur();
    if (!p) return;
    p.open = null;
    p.sheet = null;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('am-tab', (t) => {
    const { p } = cur();
    if (!p) return;
    p.tab = t;
    save();
  });
  UI.on('am-file', () => {
    const { p } = cur();
    if (!p) return;
    p.file = !p.file;
    save();
  });
  UI.on('am-last-close', () => {
    const { p } = cur();
    if (!p) return;
    p.last = null;
    save();
  });
  UI.on('am-rx', (kind) => {
    const { p, pt } = cur();
    if (!pt) return;
    p.tab = 'rx';
    UI.handlers['wd-add'](kind);
  });
  UI.on('am-decide', (i) => {
    const { s, p, pt } = cur();
    if (!pt || !pt.pending) return;
    const r = M.decide(s, pt, +i);
    p.calls++;
    if (r) H.fb(p, pt, r.title, [{ lvl: r.ok === true ? 'ok' : r.ok === 'part' ? 'warn' : 'err', text: r.why }]);
    // звонок требует приёма сегодня — пациента записывают в конец очереди
    if (!pt.away && pt.urgent && pt.next <= s.day && p.list.indexOf(pt.uid) < 0) {
      p.list.push(pt.uid);
      UI.toast(esc(pt.name) + ' — записан' + pv(pt, '', 'а') + ' на сегодня.');
    }
    if (!pt.away && p.list.indexOf(pt.uid) >= 0 && p.done[pt.uid] == null) {
      M.beginVisit(s, pt);
      p.tab = 'visit';
    }
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('am-dx', (i) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const r = M.chooseDx(s, pt, +i);
    if (r) H.fb(p, pt, 'Предварительный диагноз', [{ lvl: r.ok === true ? 'ok' : r.ok === 'part' ? 'warn' : 'err', text: (r.ok === true ? '' : 'Верный диагноз: ' + r.right + '. ') + r.why }]);
    save();
  });
  UI.on('am-talk', (k) => {
    const { s, p, pt } = cur();
    const v = pt && visitToday(s, pt);
    if (!v) return;
    const out = M.talk(s, pt, k);
    v.out = (v.out || []).concat(out);
    save();
  });
  UI.on('am-next', (n) => {
    const { p, pt } = cur();
    if (!pt) return;
    p.next[pt.uid] = +n;
    save();
  });
  function finishVisit(s, p, pt, n) {
    const r = M.endVisit(s, pt, n);
    const pay = M.reward(s, pt, r.score);
    let stars = 0;
    const job = G.job(s);
    if (job && job.reviews) {
      stars = r.score >= 85 ? 5 : r.score >= 70 ? 4 : r.score >= 50 ? 3 : 2;
      s.career.reviews.push(stars);
    }
    p.done[pt.uid] = r.score;
    p.pay += pay;
    return { r, pay, stars };
  }
  UI.on('am-end', () => {
    const { s, p, pt } = cur();
    if (!pt || !visitToday(s, pt)) return;
    if (pt.pending) return UI.toast('Сначала решите, что делать со звонком.');
    if (isNew(pt) && pt.dxOk == null) return UI.toast('Сначала поставьте предварительный диагноз.');
    const n = p.next[pt.uid] || 7;
    const { r, pay, stars } = finishVisit(s, p, pt, n);
    p.last = { uid: pt.uid, name: pt.name, score: r.score, msgs: r.msgs, pay, stars, next: n };
    p.open = null;
    p.sheet = null;
    p.fb = null;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('am-dayhosp', () => {
    const { s, p, pt } = cur();
    if (!pt || !visitToday(s, pt)) return;
    const msgs = W.prescribe(s, pt, { id: 'day_hospital', kind: 'int' });
    H.fb(p, pt, 'Дневной стационар', msgs.length ? msgs : [{ lvl: 'info', text: 'Направление в дневной стационар выписано: курс около месяца лечения, таблетки — под контролем медсестры.' }]);
    p.tab = 'rx';
    save();
  });
  UI.on('am-hosp', () => {
    const { s, p, pt } = cur();
    if (!pt || !visitToday(s, pt)) return;
    UI.ask('Направить в стационар?', 'Госпитализация — когда амбулаторно не справиться: тяжёлое состояние, высокий суицидальный риск, токсичность. Без показаний пациент откажется.', 'Направить', () => {
      const r = M.hospitalize(s, pt);
      if (!r.ok) {
        H.fb(p, pt, 'Госпитализация', r.msgs);
        save();
        return;
      }
      p.done[pt.uid] = 'hosp';
      p.last = { uid: pt.uid, name: pt.name, title: 'Направлен' + pv(pt, '', 'а') + ' в стационар', score: null, msgs: r.msgs };
      p.open = null;
      p.sheet = null;
      p.fb = null;
      G.save();
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('am-close', () => {
    const { s, p, pt } = cur();
    if (!pt || !visitToday(s, pt)) return;
    const can = M.canClose(s, pt);
    if (!can.ok) return UI.toast(esc(can.why));
    if (isNew(pt) && pt.dxOk == null) return UI.toast('Сначала поставьте предварительный диагноз.');
    UI.ask('Перевести на редкие визиты?', 'Состояние устойчиво: дальше — плановые визиты раз в несколько месяцев. Ведение пациента оценят по итогам — исход, соответствие КР, безопасность и контроль.', 'Перевести', () => {
      finishVisit(s, p, pt, 28);
      M.close(s, pt, 'rare');
      p.closed++;
      p.summary = pt.uid;
      p.open = null;
      p.sheet = null;
      p.fb = null;
      G.save();
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('am-sum-close', () => {
    const { s, p } = cur();
    if (!p) return;
    p.summary = null;
    M.archiveDone(s);
    save();
  });
  UI.on('am-done', () => {
    const { s, p } = cur();
    if (!p) return;
    const left = p.list.map((u) => M.byUid(s, u)).filter((x) => x && !x.done && !x.away && p.done[x.uid] == null);
    const calls = M.active(s).filter((x) => x.pending);
    const finish = () => {
      // начатые и не законченные визиты записываются как есть
      left.forEach((x) => {
        if (visitToday(s, x)) finishVisit(s, p, x, p.next[x.uid] || 7);
        else {
          x.next = s.day + 1;
          x.care.late++;
        }
      });
      M.archiveDone(s);
      ACT.done(M.dayResult(s, p));
    };
    const why = [];
    if (left.length) why.push(U.cap(U.plural(left.length, ['не принят', 'не приняты', 'не приняты'])) + ' ' + left.length + ' ' + U.plural(left.length, ['пациент', 'пациента', 'пациентов']) + ' — их перенесут на завтра.');
    if (calls.length) why.push('Есть звонки без ответа: если не ответить, решать будет дежурный врач.');
    if (why.length) UI.ask('Закончить приём?', why.join(' '), 'Закончить', finish);
    else finish();
  });

  /* ================= Картотека участка (справочник) ================= */
  UI.clinic = {};
  UI.clinic.fileRef = function (s) {
    const act = M.active(s).slice().sort((a, b) => a.next - b.next);
    const done = ((s.amb && s.amb.done) || []).slice().reverse();
    if (!act.length && !done.length) return '<p class="empty">Здесь появятся амбулаторные карты ваших пациентов — на участке ПНД, в частной клинике или на консультациях кафедры.</p>';
    const open = UI.view.refItem;
    let out = '';
    if (act.length) {
      out += '<h3 class="step-h">На участке</h3>';
      act.forEach((pt) => {
        const isOpen = open === 'a:' + pt.uid;
        const sc = lastScale(pt);
        out +=
          '<div class="pt-row"><button type="button" class="pt-head" data-act="ref-amb" data-arg="a:' + pt.uid + '" aria-expanded="' + isOpen + '"><span><b>' + esc(pt.name) + ', ' + years(pt.age) + '</b> · ' + esc(isNew(pt) && pt.dxOk == null ? 'диагноз не установлен' : P.group(pt).name) +
          '<br><span class="dim small">' + (pt.away ? 'в стационаре' : 'визит ' + (pt.next <= s.day ? 'сегодня' : esc(C.fmtDate(pt.next)))) + (sc && P.SCALES[pt.group] ? ' · ' + esc(P.SCALES[pt.group].name.split(/[ ,(]/)[0]) + ' ' + sc.v : '') + (pt.pending ? ' · звонок' : '') + '</span></span><span aria-hidden="true">' + (isOpen ? '−' : '+') + '</span></button>';
        if (isOpen) out += '<div class="pt-body">' + H.rxTab(s, {}, pt, true) + recordsTab(s, {}, pt) + '</div>';
        out += '</div>';
      });
    }
    if (done.length) {
      out += '<h3 class="step-h">Завершённое ведение</h3>';
      done.forEach((x) => {
        const key = 'd:' + x.uid + ':' + x.end;
        const isOpen = open === key;
        const t = D.ambById[x.tpl] || {};
        let body = '';
        if (isOpen) {
          body += '<div class="pt-body"><p class="mono small">' + esc(x.dx) + '</p>';
          if ((x.issues || []).length) body += '<ul class="fb-list">' + x.issues.map((i) => '<li class="fb-' + (i.ok ? 'ok' : 'err') + '">' + esc(i.msg) + '</li>').join('') + '</ul>';
          const bad = (x.rev || []).filter((m) => m.lvl === 'err' || m.lvl === 'warn');
          if (bad.length) body += '<ul class="fb-list">' + bad.map((m) => '<li class="fb-' + m.lvl + '">' + esc(m.text) + '</li>').join('') + '</ul>';
          if (t.ideal) body += '<div class="pearl plain"><span class="eyebrow">Как вести по КР</span>' + U.md(t.ideal) + '</div>';
          body += '</div>';
        }
        out +=
          '<div class="pt-row"><button type="button" class="pt-head" data-act="ref-amb" data-arg="' + key + '" aria-expanded="' + isOpen + '"><span><b>' + esc(x.name) + '</b> · ' + esc(P.GROUPS[x.group] ? P.GROUPS[x.group].name : '') +
          '<br><span class="dim small">' + esc(C.fmtDate(Math.max(1, x.start))) + ' — ' + esc(C.fmtDate(x.end)) + ' · ' + (x.how === 'rare' ? 'редкие визиты' : 'передан коллеге') + ' · визитов: ' + (x.visits || 0) + '</span></span>' +
          '<span class="score-pill s' + (x.score >= 85 ? 5 : x.score >= 70 ? 4 : x.score >= 50 ? 3 : 2) + '">' + x.score + '</span></button>' + body + '</div>';
      });
    }
    return out;
  };
  UI.on('ref-amb', (k) => {
    UI.view.refItem = UI.view.refItem === k ? null : k;
    UI.render();
  });

  /** Карточка профиля: участок и итоги амбулаторного ведения. */
  UI.clinic.profileCard = function (s) {
    if (!s.amb || (!M.active(s).length && !(s.amb.done || []).length && !s.amb.visits)) return '';
    const done = (s.amb.done || []).filter((x) => x.how === 'rare');
    const avg = done.length ? Math.round(done.reduce((a, x) => a + x.score, 0) / done.length) : null;
    const stat = (l, v) => '<div class="stat"><span>' + l + '</span><b>' + v + '</b></div>';
    return (
      '<section class="card"><h2 class="h2">Амбулаторный приём</h2><div class="stats">' +
      stat('На участке', M.active(s).length) +
      stat('Визитов', s.amb.visits || 0) +
      stat('Переведены на редкие визиты', done.length) +
      (avg != null ? stat('Средняя оценка ведения', avg) : '') +
      '</div><p class="small dim">Амбулаторные карты — в справочнике, вкладка «Участок».</p></section>'
    );
  };
})((window.A = window.A || {}));
