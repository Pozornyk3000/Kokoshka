/* Интерфейс: ядро, шапка, главный экран (карта дня), выбор действия, нижнее меню. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = A.game;

  const UI = (A.ui = {
    view: { screen: null, tab: 'hub', place: null, placeKey: null, picker: null, confirm: null, ref: 'notes', refItem: null, toast: null },
    handlers: {},
  });
  const val = (v, s) => (typeof v === 'function' ? v(s) : v);
  UI.val = val;
  UI.on = (name, fn) => (UI.handlers[name] = fn);

  /* ---------- Рендер ---------- */
  UI.render = function (opt) {
    opt = opt || {};
    const s = A.state;
    const app = document.getElementById('app');
    if (!app) return;
    let html;
    if (UI.view.screen === 'create') html = UI.screens.create();
    else if (UI.view.screen === 'mode') html = UI.screens.mode();
    else if (UI.view.screen === 'refs') html = UI.screens.refs();
    else if (UI.view.screen === 'trainer') html = UI.screens.trainer();
    else if (UI.view.screen === 'about') html = UI.screens.about();
    else if (!s) html = UI.screens.title();
    else if (s.activity) html = UI.act.render(s);
    else if (UI.view.tab === 'profile') html = UI.screens.profile(s);
    else if (UI.view.tab === 'ref') html = UI.screens.ref(s);
    else if (UI.view.tab === 'menu') html = UI.screens.menu(s);
    else html = UI.hub(s);
    app.innerHTML = html + UI.overlays(s);
    document.body.classList.toggle('big-text', !!A.store.prefs().bigText);
    if (opt.scroll === 'top') window.scrollTo(0, 0);
    else if (opt.scroll === 'last') {
      const el = app.querySelector('[data-last]');
      if (el) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    if (opt.focus) {
      const f = app.querySelector(opt.focus);
      if (f) f.focus();
    }
    UI.flushAchievements(s);
  };

  /* ---------- Делегирование кликов ---------- */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const h = UI.handlers[el.dataset.act];
    if (!h) return;
    e.preventDefault();
    h(el.dataset.arg, el, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (UI.view.picker || UI.view.confirm)) {
      UI.view.picker = null;
      UI.view.confirm = null;
      UI.render();
    }
  });

  /* ---------- Общие фрагменты ---------- */
  UI.icon = (n) => A.art.icon(n);

  UI.hud = function (s) {
    const maxE = G.maxEnergy(s);
    const bar = (label, v, max, cls, low) =>
      '<div class="bar ' + cls + (low ? ' low' : '') + '"><div class="bar-head"><span>' + label + '</span><b>' + Math.round(v) + '</b></div>' +
      '<div class="bar-track" role="meter" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + Math.round(v) + '"><div class="bar-fill" style="width:' + U.clamp((v / max) * 100, 0, 100) + '%"></div></div></div>';
    const badges = [];
    if (s.burnout.active) badges.push('<span class="badge alarm">выгорание</span>');
    if (G.isSick(s)) badges.push('<span class="badge">больничный</span>');
    if (s.phase === 'study' && s.study.debts.length) badges.push('<span class="badge warn">долгов: ' + s.study.debts.length + '</span>');
    return (
      '<header class="hud"><div class="wrap">' +
      '<div class="hud-top"><span class="hud-date">' + C.fmtShort(s.day) + '</span>' +
      '<span class="hud-slot">' + C.SLOTS[s.slot] + ' <span class="dim">' + C.SLOT_TIME[s.slot] + '</span></span>' +
      '<span class="hud-money' + (s.money < 0 ? ' neg' : '') + '">' + U.money(s.money) + '</span></div>' +
      '<div class="bars">' +
      bar('Энергия', s.energy, maxE, 'energy', s.energy < 25) +
      bar('Стресс', s.stress, 100, 'stress', s.stress > 75) +
      bar('Здоровье', s.health, 100, 'health', s.health < 35) +
      '</div>' +
      (badges.length ? '<div class="hud-badges">' + badges.join('') + '</div>' : '') +
      '</div></header>'
    );
  };

  UI.tabbar = function (active) {
    const t = (id, label, icon) =>
      '<button type="button" data-act="tab" data-arg="' + id + '"' + (active === id ? ' aria-current="page"' : '') + '>' + UI.icon(icon) + '<span>' + label + '</span></button>';
    const s = A.state;
    const profileLabel = s && s.phase === 'career' ? 'Карьера' : 'Зачётка';
    return '<nav class="tabbar" aria-label="Разделы"><div class="wrap">' + t('hub', 'День', 'map') + t('profile', profileLabel, 'card') + t('ref', 'Справочник', 'book') + t('menu', 'Меню', 'menu') + '</div></nav>';
  };

  UI.chip = (t, c) => '<span class="chip ' + (c || '') + '">' + t + '</span>';

  UI.deltaChips = function (d) {
    if (!d) return '';
    const out = [];
    const r = (x) => Math.round(x);
    if (r(d.money)) out.push(UI.chip(U.signedMoney(r(d.money)), d.money > 0 ? 'pos' : 'neg'));
    if (r(d.energy)) out.push(UI.chip(U.signed(d.energy) + ' энергии', d.energy > 0 ? 'pos' : 'neg'));
    if (r(d.stress)) out.push(UI.chip(U.signed(d.stress) + ' стресса', d.stress < 0 ? 'pos' : 'neg'));
    if (r(d.health)) out.push(UI.chip(U.signed(d.health) + ' здоровья', d.health > 0 ? 'pos' : 'neg'));
    if (Math.abs(d.rep) >= 0.5) out.push(UI.chip(U.signed(d.rep) + ' репутации', d.rep > 0 ? 'pos' : 'neg'));
    if (d.know >= 0.5) out.push(UI.chip('+' + d.know.toFixed(1).replace('.', ',') + ' знаний', 'pos'));
    if (d.xp >= 1) out.push(UI.chip('+' + r(d.xp) + ' опыта', 'pos'));
    return out.length ? '<div class="delta">' + out.join('') + '</div>' : '';
  };

  UI.sceneFig = function (id, s, tag, extra) {
    const opts = Object.assign({ slot: s ? s.slot : 1, season: s ? C.season(s.day) : 'autumn', seed: s ? s.day : 1 }, extra || {});
    return '<figure class="scene">' + A.art.scene(id, opts) + (tag ? '<figcaption class="scene-tag">' + U.esc(tag) + '</figcaption>' : '') + '</figure>';
  };

  UI.npcPortrait = function (id, emotion, cls) {
    const n = D.npc[id];
    if (!n) return '';
    return '<div class="npc ' + (cls || '') + '">' + A.art.portrait(n.look, emotion || 'neutral', { seed: U.hash(id) }) + '<div class="npc-cap"><b>' + U.esc(n.short) + '</b>' + (n.role ? '<span>' + U.esc(n.role) + '</span>' : '') + '</div></div>';
  };

  /* ---------- Главный экран ---------- */
  UI.defaultPlace = function (s) {
    const order = ['uni', 'work', 'gigs', 'home', 'city'];
    for (const p of order) {
      const pl = A.places[p];
      if (pl.phases && pl.phases.indexOf(s.phase) < 0) continue;
      const prim = A.actions.list.some((a) => a.place === p && a.primary && !G.status(s, a).hidden && !G.status(s, a).disabled && G.status(s, a).primary);
      if (prim) return p;
    }
    return 'home';
  };
  UI.places = function (s) {
    return Object.keys(A.places).filter((p) => {
      const pl = A.places[p];
      return !pl.phases || pl.phases.indexOf(s.phase) >= 0;
    });
  };

  UI.hub = function (s) {
    const key = s.day * 4 + s.slot;
    if (UI.view.placeKey !== key || !UI.view.place || UI.places(s).indexOf(UI.view.place) < 0) {
      UI.view.place = UI.defaultPlace(s);
      UI.view.placeKey = key;
    }
    const place = UI.view.place;
    const pl = A.places[place];
    const sceneId = val(pl.scene, s);
    const feed = s.feed.filter((e) => e.day === s.day);
    const latest = feed.length ? feed[feed.length - 1] : s.feed[s.feed.length - 1];
    const earlier = feed.slice(0, -1).reverse();

    const tabs = UI.places(s)
      .map((p) => '<button type="button" class="tab" role="tab" data-act="place" data-arg="' + p + '" aria-selected="' + (p === place) + '">' + A.places[p].name + '</button>')
      .join('');

    const acts = A.actions.list
      .filter((a) => a.place === place)
      .map((a) => ({ a, st: G.status(s, a) }))
      .filter((x) => !x.st.hidden);
    acts.sort((x, y) => rank(x) - rank(y));
    function rank(x) {
      if (x.st.disabled) return 3;
      if (x.st.primary) return 0;
      return x.a.free ? 2 : 1;
    }

    const rows = acts.map((x) => UI.actionRow(s, x.a, x.st)).join('');
    const dream = D.dreams[s.player.dream];
    const prog = dream ? dream.progress(s) : null;

    return (
      UI.hud(s) +
      '<main class="wrap hub">' +
      UI.sceneFig(sceneId, s, val(pl.tag, s)) +
      '<section class="story" aria-live="polite">' +
      (latest ? U.md(latest.text) : '') +
      UI.deltaChips(s.delta) +
      '</section>' +
      (earlier.length
        ? '<details class="earlier"><summary>Ранее сегодня · ' + earlier.length + '</summary>' + earlier.map((e) => '<div class="earlier-item"><span class="dim">' + C.SLOTS[e.slot] + '</span> ' + U.md(e.text) + '</div>').join('') + '</details>'
        : '') +
      '<div class="tabs" role="tablist" aria-label="Места">' +
      tabs +
      '</div>' +
      '<div class="folder" role="tabpanel">' +
      (rows || '<p class="empty">Здесь сейчас нечего делать.</p>') +
      '</div>' +
      (prog
        ? '<div class="dream-line"><span class="eyebrow">Мечта · ' + U.esc(dream.title) + '</span><div class="mini-track"><div style="width:' + U.clamp((prog.value / prog.max) * 100, 0, 100) + '%"></div></div><span class="dim">' + U.esc(prog.label) + '</span></div>'
        : '') +
      '</main>' +
      UI.tabbar('hub')
    );
  };

  UI.actionRow = function (s, a, st) {
    const title = val(a.title, s);
    const sub = val(a.sub, s);
    const chips = (val(a.chips, s) || []).map((c) => UI.chip(U.esc(U.t(c.t)), c.c));
    if (st.warn) chips.push(UI.chip(U.esc(U.t(st.warn)), 'warn'));
    if (st.disabled && st.reason) chips.unshift(UI.chip(U.esc(U.t(st.reason)), 'off'));
    const dur = G.dur(s, a);
    const when = a.free || dur === 0 ? 'сразу' : dur > 1 ? dur + ' части дня' : a.sleep ? 'до утра' : '';
    return (
      '<button type="button" class="act' +
      (st.primary && !st.disabled ? ' primary' : '') +
      (st.disabled ? ' off' : '') +
      '" data-act="do" data-arg="' +
      a.id +
      '"' +
      (st.disabled ? ' aria-disabled="true"' : '') +
      '>' +
      '<span class="act-box" aria-hidden="true"></span>' +
      '<span class="act-main"><span class="act-title">' +
      U.line(title) +
      '</span>' +
      (sub ? '<span class="act-sub">' + U.line(sub) + '</span>' : '') +
      (chips.length ? '<span class="act-chips">' + chips.join('') + '</span>' : '') +
      '</span>' +
      (when ? '<span class="act-when">' + when + '</span>' : '') +
      '</button>'
    );
  };

  /* ---------- Оверлеи: выбор варианта, подтверждение, тост ---------- */
  UI.overlays = function (s) {
    let out = '';
    const p = UI.view.picker;
    if (p && s) {
      const a = A.actions.byId[p];
      const opts = a && a.pick ? a.pick(s) : [];
      out +=
        '<div class="sheet-back" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' +
        U.esc(U.t(val(a.title, s))) +
        '"><div class="sheet-head"><b>' +
        U.line(val(a.title, s)) +
        '</b><button type="button" class="x" data-act="close-sheet" aria-label="Закрыть">' +
        UI.icon('x') +
        '</button></div><div class="sheet-list">' +
        opts
          .map(
            (o) =>
              '<button type="button" class="opt" data-act="pick" data-arg="' +
              U.esc(o.value) +
              '"' +
              (o.disabled ? ' aria-disabled="true"' : '') +
              '><span class="opt-main"><span class="opt-t">' +
              U.line(o.label) +
              '</span>' +
              (o.sub ? '<span class="opt-sub">' + U.line(o.sub) + '</span>' : '') +
              '</span></button>'
          )
          .join('') +
        '</div></div>';
    }
    const c = UI.view.confirm;
    if (c) {
      out +=
        '<div class="sheet-back" data-act="close-sheet"></div><div class="sheet confirm" role="alertdialog" aria-modal="true"><div class="sheet-head"><b>' +
        U.esc(c.title) +
        '</b></div><p>' +
        U.esc(c.text) +
        '</p><div class="row-btns"><button type="button" class="btn" data-act="close-sheet">Отмена</button><button type="button" class="btn danger" data-act="confirm-yes">' +
        U.esc(c.yes || 'Да') +
        '</button></div></div>';
    }
    if (UI.view.toast) out += '<div class="toast" role="status">' + UI.view.toast + '</div>';
    return out;
  };

  UI.toast = function (html, ms) {
    UI.view.toast = null;
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.innerHTML = html;
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(() => {
      const el = document.querySelector('.toast');
      if (el) el.remove();
    }, ms || 3200);
  };

  UI.flushAchievements = function (s) {
    if (!s || !s.flags.newAch || !s.flags.newAch.length) return;
    const ids = s.flags.newAch;
    s.flags.newAch = [];
    G.save();
    const names = ids.map((id) => U.esc(U.t(D.achievements[id].name))).join(', ');
    setTimeout(() => UI.toast('<b>Достижение:</b> ' + names, 3600), 30);
  };

  UI.ask = function (title, text, yes, fn) {
    UI.view.confirm = { title, text, yes, fn };
    UI.render();
  };

  /* ---------- Обработчики ---------- */
  UI.on('tab', (id) => {
    UI.view.tab = id;
    UI.view.refItem = null;
    UI.render({ scroll: 'top' });
  });
  UI.on('place', (id) => {
    UI.view.place = id;
    UI.view.placeKey = A.state.day * 4 + A.state.slot;
    UI.render();
  });
  UI.on('do', (id) => {
    const s = A.state;
    const a = A.actions.byId[id];
    if (!a) return;
    const st = G.status(s, a);
    if (st.disabled || st.hidden) return;
    if (a.pick) {
      UI.view.picker = id;
      UI.render();
      return;
    }
    const before = s.day * 4 + s.slot;
    G.perform(id);
    UI.afterAction(before);
  });
  UI.on('pick', (value) => {
    const id = UI.view.picker;
    UI.view.picker = null;
    const s = A.state;
    const before = s.day * 4 + s.slot;
    G.perform(id, value);
    UI.afterAction(before);
  });
  UI.on('close-sheet', () => {
    UI.view.picker = null;
    UI.view.confirm = null;
    UI.render();
  });
  UI.on('confirm-yes', () => {
    const c = UI.view.confirm;
    UI.view.confirm = null;
    if (c && c.fn) c.fn();
    else UI.render();
  });

  /** Системная кнопка «назад» (приложение для Android). true — обработано внутри игры,
      false — пусть приложение свернётся. Во время пары, приёма или экзамена назад не уходим. */
  UI.back = function () {
    const v = UI.view;
    if (v.confirm || v.picker) {
      v.confirm = null;
      v.picker = null;
      UI.render();
      return true;
    }
    if (v.screen === 'create') {
      v.screen = 'mode';
      UI.render({ scroll: 'top' });
      return true;
    }
    if (v.screen === 'refs' && v.refItem != null) {
      v.refItem = null;
      UI.render();
      return true;
    }
    if (v.screen === 'trainer') {
      if (v.trainer && (v.trainer.run || v.trainer.mse)) {
        v.trainer.run = null;
        v.trainer.mse = null;
        UI.render({ scroll: 'top' });
      } else UI.handlers['tr-exit']();
      return true;
    }
    if (v.screen === 'about' || v.screen === 'mode' || v.screen === 'refs') {
      v.screen = null;
      UI.render({ scroll: 'top' });
      return true;
    }
    const s = A.state;
    if (s && s.activity) {
      // в отделении «назад» закрывает лист назначения и возвращает из истории болезни к списку
      const step = s.activity.steps[s.activity.i];
      const ap = step && step.type === 'amb' ? step.p : null;
      if (ap && (ap.mse || ap.sheet || ap.summary || ap.open)) {
        if (ap.mse) ap.mse = null;
        else if (ap.sheet) ap.sheet = null;
        else if (ap.summary) {
          ap.summary = null;
          A.clinic.archiveDone(s);
        } else ap.open = null;
        G.save();
        UI.render({ scroll: 'top' });
        return true;
      }
      const p = step && step.type === 'ward' ? step.p : null;
      if (p && (p.sheet || p.summary || p.open)) {
        if (p.sheet) p.sheet = null;
        else if (p.summary) p.summary = null;
        else {
          const pt = A.ward.byUid(s, p.open);
          if (pt) pt.seen = pt.notes.length;
          p.open = null;
        }
        G.save();
        UI.render({ scroll: 'top' });
        return true;
      }
      return false;
    }
    if (!s) return false;
    if (v.tab === 'ref' && v.refItem != null) {
      v.refItem = null;
      UI.render();
      return true;
    }
    if (v.tab !== 'hub') {
      v.tab = 'hub';
      v.refItem = null;
      UI.render({ scroll: 'top' });
      return true;
    }
    return false;
  };

  UI.afterAction = function (beforeKey) {
    const s = A.state;
    const moved = s.day * 4 + s.slot !== beforeKey;
    UI.render({ scroll: s.activity || moved ? 'top' : null });
  };
})((window.A = window.A || {}));
