/* Интерфейс отделения: обход, история болезни, лист назначений, обследования, срочные решения, выписка.
   А также справочник препаратов и клинических рекомендаций. */
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

  const esc = U.esc;
  const btn = (label, act, arg, cls, dis) =>
    '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + (dis ? ' aria-disabled="true"' : '') + '>' + label + '</button>';
  const num = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  const years = (n) => n + ' ' + U.plural(n, ['год', 'года', 'лет']);

  /* ---------- Подписи ---------- */
  const DOMAIN = {
    psychosis: 'психоз',
    mania: 'мания',
    bipdep: 'биполярная депрессия',
    depression: 'депрессия',
    anxiety: 'тревога',
    ocd: 'ОКР',
    ptsd: 'ПТСР',
    withdrawal: 'отмена алкоголя',
    bpsd: 'поведение при деменции',
    impulsivity: 'импульсивность',
    sleep: 'бессонница',
    eps: 'ЭПС',
    akathisia: 'акатизия',
    craving: 'влечение к алкоголю',
    cognition: 'когнитивные функции',
    agitation: 'возбуждение',
  };
  const SE_NAME = {
    eps: 'экстрапирамидные расстройства',
    akathisia: 'акатизия',
    sedation: 'седация',
    weight: 'прибавка веса',
    metabolic: 'метаболические нарушения',
    prolactin: 'гиперпролактинемия',
    qt: 'удлинение QT',
    anticholinergic: 'холинолитические эффекты',
    orthostatic: 'ортостатическая гипотензия',
    serotonergic: 'серотонинергические эффекты',
    seizure: 'снижение судорожного порога',
    hyponatremia: 'гипонатриемия',
    agranulocytosis: 'угнетение кроветворения',
    sexual: 'сексуальная дисфункция',
    activation: 'активация в начале приёма',
    hepatotox: 'гепатотоксичность',
    rash: 'кожная сыпь',
    tremor: 'тремор',
    dependence: 'зависимость',
    nms: 'риск ЗНС',
  };
  const CLS = {
    fga_high: 'типичный антипсихотик, высокопотентный',
    fga_low: 'типичный антипсихотик, низкопотентный',
    benzamide: 'антипсихотик, замещённый бензамид',
    sga: 'атипичный антипсихотик',
    clozapine: 'атипичный антипсихотик (резерв)',
    ssri: 'СИОЗС',
    snri: 'СИОЗСН',
    tca: 'трициклический антидепрессант',
    nassa: 'НаССА',
    ad_other: 'антидепрессант другой группы',
    lithium: 'нормотимик',
    aed: 'противоэпилептический нормотимик',
    bzd: 'бензодиазепин',
    z: 'небензодиазепиновое снотворное',
    anxiolytic: 'анксиолитик',
    anticholinergic: 'холинолитический корректор',
    beta: 'бета-блокатор',
    che: 'ингибитор холинэстеразы',
    nmda: 'антагонист NMDA-рецепторов',
    addiction: 'средство для лечения зависимости',
    vitamin: 'витамин',
    other: 'прочее',
  };
  const LVL = { ok: 'Верно', info: 'Обратите внимание', warn: 'Замечание', err: 'Ошибка' };
  const LEGAL = { voluntary: 'добровольно', involuntary: 'недобровольно (ст. 29)' };
  const EMO = {
    schizophrenia: ['suspicious', 'neutral'],
    mania: ['elated', 'smirk'],
    bipolar_depression: ['sad', 'tired'],
    depression: ['sad', 'tired'],
    depression_psychotic: ['fear', 'sad'],
    gad: ['anxious', 'neutral'],
    panic: ['anxious', 'neutral'],
    ocd: ['anxious', 'neutral'],
    ptsd: ['fear', 'tired'],
    alcohol_withdrawal: ['anxious', 'tired'],
    delirium_tremens: ['fear', 'confused'],
    dementia_bpsd: ['confused', 'confused'],
    bpd_crisis: ['angry', 'sad'],
    bipolar_maint: ['elated', 'sad'],
    alcohol_dependence: ['tired', 'anxious'],
    insomnia: ['tired', 'tired'],
    dementia_mild: ['confused', 'neutral'],
  };
  function emotion(pt) {
    const st = P.stage(pt.sev).k;
    const e = EMO[pt.group] || ['neutral', 'neutral'];
    if (pt.pending) return 'fear';
    if (st === 'severe') return e[0];
    if (st === 'moderate') return e[1];
    if (st === 'mild') return 'neutral';
    return 'smile';
  }
  const portrait = (pt) => A.art.portrait(Object.assign({ sex: pt.sex, age: pt.age }, pt.look || {}), emotion(pt), { seed: pt.seed || U.hash(pt.name) });
  const fill = (pt, t) => U.line(W.fill(pt, t));
  const mdFill = (pt, t) => U.md(W.fill(pt, t));

  function trend(pt) {
    const h = pt.hist;
    if (h.length < 2) return { t: '', c: '' };
    const now = h[h.length - 1].sev;
    const then = h[Math.max(0, h.length - 4)].sev;
    if (now <= then - 3) return { t: '↓ лучше', c: 'pos' };
    if (now >= then + 3) return { t: '↑ хуже', c: 'neg' };
    return { t: '→ без перемен', c: '' };
  }

  /** Линия тяжести: выше — тяжелее; пунктир — порог выписки. */
  function spark(pt, w, h) {
    const pts = pt.hist.map((x) => x.sev);
    if (pts.length < 2) pts.unshift(pts[0] || pt.sev0);
    const n = pts.length;
    const X = (i) => 2 + (i / (n - 1)) * (w - 4);
    const Y = (v) => 2 + (1 - U.clamp(v, 0, 100) / 100) * (h - 4);
    const d = pts.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const th = Y(P.group(pt).discharge);
    return (
      '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<line x1="0" x2="' + w + '" y1="' + th.toFixed(1) + '" y2="' + th.toFixed(1) + '" class="sp-th"/>' +
      '<path d="' + d + '" class="sp-line"/>' +
      '<circle cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(pts[n - 1]).toFixed(1) + '" r="2.6" class="sp-dot"/>' +
      '</svg>'
    );
  }

  function doseText(d, rx) {
    const f = P.form(d, rx.route);
    if (rx.kind === 'int') return '';
    if (rx.prn) return P.fmtDose(rx.dose) + ' по требованию';
    if (rx.route === 'depot') return P.fmtDose(rx.dose) + ' раз в ' + (f.interval || 28) + ' дн.';
    if (rx.route === 'im') return P.fmtDose(rx.dose) + (f.interval === 1 ? ' ежедневно' : f.interval ? ' раз в ' + f.interval + ' дн.' : '');
    if (rx.route === 'patch') return P.fmtDose(rx.dose) + ' за 24 ч';
    const split = f.split || 1;
    const per = rx.dose / split;
    return P.fmtDose(rx.dose) + '/сут' + (split > 1 && per >= 0.25 ? ' <span class="dim">(' + num(per) + ' × ' + split + ')</span>' : '');
  }

  /** Текущий шаг: обход отделения или амбулаторный приём — лист назначений и анализы у них общие. */
  function cur() {
    const s = A.state;
    const step = s && s.activity && s.activity.steps[s.activity.i];
    if (!step || (step.type !== 'ward' && step.type !== 'amb') || !step.p) return {};
    const p = step.p;
    const pt = p.open ? (step.type === 'amb' ? A.clinic.byUid(s, p.open) : W.byUid(s, p.open)) : null;
    return { s, step, p, pt };
  }
  const save = () => {
    G.save();
    UI.render();
  };

  /* ================= Шаг «обход» ================= */
  ACT.ward = function (s, step) {
    const mode = step.mode || (s.phase === 'study' ? 'study' : 'work');
    if (!step.p) {
      const admitted = W.beginRound(s, mode);
      step.p = { mode, admitted: admitted.map((x) => x.uid), open: null, tab: 'today', sheet: null, fb: null, summary: null };
      G.save();
    }
    const p = step.p;
    if (p.summary) return summaryView(s, p, W.byUid(s, p.summary));
    const pt = p.open ? W.byUid(s, p.open) : null;
    if (pt && !pt.done) return chartView(s, p, pt);
    return listView(s, p);
  };

  function boss(p) {
    if (p.amb) return A.clinic.bossNpc(A.state) || 'director';
    return p.mode === 'study' ? 'kandinsky' : 'shubin';
  }

  function listView(s, p) {
    const list = W.active(s).filter((x) => x.mode === p.mode);
    const intro =
      p.mode === 'study'
        ? 'Кандинский раздаёт истории болезни: «Ваши пациенты — ваша ответственность. Назначения согласуете со мной, обоснование — по клиническим рекомендациям. Я проверю каждое».'
        : 'Утренняя пятиминутка закончилась, Галина Петровна кладёт на стол стопку историй болезни. Ваши палаты ждут.';
    let out = UI.sceneFig('ward', s, p.mode === 'study' ? 'Курация · отделение кафедры' : 'Острое отделение, ваши палаты');
    out += '<section class="story"><span class="eyebrow">Обход · ' + esc(C.fmtDate(s.day)) + '</span><h1 class="display">Мои пациенты</h1><p>' + U.line(intro) + '</p></section>';
    const fresh = (p.admitted || []).map((u) => W.byUid(s, u)).filter((x) => x && !x.done);
    if (fresh.length) out += '<p class="note">' + UI.icon('plus') + ' ' + (fresh.length > 1 ? 'Поступили' : 'Поступил' + W.pv(fresh[0], '', 'а')) + ': ' + fresh.map((x) => '<b>' + esc(x.name) + '</b>').join(', ') + (/\.$/.test(fresh[fresh.length - 1].name) ? '' : '.') + '</p>';
    if (!list.length) out += '<p class="empty">Свободных пациентов сегодня нет — все койки заняты у коллег.</p>';
    out += '<div class="wlist">' + list.map((pt) => card(s, pt)).join('') + '</div>';
    const done = (s.ward.done || []).filter((x) => x.end === s.day && x.mode === p.mode && x.how === 'discharge');
    if (done.length) out += '<p class="note">Выписаны сегодня: ' + done.map((x) => esc(x.name) + ' — ' + x.score + ' баллов').join('; ') + '.</p>';
    out += '<div class="next-row">' + btn('Завершить обход', 'wd-done', null, 'primary wide') + '</div>';
    return out;
  }

  function card(s, pt) {
    const st = P.stage(pt.sev);
    const tr = trend(pt);
    const chips = [];
    chips.push(UI.chip(esc(st.name), st.k === 'severe' ? 'neg' : st.k === 'remission' ? 'pos' : ''));
    if (tr.t) chips.push(UI.chip(tr.t, tr.c));
    if (pt.pending) chips.push(UI.chip('срочно', 'warn'));
    if (pt.away) chips.push(UI.chip('в ' + esc(pt.away.where), 'off'));
    const fresh = (pt.notes.length - (pt.seen || 0));
    if (fresh > 0) chips.push(UI.chip('новых записей: ' + fresh, ''));
    const due = P.dueTests(s, pt);
    if (due.some((x) => x.overdue)) chips.push(UI.chip('просрочен контроль', 'neg'));
    else if (due.length) chips.push(UI.chip('пора: ' + due.map((x) => P.lc(P.TESTS[x.test].name)).join(', '), 'warn'));
    const day = s.day - pt.admitDay + 1;
    return (
      '<button type="button" class="wcard' + (pt.pending ? ' alarm' : '') + '" data-act="wd-open" data-arg="' + pt.uid + '">' +
      '<span class="wc-photo">' + portrait(pt) + '</span>' +
      '<span class="wc-main"><b>' + esc(pt.name) + ', ' + years(pt.age) + '</b><span class="dim small"> · ' + day + '-й день</span>' +
      '<span class="wc-dx">' + esc(shortDx(pt.dx)) + '</span>' +
      '<span class="act-chips">' + chips.join('') + '</span></span>' +
      '<span class="wc-spark">' + spark(pt, 84, 34) + '</span>' +
      '</button>'
    );
  }
  function shortDx(dx) {
    const t = String(dx || '');
    const cut = t.indexOf('.', 6);
    const first = t.split('. ')[0];
    return first.length > 90 ? first.slice(0, 88) + '…' : first || t.slice(0, cut > 0 ? cut : 90);
  }

  /* ---------- История болезни ---------- */
  function chartView(s, p, pt) {
    const tpl = D.wardById[pt.tpl] || {};
    const day = s.day - pt.admitDay + 1;
    const st = P.stage(pt.sev);
    const tabs = [
      ['today', 'Сегодня'],
      ['rx', 'Лечение'],
      ['tests', 'Анализы'],
      ['info', 'Анамнез'],
    ]
      .map((t) => '<button type="button" class="tab" role="tab" data-act="wd-tab" data-arg="' + t[0] + '" aria-selected="' + (p.tab === t[0]) + '">' + t[1] + (t[0] === 'tests' && P.dueTests(s, pt).length ? ' •' : '') + '</button>')
      .join('');
    let out = '<button type="button" class="link back-link" data-act="wd-back">← Все пациенты</button>';
    out +=
      '<div class="chart"><div class="chart-top mono">История болезни № ' + (1000 + parseInt(pt.uid.slice(1), 10) * 7 + (pt.seed % 7)) + ' · ' + day + '-й день · ' + esc(LEGAL[pt.legal] || 'добровольно') + '</div>' +
      '<div class="patient"><div class="pt-photo">' + portrait(pt) + '</div><div class="pt-info">' +
      '<span class="eyebrow">' + esc(P.group(pt).name) + '</span>' +
      '<b class="pt-name">' + esc(pt.name) + ', ' + years(pt.age) + '</b>' +
      '<span class="small">' + esc(pt.dx) + '</span>' +
      '<span class="act-chips">' + UI.chip('состояние: ' + esc(st.name), st.k === 'severe' ? 'neg' : st.k === 'remission' ? 'pos' : '') + (pt.refusing ? UI.chip('отказывается от таблеток', 'warn') : '') + '</span>' +
      '</div></div></div>';
    if (pt.pending) out += urgentCard(s, pt);
    if (p.fb && p.fb.uid === pt.uid) out += feedback(p);
    out += '<div class="tabs" role="tablist" aria-label="Разделы истории болезни">' + tabs + '</div><div class="folder pad">';
    if (p.tab === 'rx') out += rxTab(s, p, pt);
    else if (p.tab === 'tests') out += testsTab(s, p, pt);
    else if (p.tab === 'info') out += infoTab(s, p, pt, tpl);
    else out += todayTab(s, p, pt);
    out += '</div>';
    const can = W.canDischarge(s, pt);
    out += '<div class="next-row col">' + btn('Выписать', 'wd-discharge', null, 'wide' + (can.ok && !can.early ? ' primary' : ''), !can.ok) + (can.ok ? '' : '<p class="small dim">' + esc(can.why) + '</p>') + '</div>';
    if (p.sheet) out += sheet(s, p, pt);
    return out;
  }

  function urgentCard(s, pt) {
    const ev = W.EVENTS[pt.pending.k];
    return (
      '<section class="urgent" data-last><span class="eyebrow">Срочно</span><h2 class="h2">' + esc(ev.title) + '</h2><p>' + fill(pt, ev.q(s, pt)) + '</p>' +
      '<div class="choices">' +
      ev.opts.map((o, i) => '<button type="button" class="opt choice" data-act="wd-decide" data-arg="' + i + '"><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.line(o.t) + '</span></span></button>').join('') +
      '</div></section>'
    );
  }

  function feedback(p) {
    const fb = p.fb;
    if (!fb.msgs.length) return '';
    const who = D.npc[boss(p)];
    const order = { err: 0, warn: 1, info: 2, ok: 3 };
    const msgs = fb.msgs.slice().sort((a, b) => order[a.lvl] - order[b.lvl]);
    return (
      '<section class="fb">' +
      '<div class="fb-head">' + UI.npcPortrait(boss(p), msgs.some((m) => m.lvl === 'err') ? 'stern' : msgs.every((m) => m.lvl === 'ok') ? 'smile' : 'neutral', 'mini') +
      '<div><span class="eyebrow">' + esc(who ? who.short : 'Куратор') + (fb.title ? ' · ' + esc(fb.title) : '') + '</span></div>' +
      '<button type="button" class="x" data-act="wd-fb-close" aria-label="Скрыть">' + UI.icon('x') + '</button></div>' +
      '<ul class="fb-list">' +
      msgs.map((m) => '<li class="fb-' + m.lvl + '"><b>' + LVL[m.lvl] + '.</b> ' + U.inline(esc(m.text)) + (m.cite ? ' <span class="cite">' + esc(m.cite) + '</span>' : '') + '</li>').join('') +
      '</ul></section>'
    );
  }

  function todayTab(s, p, pt) {
    const T = D.wardTexts || {};
    const st = P.stage(pt.sev).k;
    const list = ((T.status || {})[pt.group] || {})[st] || [];
    const status = list.length ? list[(s.day + (pt.seed % 5)) % list.length] : '';
    let out = '';
    out += '<h3 class="step-h">Психический статус</h3><p>' + fill(pt, status) + '</p>';
    out += '<div class="dyn">' + spark(pt, 300, 70) + '<p class="small dim">Тяжесть состояния за ' + (s.day - pt.admitDay + 1) + ' дн. Пунктир — порог выписки.</p></div>';
    // нежелательные явления
    const se = Object.keys(pt.sx || {})
      .filter((k) => (pt.sx[k] || 0) >= 0.8 && SE_NAME[k])
      .sort((a, b) => pt.sx[b] - pt.sx[a])
      .map((k) => UI.chip(SE_NAME[k] + ': ' + (pt.sx[k] >= 2.5 ? 'выражено' : pt.sx[k] >= 1.5 ? 'умеренно' : 'слабо'), pt.sx[k] >= 1.5 ? 'warn' : ''));
    if (se.length) out += '<h3 class="step-h">Нежелательные явления</h3><div class="delta">' + se.join('') + '</div>';
    const due = P.dueTests(s, pt);
    if (due.length)
      out +=
        '<h3 class="step-h">Пора проверить</h3><ul class="due">' +
        due.map((x) => '<li class="' + (x.overdue ? 'over' : '') + '">' + esc(P.TESTS[x.test].name) + ' <span class="dim small">— ' + esc(x.why) + '</span> ' + btn('Назначить', 'wd-order', x.test, 'small') + '</li>').join('') +
        '</ul>';
    // дневник
    const from = Math.max(0, Math.min(pt.seen || 0, pt.notes.length - 3));
    const notes = pt.notes.slice(from).slice(-14);
    out += '<h3 class="step-h">Дневник наблюдения</h3><div class="diary">' + notes.map((n, i) => noteHtml(s, pt, n, from + i >= (pt.seen || 0))).join('') + '</div>';
    return out;
  }
  function noteHtml(s, pt, n, fresh) {
    const who = { course: 'Наблюдение', quote: 'Пациент', se: 'Нежелательное явление', lab: 'Лаборатория', staff: 'Персонал', event: 'Происшествие', admit: 'Поступление' }[n.kind] || '';
    const body = n.kind === 'quote' ? '<span class="quote">' + esc(n.text) + '</span>' : U.inline(esc(n.text));
    return '<div class="dnote k-' + n.kind + (n.lvl ? ' l-' + n.lvl : '') + (fresh ? ' fresh' : '') + '"><span class="mono dim small">' + esc(C.fmtShort(n.day)) + ' · ' + who + '</span><p>' + body + '</p></div>';
  }

  /** Дни лечения: на амбулаторном приёме игровой день — несколько дней приёма препарата. */
  const rxDays = (s, pt, since) => Math.round((s.day - since) * (pt.mode === 'amb' ? W.speed(pt) : 1));
  function timeSeg(pt, rx, i, item, ro) {
    if (rx.kind === 'int' || rx.prn || !P.oral(rx.route)) return '';
    if (ro) return rx.time ? '<span class="small">Приём: ' + esc(P.TIMES[rx.time]) + '</span>' : '';
    const f = P.form(item, rx.route);
    const opts = ['am', 'pm'].concat((f.split || 1) > 1 || rx.time === 'split' ? ['split'] : []);
    const adv = G.hard(A.state) ? null : P.timeAdvice(item);
    return (
      '<div class="seg segb tseg" role="group" aria-label="Время приёма">' +
      opts.map((t) => '<button type="button" class="seg-b" data-act="wd-time" data-arg="' + i + ':' + t + '" aria-pressed="' + (rx.time === t) + '">' + esc(P.TIMES[t]) + (adv === t ? ' ✓' : '') + '</button>').join('') +
      '</div>'
    );
  }
  function rxNote(s, pt, rx) {
    const amb = pt.mode === 'amb';
    const days = rxDays(s, pt, rx.since);
    const parts = [];
    if (rx.home) parts.push(amb ? 'назначил другой врач' : 'принимал' + W.pv(pt, '', 'а') + ' до поступления');
    else if (rx.pre) parts.push('назначил прежний врач');
    else if (rx.hosp) parts.push('назначено в стационаре');
    parts.push(days > 0 ? (amb ? 'принимает ' + days + ' ' + U.plural(days, ['день', 'дня', 'дней']) : days + '-й день приёма') : 'назначено сегодня');
    if (rx.route === 'depot' && rx.lastInj != null && amb) {
      const every = P.form(P.drug(rx.id), 'depot').interval || 28;
      const ago = rxDays(s, pt, rx.lastInj);
      parts.push(ago <= 0 ? 'инъекция сделана сегодня' : 'инъекция ' + ago + ' дн. назад, следующая — через ' + Math.max(0, every - ago) + ' дн.');
    }
    return parts.join(' · ');
  }
  /** ro — только просмотр (амбулаторная карта вне визита). */
  function rxTab(s, p, pt, ro) {
    let out = '<h3 class="step-h">' + (pt.mode === 'amb' ? 'Текущее лечение' : 'Лист назначений') + '</h3>';
    if (!pt.rx.length) out += '<p class="empty">Назначений пока нет.</p>';
    out += '<div class="rxlist">';
    pt.rx.forEach((rx, i) => {
      const item = P.item(rx);
      if (!item) return;
      const days = rxDays(s, pt, rx.since);
      if (rx.kind === 'int') {
        out += '<div class="rx int"><div class="rx-main"><b>' + esc(item.name) + '</b><span class="dim small">' + (days > 0 ? (pt.mode === 'amb' ? days + ' дн.' : days + '-й день') : 'с сегодняшнего дня') + '</span></div>' + (ro ? '' : '<div class="rx-btns">' + btn('Отменить', 'wd-stop', i, 'small ghost') + '</div>') + '</div>';
        return;
      }
      const f = P.form(item, rx.route);
      const steps = f.steps || [];
      const k = steps.indexOf(rx.dose);
      out +=
        '<div class="rx' + (rx.held ? ' held' : '') + '"><div class="rx-main"><b>' + esc(item.name) + '</b> <span class="dim small">' + esc(f.label || P.ROUTES[rx.route]) + '</span>' +
        '<span class="rx-dose">' + doseText(item, rx) + (rx.held ? ' ' + UI.chip('приостановлен', 'warn') : '') + '</span>' +
        '<span class="dim small">' + esc(rxNote(s, pt, rx)) + '</span>' +
        timeSeg(pt, rx, i, item, ro) +
        (rx.held && !ro ? btn('Возобновить в этой дозе', 'wd-resume', i, 'small') : '') +
        '</div>' +
        (ro
          ? ''
          : '<div class="rx-btns">' +
            (rx.prn ? '' : btn('−', 'wd-down', i, 'small', k === 0) + btn('+', 'wd-up', i, 'small', k === steps.length - 1)) +
            btn('×', 'wd-stop', i, 'small ghost') +
            '</div>') +
        '</div>';
    });
    out += '</div>';
    if (ro) {
      const home = pt.meds_home || [];
      if (home.length) out += '<h3 class="step-h">Сопутствующие препараты</h3><ul class="home-meds">' + home.map((m) => '<li>' + esc(m.name) + '</li>').join('') + '</ul>';
      return out;
    }
    if (pt.rx.some((r) => r.kind !== 'int' && P.oral(r.route) && !r.prn)) out += '<p class="small dim">' + (G.hard(s) ? '' : '✓ — время приёма по инструкции. ') + 'Чем меньше приёмов в день, тем реже пропуски.</p>';
    out += '<div class="row-btns">' + btn(UI.icon('plus') + ' Назначить препарат', 'wd-add', 'drug', 'primary') + btn('Без лекарств', 'wd-add', 'int', '') + '</div>';
    const home = pt.meds_home || [];
    if (home.length) {
      out += '<h3 class="step-h">Сопутствующие препараты</h3><ul class="home-meds">';
      home.forEach((m) => {
        out += '<li>' + esc(m.name) + (W.HOME_ALT[m.tag] ? ' ' + btn('Попросить терапевта заменить', 'wd-home-stop', m.tag, 'small ghost') : '') + '</li>';
      });
      out += '</ul>';
    }
    return out;
  }

  function testsTab(s, p, pt, ro) {
    const due = P.dueTests(s, pt).map((x) => x.test);
    let out = ro ? '<div>' : '<h3 class="step-h">Назначить обследование</h3><div class="tests">';
    Object.keys(ro ? {} : P.TESTS).forEach((k) => {
      const T = P.TESTS[k];
      const today = pt.tests.some((x) => x.test === k && x.day === s.day);
      out +=
        '<button type="button" class="test' + (due.indexOf(k) >= 0 ? ' due' : '') + '" data-act="wd-order" data-arg="' + k + '"' + (today ? ' aria-disabled="true"' : '') + '>' +
        '<b>' + esc(T.name) + '</b><span class="dim small">' + (today ? 'назначено сегодня' : T.cito ? 'результат сразу' : pt.mode === 'amb' ? 'результат к следующему визиту' : 'результат завтра') + '</span></button>';
    });
    out += '</div>';
    const res = pt.tests.filter((r) => !r.auto || r.flag).slice().reverse().slice(0, 30);
    out += '<h3 class="step-h">Результаты</h3>';
    if (!res.length) out += '<p class="empty">Обследований ещё не было.</p>';
    else
      out +=
        '<ul class="results">' +
        res.map((r) => '<li' + (r.flag ? ' class="flag"' : '') + '><span class="mono dim small">' + esc(pt.mode === 'amb' ? A.clinic.dayText(s, r.day) : C.fmtShort(r.day)) + '</span> <b>' + esc(P.TESTS[r.test].name) + '</b>: ' + (r.value ? esc(r.text) : '<span class="dim">ждём результат</span>') + '</li>').join('') +
        '</ul>';
    return out;
  }

  function infoTab(s, p, pt, tpl) {
    let out = '';
    const sec = (h, t) => (t ? '<h3 class="step-h">' + h + '</h3>' + mdFill(pt, t) : '');
    out += sec('Поступление', tpl.admit);
    out += sec('Жалобы', tpl.complaints);
    out += sec('Анамнез', tpl.history);
    out += sec('Психический статус при поступлении', tpl.status);
    const tags = (pt.traits || []).filter((t) => P.TAG_NAMES[t]).map((t) => UI.chip(esc(P.TAG_NAMES[t]), ''));
    const derived = P.tags(pt);
    ['elderly', 'woman_childbearing', 'qt_long', 'renal', 'liver'].forEach((t) => {
      if (derived[t] && (pt.traits || []).indexOf(t) < 0) tags.push(UI.chip(esc(P.TAG_NAMES[t]), 'warn'));
    });
    if (tags.length) out += '<h3 class="step-h">Важно для назначений</h3><div class="delta">' + tags.join('') + '</div>';
    if ((pt.intolerant || []).length) out += '<p class="small"><b>Плохо переносил' + W.pv(pt, '', 'а') + ':</b> ' + pt.intolerant.map((id) => esc((P.drug(id) || { name: id }).name.toLowerCase())).join(', ') + '.</p>';
    if ((pt.failed || []).length) out += '<p class="small"><b>Ранее неэффективно в адекватной дозе:</b> ' + pt.failed.map((id) => esc((P.drug(id) || { name: id }).name.toLowerCase())).join(', ') + '.</p>';
    const g = P.gl(pt);
    const std = P.standardFor(pt, g);
    if (g) out += '<p class="small dim">Опора для лечения: ' + esc(P.citeFull(g)) + (std ? '; ' + esc(std.title) + ' (' + esc(std.order) + ')' : '') + '. Подробно — во вкладке «КР» справочника.</p>';
    return out;
  }

  /* ---------- Лист выбора препарата ---------- */
  function defaultGroup(pt) {
    return (
      {
        schizophrenia: 'antipsychotic',
        mania: 'antipsychotic',
        bipolar_depression: 'antipsychotic',
        depression: 'antidepressant',
        depression_psychotic: 'antidepressant',
        gad: 'antidepressant',
        panic: 'antidepressant',
        ocd: 'antidepressant',
        ptsd: 'antidepressant',
        alcohol_withdrawal: 'anxiolytic',
        delirium_tremens: 'anxiolytic',
        dementia_bpsd: 'dementia',
        bpd_crisis: 'int',
        bipolar_maint: 'moodstab',
        alcohol_dependence: 'addiction',
        insomnia: 'hypnotic',
        dementia_mild: 'dementia',
      }[pt.group] || 'antipsychotic'
    );
  }
  function sheet(s, p, pt) {
    const sh = p.sheet;
    let body = '';
    let title = 'Назначение';
    if (sh.id && sh.group !== 'int') {
      const d = P.drug(sh.id);
      title = d.name;
      const forms = d.forms || [];
      const f = P.form(d, sh.route);
      const r = P.range(d, sh.route, pt);
      const dupe = pt.rx.find((x) => x.id === d.id && x.route === sh.route);
      body += '<p class="small dim">' + esc(CLS[d.cls] || '') + (d.aka ? ' · ' + esc(d.aka) : '') + '</p><p class="small">' + esc(d.notes || '') + '</p>';
      if (forms.length > 1)
        body +=
          '<div class="seg segb" role="group" aria-label="Форма">' +
          forms.map((x) => '<button type="button" class="seg-b" data-act="wd-sroute" data-arg="' + x.route + '" aria-pressed="' + (x.route === sh.route) + '">' + esc(P.ROUTES[x.route]) + '</button>').join('') +
          '</div><p class="small dim">' + esc(f.label || '') + '</p>';
      else body += '<p class="small"><b>Форма:</b> ' + esc(f.label || P.ROUTES[f.route]) + '</p>';
      const hard = G.hard(s);
      if (r && !hard) body += '<p class="small">' + (P.oral(sh.route) ? 'Для этого пациента: ' : '') + 'старт ' + P.fmtDose(r.start) + ', терапевтическая ' + P.fmtDose(r.min) + ' — ' + P.fmtDose(r.max) + (P.oral(sh.route) ? ' в сутки' : '') + '.</p>';
      if (hard) body += '<p class="small dim">Сложная игра: дозы — по справочнику препаратов.</p>';
      if (d.titration && d.titration.note && !hard) body += '<p class="small dim">Титрация: ' + esc(d.titration.note) + '</p>';
      body +=
        '<div class="doses" role="group" aria-label="Доза">' +
        (f.steps || []).map((x) => '<button type="button" class="dose" data-act="wd-sdose" data-arg="' + x + '" aria-pressed="' + (x === sh.dose) + '">' + num(x) + '</button>').join('') +
        '</div><p class="small dim">' + (f.prn ? 'Разовая доза, вводится по требованию.' : P.oral(sh.route) ? 'мг в сутки' + (f.split > 1 ? ', в ' + f.split + ' приёма' : '') : sh.route === 'patch' ? 'мг за 24 часа' : 'мг на введение') + '</p>';
      if (P.oral(sh.route) && !f.prn) {
        const adv = hard ? null : P.timeAdvice(d);
        const opts = ['am', 'pm'].concat((f.split || 1) > 1 ? ['split'] : []);
        body +=
          '<p class="small"><b>Когда принимать:</b></p><div class="seg segb" role="group" aria-label="Время приёма">' +
          opts.map((t) => '<button type="button" class="seg-b" data-act="wd-stime" data-arg="' + t + '" aria-pressed="' + (sh.time === t) + '">' + esc(P.TIMES[t]) + (adv === t ? ' ✓' : '') + '</button>').join('') +
          '</div>' + (adv ? '<p class="small dim">✓ — ' + (adv === 'pm' ? 'вызывает сонливость, удобнее вечером' : 'может бодрить, лучше утром') + '.</p>' : '');
      }
      if (dupe) body += '<p class="note warn">Этот препарат в этой форме уже назначен — изменится доза.</p>';
      body += '<div class="row-btns spread">' + btn('← Список', 'wd-sback', null, 'ghost') + btn('Назначить', 'wd-sok', null, 'primary', sh.dose == null) + '</div>';
    } else {
      const tabs = P.GROUP_TABS.map((t) => '<button type="button" class="tab" role="tab" data-act="wd-sgroup" data-arg="' + t[0] + '" aria-selected="' + (sh.group === t[0]) + '">' + esc(t[1]) + '</button>').join('');
      body += '<div class="tabs small-tabs" role="tablist">' + tabs + '</div><div class="sheet-list">';
      if (sh.group === 'int') {
        const place = pt.mode === 'amb' ? 'amb' : 'ward';
        (D.interventions || []).filter((it) => !it.where || it.where.indexOf(place) >= 0).forEach((it) => {
          const on = pt.rx.some((x) => x.kind === 'int' && x.id === it.id);
          body += '<button type="button" class="opt" data-act="wd-sint" data-arg="' + it.id + '"' + (on ? ' aria-disabled="true"' : '') + '><span class="opt-main"><span class="opt-t">' + esc(it.name) + (on ? ' <span class="chip">назначено</span>' : '') + '</span><span class="opt-sub">' + esc(it.note || '') + '</span></span></button>';
        });
      } else {
        (D.drugs || [])
          .filter((d) => d.group === sh.group)
          .forEach((d) => {
            const on = pt.rx.some((x) => x.id === d.id);
            let kr = '';
            if (G.difficulty(s) === 'easy') {
              const ln = P.line(pt, d).line;
              if (ln === 'first') kr = ' <span class="chip pos">КР: первая линия</span>';
              else if (ln === 'second') kr = ' <span class="chip">КР: вторая линия</span>';
              else if (ln === 'avoid') kr = ' <span class="chip neg">КР: не рекомендуется</span>';
            }
            body += '<button type="button" class="opt" data-act="wd-sdrug" data-arg="' + d.id + '"><span class="opt-main"><span class="opt-t">' + esc(d.name) + (on ? ' <span class="chip">назначен</span>' : '') + kr + '</span><span class="opt-sub">' + esc(CLS[d.cls] || '') + (d.aka ? ' · ' + esc(d.aka) : '') + '</span></span></button>';
          });
      }
      body += '</div>';
    }
    return (
      '<div class="sheet-back" data-act="wd-sclose"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-head"><b>' + esc(title) + '</b><button type="button" class="x" data-act="wd-sclose" aria-label="Закрыть">' + UI.icon('x') + '</button></div>' +
      body +
      '</div>'
    );
  }

  /* ---------- Выписка ---------- */
  function summaryView(s, p, pt) {
    if (!pt || !pt.score) {
      p.summary = null;
      return listView(s, p);
    }
    const sc = pt.score;
    const tpl = D.wardById[pt.tpl] || {};
    const g = P.gl(pt);
    const grade = sc.total >= 85 ? 'Отлично' : sc.total >= 70 ? 'Хорошо' : sc.total >= 50 ? 'Удовлетворительно' : 'Плохо';
    const bar = (l, v) => '<div class="part"><span>' + l + '</span><div class="mini-track"><div style="width:' + v + '%"></div></div><b>' + v + '</b></div>';
    let out = '<section class="result-card"><div class="stamp' + (sc.total < 50 ? ' bad' : '') + '"><b>' + sc.total + '</b><span>' + grade + '</span></div>';
    out += '<p class="mono small">' + esc(pt.name) + ' · ' + (pt.how === 'discharge' ? 'выписка' : 'передача') + ' на ' + sc.days + '-й день</p>';
    out += '<div class="parts wide">' + bar('Исход', sc.outcome) + bar('Соответствие КР', sc.kr) + bar('Безопасность', sc.safety) + bar('Мониторинг', sc.mon) + bar('Срок лечения', sc.los) + '</div>';
    if (sc.maint && sc.maint.length) out += '<ul class="fb-list">' + sc.maint.map((m) => '<li class="fb-' + m.lvl + '"><b>' + LVL[m.lvl] + '.</b> ' + esc(m.text) + '</li>').join('') + '</ul>';
    out += '</section>';
    out += '<section class="review">';
    const bad = pt.rev.list.filter((m) => m.lvl === 'err' || m.lvl === 'warn').slice(-8);
    if (bad.length) out += '<h2 class="step-h">Замечания по ходу лечения</h2><ul class="fb-list">' + bad.map((m) => '<li class="fb-' + m.lvl + '"><span class="mono dim small">' + esc(C.fmtShort(m.day)) + '</span> ' + esc(m.text) + (m.cite ? ' <span class="cite">' + esc(m.cite) + '</span>' : '') + '</li>').join('') + '</ul>';
    const ev = pt.events.filter((e) => e.resolved);
    if (ev.length)
      out +=
        '<h2 class="step-h">Осложнения</h2><ul class="marks">' +
        ev.map((e) => '<li class="' + (e.auto ? 'm-miss' : e.ok === true ? 'm-ok' : 'm-bad') + '">' + esc(W.EVENTS[e.k].title) + (e.preventable ? ' <span class="chip neg">можно было предотвратить</span>' : '') + (e.auto ? ' <span class="dim">— решал дежурный врач</span>' : '') + '</li>').join('') +
        '</ul>';
    if (tpl.pitfall) out += '<h2 class="step-h">В чём был подвох</h2><div class="prose">' + mdFill(pt, tpl.pitfall) + '</div>';
    if (tpl.ideal) out += '<div class="pearl plain"><span class="eyebrow">Как вести по клиническим рекомендациям</span>' + mdFill(pt, tpl.ideal) + '</div>';
    const std = P.standardFor(pt, g);
    if (g) out += '<p class="small dim">' + esc(P.citeFull(g)) + (std ? '. ' + esc(std.title) + ', ' + esc(std.order) : '') + '.</p>';
    out += '</section><div class="next-row">' + btn('К списку пациентов', 'wd-sum-close', null, 'primary wide') + '</div>';
    return out;
  }

  /* ---------- Обработчики ---------- */
  UI.on('wd-open', (uid) => {
    const { p } = cur();
    if (!p) return;
    p.open = uid;
    p.tab = 'today';
    p.sheet = null;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('wd-back', () => {
    const { p, pt } = cur();
    if (!p) return;
    if (pt) pt.seen = pt.notes.length;
    p.open = null;
    p.sheet = null;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('wd-tab', (t) => {
    const { p } = cur();
    if (!p) return;
    p.tab = t;
    save();
  });
  UI.on('wd-fb-close', () => {
    const { p } = cur();
    if (!p) return;
    p.fb = null;
    save();
  });
  function fb(p, pt, title, msgs) {
    p.fb = { uid: pt.uid, title, msgs: msgs || [] };
  }
  UI.on('wd-decide', (i) => {
    const { s, p, pt } = cur();
    if (!pt || !pt.pending) return;
    const r = W.decide(s, pt, +i);
    if (r) fb(p, pt, r.title, [{ lvl: r.ok === true ? 'ok' : r.ok === 'part' ? 'warn' : 'err', text: r.why }]);
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('wd-up', (i) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const rx = pt.rx[+i];
    const msgs = W.stepDose(s, pt, +i, 1);
    if (rx) fb(p, pt, P.item(rx).name + ': доза повышена', msgs);
    save();
  });
  UI.on('wd-down', (i) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const rx = pt.rx[+i];
    const msgs = W.stepDose(s, pt, +i, -1);
    if (rx) fb(p, pt, P.item(rx).name + ': доза снижена', msgs);
    save();
  });
  UI.on('wd-stop', (i) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const rx = pt.rx[+i];
    if (!rx) return;
    const name = P.item(rx).name;
    const msgs = W.stop(s, pt, +i);
    fb(p, pt, name + ': отменено', msgs);
    save();
  });
  UI.on('wd-home-stop', (tag) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const m = W.stopHome(s, pt, tag);
    if (m) fb(p, pt, 'Сопутствующая терапия', [{ lvl: 'info', text: 'Терапевт заменил: ' + m.name + '. ' + (W.HOME_ALT[tag] || '') + '.' }]);
    save();
  });
  UI.on('wd-order', (test) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const r = W.order(s, pt, test);
    if (r) UI.toast(r.value ? '<b>' + esc(P.TESTS[test].name) + ':</b> ' + esc(r.text) : 'Назначено: ' + esc(P.lc(P.TESTS[test].name)) + (pt.mode === 'amb' ? '. Результат придёт к следующему визиту.' : '. Результат будет завтра.'));
    save();
  });
  UI.on('wd-add', (kind) => {
    const { p, pt } = cur();
    if (!pt) return;
    p.sheet = { group: kind === 'int' ? 'int' : defaultGroup(pt) === 'int' ? 'antipsychotic' : defaultGroup(pt), id: null, route: null, dose: null };
    save();
  });
  UI.on('wd-sgroup', (g) => {
    const { p } = cur();
    if (!p || !p.sheet) return;
    p.sheet = { group: g, id: null, route: null, dose: null };
    save();
  });
  UI.on('wd-sdrug', (id) => {
    const { p, pt } = cur();
    if (!p || !p.sheet) return;
    const d = P.drug(id);
    if (!d) return;
    const ex = pt.rx.find((x) => x.id === id);
    const route = ex ? ex.route : (d.forms[0] || {}).route || 'po';
    p.sheet.id = id;
    setRoute(p.sheet, d, route, pt, ex);
    save();
  });
  function setRoute(sh, d, route, pt, ex) {
    sh.route = route;
    sh.time = ex && ex.route === route && ex.time ? ex.time : P.defaultTime(d, route);
    const f = P.form(d, route);
    const r = P.range(d, route, pt);
    const steps = f.steps || [];
    let dose = ex && ex.route === route ? ex.dose : r && r.start != null ? r.start : steps[0];
    if (steps.length && steps.indexOf(dose) < 0) dose = steps.reduce((a, b) => (Math.abs(b - dose) < Math.abs(a - dose) ? b : a), steps[0]);
    sh.dose = dose;
  }
  UI.on('wd-sroute', (route) => {
    const { p, pt } = cur();
    if (!p || !p.sheet || !p.sheet.id) return;
    const d = P.drug(p.sheet.id);
    setRoute(p.sheet, d, route, pt, pt.rx.find((x) => x.id === d.id && x.route === route));
    save();
  });
  UI.on('wd-stime', (t) => {
    const { p } = cur();
    if (!p || !p.sheet || !P.TIMES[t]) return;
    p.sheet.time = t;
    save();
  });
  UI.on('wd-time', (arg) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const [i, t] = String(arg).split(':');
    const rx = pt.rx[+i];
    if (!rx) return;
    const msgs = W.setTime(s, pt, +i, t);
    if (pt.vis) pt.vis.timeChanged = true;
    fb(p, pt, P.item(rx).name + ': ' + P.TIMES[t], msgs);
    save();
  });
  UI.on('wd-resume', (i) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const rx = pt.rx[+i];
    if (!rx || !rx.held) return;
    rx.held = false;
    rx.heldDay = null;
    rx.changed = s.day;
    W.log(s, pt, P.item(rx).name + ': приём возобновлён в прежней дозе.');
    fb(p, pt, P.item(rx).name + ': приём возобновлён', [{ lvl: 'info', text: 'Препарат снова в листе назначений. Если причиной паузы была токсичность — проверьте концентрацию или анализы через несколько дней.' }]);
    save();
  });
  UI.on('wd-sdose', (x) => {
    const { p } = cur();
    if (!p || !p.sheet) return;
    p.sheet.dose = +x;
    save();
  });
  UI.on('wd-sback', () => {
    const { p } = cur();
    if (!p || !p.sheet) return;
    p.sheet.id = null;
    save();
  });
  UI.on('wd-sclose', () => {
    const { p } = cur();
    if (!p) return;
    p.sheet = null;
    save();
  });
  UI.on('wd-sok', () => {
    const { s, p, pt } = cur();
    if (!pt || !p.sheet || !p.sheet.id || p.sheet.dose == null) return;
    const d = P.drug(p.sheet.id);
    const msgs = W.prescribe(s, pt, { id: d.id, kind: 'drug', route: p.sheet.route, dose: p.sheet.dose, time: p.sheet.time });
    fb(p, pt, d.name + ' ' + P.fmtDose(p.sheet.dose), msgs);
    p.sheet = null;
    p.tab = 'rx';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('wd-sint', (id) => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const it = P.int(id);
    if (!it) return;
    const msgs = W.prescribe(s, pt, { id, kind: 'int' });
    fb(p, pt, it.name, msgs);
    p.sheet = null;
    p.tab = 'rx';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('wd-discharge', () => {
    const { s, p, pt } = cur();
    if (!pt) return;
    const can = W.canDischarge(s, pt);
    if (!can.ok) {
      UI.toast(esc(can.why));
      return;
    }
    const go = () => {
      pt.seen = pt.notes.length;
      W.finish(s, pt, 'discharge');
      p.summary = pt.uid;
      p.open = null;
      p.sheet = null;
      G.save();
      UI.render({ scroll: 'top' });
    };
    if (can.early) UI.ask('Выписать досрочно?', 'Состояние ещё не дотягивает до критериев выписки: возможен ранний рецидив, это скажется на оценке.', 'Выписать', go);
    else UI.ask('Выписать пациента?', 'Выписка с рекомендациями по поддерживающей терапии. Лист назначений на момент выписки уйдёт в выписной эпикриз.', 'Выписать', go);
  });
  UI.on('wd-sum-close', () => {
    const { p } = cur();
    if (!p) return;
    p.summary = null;
    save();
  });
  UI.on('wd-done', () => {
    const { s, p } = cur();
    if (!p) return;
    const list = W.active(s).filter((x) => x.mode === p.mode);
    const finish = () => {
      list.forEach((x) => (x.seen = x.notes.length));
      ACT.done(W.roundResult(s, p.mode));
    };
    if (list.some((x) => x.pending)) UI.ask('Закончить обход?', 'У части пациентов остались срочные ситуации. Решать их будет дежурный врач — без вас.', 'Закончить', finish);
    else finish();
  });

  // Escape на компьютере закрывает лист назначения
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const { p } = cur();
    if (p && p.sheet) {
      p.sheet = null;
      save();
    }
  });

  /* ================= Справочник: препараты и КР ================= */
  UI.ward = {};
  /** Общие части для амбулаторного приёма (js/ui/clinic.js). */
  UI.ward.h = { btn, num, years, portrait, spark, doseText, feedback, sheet, rxTab, testsTab, infoTab, shortDx, fill, mdFill, fb, emotion, LVL, SE_NAME, CLS, DOMAIN, cur, rxDays };
  UI.ward.drugsRef = function (s) {
    const g = UI.view.drugGroup || 'antipsychotic';
    const open = UI.view.refItem;
    const tabs = P.GROUP_TABS.filter((t) => t[0] !== 'int').map((t) => '<button type="button" class="chipbtn" data-act="ref-dgroup" data-arg="' + t[0] + '" aria-pressed="' + (g === t[0]) + '">' + esc(t[1]) + '</button>').join('');
    let out = '<p class="small dim">Игровой справочник: дозы и показания упрощены. Для реальных пациентов сверяйтесь с инструкцией и действующими клиническими рекомендациями.</p><div class="chipbar">' + tabs + '</div>';
    (D.drugs || [])
      .filter((d) => d.group === g)
      .forEach((d) => {
        const isOpen = open === d.id;
        out += '<div class="pt-row"><button type="button" class="pt-head" data-act="ref-drug" data-arg="' + d.id + '" aria-expanded="' + isOpen + '"><span><b>' + esc(d.name) + '</b><br><span class="dim small">' + esc(CLS[d.cls] || '') + (d.aka ? ' · ' + esc(d.aka) : '') + '</span></span><span aria-hidden="true">' + (isOpen ? '−' : '+') + '</span></button>';
        if (isOpen) out += '<div class="pt-body">' + drugCard(d) + '</div>';
        out += '</div>';
      });
    return out;
  };
  function drugCard(d) {
    let out = '<p>' + esc(d.notes || '') + '</p>';
    out += '<p class="small"><b>Формы:</b> ' + (d.forms || []).map((f) => esc(f.label || P.ROUTES[f.route]) + ' (' + (f.steps || []).map(num).join(', ') + ' мг)').join('; ') + '.</p>';
    const doses = Object.keys(d.doses || {})
      .filter((k) => DOMAIN[k])
      .map((k) => DOMAIN[k] + ': ' + num(d.doses[k].start) + ' → ' + num(d.doses[k].min) + '–' + num(d.doses[k].max) + ' мг/сут');
    if (doses.length) out += '<p class="small"><b>Дозы (старт → терапевтические):</b> ' + esc(doses.join('; ')) + '.</p>';
    const eff = Object.keys(d.eff || {})
      .filter((k) => (d.eff[k] || 0) >= 0.3 && DOMAIN[k])
      .sort((a, b) => d.eff[b] - d.eff[a])
      .map((k) => DOMAIN[k]);
    if (eff.length) out += '<p class="small"><b>Действует на:</b> ' + esc(eff.join(', ')) + '.</p>';
    if (d.titration && d.titration.note) out += '<p class="small"><b>Титрация:</b> ' + esc(d.titration.note) + '</p>';
    const se = Object.keys(d.se || {}).filter((k) => SE_NAME[k] && d.se[k] >= 1);
    const often = se.filter((k) => d.se[k] >= 2).map((k) => SE_NAME[k]);
    const some = se.filter((k) => d.se[k] < 2).map((k) => SE_NAME[k]);
    if (often.length) out += '<p class="small"><b>Частые нежелательные явления:</b> ' + esc(often.join(', ')) + '.</p>';
    if (some.length) out += '<p class="small"><b>Возможны:</b> ' + esc(some.join(', ')) + '.</p>';
    const contra = (d.contra || []).map((c) => '<li><b>' + esc(P.tagName(c.t)) + '</b>' + (c.sev === 'moderate' ? ' (с осторожностью)' : '') + ' — ' + esc(c.note || '') + '</li>');
    if (contra.length) out += '<p class="small"><b>Противопоказания и опасные сочетания:</b></p><ul class="small">' + contra.join('') + '</ul>';
    const mon = (d.monitor || []).map((m) => esc(P.TESTS[m.test] ? P.TESTS[m.test].name : m.test) + ' — ' + esc(m.note || ''));
    if (mon.length) out += '<p class="small"><b>Контроль:</b> ' + mon.join('; ') + '.</p>';
    return out;
  }
  UI.ward.krRef = function (s) {
    const open = UI.view.refItem;
    let out = '<p class="small dim">Клинические рекомендации Минздрава России и стандарты медицинской помощи, на которые опирается проверка назначений в игре. Уровни УУР/УДД указаны там, где они проверены; пометка «общий принцип» — положение, которое игра не приписывает конкретным КР. Актуальные тексты — в рубрикаторе cr.minzdrav.gov.ru.</p>';
    Object.keys(P.GROUPS).forEach((k) => {
      const g = (D.guidelines || {})[k];
      if (!g) return;
      const isOpen = open === 'kr:' + k;
      out += '<div class="pt-row"><button type="button" class="pt-head" data-act="ref-kr" data-arg="' + k + '" aria-expanded="' + isOpen + '"><span><b>' + esc(P.GROUPS[k].name) + '</b><br><span class="dim small">КР «' + esc(g.short || g.title) + '»' + (g.year ? ', ' + g.year : '') + (g.id ? ' · ID ' + g.id : '') + '</span></span><span aria-hidden="true">' + (isOpen ? '−' : '+') + '</span></button>';
      if (isOpen) {
        out += '<div class="pt-body"><p class="small">' + esc(P.citeFull(g)) + '.</p>';
        if (g.standard) out += '<p class="small"><b>Стандарт:</b> ' + esc(g.standard.title) + ', ' + esc(g.standard.order) + (g.standard.icd ? ' (' + esc(g.standard.icd.join(', ')) + ')' : '') + '.</p>';
        out += '<ul class="kr-key">' + (g.key || []).map((x) => '<li>' + esc(x.t) + (x.uur ? ' <span class="chip">УУР ' + esc(x.uur) + (x.udd ? ', УДД ' + esc(x.udd) : '') + '</span>' : '') + (x.gen ? ' <span class="chip off">общий принцип</span>' : '') + '</li>').join('') + '</ul></div>';
      }
      out += '</div>';
    });
    return out;
  };
  UI.ward.archive = function (s) {
    const done = ((s.ward && s.ward.done) || []).slice().reverse();
    if (!done.length) return '<p class="empty">Здесь появятся пациенты, которых вы вели в отделении: оценка, замечания и разбор.</p>';
    const open = UI.view.refItem;
    return done
      .map((x) => {
        const isOpen = open === 'w:' + x.uid + ':' + x.end;
        const tpl = D.wardById[x.tpl] || {};
        let body = '';
        if (isOpen) {
          body += '<div class="pt-body"><p class="mono small">' + esc(x.dx) + '</p>';
          if ((x.maint || []).length) body += '<ul class="fb-list">' + x.maint.map((m) => '<li class="fb-' + m.lvl + '">' + esc(m.text) + '</li>').join('') + '</ul>';
          const bad = (x.rev || []).filter((m) => m.lvl === 'err' || m.lvl === 'warn');
          if (bad.length) body += '<ul class="fb-list">' + bad.map((m) => '<li class="fb-' + m.lvl + '">' + esc(m.text) + '</li>').join('') + '</ul>';
          if (tpl.ideal) body += '<div class="pearl plain"><span class="eyebrow">Как вести по КР</span>' + U.md(tpl.ideal) + '</div>';
          body += '</div>';
        }
        return (
          '<div class="pt-row"><button type="button" class="pt-head" data-act="ref-ward" data-arg="' + x.uid + ':' + x.end + '" aria-expanded="' + isOpen + '"><span><b>' + esc(x.name) + '</b> · ' + esc(P.GROUPS[x.group] ? P.GROUPS[x.group].name : '') +
          '<br><span class="dim small">' + C.fmtDate(x.admit) + ' — ' + C.fmtDate(x.end) + ' · ' + (x.how === 'discharge' ? 'выписка' : 'передача') + (x.mode === 'study' ? ' · практика' : '') + '</span></span>' +
          '<span class="score-pill s' + (x.score >= 85 ? 5 : x.score >= 70 ? 4 : x.score >= 50 ? 3 : 2) + '">' + x.score + '</span></button>' + body + '</div>'
        );
      })
      .join('');
  };
  /* ================= Диплом ================= */
  UI.ward.diplomaDoc = function (s) {
    const d = s.study.diploma;
    if (!d) return '';
    const gr = (g) => (g ? A.exams.gradeName(g) : '—');
    const date = G.when(d.day, d.date);
    return (
      '<section class="diploma">' +
      '<div class="dip-title">' +
      '<span class="dip-uni">Медицинский университет города N</span>' +
      '<h2 class="dip-h">Диплом</h2><p class="dip-sub">об окончании ординатуры</p>' +
      '<p class="dip-no mono">' + esc(d.number) + '</p>' +
      '<p>Настоящий диплом свидетельствует о том, что</p>' +
      '<p class="dip-name">' + esc(s.player.name) + '</p>' +
      '<p>' + U.t('{освоил|освоила}') + ' программу ординатуры по специальности</p>' +
      '<p class="dip-spec">' + esc(d.spec) + '</p>' +
      '<p>Решением Государственной экзаменационной комиссии<br><span class="mono small">(протокол № ' + esc(d.protocol) + ' от ' + esc(date) + ')</span><br>присвоена квалификация</p>' +
      '<p class="dip-qual">' + esc(d.qual) + '</p>' +
      '<p class="dip-meta mono">Рег. № ' + esc(d.reg) + ' · дата выдачи ' + esc(date) + '</p>' +
      '</div>' +
      '<div class="dip-app"><h3 class="dip-ah">Приложение к диплому</h3>' +
      '<p class="small">Срок освоения программы ординатуры — 2 года, объём — 120 зачётных единиц.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Дисциплины (модули), практики, ГИА</th><th>Оценка</th></tr></thead><tbody>' +
      '<tr><td>Психиатрия</td><td class="hand">' + gr(d.grades.exam1) + '</td></tr>' +
      '<tr><td>Производственная (клиническая) практика</td><td class="hand">' + gr(d.grades.practice) + '</td></tr>' +
      '<tr><td>Государственная итоговая аттестация</td><td class="hand">' + gr(d.grades.gia) + '</td></tr>' +
      '</tbody></table></div>' +
      '<p class="small dim">Игровой документ. В реальности образец диплома об окончании ординатуры утверждён приказом Минздрава России от 25.03.2025 № 148н, порядок ГИА — приказом Минобрнауки России от 18.03.2016 № 227, программа — ФГОС ВО 31.08.20 «Психиатрия» (приказ Минобрнауки России от 16.10.2023 № 981). Диплома ординатуры «с отличием» не предусмотрено.</p>' +
      '</div></section>'
    );
  };
  ACT.diploma = function (s) {
    return (
      '<section class="story"><span class="eyebrow">Деканат</span><h1 class="display">Диплом об окончании ординатуры</h1><p>Синяя твёрдая обложка, титул и приложение с оценками. Квалификация — «врач-психиатр». Чтобы работать, остаётся пройти аккредитацию.</p></section>' +
      UI.ward.diplomaDoc(s) +
      '<div class="next-row">' + btn('Дальше', 'step-next', null, 'primary wide') + '</div>'
    );
  };

  /** Карточки профиля: практика, диплом, аккредитация. */
  UI.ward.profileCards = function (s) {
    let out = '';
    const pr = s.ward && s.ward.practice;
    if (pr && pr.pre) {
      out +=
        '<section class="card"><h2 class="h2">Производственная практика</h2><p class="small">Пройдена в ординатуре, ' + esc(pr.date || '') + ': <b>' + esc(pr.grade >= 3 ? A.exams.gradeName(pr.grade) : 'не зачтено') + '</b>.</p></section>';
    } else if (pr && (pr.start || pr.closed)) {
      const led = ((s.ward && s.ward.done) || []).filter((x) => x.mode === 'study').length + W.active(s).filter((x) => x.mode === 'study').length;
      const g = pr.closed ? (pr.grade >= 3 ? A.exams.gradeName(pr.grade) : 'не зачтено') : 'идёт';
      out +=
        '<section class="card"><h2 class="h2">Производственная практика</h2><div class="stats">' +
        '<div class="stat"><span>Обходов</span><b>' + (pr.rounds || 0) + (pr.days ? ' / ' + pr.days : '') + '</b></div>' +
        '<div class="stat"><span>Пациентов</span><b>' + led + '</b></div>' +
        (pr.closed ? '<div class="stat"><span>Средняя оценка ведения</span><b>' + (pr.avg || 0) + '</b></div>' : '') +
        '<div class="stat"><span>Зачёт</span><b>' + esc(g) + (pr.makeupDone ? ' (отработка)' : '') + (pr.legacy ? ' (по старым правилам)' : '') + '</b></div>' +
        '</div>' +
        (pr.closed ? '' : '<p class="small dim">Практика — с ' + C.fmtDate(W.PRACTICE_FROM) + ' по ' + C.fmtDate(W.PRACTICE_TO) + ': обход каждый учебный день, на кафедре.</p>') +
        '</section>';
    }
    const d = s.study.diploma;
    if (d) {
      const open = UI.view.diplomaOpen;
      out +=
        '<section class="card"><h2 class="h2">Диплом об окончании ординатуры</h2><p class="small">' + esc(d.spec) + ' · квалификация «' + esc(d.qual) + '» · № ' + esc(d.number) + ', выдан ' + esc(G.when(d.day, d.date)) + '.</p>' +
        '<button type="button" class="link" data-act="diploma-open">' + (open ? 'Свернуть' : 'Открыть диплом') + '</button>' +
        (open ? UI.ward.diplomaDoc(s) : '') +
        '</section>';
    }
    if (s.study.accr) {
      out +=
        '<section class="card"><h2 class="h2">Аккредитация</h2><p class="small">Первичная специализированная аккредитация по специальности «Психиатрия» — <b>сдано</b>, ' + esc(G.when(s.study.accr.day, s.study.accr.date)) + (s.study.accr.testPct != null ? ' (тестирование — ' + s.study.accr.testPct + '%)' : '') + '.</p>' +
        '<p class="small dim">Сведения внесены в Федеральный регистр медицинских работников; выписка — на Госуслугах. Следующая аккредитация — периодическая, через 5 лет (Положение об аккредитации специалистов, приказ Минздрава России от 28.10.2022 № 709н).</p></section>';
    }
    return out;
  };
  UI.on('diploma-open', () => {
    UI.view.diplomaOpen = !UI.view.diplomaOpen;
    UI.render();
  });

  UI.on('ref-dgroup', (g) => {
    UI.view.drugGroup = g;
    UI.view.refItem = null;
    UI.render();
  });
  UI.on('ref-drug', (id) => {
    UI.view.refItem = UI.view.refItem === id ? null : id;
    UI.render();
  });
  UI.on('ref-kr', (k) => {
    UI.view.refItem = UI.view.refItem === 'kr:' + k ? null : 'kr:' + k;
    UI.render();
  });
  UI.on('ref-ward', (k) => {
    UI.view.refItem = UI.view.refItem === 'w:' + k ? null : 'w:' + k;
    UI.render();
  });
})((window.A = window.A || {}));
