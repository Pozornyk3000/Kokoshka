#!/usr/bin/env node
/* Автоигрок: проходит игру через интерфейс в headless Chromium и ловит ошибки.
   NODE_PATH=/opt/node22/lib/node_modules node tools/autoplay.cjs <page.html> [шагов=600] [--shots DIR] [--seed N] [--days N] [--dark] [--smart] [--mode full|doctor] [--job pnd|hospital|private|uni] [--difficulty easy|normal|hard]
   Внутри приложения Android (отладочная сборка на устройстве или эмуляторе, подключённом через adb):
   node tools/autoplay.cjs - 300 --android io.github.pozornyk3000.anamnez --smart
   К уже запущенному Chromium по DevTools: --cdp http://127.0.0.1:9222 */
const path = require('path');
const fs = require('fs');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('playwright-core');
}
const { chromium } = pw;

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const page_ = argv[0];
const maxSteps = +(argv[1] && !argv[1].startsWith('--') ? argv[1] : 600);
const shots = flag('--shots', null);
const seed = +flag('--seed', 1);
const maxDays = +flag('--days', 999);
const mode = flag('--mode', 'full');
if (shots) fs.mkdirSync(shots, { recursive: true });
// На устройстве печатаем ход игры по мере прохождения: если эмулятор упадёт, в журнале будет видно, где
const progress = argv.includes('--android') || argv.includes('--progress');
const t0 = Date.now();
const note = (msg) => progress && console.log(`[+${Math.round((Date.now() - t0) / 1000)} с] ${msg}`);

const androidPkg = flag('--android', null);
const cdp = flag('--cdp', null) || androidPkg;

(async () => {
  let browser;
  let page;
  let device = null;
  if (androidPkg) {
    // WebView приложения: подключение через adb (у Playwright для этого отдельный режим)
    const devices = await pw._android.devices({ omitDriverInstall: true });
    if (!devices.length) throw new Error('adb не видит ни одного устройства');
    device = devices[0];
    const webview = await device.webView(process.env.SOCK ? { socketName: process.env.SOCK } : { pkg: androidPkg }, { timeout: 60000 });
    page = await webview.page();
    console.log('Подключено к', device.model(), page.url());
  } else if (cdp) {
    browser = await chromium.connectOverCDP(cdp);
    const pages = browser.contexts().flatMap((c) => c.pages());
    page = pages.find((p) => /index\.html/.test(p.url())) || pages[0];
    if (!page) throw new Error('Нет страницы');
    console.log('Подключено к', page.url());
  } else {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: argv.includes('--dark') ? 'dark' : 'light' });
    page = await ctx.newPage();
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|fonts\.g|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
  });
  if (!cdp) {
    const url = /^(https?|file):/.test(page_) ? page_ : 'file://' + path.resolve(page_);
    await page.goto(url);
  }
  await page.waitForFunction(() => window.A && window.A.ui && document.querySelector('[data-act]'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.evaluate((sd) => {
    let x = sd >>> 0;
    Math.random = function () {
      x = (x + 0x6d2b79f5) >>> 0;
      let r = Math.imul(x ^ (x >>> 15), 1 | x);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    try { localStorage.clear(); } catch (e) {}
  }, seed);
  // На эмуляторе фоновая музыка — лишняя нагрузка: звук проверяется отдельным шагом
  if (androidPkg) await page.evaluate(() => window.A.sound && window.A.sound.setEnabled(false));

  const shot = async (name) => {
    if (!shots) return;
    note('снимок ' + name);
    await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: !cdp }).catch((e) => console.log('screenshot failed:', e.message));
  };
  const click = async (sel) => {
    for (let k = 0; k < 3; k++) {
      const el = await page.$(sel);
      if (!el) return false;
      try {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(15);
        return true;
      } catch (e) {
        await page.waitForTimeout(60);
      }
    }
    return false;
  };

  // Титул → новая игра
  await shot('00-title');
  await click('[data-act="new"]');
  await click('[data-act="confirm-yes"]');
  await shot('01-mode');
  await click('[data-act="mode-pick"][data-arg="' + mode + '"]');
  await shot('01-create');
  await click('[data-act="cr-bg"][data-arg="orderly"]');
  if (flag('--difficulty', null)) await click('[data-act="cr-diff"][data-arg="' + flag('--difficulty', null) + '"]');
  await click('[data-act="cr-start"]');

  const seenTypes = {};
  const shotTypes = {};
  let lastKey = '';
  let stuck = 0;
  for (let i = 0; i < maxSteps; i++) {
    const info = await page.evaluate(() => {
      const s = window.A.state;
      if (!s) return { none: true };
      const act = s.activity;
      const step = act ? act.steps[act.i] : null;
      const wardView = (p) => (p.summary ? 'summary' : p.sheet ? 'sheet' + (p.sheet.id ? '-drug' : '') : p.open ? 'chart-' + p.tab : 'list');
      return { day: s.day, slot: s.slot, money: s.money, energy: s.energy, stress: s.stress, health: s.health, phase: s.phase, type: step ? step.type : 'hub', stage: step && step.p ? step.p.stage || (step.type === 'ward' || step.type === 'amb' ? wardView(step.p) : '') : '', ended: s.ended };
    });
    if (info.none) {
      errors.push('state is null at step ' + i);
      break;
    }
    if (info.day > maxDays || info.ended) break;
    for (const k of ['money', 'energy', 'stress', 'health']) if (!Number.isFinite(info[k])) errors.push(`step ${i}: ${k} = ${info[k]}`);
    const key = JSON.stringify(info) + (await page.evaluate(() => document.getElementById('app').innerHTML.length));
    if (key === lastKey) stuck++;
    else stuck = 0;
    lastKey = key;
    if (stuck > 8) {
      errors.push('stuck at ' + JSON.stringify(info));
      await shot('stuck-' + i);
      break;
    }
    seenTypes[info.type] = (seenTypes[info.type] || 0) + 1;
    if (i % 20 === 0) note(`шаг ${i}: день ${info.day}, слот ${info.slot}, ${info.type}${info.stage ? '/' + info.stage : ''}`);
    const tkey = info.type + (info.stage ? '-' + info.stage : '');
    if (!shotTypes[tkey]) {
      shotTypes[tkey] = true;
      await shot(String(Object.keys(shotTypes).length + 1).padStart(2, '0') + '-' + tkey);
    }
    if (await click('[data-act="confirm-yes"]')) continue;
    if (await page.$('.sheet [data-act="pick"]')) {
      const picks = await page.$$('.sheet [data-act="pick"]:not([aria-disabled="true"])');
      if (picks.length) await picks[Math.floor(Math.random() * picks.length)].click().catch(() => {});
      else await click('[data-act="close-sheet"]');
      continue;
    }
    if (info.type === 'hub') {
      const choice = await page.evaluate(() => {
        const A = window.A;
        const s = A.state;
        const G = A.game;
        const ok = A.actions.list.filter((a) => {
          const st = G.status(s, a);
          return !st.hidden && !st.disabled;
        });
        const prim = ok.filter((a) => G.status(s, a).primary);
        const r = Math.random();
        let pick = null;
        if (prim.length && r < 0.92) pick = prim[0];
        else if (s.slot === 3) pick = ok.find((a) => a.id === (r < 0.75 ? 'sleep' : r < 0.85 ? 'gig_nurse' : 'gig_night')) || ok.find((a) => a.id === 'sleep');
        if (!pick) {
          const timed = ok.filter((a) => !a.free && a.id !== 'cram');
          const free = ok.filter((a) => a.free && ['pet', 'coffee', 'call_mom', 'shop', 'food_plan'].indexOf(a.id) >= 0);
          if (free.length && Math.random() < 0.25) pick = free[Math.floor(Math.random() * free.length)];
          else if (timed.length) pick = timed[Math.floor(Math.random() * timed.length)];
          else pick = ok[0];
        }
        return pick ? { id: pick.id, place: pick.place } : null;
      });
      if (!choice) {
        errors.push('no available action at ' + JSON.stringify(info));
        break;
      }
      await click(`[data-act="place"][data-arg="${choice.place}"]`);
      if (!(await click(`[data-act="do"][data-arg="${choice.id}"]`))) errors.push('cannot click action ' + choice.id + ' in ' + choice.place);
      continue;
    }
    // Конструктор психического статуса (практикум на кафедре, первичный приём): «умный» режим отмечает верные формулировки
    const ms = await page.evaluate((smart) => {
      const A = window.A;
      const c = A.ui.mse && A.ui.mse.cur();
      if (!c) return null;
      const cl = (sel) => {
        const b = Array.from(document.querySelectorAll(sel)).find((x) => x.getAttribute('aria-disabled') !== 'true');
        if (b) {
          b.click();
          return true;
        }
        return false;
      };
      if (c.st.done) return cl('[data-act="mse-close"]') ? 'mse-close' : null;
      if (!smart && Math.random() < 0.03 && cl('[data-act="mse-quit"]')) return 'mse-quit';
      if (!c.st.secs[c.st.i].sel.length) {
        const items = A.mse.items(c.st, c.st.i);
        let ks = items.map((o, k) => k).filter((k) => Math.random() < (smart ? (items[k].k === 'ok' ? 0.9 : 0.1) : 0.45));
        if (!ks.length) ks = [Math.floor(Math.random() * items.length)];
        ks.forEach((k) => cl('[data-act="mse-tog"][data-arg="' + k + '"]'));
        return 'mse-tog';
      }
      if (!c.st.secs[c.st.i].checked) return cl('[data-act="mse-check"]') ? 'mse-check' : null;
      if (c.st.i > 0 && Math.random() < 0.04 && cl('[data-act="mse-prev"]')) return 'mse-prev';
      return cl('[data-act="mse-next"]') || cl('[data-act="mse-done"]') ? 'mse-next' : null;
    }, argv.includes('--smart'));
    if (ms) {
      seenTypes['mse:' + ms] = (seenTypes['mse:' + ms] || 0) + 1;
      continue;
    }
    // Отделение: обойти пациентов, решить срочное, назначить лечение, выписать готовых
    if (info.type === 'ward') {
      const smart = argv.includes('--smart');
      const wa = await page.evaluate((smart) => {
        const A = window.A;
        const s = A.state;
        const step = s.activity.steps[s.activity.i];
        const p = step.p;
        if (!p) return null;
        const cl = (sel) => {
          const b = Array.from(document.querySelectorAll(sel)).find((x) => x.getAttribute('aria-disabled') !== 'true');
          if (b) {
            b.click();
            return true;
          }
          return false;
        };
        const W = A.ward;
        const P = A.pharma;
        window.__wd = window.__wd && window.__wd.day === s.day ? window.__wd : { day: s.day, seen: {}, acts: {} };
        if (p.summary) return cl('[data-act="wd-sum-close"]') ? 'wd-sum-close' : null;
        if (p.sheet) {
          if (p.sheet.id) return cl('[data-act="wd-sok"]') ? 'wd-sok' : cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
          if (p.sheet.group === 'int') return cl('[data-act="wd-sint"]') ? 'wd-sint' : cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
          const pt = W.byUid(s, p.open);
          let pickId = null;
          if (smart && pt) {
            const g = P.gl(pt);
            const ph = g && g.phases && (g.phases[P.phase(pt)] || g.phases.acute);
            const first = ((ph && ph.first) || []).map((e) => (typeof e === 'string' ? { id: e } : e));
            const cands = A.data.drugs.filter((d) => d.group === p.sheet.group && first.some((e) => (e.id ? e.id === d.id : e.cls ? e.cls === d.cls : e.group === d.group)));
            if (cands.length) pickId = cands[Math.floor(Math.random() * cands.length)].id;
          }
          if (pickId) return cl('[data-act="wd-sdrug"][data-arg="' + pickId + '"]') ? 'wd-sdrug-smart' : null;
          const opts = Array.from(document.querySelectorAll('[data-act="wd-sdrug"]'));
          if (opts.length) {
            opts[Math.floor(Math.random() * opts.length)].click();
            return 'wd-sdrug';
          }
          return cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
        }
        if (p.open) {
          const pt = W.byUid(s, p.open);
          const key = p.open;
          const did = (window.__wd.acts[key] = window.__wd.acts[key] || {});
          if (!pt) return cl('[data-act="wd-back"]') ? 'wd-back' : null;
          if (pt.pending) {
            const ev = W.EVENTS[pt.pending.k];
            const best = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
            const i = smart && Math.random() < 0.85 ? best : Math.floor(Math.random() * ev.opts.length);
            return cl('[data-act="wd-decide"][data-arg="' + i + '"]') ? 'wd-decide' : null;
          }
          if (!did.tabs) {
            did.tabs = 1;
            const t = ['tests', 'info', 'rx'][Math.floor(Math.random() * 3)];
            return cl('[data-act="wd-tab"][data-arg="' + t + '"]') ? 'wd-tab' : null;
          }
          const due = P.dueTests(s, pt);
          if (due.length && !did.order && Math.random() < (smart ? 0.9 : 0.5)) {
            did.order = 1;
            if (p.tab !== 'tests' && p.tab !== 'today') return cl('[data-act="wd-tab"][data-arg="tests"]') ? 'wd-tab' : null;
            return cl('[data-act="wd-order"][data-arg="' + due[0].test + '"]') ? 'wd-order' : null;
          }
          const drugs = pt.rx.filter((r) => r.kind !== 'int' && !r.home);
          if (!drugs.length && !did.add) {
            did.add = 1;
            if (p.tab !== 'rx') {
              did.add = 0;
              return cl('[data-act="wd-tab"][data-arg="rx"]') ? 'wd-tab' : null;
            }
            return cl('[data-act="wd-add"][data-arg="drug"]') ? 'wd-add' : null;
          }
          if (drugs.length && !did.titr && p.tab === 'rx' && Math.random() < 0.4) {
            did.titr = 1;
            const r = drugs[0];
            const d = P.drug(r.id);
            const rg = P.range(d, r.route, pt);
            if (rg && r.dose < rg.min) {
              const i = pt.rx.indexOf(r);
              return cl('[data-act="wd-up"][data-arg="' + i + '"]') ? 'wd-up' : null;
            }
          }
          const can = W.canDischarge(s, pt);
          if (can.ok && pt.sev <= P.group(pt).discharge && !did.dis) {
            did.dis = 1;
            return cl('[data-act="wd-discharge"]') ? 'wd-discharge' : null;
          }
          window.__wd.seen[key] = 1;
          return cl('[data-act="wd-back"]') ? 'wd-back' : null;
        }
        const next = W.active(s).find((x) => x.mode === p.mode && !window.__wd.seen[x.uid]);
        if (next) return cl('[data-act="wd-open"][data-arg="' + next.uid + '"]') ? 'wd-open' : null;
        return cl('[data-act="wd-done"]') ? 'wd-done' : null;
      }, smart);
      if (wa) continue;
    }
    // Амбулаторный приём: звонки, визиты (диагноз, беседа, назначения, время приёма, анализы), следующий визит
    if (info.type === 'amb') {
      const smart = argv.includes('--smart');
      const aa = await page.evaluate((smart) => {
        const A = window.A;
        const s = A.state;
        const step = s.activity.steps[s.activity.i];
        const p = step.p;
        if (!p) return null;
        const cl = (sel) => {
          const b = Array.from(document.querySelectorAll(sel)).find((x) => x.getAttribute('aria-disabled') !== 'true');
          if (b) {
            b.click();
            return true;
          }
          return false;
        };
        const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const M = A.clinic;
        const P = A.pharma;
        window.__am = window.__am && window.__am.day === s.day ? window.__am : { day: s.day, acts: {}, skip: {} };
        if (p.summary) return cl('[data-act="am-sum-close"]') ? 'am-sum-close' : null;
        if (p.sheet) {
          if (p.sheet.id) {
            if (Math.random() < 0.3 && cl('[data-act="wd-stime"]')) return 'wd-stime';
            return cl('[data-act="wd-sok"]') ? 'wd-sok' : cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
          }
          if (p.sheet.group === 'int') return cl('[data-act="wd-sint"]') ? 'wd-sint' : cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
          const pt = M.byUid(s, p.open);
          let pickId = null;
          if (smart && pt) {
            const g = P.gl(pt);
            const ph = g && g.phases && (g.phases[P.phase(pt)] || g.phases.acute);
            const first = ((ph && ph.first) || []).map((e) => (typeof e === 'string' ? { id: e } : e));
            const cands = A.data.drugs.filter((d) => d.group === p.sheet.group && first.some((e) => (e.id ? e.id === d.id : e.cls ? e.cls === d.cls : e.group === d.group)));
            if (cands.length) pickId = rnd(cands).id;
          }
          if (pickId) return cl('[data-act="wd-sdrug"][data-arg="' + pickId + '"]') ? 'wd-sdrug-smart' : null;
          const opts = Array.from(document.querySelectorAll('[data-act="wd-sdrug"]'));
          if (opts.length) {
            rnd(opts).click();
            return 'wd-sdrug';
          }
          return cl('[data-act="wd-sclose"]') ? 'wd-sclose' : null;
        }
        if (p.open) {
          const pt = M.byUid(s, p.open);
          if (!pt) return cl('[data-act="am-back"]') ? 'am-back' : null;
          const did = (window.__am.acts[p.open] = window.__am.acts[p.open] || {});
          if (pt.pending) {
            const ev = M.EVENTS[pt.pending.k];
            const best = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
            const i = smart && Math.random() < 0.85 ? best : Math.floor(Math.random() * ev.opts.length);
            return cl('[data-act="am-decide"][data-arg="' + i + '"]') ? 'am-decide' : null;
          }
          const live = pt.vis && pt.vis.day === s.day && p.done[pt.uid] == null;
          if (!live) {
            window.__am.skip[pt.uid] = 1;
            return cl('[data-act="am-back"]') ? 'am-back' : null;
          }
          // психический статус на первичном приёме: записать самому или открыть готовую запись
          if (!did.mse && document.querySelector('[data-act="am-mse"]')) {
            did.mse = 1;
            return cl(Math.random() < 0.6 ? '[data-act="am-mse"]' : '[data-act="am-mse-skip"]') ? 'am-mse' : null;
          }
          if (document.querySelector('[data-act="am-dx-key"]')) {
            // сложная игра: диагноз из полного списка МКБ-10
            if (!A.ui.view.amDxKey) {
              const okO = M.tpl(pt).dxq.opts.find((o) => o.ok === true);
              if (smart && Math.random() < 0.85) {
                A.ui.view.amDxKey = A.icd.entryFor(okO.t).k;
                A.ui.render();
                return 'am-icd-smart';
              }
              if (cl('[data-act="am-icd"]:nth-of-type(' + (1 + Math.floor(Math.random() * 3)) + ')') || cl('[data-act="am-icd"]')) return 'am-icd';
              return cl('[data-act="icd-block"][data-arg="' + rnd(['F2', 'F3', 'F4', 'F1', 'F0']) + '"]') ? 'icd-block' : null;
            }
            return cl('[data-act="am-dx-key"]') ? 'am-dx-key' : null;
          }
          if (document.querySelector('[data-act="am-dx"]')) {
            const t = M.tpl(pt);
            const ok = t.dxq.opts.findIndex((o) => o.ok === true);
            const i = smart && Math.random() < 0.85 ? ok : Math.floor(Math.random() * t.dxq.opts.length);
            return cl('[data-act="am-dx"][data-arg="' + i + '"]') ? 'am-dx' : null;
          }
          if (!did.tabs) {
            did.tabs = 1;
            return cl('[data-act="am-tab"][data-arg="' + rnd(['card', 'info', 'tests', 'rx']) + '"]') ? 'am-tab' : null;
          }
          if (p.tab !== 'visit' && !did.back) {
            did.back = 1;
            if (p.tab === 'rx' && Math.random() < 0.5 && cl('[data-act="wd-time"]')) return 'wd-time';
            return cl('[data-act="am-tab"][data-arg="visit"]') ? 'am-tab' : null;
          }
          if (!did.talk) {
            did.talk = 1;
            const t = Array.from(document.querySelectorAll('[data-act="am-talk"]')).filter((b) => b.getAttribute('aria-disabled') !== 'true');
            if (t.length) {
              rnd(t).click();
              return 'am-talk';
            }
          }
          const due = P.dueTests(s, pt).filter((x) => !pt.tests.some((r) => r.test === x.test && r.day === s.day));
          if (due.length && !did.order && Math.random() < (smart ? 0.9 : 0.5)) {
            if (!document.querySelector('[data-act="wd-order"][data-arg="' + due[0].test + '"]')) return cl('[data-act="am-tab"][data-arg="visit"]') ? 'am-tab' : null;
            did.order = 1;
            return cl('[data-act="wd-order"][data-arg="' + due[0].test + '"]') ? 'wd-order' : null;
          }
          const own = pt.rx.filter((r) => r.kind !== 'int' && !r.home && !r.pre);
          if (!own.length && !did.add && pt.sev >= 25) {
            did.add = 1;
            return cl('[data-act="am-rx"][data-arg="drug"]') || cl('[data-act="wd-add"][data-arg="drug"]') ? 'am-rx' : null;
          }
          if (!did.next) {
            did.next = 1;
            const n = smart ? (pt.sev >= 55 ? 3 : pt.sev >= 30 ? 7 : 14) : rnd(M.INTERVALS);
            return cl('[data-act="am-next"][data-arg="' + n + '"]') ? 'am-next' : null;
          }
          if (M.canClose(s, pt).ok && !did.close) {
            did.close = 1;
            return cl('[data-act="am-close"]') ? 'am-close' : null;
          }
          if (cl('[data-act="am-end"]')) return 'am-end';
          if (p.tab !== 'visit' && cl('[data-act="am-tab"][data-arg="visit"]')) return 'am-tab';
          return cl('[data-act="am-back"]') ? 'am-back' : null;
        }
        const call = M.active(s).find((x) => x.pending);
        if (call) return cl('[data-act="am-open"][data-arg="' + call.uid + '"]') ? 'am-open' : null;
        const next = p.list.find((u) => {
          const x = M.byUid(s, u);
          return x && !x.done && !x.away && p.done[u] == null && !window.__am.skip[u];
        });
        if (next) return cl('[data-act="am-open"][data-arg="' + next + '"]') ? 'am-open' : null;
        if (Math.random() < 0.15 && cl('[data-act="am-file"]')) return 'am-file';
        return cl('[data-act="am-done"]') ? 'am-done' : null;
      }, smart);
      if (aa) continue;
    }
    // Активности: «умный» режим — знает верные ответы и выбирает их с вероятностью 85%
    if (argv.includes('--smart')) {
      const sm = await page.evaluate(() => {
        const A = window.A;
        const ok = () => Math.random() < 0.85;
        const cl = (sel) => {
          const b = document.querySelector(sel);
          if (b && b.getAttribute('aria-disabled') !== 'true') {
            b.click();
            return true;
          }
          return false;
        };
        const s = A.state;
        const step = s.activity && s.activity.steps[s.activity.i];
        if (!step) return null;
        const x = A.ui.act.cur && A.ui.act.cur();
        if (x && x.p && x.p.stage) {
          const c = x.c;
          const p = x.p;
          if (p.stage === 'status' && !p._done) {
            c.status.opts.forEach((o, i) => {
              if (o.ok && ok() && p.sel.status.indexOf(i) < 0) p.sel.status.push(i);
            });
            p._done = true;
            return cl('[data-act="cs-submit"]') ? 'smart-status' : null;
          }
          if (p.stage === 'dx') {
            p.sel.syn = ok() ? c.syndrome.opts.findIndex((o) => o.ok) : 0;
            p.sel.dx = ok() ? c.dx.opts.findIndex((o) => o.ok) : 0;
            // сложная игра: тот же выбор, но ключом каталога МКБ-10
            if (p.hard) p.sel.dxKey = A.icd.entryFor(c.dx.opts[p.sel.dx].t).k;
            A.ui.render();
            return cl('[data-act="cs-submit"]') ? 'smart-dx' : null;
          }
          if (p.stage === 'tx' && !p.sel.tx.length) {
            c.tx.opts.forEach((o, i) => {
              if (o.ok && ok()) p.sel.tx.push(i);
            });
            if (!p.sel.tx.length) p.sel.tx.push(c.tx.opts.findIndex((o) => o.ok));
            A.ui.render();
            return cl('[data-act="cs-submit"]') ? 'smart-tx' : null;
          }
          if (p.stage === 'talk') {
            const left = p.maxQ - p.asked.length;
            // лёгкая игра: вопросов без ограничений — «умный» игрок останавливается на обычных пяти
            if (left > 0 && !(p.free && p.asked.length >= (c.maxQ || 5))) {
              const order = c.q.map((q, i) => ({ i, v: (q.crit ? 10 : 0) + q.v })).filter((o) => p.asked.indexOf(o.i) < 0 && c.q[o.i].v >= 0).sort((a, b) => b.v - a.v);
              if (order.length) return cl('[data-act="cs-ask"][data-arg="' + order[0].i + '"]') ? 'smart-ask' : null;
            }
          }
        }
        if (step.type === 'lecture' && step.p && step.p.stage === 'quiz' && step.p.ans[step.p.q] == null) {
          const L = A.data.lectureById[step.id];
          const k = ok() ? L.quiz[step.p.q].ok : 0;
          return cl('[data-act="lec-pick"][data-arg="' + k + '"]') ? 'smart-quiz' : null;
        }
        if (step.type === 'exam' && step.p && step.p.stage === 'test') {
          const q = A.exams.testQuestion(step.p.test[step.p.tq]);
          return cl('[data-act="ex-test"][data-arg="' + (ok() ? q.ok : 0) + '"]') ? 'smart-test' : null;
        }
        if (step.type === 'mini' && step.p && step.p.pick == null) {
          const m = A.minis.get(step, step.p.i);
          const k = ok() ? m.options.findIndex((o) => o.ok) : 0;
          return cl('[data-act="mini-pick"][data-arg="' + k + '"]') ? 'smart-mini' : null;
        }
        return null;
      });
      if (sm) continue;
    }
    // Выбор работы: --job pnd|hospital|private|uni (если доступна)
    if (flag('--job', null) && (await click('[data-act="job-pick"][data-arg="' + flag('--job', null) + '"]'))) continue;
    // Активности: кликаем по смыслу
    const acted = await page.evaluate(() => {
      const q = (sel) => Array.from(document.querySelectorAll(sel)).filter((b) => b.getAttribute('aria-disabled') !== 'true');
      const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const order = ['ev-choice', 'lec-pick', 'lec-qnext', 'lec-next', 'lec-quiz', 'lec-done', 'mini-pick', 'mini-next', 'ex-start', 'ex-test', 'ex-done', 'job-pick', 'cs-finish'];
      const asks = q('[data-act="cs-ask"]');
      if (asks.length && Math.random() < 0.85) {
        rnd(asks).click();
        return 'ask';
      }
      const toggles = q('[data-act="cs-toggle"]');
      if (toggles.length) {
        const pressed = toggles.filter((b) => b.getAttribute('aria-pressed') === 'true');
        if (pressed.length < 3) {
          rnd(toggles.filter((b) => b.getAttribute('aria-pressed') !== 'true')).click();
          return 'toggle';
        }
      }
      const radios = q('[data-act="cs-radio"]');
      if (radios.length) {
        const groups = {};
        radios.forEach((b) => (groups[b.dataset.arg.split(':')[0]] = groups[b.dataset.arg.split(':')[0]] || []).push(b));
        for (const g in groups) {
          if (!groups[g].some((b) => b.getAttribute('aria-pressed') === 'true')) {
            rnd(groups[g]).click();
            return 'radio';
          }
        }
      }
      // сложная игра: диагноз из полного списка — открыть раздел и выбрать рубрику
      if (document.getElementById('icd-q') && !document.querySelector('.icd-sel')) {
        const items = q('[data-act="cs-icd"]');
        if (items.length) {
          rnd(items.slice(0, 8)).click();
          return 'icd-pick';
        }
        const blocks = q('[data-act="icd-block"]');
        if (blocks.length) {
          rnd(blocks).click();
          return 'icd-block';
        }
      }
      const sub = q('[data-act="cs-submit"]');
      if (sub.length) {
        sub[0].click();
        return 'submit';
      }
      const nx = q('[data-act="cs-next"]');
      if (nx.length) {
        nx[0].click();
        return 'next';
      }
      for (const a of order) {
        const b = q('[data-act="' + a + '"]');
        if (b.length) {
          rnd(b).click();
          return a;
        }
      }
      const buy = q('[data-act="buy"]');
      if (buy.length && Math.random() < 0.3) {
        rnd(buy).click();
        return 'buy';
      }
      const st = q('[data-act="step-next"]');
      if (st.length) {
        st[0].click();
        return 'step-next';
      }
      const end = q('[data-act="end-cp"]');
      if (end.length) {
        end[0].click();
        return 'end-cp';
      }
      return null;
    });
    await page.waitForTimeout(10);
    if (!acted) {
      errors.push('no button in activity ' + JSON.stringify(info));
      await shot('nobutton-' + i);
      break;
    }
  }
  const fin = await page.evaluate(() => {
    const s = window.A.state;
    return s ? { day: s.day, phase: s.phase, money: Math.round(s.money), rep: Math.round(s.rep), xp: s.xp, stress: Math.round(s.stress), health: Math.round(s.health), cases: s.stats.cases, exams: s.study.exams, job: s.career && s.career.job, ach: Object.keys(s.ach), saveKB: Math.round(JSON.stringify(s).length / 1024) } : null;
  });
  await shot('99-final');
  console.log('Типы шагов:', JSON.stringify(seenTypes));
  console.log('Итог:', JSON.stringify(fin));
  if (errors.length) {
    console.log('ОШИБКИ (' + errors.length + '):');
    [...new Set(errors)].slice(0, 30).forEach((e) => console.log(' - ' + e));
  } else console.log('Ошибок нет.');
  if (device) await device.close().catch(() => {});
  else if (!cdp) await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
