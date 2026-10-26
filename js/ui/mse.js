/* Экран конструктора психического статуса: материал приёма, разделы по одному, запись в карте, разбор и образец.
   Один экран на три места: тренажёр (UI.view.trainer.mse), практикум на кафедре (шаг занятия «mse»)
   и первичный приём (step.p.mse = { uid, st }). Движок — A.mse. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = A.data;
  const G = A.game;
  const UI = A.ui;
  const ACT = UI.act;
  const MS = A.mse;
  const esc = U.esc;
  const btn = (label, act, arg, cls, dis) =>
    '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + (dis ? ' aria-disabled="true"' : '') + '>' + label + '</button>';
  const years = (n) => n + ' ' + U.plural(n, ['год', 'года', 'лет']);
  const fx = (st, t) => U.inline(esc(MS.fill(t, st.sex)));
  const MAT = { see: 'Наблюдение', chart: 'Документы' };
  const MARK = { ok: 'точно', part: 'неполно', bad: 'с ошибкой' };

  /* ---------- Где открыт конструктор ---------- */
  function cur() {
    const v = UI.view;
    if (v.screen === 'trainer') return v.trainer && v.trainer.mse ? trCtx(v.trainer) : null;
    if (v.screen) return null;
    const s = A.state;
    const act = s && s.activity;
    const step = act && act.steps[act.i];
    if (!step || !step.p) return null;
    if (step.type === 'mse') return actCtx(s, step);
    if (step.type === 'amb' && step.p.mse) return amCtx(s, step);
    return null;
  }

  function scPatient(sc) {
    const c = sc.case && D.caseById ? D.caseById[sc.case] : null;
    const look = Object.assign({ sex: sc.patient.sex, age: sc.patient.age }, (c && c.patient && c.patient.look) || {});
    return { name: sc.patient.name, age: sc.patient.age, photo: A.art.portrait(look, sc.patient.emotion || 'neutral', { seed: U.hash(sc.id) }) };
  }

  function trCtx(tv) {
    const st = tv.mse;
    const sc = MS.get(st.id);
    const T = A.trainer;
    return {
      kind: 'tr',
      st,
      sc,
      who: scPatient(sc),
      eyebrow: 'Тренажёр · психический статус · ' + T.LEVELS[sc.lvl].short + ' уровень',
      quit: 'Прервать',
      save() {},
      finish() {
        st.newAch = T.mseFinish(st);
      },
      quitFn() {
        tv.mse = null;
      },
      closeBtns: () => btn('Ещё раз', 'mse-again', null, 'primary wide') + btn('Другой пациент', 'mse-other', null, 'wide') + btn('К тренажёру', 'mse-close', null, 'wide'),
      close() {
        tv.mse = null;
      },
    };
  }

  function actCtx(s, step) {
    const st = step.p;
    const sc = MS.get(st.id);
    return {
      kind: 'act',
      st,
      sc,
      who: scPatient(sc),
      eyebrow: 'Практикум · кафедра психиатрии',
      intro: '«Психический статус — это описание, а не впечатление, — Кандинский раздаёт карты. — Перепишите так, чтобы любой врач увидел пациента. И чтобы я не встретил там ни одного „неадекватен“».',
      quit: null,
      save: () => G.save(),
      finish() {},
      boss: { npc: 'kandinsky', text: (r) => (r.pct >= 90 ? '«Вот это статус. Хоть сейчас в учебник».' : r.pct >= MS.PASS ? '«Неплохо. Но посмотрите, что пропустили: в карте важна каждая строчка».' : '«Переписать. Сначала — что вы видите и слышите, потом — как это называется. Не наоборот».') },
      closeBtns: () => btn('Дальше', 'mse-close', null, 'primary wide'),
      close() {
        ACT.done({ kind: 'mse', id: st.id, pct: st.res.pct, traps: st.res.traps });
        return 'done';
      },
    };
  }

  function amCtx(s, step) {
    const p = step.p;
    const st = p.mse.st;
    const sc = MS.get(st.id);
    const pt = A.clinic.byUid(s, p.mse.uid);
    const H = UI.ward.h;
    const boss = A.clinic.bossNpc(s) || 'director';
    return {
      kind: 'am',
      st,
      sc,
      pt,
      who: pt ? { name: pt.name, age: pt.age, photo: H.portrait(pt) } : scPatient(sc),
      rel: pt && pt.rel,
      where: ({ pnd: 'ПНД', private: 'Частная клиника', uni: 'Клиника кафедры' }[A.clinic.place(s)] || 'Поликлиника') + ' · первичный приём',
      eyebrow: 'Первичный приём · психический статус',
      quit: 'Вернуться к приёму',
      save: () => G.save(),
      finish() {
        if (pt) A.clinic.mseDone(s, pt, st.res);
      },
      quitFn() {
        p.mse = null;
      },
      boss: { npc: boss, text: (r) => (r.pct >= MS.GOOD ? '«Статус записан толково — подпишу».' : r.pct >= MS.PASS ? '«Запись с огрехами — поправил, посмотрите разбор».' : '«Такой статус я подписать не могу — переписал за вас. Разберитесь, где ошиблись».') },
      closeBtns: () => btn('Вернуться к приёму', 'mse-close', null, 'primary wide'),
      close() {
        p.mse = null;
      },
    };
  }

  /* ---------- Экран ---------- */
  function patientBox(c) {
    const w = c.who;
    return '<div class="patient mse-pt"><div class="pt-photo">' + w.photo + '</div><div class="pt-info"><b class="pt-name">' + esc(w.name) + ', ' + years(w.age) + '</b><span class="small dim">' + esc(c.where || c.sc.where || '') + '</span></div></div>';
  }
  function material(c) {
    const st = c.st;
    const rel = c.rel || c.sc.rel || 'Родственник';
    const rows = c.sc.material.map((m) => {
      const label = m.k === 'say' ? (st.sex === 'f' ? 'Пациентка' : 'Пациент') : m.k === 'rel' ? rel : MAT[m.k] || '';
      return '<li class="mse-m mse-' + m.k + '"><span class="mse-mk">' + esc(label) + '</span><span class="mse-mt">' + fx(st, m.t) + '</span></li>';
    });
    // на первом разделе материал раскрыт, дальше — свёрнут, пока игрок сам его не раскроет (выбор запоминается)
    const open = UI.view.mseMat != null ? UI.view.mseMat : st.i === 0;
    return '<details class="mse-mat"' + (open ? ' open' : '') + '><summary>Что вы видите и слышите</summary><ul class="mse-mlist">' + rows.join('') + '</ul></details>';
  }
  function recordText(st, model, mark) {
    return MS.text(st, model)
      .map((ph) => ph.map((x) => (mark && x.k !== 'ok' ? '<mark class="mse-' + (x.k === 'trap' ? 'trap' : 'bad') + '">' + U.inline(esc(x.t)) + '</mark>' : U.inline(esc(x.t)))).join(' '))
      .filter(Boolean)
      .join(' ');
  }

  function sectionView(c) {
    const st = c.st;
    const secs = MS.sections();
    const n = secs.length;
    const S = secs[st.i];
    const sec = st.secs[st.i];
    const items = MS.items(st, st.i);
    const filled = st.secs.filter((x) => x.sel.length).length;
    let out =
      '<header class="act-head"><span class="eyebrow">' + esc(c.eyebrow) + '</span>' +
      '<div class="tr-progress"><span class="mono small">Раздел ' + (st.i + 1) + ' из ' + n + '</span><div class="mini-track"><div style="width:' + Math.round((st.i / n) * 100) + '%"></div></div></div></header>';
    out += patientBox(c);
    if (c.intro && st.i === 0) out += '<p class="mse-intro">' + U.inline(esc(c.intro)) + '</p>';
    out += material(c);
    out +=
      '<h2 class="step-h mse-sec">' + esc(S.name) + ' <span class="dim">— отметьте все верные формулировки</span></h2>' +
      '<p class="small dim mse-hint">' + esc(S.hint) + '</p><div class="opts">';
    out += sec.order
      .map((k) => {
        const o = items[k];
        if (!o) return '';
        return '<button type="button" class="opt" data-act="mse-tog" data-arg="' + k + '" aria-pressed="' + (sec.sel.indexOf(k) >= 0) + '"><span class="opt-box" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + fx(st, o.t) + '</span></span></button>';
      })
      .join('');
    out += '</div>';
    const rec = recordText(st, false, false);
    out += '<details class="talk-fold mse-rec"><summary>Запись в карте · заполнено разделов: ' + filled + ' из ' + n + '</summary>' + (rec ? '<article class="record"><p>' + rec + '</p></article>' : '<p class="small dim">Пока пусто.</p>') + '</details>';
    const last = MS.last(st);
    out +=
      '<div class="next-row mse-nav">' + (st.i > 0 ? btn('Назад', 'mse-prev', null, 'ghost') : '') +
      btn(last ? 'Готово — на проверку' : 'Дальше', last ? 'mse-done' : 'mse-next', null, 'primary wide', !sec.sel.length) + '</div>';
    if (!sec.sel.length) out += '<p class="small dim mse-need">Отметьте хотя бы одну формулировку.</p>';
    if (c.quit) out += '<div class="create-btns">' + btn(esc(c.quit), 'mse-quit', null, 'ghost') + '</div>';
    return out;
  }

  function resultView(c) {
    const st = c.st;
    const sc = c.sc;
    const r = MS.score(st);
    const secs = MS.sections();
    const label = r.pct >= 90 ? 'подписано' : r.pct >= MS.PASS ? 'с замечаниями' : 'переписать';
    let out =
      '<header class="act-head"><span class="eyebrow">' + esc(c.eyebrow) + '</span></header>' +
      '<section class="result-card"><div class="stamp' + (r.pct >= MS.PASS ? '' : ' bad') + '"><b>' + r.pct + '%</b><span>' + label + '</span></div>' +
      '<p class="mono small">' + esc(sc.title) + ' · точно описано разделов: ' + r.exact + ' из ' + secs.length + (r.traps ? ' · ярлыков в записи: ' + r.traps : ' · без ярлыков') + '</p></section>';
    if (c.boss) out += '<div class="fb mse-boss"><div class="fb-head">' + UI.npcPortrait(c.boss.npc, r.pct >= 90 ? 'smile' : r.pct >= MS.PASS ? 'neutral' : 'stern', 'mini') + '<div><p>' + esc(c.boss.text(r)) + '</p></div></div></div>';
    if (st.newAch && st.newAch.length && A.trainer) {
      const list = A.trainer.achList().filter((a) => st.newAch.indexOf(a.id) >= 0);
      out += '<section class="card tr-ach-new"><h2 class="h2">Новые достижения</h2><ul class="achs">' + list.map((a) => '<li class="ach got"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></li>').join('') + '</ul></section>';
    }
    out += '<h2 class="step-h">Ваша запись</h2><article class="record mse-mine"><span class="eyebrow">Психический статус</span><p>' + recordText(st, false, true) + '</p></article>';
    if (r.traps || r.per.some((x) => x.wrong.length)) out += '<p class="small dim">Выделено: <mark class="mse-bad">ошибка по содержанию</mark>, <mark class="mse-trap">ярлык или оценка вместо описания</mark>.</p>';
    out += '<section class="review"><h2 class="step-h">Разбор по разделам</h2><ul class="marks">';
    r.per.forEach((x, si) => {
      let li = '<li class="' + (x.mark === 'ok' ? 'm-ok' : x.mark === 'part' ? 'm-miss' : 'm-bad') + '"><b>' + esc(secs[si].name) + '</b> — ' + MARK[x.mark];
      x.wrong.forEach((o) => (li += '<span class="m-def"><b>' + (o.k === 'trap' ? 'Ярлык' : 'Неверно') + ':</b> «' + fx(st, o.t) + '» ' + fx(st, o.why) + '</span>'));
      x.missed.forEach((o) => (li += '<span class="m-def"><b>Пропущено:</b> ' + fx(st, o.t) + '</span>'));
      out += li + '</li>';
    });
    out += '</ul></section>';
    out += '<h2 class="step-h">Образец</h2><article class="record"><span class="eyebrow">Психический статус</span><p>' + recordText(st, true, false) + '</p></article>';
    if (sc.note) out += '<div class="pearl plain"><span class="eyebrow">Главное в этом статусе</span><p>' + U.inline(esc(sc.note)) + '</p></div>';
    out += memo();
    out += '<div class="next-row col">' + c.closeBtns() + '</div>';
    return out;
  }

  function memo() {
    return '<details class="card mse-memo"><summary class="h2">Как писать психический статус</summary><ul>' + (D.statusMemo || []).map((t) => '<li>' + U.inline(esc(t)) + '</li>').join('') + '</ul></details>';
  }

  /** Экран конструктора для контекста c (или текущего). */
  UI.mse = {
    cur,
    memo,
    view(c) {
      c = c || cur();
      if (!c || !c.sc) return '<p>Сценарий не найден.</p>';
      return c.st.done ? resultView(c) : sectionView(c);
    },
  };

  /* ---------- Шаг занятия «mse» (практикум на кафедре) ---------- */
  ACT.mse = function (s, step) {
    if (!step.p) {
      step.p = MS.init(step.id, { seed: U.hash(step.id + ':' + s.day + ':' + s.slot) });
      G.save();
    }
    if (!step.p) return '<p>Сценарий не найден.</p>' + btn('Дальше', 'step-next', null, 'primary wide');
    return UI.mse.view(actCtx(s, step));
  };

  /* ---------- Обработчики ---------- */
  UI.on('mse-tog', (k) => {
    const c = cur();
    if (!c || !MS.toggle(c.st, k)) return;
    c.save();
    UI.render();
  });
  UI.on('mse-next', () => {
    const c = cur();
    if (!c || c.st.done || !c.st.secs[c.st.i].sel.length) return;
    MS.go(c.st, 1);
    c.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('mse-prev', () => {
    const c = cur();
    if (!c || c.st.done) return;
    MS.go(c.st, -1);
    c.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('mse-done', () => {
    const c = cur();
    if (!c || c.st.done || !c.st.secs[c.st.i].sel.length) return;
    MS.finish(c.st);
    c.finish();
    c.save();
    UI.render({ scroll: 'top' });
    const got = c.st.newAch || [];
    if (got.length && A.trainer) UI.toast((got.length > 1 ? 'Новые достижения: ' : 'Новое достижение: ') + got.map(A.trainer.achName).join(', ') + '.');
  });
  UI.on('mse-close', () => {
    const c = cur();
    if (!c || !c.st.done) return;
    if (c.close() === 'done') return;
    c.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('mse-quit', () => {
    const c = cur();
    if (!c || !c.quitFn) return;
    const go = () => {
      c.quitFn();
      c.save();
      UI.render({ scroll: 'top' });
    };
    if (!c.st.done && c.st.secs.some((x) => x.sel.length)) UI.ask('Прервать запись статуса?', 'Отмеченные формулировки не сохранятся.', 'Прервать', go);
    else go();
  });
  // только тренажёр: тот же пациент заново (варианты перемешаются) или другой
  UI.on('mse-again', () => {
    const tv = UI.view.trainer;
    if (!tv || !tv.mse) return;
    tv.mse = MS.init(tv.mse.id);
    UI.render({ scroll: 'top' });
  });
  UI.on('mse-other', () => {
    const tv = UI.view.trainer;
    if (!tv || !tv.mse) return;
    const id = A.trainer.msePick(tv.lvl || 0, tv.mse.id);
    tv.mse = id ? MS.init(id) : null;
    UI.render({ scroll: 'top' });
  });
  // игрок сам раскрыл или свернул материал приёма — запоминаем до конца сеанса (клик по заголовку, до переключения)
  document.addEventListener('click', (e) => {
    const sum = e.target && e.target.closest ? e.target.closest('.mse-mat > summary') : null;
    if (sum) UI.view.mseMat = !sum.parentElement.open;
  });
})((window.A = window.A || {}));
