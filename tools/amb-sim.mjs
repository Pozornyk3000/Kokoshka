#!/usr/bin/env node
/* Симуляция амбулаторного ведения: один шаблон пациента, сценарий визитов, течение болезни между визитами и итоговая оценка.
   node tools/amb-sim.mjs <шаблон> [сценарий=ideal] [--job pnd|private|uni] [--seed 1] [--runs 1] [--days 90] [--quiet] [--verbose]
   node tools/amb-sim.mjs --all [--runs 20] [--check]  — все шаблоны, сценарии ideal и bad; --check — проверка баланса
   Сценарии описаны в tools/amb-plans.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PLANS } from './amb-plans.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--quiet', '--verbose', '--all'].includes(argv[i - 1])));
const runs = +flag('--runs', 1);
const maxDays = +flag('--days', 90);
const job = flag('--job', 'pnd');
const quiet = argv.includes('--quiet');
const verbose = argv.includes('--verbose');

function load(seed) {
  let x = seed >>> 0;
  const rand = () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let r = Math.imul(x ^ (x >>> 15), 1 | x);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const MathR = Object.create(Math);
  MathR.random = rand;
  const ctx = { console, Math: MathR, JSON, Object, Array, String, Number, Date, setTimeout: () => 0, clearTimeout: () => 0 };
  ctx.window = ctx;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/\/(ui|art)\/|main\.js/.test(s));
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s });
  ctx.A.data.index();
  ctx.A.store = { save() {}, checkpoint() {} };
  return ctx.A;
}

function run(tplId, planId, seed) {
  const A = load(seed);
  const G = A.game;
  const W = A.ward;
  const M = A.clinic;
  const P = A.pharma;
  const D = A.data;
  if (!D.ambById[tplId]) throw new Error('нет шаблона ' + tplId + '. Есть: ' + Object.keys(D.ambById).join(', '));
  const s = (A.state = G.newState({ name: 'Тест', gender: 'f', background: 'excellent', dream: 'flat' }));
  s.day = 40;
  G.startCareer(s, job);
  M.ensure(s);
  s.amb.seeded = job;
  const pt = M.admit(s, tplId);
  pt.next = s.day;
  const plan = (PLANS[tplId] || {})[planId] || PLANS._default[planId];
  if (!plan) throw new Error('нет сценария ' + planId + ' для ' + tplId);
  const msgs = [];
  const say = (list) => list.forEach((m) => msgs.push('   [' + m.lvl + '] ' + m.text + (m.cite ? ' — ' + m.cite : '')));
  let how = 'transfer';
  let k = 0;
  const start = s.day;
  for (let d = 0; d < maxDays; d++) {
    const hd = s.day - start;
    if (pt.pending) {
      const ev = M.EVENTS[pt.pending.k];
      const okOf = (o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok);
      let i = plan.decide === 'worst' ? ev.opts.findIndex((o) => okOf(o) === false) : ev.opts.findIndex((o) => okOf(o) === true);
      if (i < 0) i = 0;
      if (plan.decide !== 'skip') {
        const r = M.decide(s, pt, i);
        msgs.push(hd + ': ЗВОНОК ' + ev.title + ' → ' + (r.ok === true ? 'верно' : r.ok === 'part' ? 'частично' : 'ошибка'));
      }
    }
    if (!pt.away && pt.next <= s.day && !pt.done) {
      const v = M.beginVisit(s, pt);
      msgs.push(hd + ': ВИЗИТ ' + (k + 1) + ' (' + v.kind + '), тяжесть ' + Math.round(pt.sev) + (v.scale ? ', ' + v.scale.name + ' ' + v.scale.value : '') + ', приверженность ' + Math.round(pt.adherence * 100) + '%' + (pt.stopped ? ' (бросил' + W.pv(pt, '', 'а') + ')' : ''));
      if (verbose) v.report.forEach((x) => msgs.push('     «' + x.text + '»'));
      if (k === 0 && pt.dxOk == null && plan.dx != null) {
        const r = M.chooseDx(s, pt, plan.dx);
        if (r) msgs.push('   диагноз: ' + (r.ok === true ? 'верно' : r.ok === 'part' ? 'частично' : 'ошибка'));
      }
      const step = plan.visit(k, pt, s, A) || { acts: [], next: 28 };
      // хороший врач отвечает на то, что услышал: бросил таблетки — разобрать, жалобы — объяснить или поправить
      if (plan.react !== false && plan.decide !== 'worst') {
        const has = (kk) => v.report.some((x) => x.k === kk);
        if (has('stopped') || has('skip')) step.acts = step.acts.concat([['talk', 'adherence']]);
        if (has('wantsStop')) step.acts = step.acts.concat([['talk', 'goal']]);
        if (v.report.some((x) => x.k === 'se' && x.se !== 'weight')) step.acts = step.acts.concat([['talk', 'explain']]);
        if (v.report.some((x) => x.k === 'se' && x.se === 'weight')) step.acts = step.acts.concat([['talk', 'lifestyle']]);
        if (v.report.some((x) => x.k === 'se' && x.se === 'hyponatremia')) step.acts = step.acts.concat([['order', 'bio']]);
      }
      for (const a of step.acts) {
        const i = () => pt.rx.findIndex((r) => r.id === a[1]);
        if (a[0] === 'rx') say(W.prescribe(s, pt, { id: a[1], kind: 'drug', route: a[2], dose: a[3], time: a[4] }));
        else if (a[0] === 'int') say(W.prescribe(s, pt, { id: a[1], kind: 'int' }));
        else if (a[0] === 'dose' && i() >= 0) say(W.setDose(s, pt, i(), a[2]));
        else if (a[0] === 'stop' && i() >= 0) say(W.stop(s, pt, i()));
        else if (a[0] === 'time' && i() >= 0) say(W.setTime(s, pt, i(), a[2]));
        else if (a[0] === 'order') W.order(s, pt, a[1]);
        else if (a[0] === 'home') W.stopHome(s, pt, a[1]);
        else if (a[0] === 'talk') M.talk(s, pt, a[1]).forEach((m) => verbose && msgs.push('     беседа: ' + m.text));
        else if (a[0] === 'hosp') say(M.hospitalize(s, pt).msgs);
      }
      if (plan.monitor !== false) P.dueTests(s, pt).forEach((x) => W.order(s, pt, x.test));
      const r = M.endVisit(s, pt, step.next);
      say(r.msgs);
      msgs.push('   оценка визита ' + r.score + ', следующий через ' + step.next);
      k++;
      if (plan.close !== false && k >= 3 && M.canClose(s, pt).ok) {
        how = 'rare';
        break;
      }
    }
    s.day++;
    M.tick(s);
  }
  const sc = M.score(s, pt, how);
  return { pt, sc, how, msgs, k, s };
}

function report(tplId, planId) {
  const totals = [];
  for (let r = 0; r < runs; r++) {
    const seed = +flag('--seed', 1) + r;
    const res = run(tplId, planId, seed);
    totals.push(res);
    if (runs === 1 || verbose) {
      const pt = res.pt;
      if (!quiet) {
        console.log('== ' + tplId + ' / ' + planId + ' / seed ' + seed);
        console.log('Тяжесть: ' + pt.hist.filter((h, i) => i % 3 === 0).map((h) => h.sev).join(' '));
        res.msgs.forEach((m) => console.log(m));
        console.log('События: ' + pt.events.map((e) => e.k + '@' + (e.day - pt.admitDay) + (e.preventable ? '!' : '')).join(', '));
        console.log('Дневник: ' + pt.diary.map((x) => x.day - pt.admitDay + ' ' + x.k).join(', '));
        console.log('ПЭ: ' + Object.entries(pt.sx).filter(([k, v]) => v > 0.3).map(([k, v]) => k + '=' + v).join(' '));
        console.log('Пропущенный контроль: ' + Object.keys(pt.monMissed).join('; '));
        console.log('Лаб: Na ' + Math.round(pt.lab.na) + ', Li ' + Math.round(pt.lab.li * 100) / 100 + ', вес +' + Math.round((pt.lab.weight - pt.base.weight) * 10) / 10 + ', PRL ' + Math.round(pt.lab.prl) + ', глюкоза ' + Math.round(pt.lab.glucose * 10) / 10);
      }
      console.log('Итог (' + res.how + ', ' + res.sc.days + ' дн., визитов ' + res.sc.visits + '): ' + JSON.stringify({ total: res.sc.total, outcome: res.sc.outcome, kr: res.sc.kr, safety: res.sc.safety, mon: res.sc.mon, care: res.sc.care, adh: res.sc.adh }));
      res.sc.issues.forEach((x) => console.log('   ' + (x.ok ? '✓ ' : '✗ ') + x.msg));
      if (verbose) res.pt.rev.list.forEach((m) => console.log('   rev [' + m.lvl + '] ' + m.text));
    }
  }
  const avg = (f) => Math.round(totals.reduce((a, r) => a + f(r), 0) / totals.length);
  const line = tplId + ' / ' + planId + ' × ' + runs + ': итог ' + avg((r) => r.sc.total) + ' (мин ' + Math.min(...totals.map((r) => r.sc.total)) + '), исход ' + avg((r) => r.sc.outcome) + ', КР ' + avg((r) => r.sc.kr) + ', безоп. ' + avg((r) => r.sc.safety) + ', контроль ' + avg((r) => r.sc.mon) + ', ведение ' + avg((r) => r.sc.care) + ', дней ' + avg((r) => r.sc.days) + ', визитов ' + avg((r) => r.sc.visits) + ', редкие ' + totals.filter((r) => r.how === 'rare').length + ', событий ' + avg((r) => r.pt.events.length * 100) / 100;
  if (runs > 1) console.log(line);
  return totals;
}

if (argv.includes('--all')) {
  // --check: сбой, если ведение по КР оценивается ниже 85 или грубые ошибки — выше 75 (защита баланса)
  const A = load(1);
  const bad = [];
  for (const id of Object.keys(A.data.ambById))
    for (const pl of ['ideal', 'bad']) {
      if (!(PLANS[id] || {})[pl]) continue;
      const t = report(id, pl);
      const avg = Math.round(t.reduce((a, r) => a + r.sc.total, 0) / t.length);
      if (pl === 'ideal' && avg < 85) bad.push(id + ' / ideal: ' + avg + ' < 85');
      if (pl === 'bad' && avg > 75) bad.push(id + ' / bad: ' + avg + ' > 75');
    }
  for (const id of Object.keys(A.data.ambById)) if (!PLANS[id]) bad.push(id + ': нет сценариев в tools/amb-plans.mjs');
  if (argv.includes('--check')) {
    if (bad.length) {
      console.log('ОШИБКИ БАЛАНСА:\n' + bad.join('\n'));
      process.exit(1);
    }
    console.log('Баланс амбулаторного приёма в норме.');
  }
} else report(pos[0], pos[1] || 'ideal');
