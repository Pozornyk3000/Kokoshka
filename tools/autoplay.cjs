#!/usr/bin/env node
/* Автоигрок: проходит игру через интерфейс в headless Chromium и ловит ошибки.
   NODE_PATH=/opt/node22/lib/node_modules node tools/autoplay.cjs <page.html> [шагов=600] [--shots DIR] [--seed N] [--days N] [--dark] */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const page_ = argv[0];
const maxSteps = +(argv[1] && !argv[1].startsWith('--') ? argv[1] : 600);
const shots = flag('--shots', null);
const seed = +flag('--seed', 1);
const maxDays = +flag('--days', 999);
if (shots) fs.mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: argv.includes('--dark') ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|fonts\.g|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
  });
  const url = /^(https?|file):/.test(page_) ? page_ : 'file://' + path.resolve(page_);
  await page.goto(url);
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

  const shot = async (name) => {
    if (!shots) return;
    await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
  };
  const click = async (sel) => {
    const el = await page.$(sel);
    if (!el) return false;
    await el.click();
    await page.waitForTimeout(15);
    return true;
  };

  // Титул → новая игра
  await shot('00-title');
  await click('[data-act="new"]');
  await click('[data-act="confirm-yes"]');
  await shot('01-create');
  await click('[data-act="cr-bg"][data-arg="orderly"]');
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
      return { day: s.day, slot: s.slot, money: s.money, energy: s.energy, stress: s.stress, health: s.health, phase: s.phase, type: step ? step.type : 'hub', stage: step && step.p ? step.p.stage || '' : '', ended: s.ended };
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
    const tkey = info.type + (info.stage ? '-' + info.stage : '');
    if (!shotTypes[tkey]) {
      shotTypes[tkey] = true;
      await shot(String(Object.keys(shotTypes).length + 1).padStart(2, '0') + '-' + tkey);
    }
    if (await click('[data-act="confirm-yes"]')) continue;
    if (await page.$('.sheet [data-act="pick"]')) {
      const picks = await page.$$('.sheet [data-act="pick"]:not([aria-disabled="true"])');
      if (picks.length) await picks[Math.floor(Math.random() * picks.length)].click();
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
            if (left > 0) {
              const order = c.q.map((q, i) => ({ i, v: (q.crit ? 10 : 0) + q.v })).filter((o) => p.asked.indexOf(o.i) < 0).sort((a, b) => b.v - a.v);
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
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
