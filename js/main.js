/* Запуск игры: индексы данных, загрузка сохранения (браузер + облако Claude), восстановление после горячего обновления. */
(function (A) {
  'use strict';
  const G = A.game;
  const U = A.util;

  /* Заглушки на случай, если какой-то файл графики не загрузился */
  A.art = A.art || {};
  const ph = (w, h, label) => '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + label + '"><rect width="' + w + '" height="' + h + '" fill="#9cc3b2"/></svg>';
  A.art.scene = A.art.scene || ((id) => ph(400, 225, id));
  A.art.portrait = A.art.portrait || (() => ph(120, 140, 'Портрет'));
  A.art.randomLook = A.art.randomLook || ((seed, o) => Object.assign({ hair: 'short', clothes: 'sweater' }, o || {}));
  A.art.icon = A.art.icon || (() => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>');

  /** Дополнить старое сохранение полями новой версии. */
  A.migrate = function (st) {
    if (!st || !st.player) return st;
    const fresh = G.newState({ name: st.player.name, gender: st.player.gender, background: st.player.background, dream: st.player.dream });
    const fill = (dst, src) => {
      Object.keys(src).forEach((k) => {
        if (!(k in dst)) dst[k] = U.deepCopy(src[k]);
        else if (dst[k] && src[k] && typeof dst[k] === 'object' && typeof src[k] === 'object' && !Array.isArray(src[k])) fill(dst[k], src[k]);
      });
    };
    fill(st, fresh);
    // Активность со ссылкой на удалённый контент — сбрасываем, чтобы игра не зависла
    if (st.activity) {
      const ok = st.activity.steps.every((x) => {
        if (x.type === 'case') return !!A.data.caseById[x.id];
        if (x.type === 'lecture') return !!A.data.lectureById[x.id];
        if (x.type === 'event') return !!A.events.byId[x.id];
        return true;
      });
      if (!ok) st.activity = null;
    }
    return st;
  };

  A.boot = { save: null };

  function start(hot) {
    A.data.index();
    const local = A.store.readLocal('save');
    A.boot.save = local && local.player ? local : null;
    if (hot && hot.state && hot.state.player) {
      A.state = A.migrate(hot.state);
      if (hot.view) Object.assign(A.ui.view, hot.view);
    }
    A.ui.render();
    A.store.onChange(() => {
      if (!A.state) A.ui.render();
    });
    A.store.initCloud().then(async (cloud) => {
      if (!cloud) return;
      const remote = await A.store.readCloud('save');
      const best = A.store.newest(A.boot.save, remote && remote.player ? remote : null);
      if (best && best !== A.boot.save) {
        A.boot.save = best;
        A.store.writeLocal('save', best);
      }
      const lcp = A.store.readLocal('checkpoint');
      const rcp = await A.store.readCloud('checkpoint');
      const bcp = A.store.newest(lcp, rcp && rcp.player ? rcp : null);
      if (bcp && bcp !== lcp) A.store.writeLocal('checkpoint', bcp);
      if (!A.state) A.ui.render();
    });
  }

  window.addEventListener('pagehide', () => {
    if (A.state) A.store.writeLocal('save', A.state);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && A.state) A.store.writeLocal('save', A.state);
  });

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try {
      hot.snapshot(() => ({ state: A.state, view: { tab: A.ui.view.tab, ref: A.ui.view.ref } }));
    } catch (e) {
      /* необязательная возможность */
    }
  }
  function go() {
    if (hot && typeof hot.ready === 'function') {
      try {
        hot.ready(start);
        return;
      } catch (e) {
        /* запасной путь ниже */
      }
    }
    start((hot && hot.data) || {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})((window.A = window.A || {}));
