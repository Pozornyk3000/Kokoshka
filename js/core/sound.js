/* Фоновый эмбиент: генеративная музыка и шумы через Web Audio, без аудиофайлов.
   Настроение зависит от места, времени суток, погоды и стресса. Звук включается после первого
   касания (так требуют браузеры) и замолкает, когда вкладка или приложение уходят в фон. */
(function (A) {
  'use strict';
  const SND = (A.sound = { ok: false });
  const W = typeof window !== 'undefined' ? window : null;
  const AC = W && (W.AudioContext || W.webkitAudioContext);
  const hasDoc = typeof document !== 'undefined';

  let ctx = null;
  let N = null; // общие узлы
  let loop = null;
  let mood = null; // текущее настроение
  let moodKey = '';
  let chordI = 0;
  let prog = null;
  let paused = false;
  let forced = null; // настроение для проверки без игры
  const at = { chord: 0, bell: 0, tick: 0, drop: 0, purr: 0, gust: 0 };

  // Настройки читаются один раз: касаний много, а хранилище в приложении — файл
  let cfg = null;
  const conf = () => {
    if (cfg) return cfg;
    const p = (A.store && A.store.prefs()) || {};
    cfg = { on: p.ambient !== false, vol: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.6 };
    return cfg;
  };
  SND.enabled = () => conf().on;
  SND.volume = () => conf().vol;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const levelOf = (v) => 1.6 * v * v;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* Аккорды: бас и три верхних голоса (номера нот MIDI) */
  const PROG = {
    calm: [[38, 53, 57, 64], [40, 55, 59, 62], [41, 57, 60, 64], [43, 59, 62, 64]], // Dm9 Em7 Fmaj7 G6
    warm: [[41, 57, 60, 64], [45, 55, 60, 64], [38, 53, 57, 64], [36, 55, 59, 64]], // Fmaj7 Am7 Dm9 Cmaj7
    bright: [[36, 55, 59, 64], [40, 55, 59, 62], [41, 57, 59, 64], [43, 59, 62, 64]], // Cmaj7 Em7 Fmaj7#11 G6
    minor: [[45, 52, 59, 60], [41, 57, 60, 64], [38, 53, 57, 60], [40, 55, 59, 62]], // Am9 Fmaj7 Dm7 Em7
    tense: [[40, 55, 59, 66], [41, 57, 60, 64], [40, 50, 55, 59], [40, 53, 57, 62]], // Em9 Fmaj7 Em7 Dm/E
  };
  /* Настроения: прогрессия, яркость, длина аккорда (с), средний интервал «колокольчиков» (с) */
  const MOODS = {
    title: { prog: 'calm', cutoff: 1250, len: 11, bells: 6 },
    home: { prog: 'warm', cutoff: 1350, len: 10, bells: 7, purr: true },
    uni: { prog: 'bright', cutoff: 1700, len: 9, bells: 5.5 },
    clinic: { prog: 'minor', cutoff: 1050, len: 12, bells: 9 },
    street: { prog: 'warm', cutoff: 1500, len: 10, bells: 8, wind: true },
    exam: { prog: 'tense', cutoff: 850, len: 13, bells: 14, tick: true },
  };

  /* ---------- Какое сейчас настроение ---------- */
  const SCENE_MOOD = { dorm: 'home', home: 'home', room: 'home', studio: 'home', lecture: 'uni', seminar: 'uni', library: 'uni', exam: 'exam', commission: 'exam', ward: 'clinic', office: 'clinic', er: 'clinic', private: 'clinic', night: 'clinic', street: 'street', shop: 'street', cafe: 'street', park: 'street', title: 'title' };
  function placeOf(s) {
    const act = s.activity;
    const step = act ? act.steps[act.i] : null;
    if (step) {
      const t = step.type;
      if (t === 'exam') return 'exam';
      if (t === 'lecture' || t === 'seminar') return 'uni';
      if (t === 'ward' || t === 'mini') return 'clinic';
      if (t === 'case') return step.mode === 'exam' ? 'exam' : step.mode === 'seminar' ? 'uni' : 'clinic';
      if (t === 'jobs') return 'street';
      if (t === 'ending') return 'title';
      if (t === 'story' && A.stories) {
        const st = A.stories.get(step.story);
        const sc = st && (typeof st.scene === 'function' ? st.scene(s) : st.scene);
        if (sc && SCENE_MOOD[sc]) return SCENE_MOOD[sc];
      }
      return 'home';
    }
    const p = A.ui && A.ui.view && A.ui.view.place;
    if (p === 'uni') return s.phase === 'session' ? 'exam' : 'uni';
    if (p === 'work') return 'clinic';
    if (p === 'gigs') return s.slot === 3 ? 'clinic' : 'street';
    if (p === 'city') return 'street';
    return 'home';
  }
  function weather(s) {
    if (!A.cal || !A.util) return '';
    const season = A.cal.season(s.day);
    const h = A.util.hash('weather:' + s.day) % 6;
    if (season === 'winter') return h < 2 ? 'wind' : '';
    if (season === 'summer') return h === 0 ? 'rain' : '';
    return h < 2 ? 'rain' : h === 2 ? 'wind' : '';
  }
  function currentMood() {
    const s = A.state;
    if (!s) return { key: 'title', base: MOODS.title, night: false, rain: false, wind: false, tick: false };
    const key = placeOf(s);
    const base = MOODS[key] || MOODS.home;
    const w = weather(s);
    const night = s.slot === 3;
    return { key, base, night, rain: w === 'rain', wind: !!base.wind || w === 'wind', tick: !!base.tick || s.stress >= 75, purr: !!base.purr && key === 'home' };
  }
  const sig = (m) => [m.key, m.night, m.rain, m.wind, m.tick].join('|');

  /* ---------- Узлы ---------- */
  function noiseBuffer() {
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // розовый шум (фильтр Пола Келлета)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }
  function loopNoise(dest) {
    const src = ctx.createBufferSource();
    src.buffer = N.noise;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = N.noise.duration;
    src.connect(dest);
    src.start(ctx.currentTime, Math.random() * 2);
    return src;
  }
  function build() {
    const c = ctx;
    N = {};
    N.noise = noiseBuffer();
    N.out = c.createDynamicsCompressor();
    N.out.threshold.value = -14;
    N.out.ratio.value = 3;
    N.out.connect(c.destination);
    N.master = c.createGain();
    N.master.gain.value = 0;
    N.master.connect(N.out);
    // «пространство»: две линии задержки с обратной связью, слева и справа
    N.fx = c.createGain();
    N.fx.gain.value = 1;
    const wet = c.createGain();
    wet.gain.value = 0.55;
    wet.connect(N.master);
    [[0.43, -0.6, 0.42], [0.61, 0.6, 0.38]].forEach(([t, pan, fbk]) => {
      const d = c.createDelay(2);
      d.delayTime.value = t;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2300;
      const fb = c.createGain();
      fb.gain.value = fbk;
      N.fx.connect(d);
      d.connect(lp);
      lp.connect(fb);
      fb.connect(d);
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) {
        p.pan.value = pan;
        lp.connect(p);
        p.connect(wet);
      } else lp.connect(wet);
    });
    // пэд: общий фильтр с медленным «дыханием»
    N.padF = c.createBiquadFilter();
    N.padF.type = 'lowpass';
    N.padF.frequency.value = 1200;
    N.padF.Q.value = 0.6;
    N.pad = c.createGain();
    N.pad.gain.value = 0.9;
    N.padF.connect(N.pad);
    N.pad.connect(N.master);
    const sendPad = c.createGain();
    sendPad.gain.value = 0.35;
    N.pad.connect(sendPad);
    sendPad.connect(N.fx);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt);
    lfoAmt.connect(N.padF.frequency);
    lfo.start();
    // колокольчики
    N.bells = c.createGain();
    N.bells.gain.value = 0.55;
    N.bells.connect(N.master);
    const sendBells = c.createGain();
    sendBells.gain.value = 0.8;
    N.bells.connect(sendBells);
    sendBells.connect(N.fx);
    // дождь
    N.rainG = c.createGain();
    N.rainG.gain.value = 0;
    const rhp = c.createBiquadFilter();
    rhp.type = 'highpass';
    rhp.frequency.value = 500;
    const rlp = c.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 4200;
    loopNoise(rhp);
    rhp.connect(rlp);
    rlp.connect(N.rainG);
    N.rainG.connect(N.master);
    // ветер
    N.windG = c.createGain();
    N.windG.gain.value = 0;
    N.windF = c.createBiquadFilter();
    N.windF.type = 'bandpass';
    N.windF.frequency.value = 420;
    N.windF.Q.value = 0.8;
    loopNoise(N.windF);
    N.windF.connect(N.windG);
    N.windG.connect(N.master);
    // щелчки: часы и капли
    N.clicks = c.createGain();
    N.clicks.gain.value = 1;
    N.clicks.connect(N.master);
    // мурлыканье
    N.purr = c.createGain();
    N.purr.gain.value = 1;
    N.purr.connect(N.master);
  }

  /* ---------- Голоса ---------- */
  function padChord(notes, t0, len, level) {
    const c = ctx;
    const dur = len + 4.5;
    notes.forEach((m, i) => {
      const g = c.createGain();
      const lv = (i === 0 ? 0.55 : 1) * level;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(lv, t0 + 3.2);
      g.gain.setValueAtTime(lv, t0 + dur - 4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      g.connect(N.padF);
      const f = mtof(m);
      [['triangle', -7], ['sine', 6]].forEach(([type, det]) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det + rnd(-2, 2);
        o.connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      });
    });
  }
  function bell(m, t0, level) {
    const c = ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
    g.connect(N.bells);
    const f = mtof(m);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.76;
    const g2 = c.createGain();
    g2.gain.value = 0.22;
    o2.connect(g2);
    g2.connect(g);
    [o, o2].forEach((x) => {
      x.start(t0);
      x.stop(t0 + 4.1);
    });
  }
  function click(t0, freq, level, len) {
    const c = ctx;
    const src = c.createBufferSource();
    src.buffer = N.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(bp);
    bp.connect(g);
    g.connect(N.clicks);
    src.start(t0, Math.random() * 2, len + 0.02);
  }
  /** Кокошка мурлычет: шум, промодулированный 25 Гц, с ритмом вдоха и выдоха. */
  function purr(t0, dur) {
    const c = ctx;
    const src = c.createBufferSource();
    src.buffer = N.noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    lp.Q.value = 0.7;
    const am = c.createGain();
    am.gain.value = 0.5;
    const osc = c.createOscillator();
    osc.frequency.value = rnd(23, 27);
    const oscG = c.createGain();
    oscG.gain.value = 0.5;
    osc.connect(oscG);
    oscG.connect(am.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    let t = t0;
    while (t < t0 + dur - 1.6) {
      env.gain.linearRampToValueAtTime(0.48, t + 0.25);
      env.gain.linearRampToValueAtTime(0.18, t + 0.65);
      env.gain.linearRampToValueAtTime(0.72, t + 0.95);
      env.gain.linearRampToValueAtTime(0.09, t + 1.55);
      t += 1.6;
    }
    env.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    src.connect(lp);
    lp.connect(am);
    am.connect(env);
    env.connect(N.purr);
    src.start(t0, Math.random() * 2);
    osc.start(t0);
    src.stop(t + 0.5);
    osc.stop(t + 0.5);
  }

  /* ---------- Планировщик ---------- */
  function applyMood(m, first, t) {
    const b = m.base;
    const cutoff = b.cutoff * (m.night ? 0.68 : 1) * (m.tick && !b.tick ? 0.85 : 1);
    N.padF.frequency.setTargetAtTime(cutoff, t, first ? 0.1 : 2.5);
    N.pad.gain.setTargetAtTime(m.night ? 0.75 : 0.9, t, 2);
    N.rainG.gain.setTargetAtTime(m.rain ? 0.3 : 0, t, 2.5);
    N.windG.gain.setTargetAtTime(m.wind ? 0.3 : 0, t, 2.5);
    if (!prog || PROG[b.prog] !== prog) {
      prog = PROG[b.prog];
      chordI = Math.floor(Math.random() * prog.length);
    }
    mood = m;
  }
  function tick() {
    if (!ctx || paused || ctx.state !== 'running') return;
    try {
      step(ctx.currentTime);
    } catch (e) {
      SND.error = String((e && e.message) || e);
    }
  }
  /** Запланировать всё, что должно прозвучать в ближайшие 1,2 с после t. */
  function step(t) {
    const m = forced || currentMood();
    const k = sig(m);
    if (k !== moodKey) {
      const first = !moodKey;
      moodKey = k;
      applyMood(m, first, t);
      if (first) at.chord = t + 0.05;
    }
    const ahead = t + 1.2;
    const b = mood.base;
    while (at.chord < ahead) {
      const len = b.len * (mood.night ? 1.25 : 1);
      padChord(prog[chordI % prog.length], Math.max(at.chord, t), len, 0.05);
      chordI++;
      at.chord += len;
    }
    if (at.bell < t) at.bell = t + rnd(1, b.bells);
    while (at.bell < ahead) {
      const ch = prog[(chordI + prog.length - 1) % prog.length];
      const note = ch[1 + Math.floor(Math.random() * 3)] + (Math.random() < 0.6 ? 12 : 24);
      bell(note, at.bell, mood.night ? 0.2 : 0.28);
      at.bell += rnd(0.5, 1.5) * b.bells * (mood.night ? 1.6 : 1);
    }
    if (mood.tick) {
      if (at.tick < t) at.tick = Math.ceil(t);
      while (at.tick < ahead) {
        click(at.tick, Math.round(at.tick) % 2 ? 1500 : 1850, b.tick ? 1.2 : 0.5, 0.035);
        at.tick += 1;
      }
    }
    if (mood.rain) {
      if (at.drop < t) at.drop = t;
      while (at.drop < ahead) {
        click(at.drop, rnd(2200, 5200), rnd(0.1, 0.35), rnd(0.02, 0.05));
        at.drop += rnd(0.05, 0.4);
      }
    }
    if (mood.wind && at.gust < t) {
      N.windF.frequency.setTargetAtTime(rnd(260, 720), t, 1.8);
      N.windG.gain.setTargetAtTime(rnd(0.18, 0.45), t, 2.2);
      at.gust = t + rnd(2.5, 6);
    }
    if (mood.purr && at.purr < t) {
      // Кокошка рядом не всегда: эпизоды по 10–16 с, раз в полминуты-минуту
      if (at.purr) {
        const dur = rnd(10, 16);
        purr(t + 0.3, dur);
        at.purr = t + dur + rnd(25, 70);
      } else at.purr = t + rnd(4, 12);
    }
  }

  /* ---------- Управление ---------- */
  function setLevel(v, fade) {
    if (!N) return;
    const t = ctx.currentTime;
    N.master.gain.cancelScheduledValues(t);
    N.master.gain.setValueAtTime(N.master.gain.value, t);
    N.master.gain.linearRampToValueAtTime(levelOf(v), t + (fade == null ? 2.5 : fade));
  }
  function start() {
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC();
        build();
        SND.ok = true;
      }
      if (ctx.state !== 'running') {
        const r = ctx.resume();
        if (r && r.catch) r.catch(() => {});
      }
      paused = false;
      setLevel(SND.volume(), 3);
      if (!loop) loop = setInterval(tick, 400);
      tick();
      return true;
    } catch (e) {
      SND.ok = false;
      SND.error = String((e && e.message) || e);
      return false;
    }
  }
  function stop(fade) {
    if (!ctx) return;
    setLevel(0, fade == null ? 0.6 : fade);
    const c = ctx;
    setTimeout(() => {
      if ((paused || !SND.enabled()) && c.state === 'running') c.suspend().catch(() => {});
    }, 700);
  }

  /** Касание или клавиша: браузер разрешает звук только после действия игрока. */
  SND.unlock = function () {
    if (SND.enabled() && !paused) start();
  };
  SND.setEnabled = function (on) {
    conf().on = !!on;
    if (A.store) A.store.setPref('ambient', !!on);
    if (on) start();
    else stop();
  };
  SND.setVolume = function (v) {
    v = Math.max(0, Math.min(1, +v || 0));
    conf().vol = v;
    if (A.store) A.store.setPref('volume', v);
    if (ctx && SND.enabled() && !paused) setLevel(v, 0.3);
  };
  /** Приложение или вкладка в фоне — тишина; настройки не меняются. */
  SND.pause = function () {
    paused = true;
    if (ctx) stop(0.2);
  };
  SND.resume = function () {
    paused = false;
    if (ctx && SND.enabled()) start();
  };
  SND.status = function () {
    return { ok: SND.ok, enabled: SND.enabled(), volume: SND.volume(), state: ctx ? ctx.state : 'none', mood: mood ? mood.key : '', error: SND.error || '' };
  };

  /** Проверка без динамиков: несколько секунд эмбиента в OfflineAudioContext, в ответ — уровни.
      opt: { key: 'home'|'uni'|'clinic'|'street'|'exam'|'title', night, rain, wind, tick, purr, purrAt } */
  SND.renderTest = function (sec, opt) {
    const OAC = W && (W.OfflineAudioContext || W.webkitOfflineAudioContext);
    if (!OAC) return Promise.resolve(null);
    opt = opt || {};
    const keep = { ctx, N, mood, moodKey, prog, chordI, paused, at: Object.assign({}, at) };
    const sr = 22050;
    const restore = () => {
      ctx = keep.ctx;
      N = keep.N;
      mood = keep.mood;
      moodKey = keep.moodKey;
      prog = keep.prog;
      chordI = keep.chordI;
      paused = keep.paused;
      Object.assign(at, keep.at);
      forced = null;
    };
    try {
      paused = true; // живой планировщик не трогает офлайн-контекст
      ctx = new OAC(2, Math.ceil(sec * sr), sr);
      build();
      N.master.gain.value = levelOf(0.6);
      moodKey = '';
      mood = null;
      prog = null;
      Object.keys(at).forEach((k) => (at[k] = 0));
      const base = MOODS[opt.key] || MOODS.home;
      forced = { key: opt.key || 'home', base, night: !!opt.night, rain: !!opt.rain, wind: !!opt.wind || !!base.wind, tick: !!opt.tick || !!base.tick, purr: !!opt.purr };
      if (opt.purr) at.purr = 0.01;
      for (let t = 0; t < sec; t += 0.4) step(t);
      if (opt.solo) {
        const bus = { pad: N.pad, bells: N.bells, rain: N.rainG, wind: N.windG, clicks: N.clicks, purr: N.purr };
        Object.keys(bus).forEach((k) => {
          if (k !== opt.solo) {
            bus[k].gain.cancelScheduledValues(0);
            bus[k].gain.setValueAtTime(0, 0);
          }
        });
      }
      return ctx.startRendering().then(
        (buf) => {
          restore();
          let peak = 0;
          let sum = 0;
          let n = 0;
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < d.length; i++) {
              const v = Math.abs(d[i]);
              if (v > peak) peak = v;
              sum += d[i] * d[i];
              n++;
            }
          }
          return { peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(4), sec };
        },
        (e) => {
          restore();
          throw e;
        }
      );
    } catch (e) {
      restore();
      return Promise.reject(e);
    }
  };

  if (hasDoc && AC) {
    const onGesture = () => {
      if ((ctx && ctx.state === 'running') || paused || !SND.enabled()) return;
      SND.unlock();
    };
    // события, после которых браузер разрешает звук (для касаний — отпускание пальца)
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, onGesture, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') SND.pause();
      else SND.resume();
    });
  }
})((window.A = window.A || {}));
