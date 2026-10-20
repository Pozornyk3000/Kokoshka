/* Сохранения: всегда в браузере (localStorage), а внутри Claude — ещё и в личном облачном хранилище игрока. */
(function (A) {
  'use strict';
  const KEYS = { save: 'anamnez.save.v1', checkpoint: 'anamnez.checkpoint.v1', prefs: 'anamnez.prefs.v1' };

  const S = (A.store = {
    KEYS,
    cloud: null, // { db, uid }
    cloudState: 'off', // off | connecting | on | error
    listeners: [],
  });

  S.readLocal = function (kind) {
    try {
      const raw = window.localStorage.getItem(KEYS[kind]);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  S.writeLocal = function (kind, obj) {
    try {
      window.localStorage.setItem(KEYS[kind], JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  };
  S.removeLocal = function (kind) {
    try {
      window.localStorage.removeItem(KEYS[kind]);
    } catch (e) {
      /* нет доступа к хранилищу — не страшно */
    }
  };

  /* ---------- Облако (capability db, личный раздел data/users/<id>/) ---------- */
  const pending = {};
  const inflight = {};
  const timers = {};

  S.onChange = function (fn) {
    S.listeners.push(fn);
  };
  function emit() {
    S.listeners.forEach((fn) => {
      try {
        fn(S.cloudState);
      } catch (e) {
        /* ignore */
      }
    });
  }

  S.initCloud = async function () {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return null;
    S.cloudState = 'connecting';
    emit();
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) throw new Error('no db');
      const uid = await user.id();
      if (!uid) throw new Error('no uid');
      S.cloud = { db, uid };
      S.cloudState = 'on';
      emit();
      return S.cloud;
    } catch (e) {
      S.cloud = null;
      S.cloudState = 'off';
      emit();
      return null;
    }
  };

  function ref(kind) {
    return S.cloud.db.doc('data/users/' + S.cloud.uid + '/' + kind);
  }

  S.readCloud = async function (kind) {
    if (!S.cloud) return null;
    try {
      const snap = await ref(kind).get();
      if (!snap.exists) return null;
      const body = snap.data();
      return body && body.json ? JSON.parse(body.json) : null;
    } catch (e) {
      return null;
    }
  };

  /** Отложенная запись: не чаще раза в несколько секунд, одна запись за раз на документ. */
  S.queueCloud = function (kind, obj, delay) {
    if (!S.cloud) return;
    pending[kind] = obj;
    clearTimeout(timers[kind]);
    timers[kind] = setTimeout(() => flush(kind), delay == null ? 2500 : delay);
  };

  async function flush(kind) {
    if (!S.cloud || inflight[kind]) return;
    inflight[kind] = true;
    while (pending[kind]) {
      const data = pending[kind];
      pending[kind] = null;
      const body = {
        json: JSON.stringify(data),
        savedAt: data.savedAt || Date.now(),
        day: data.day || 0,
        v: 1,
      };
      try {
        await ref(kind).set(body);
      } catch (e) {
        if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) {
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
          if (!pending[kind]) pending[kind] = data;
          if (e.code === 'resource_exhausted') break;
        } else {
          // нет прав на запись (например, просмотр по ссылке) — остаёмся на локальных сохранениях
          S.cloud = null;
          S.cloudState = 'error';
          emit();
          break;
        }
      }
    }
    inflight[kind] = false;
  }

  S.deleteCloud = async function (kind) {
    if (!S.cloud) return;
    try {
      await ref(kind).delete();
    } catch (e) {
      /* ignore */
    }
  };

  /* ---------- Высокоуровневые операции ---------- */
  S.save = function (state) {
    state.savedAt = Date.now();
    const ok = S.writeLocal('save', state);
    S.queueCloud('save', state);
    return ok;
  };
  S.checkpoint = function (state) {
    const copy = JSON.parse(JSON.stringify(state));
    copy.savedAt = Date.now();
    S.writeLocal('checkpoint', copy);
    S.queueCloud('checkpoint', copy, 4000);
  };
  S.wipe = function () {
    S.removeLocal('save');
    S.removeLocal('checkpoint');
    S.deleteCloud('save');
    S.deleteCloud('checkpoint');
  };
  /** Свежее из двух: локального и облачного. */
  S.newest = function (a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  };

  S.prefs = function () {
    return S.readLocal('prefs') || {};
  };
  S.setPref = function (k, v) {
    const p = S.prefs();
    p[k] = v;
    S.writeLocal('prefs', p);
  };

  /* Код сохранения для переноса между устройствами вручную. */
  S.exportCode = function (state) {
    const json = JSON.stringify(state);
    return 'ANM1.' + btoa(unescape(encodeURIComponent(json)));
  };
  S.importCode = function (code) {
    code = String(code || '').trim();
    if (!code.startsWith('ANM1.')) return null;
    try {
      const json = decodeURIComponent(escape(atob(code.slice(5))));
      const obj = JSON.parse(json);
      return obj && obj.player && obj.day ? obj : null;
    } catch (e) {
      return null;
    }
  };
})((window.A = window.A || {}));
