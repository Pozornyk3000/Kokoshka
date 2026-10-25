#!/usr/bin/env node
/* Быстрая симуляция игры без интерфейса: проверка движка и баланса экономики.
   node tools/sim.mjs [дней=160] [--skill 0.75] [--seed 1] [--job hospital] [--bg orderly] [--mode full|doctor] [--difficulty easy|normal|hard] [--stub stub-data.js] [--quiet] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const days = +(argv[0] && !argv[0].startsWith('--') ? argv[0] : 160);
const skill = +flag('--skill', 0.75);
const seed = +flag('--seed', 1);
const jobPref = flag('--job', 'hospital');
const bgPref = flag('--bg', 'orderly');
const dream = flag('--dream', 'flat');
const mode = flag('--mode', 'full');
const difficulty = flag('--difficulty', 'normal');
const stub = flag('--stub', null);
const quiet = argv.includes('--quiet');

let x = seed >>> 0;
const rand = () => {
  x = (x + 0x6d2b79f5) >>> 0;
  let r = Math.imul(x ^ (x >>> 15), 1 | x);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};
const MathR = Object.create(Math);
MathR.random = rand;
const ctx = { console, Math: MathR, JSON, Object, Array, String, Number, Date, Buffer, setTimeout: () => 0, clearTimeout: () => 0 };
ctx.window = ctx;
vm.createContext(ctx);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/\/(ui|art)\/|main\.js/.test(s));
for (const s of scripts) {
  if (s.endsWith('game/engine.js') && stub) vm.runInContext(fs.readFileSync(path.resolve(stub), 'utf8'), ctx, { filename: 'stub' });
  const f = path.join(root, s);
  if (!fs.existsSync(f)) continue;
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: s });
}
const A = ctx.A;
const G = A.game;
const D = A.data;
const CS = A.cases;
D.index();
A.migrate = (s) => s;

const s = (A.state = G.newState({ name: 'Тест', gender: 'f', background: bgPref, dream, mode, difficulty }));
G.queue(s, G.prologue(s), 'prologue');

const chance = (p) => rand() < p;
function solveCase(c, mode, exam) {
  const p = CS.init(s, { id: c.id, mode, exam });
  if (p.parts.includes('talk')) {
    const order = c.q.map((q, i) => ({ i, v: q.v + (q.crit ? 3 : 0) + (chance(skill) ? 0 : rand() * 6 - 3) })).sort((a, b) => b.v - a.v);
    for (const o of order.slice(0, p.maxQ)) CS.ask(c, p, o.i);
  }
  c.status.opts.forEach((o, i) => {
    if (o.ok ? chance(skill) : chance((1 - skill) / 3)) p.sel.status.push(i);
  });
  if (!p.sel.status.length) p.sel.status.push(0);
  const pickOne = (opts) => {
    const ok = opts.findIndex((o) => o.ok);
    return chance(skill) ? ok : Math.floor(rand() * opts.length);
  };
  p.sel.syn = pickOne(c.syndrome.opts);
  p.sel.dx = pickOne(c.dx.opts);
  // сложная игра: тот же выбор, но ключом полного каталога МКБ-10
  if (p.hard) p.sel.dxKey = A.icd.entryFor(c.dx.opts[p.sel.dx].t).k;
  c.tx.opts.forEach((o, i) => {
    if (o.ok ? chance(skill) : chance((1 - skill) / (o.bad ? 4 : 2))) p.sel.tx.push(i);
  });
  if (!p.sel.tx.length) p.sel.tx.push(0);
  const res = CS.score(s, c, p, mode);
  res.patientName = c.patient.name;
  CS.reward(s, c, res);
  return res;
}

/** Обход: простая «врачебная» стратегия по карте КР с ошибками в зависимости от умения. */
function wardRound(st) {
  const W = A.ward;
  const P = A.pharma;
  if (!st.p) st.p = { mode: st.mode, admitted: W.beginRound(s, st.mode).map((x) => x.uid) };
  const stats = { rx: 0, errs: 0 };
  W.active(s)
    .filter((pt) => pt.mode === st.mode)
    .forEach((pt) => {
      if (pt.pending) {
        const ev = W.EVENTS[pt.pending.k];
        const best = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
        W.decide(s, pt, chance(skill) ? best : Math.floor(rand() * ev.opts.length));
      }
      const g = P.gl(pt);
      const ph = g && g.phases ? g.phases[P.phase(pt)] || g.phases.acute : null;
      const hasFirst = pt.rx.some((r) => !r.home && P.line(pt, P.item(r)).line === 'first');
      if (ph && !hasFirst) {
        let cands = [];
        (ph.first || []).forEach((e) => {
          const en = typeof e === 'string' ? { id: e } : e;
          if (en.id) cands.push(P.int(en.id) ? { kind: 'int', id: en.id } : { kind: 'drug', id: en.id });
          else (D.drugs || []).forEach((d) => (en.cls ? d.cls === en.cls : d.group === en.group) && cands.push({ kind: 'drug', id: d.id }));
        });
        cands = cands.filter((c) => c.kind === 'int' || P.drug(c.id));
        // без грубых ошибок и с лучшим действием на основной домен
        const doms = P.group(pt).domains;
        const score = (c) => (c.kind === 'int' ? 0.3 : Math.max(...doms.map((k) => P.drug(c.id).eff[k] || 0)));
        const safe = cands.filter((c) => {
          if (c.kind === 'int') return true;
          const d = P.drug(c.id);
          const tags = P.tags(pt);
          return !(d.contra || []).some((x) => tags[x.t] && x.sev !== 'moderate') && (pt.intolerant || []).indexOf(d.id) < 0 && (pt.failed || []).indexOf(d.id) < 0;
        });
        const pool = chance(skill) ? safe.sort((a, b) => score(b) - score(a)).slice(0, 3) : cands;
        const c = pool[Math.floor(rand() * pool.length)];
        if (c) {
          let msgs;
          if (c.kind === 'int') msgs = W.prescribe(s, pt, { kind: 'int', id: c.id });
          else {
            const d = P.drug(c.id);
            const route = (d.forms.find((f) => f.route === 'po') || d.forms[0]).route;
            const r = P.range(d, route, pt);
            const steps = P.form(d, route).steps || [];
            let dose = r && r.start != null ? r.start : steps[0];
            if (steps.indexOf(dose) < 0) dose = steps.reduce((a, b) => (Math.abs(b - dose) < Math.abs(a - dose) ? b : a), steps[0]);
            msgs = W.prescribe(s, pt, { kind: 'drug', id: d.id, route, dose });
          }
          stats.rx++;
          stats.errs += msgs.filter((m) => m.lvl === 'err').length;
        }
      }
      // титрация до терапевтической дозы
      pt.rx.forEach((r, i) => {
        if (r.kind === 'int' || r.prn || r.home) return;
        const d = P.drug(r.id);
        const rg = P.range(d, r.route, pt);
        if (rg && r.dose < rg.min && s.day - (r.changed || r.since) >= 3 && chance(skill)) W.stepDose(s, pt, i, 1);
      });
      if (chance(skill)) P.dueTests(s, pt).forEach((x) => W.order(s, pt, x.test));
      if (pt.sev <= P.group(pt).discharge && W.canDischarge(s, pt).ok) W.finish(s, pt, 'discharge');
    });
  wardStats.rounds++;
  wardStats.rx += stats.rx;
  wardStats.errs += stats.errs;
  return G.stepDone(W.roundResult(s, st.mode));
}
const wardStats = { rounds: 0, rx: 0, errs: 0 };

/** Амбулаторный приём: звонки, визиты, старт лечения по КР, титрация, контроль, перевод на редкие визиты. */
function ambDay(st) {
  const M = A.clinic;
  const W = A.ward;
  const P = A.pharma;
  const list = st.list || M.beginDay(s).list;
  const res = { kind: 'amb', visits: 0, avg: 0, calls: 0, pay: 0, closed: 0 };
  let sum = 0;
  M.active(s).forEach((pt) => {
    if (!pt.pending) return;
    const ev = M.EVENTS[pt.pending.k];
    const best = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
    M.decide(s, pt, chance(skill) ? best : Math.floor(rand() * ev.opts.length));
    res.calls++;
    if (pt.urgent && !pt.away && list.indexOf(pt.uid) < 0) list.push(pt.uid);
  });
  list.forEach((uid) => {
    const pt = M.byUid(s, uid);
    if (!pt || pt.done || pt.away || pt.pending) return;
    M.beginVisit(s, pt);
    const t = M.tpl(pt);
    if (pt.dxOk == null && t.dxq) {
      const ok = t.dxq.opts.findIndex((o) => o.ok === true);
      const i = chance(skill) ? ok : Math.floor(rand() * t.dxq.opts.length);
      if (G.hard(s)) M.chooseDxKey(s, pt, A.icd.entryFor(t.dxq.opts[i].t).k);
      else M.chooseDx(s, pt, i);
    }
    if (pt.vis.kind === 'first') ['explain', 'safety'].forEach((k) => chance(skill) && M.talk(s, pt, k));
    if (pt.vis.report.some((x) => x.k === 'stopped' || x.k === 'wantsStop') && chance(skill)) M.talk(s, pt, 'adherence');
    const g = P.gl(pt);
    const ph = g && g.phases ? g.phases[P.phase(pt)] || g.phases.acute : null;
    const hasFirst = pt.rx.some((r) => !r.home && !r.held && P.line(pt, P.item(r)).line === 'first');
    if (ph && !hasFirst && pt.sev >= 25) {
      let cands = [];
      (ph.first || []).forEach((e) => {
        const en = typeof e === 'string' ? { id: e } : e;
        if (en.id) cands.push(P.int(en.id) ? { kind: 'int', id: en.id } : { kind: 'drug', id: en.id });
        else (D.drugs || []).forEach((d) => (en.cls ? d.cls === en.cls : d.group === en.group) && cands.push({ kind: 'drug', id: d.id }));
      });
      cands = cands.filter((c) => (c.kind === 'int' ? P.int(c.id) && (!P.int(c.id).where || P.int(c.id).where.indexOf('amb') >= 0) : P.drug(c.id)));
      const tags = P.tags(pt);
      const safe = cands.filter((c) => c.kind === 'int' || !(P.drug(c.id).contra || []).some((x) => tags[x.t] && x.sev !== 'moderate'));
      const pool = chance(skill) ? safe : cands;
      const c = pool[Math.floor(rand() * pool.length)];
      if (c && c.kind === 'int') W.prescribe(s, pt, { kind: 'int', id: c.id });
      else if (c) {
        const d = P.drug(c.id);
        const route = (d.forms.find((f) => f.route === 'po') || d.forms[0]).route;
        const r = P.range(d, route, pt);
        const steps = P.form(d, route).steps || [];
        let dose = r && r.start != null ? r.start : steps[0];
        if (steps.indexOf(dose) < 0) dose = steps.reduce((a, b) => (Math.abs(b - dose) < Math.abs(a - dose) ? b : a), steps[0]);
        W.prescribe(s, pt, { kind: 'drug', id: d.id, route, dose });
      }
    }
    pt.rx.forEach((r, i) => {
      if (r.kind === 'int' || r.prn || r.home || r.pre) return;
      const d = P.drug(r.id);
      const rg = P.range(d, r.route, pt);
      if (rg && r.dose < rg.min && s.day - (r.changed || r.since) >= 3 && chance(skill)) W.stepDose(s, pt, i, 1);
      if (r.held && chance(skill)) W.stepDose(s, pt, i, -1);
    });
    if (chance(skill)) P.dueTests(s, pt).forEach((x) => W.order(s, pt, x.test));
    const next = pt.sev >= 55 ? 3 : pt.sev >= 30 ? 7 : 14;
    const r = M.endVisit(s, pt, next);
    res.pay += M.reward(s, pt, r.score);
    res.visits++;
    sum += r.score;
    if (M.canClose(s, pt).ok && pt.visits.filter((v) => v.kind !== 'past').length >= 3) {
      M.close(s, pt, 'rare');
      res.closed++;
    }
  });
  M.archiveDone(s);
  res.avg = res.visits ? Math.round(sum / res.visits) : 0;
  ambStats.days++;
  ambStats.visits += res.visits;
  ambStats.calls += res.calls;
  return G.stepDone(res);
}
const ambStats = { days: 0, visits: 0, calls: 0 };

function resolveStep() {
  const act = s.activity;
  const st = act.steps[act.i];
  switch (st.type) {
    case 'story':
    case 'payslip':
    case 'diploma':
      return G.stepDone(null);
    case 'ward':
      return wardRound(st);
    case 'amb':
      return ambDay(st);
    case 'shop':
      return G.stepDone(null);
    case 'event': {
      const e = A.events.byId[st.id];
      const ch = e.choices.length > 1 && chance(0.3) ? 1 : 0;
      e.choices[ch].run(s);
      return G.stepDone(null);
    }
    case 'lecture': {
      const L = D.lectureById[st.id];
      const total = L ? L.quiz.length : 4;
      let right = 0;
      for (let i = 0; i < total; i++) if (chance(skill)) right++;
      return G.stepDone({ id: st.id, right, total, focus: G.focus(s) });
    }
    case 'case': {
      const c = D.caseById[st.id];
      return G.stepDone(solveCase(c, st.mode));
    }
    case 'exam': {
      const scores = st.tasks.cases.map((id) => solveCase(D.caseById[id], 'exam', st.exam).score);
      let test = null;
      if (st.tasks.test) {
        let right = 0;
        st.tasks.test.forEach(() => chance(skill + 0.05) && right++);
        test = { right, total: st.tasks.test.length };
      }
      return G.stepDone({ exam: st.exam, scores, cases: st.tasks.cases, test });
    }
    case 'mini': {
      const n = A.minis.count(st);
      let right = 0;
      for (let i = 0; i < n; i++) {
        const m = A.minis.get(st, i);
        const ok = chance(skill);
        if (ok) right++;
        A.minis.reward(s, m, ok);
      }
      return G.stepDone({ kind: 'mini', right, total: n });
    }
    case 'jobs': {
      const job = D.jobs[jobPref] && !D.jobs[jobPref].req(s) ? jobPref : 'pnd';
      G.startCareer(s, job);
      return G.stepDone({ job });
    }
    case 'ending': {
      const e = (D.endings || {})[st.id] || {};
      log(`ФИНАЛ: ${st.id} на день ${s.day}`);
      if (e.kind === 'bad') {
        s.ended = st.id;
        return;
      }
      return G.stepDone(null);
    }
    default:
      throw new Error('unknown step ' + st.type);
  }
}

const avail = () =>
  A.actions.list.filter((a) => {
    const st = G.status(s, a);
    return !st.hidden && !st.disabled;
  });
const can = (id) => avail().some((a) => a.id === id);
const pickArg = (id) => {
  const a = A.actions.byId[id];
  if (!a.pick) return undefined;
  const opts = a.pick(s);
  if (id === 'study' || id === 'library' || id === 'cram' || id === 'library_city') return opts.sort((p, q) => s.know[p.value] - s.know[q.value])[0].value;
  if (id === 'autoweek') return flag('--auto', 'gigs');
  return opts[0] && opts[0].value;
};
function choose() {
  const ok = avail();
  if (argv.includes('--auto') && ok.some((a) => a.id === 'autoweek') && s.stress < 60) return 'autoweek';
  const prim = ok.filter((a) => G.status(s, a).primary && a.id !== 'sleep');
  if (prim.length) return prim[0].id;
  if (can('pet') && s.daily.pets < 1) return 'pet';
  // покупки
  const wish = ['earplugs', 'textbook', 'pharmguide', 'mattress', 'coffee', 'gym'];
  for (const w of wish) {
    const it = D.shopById[w];
    if (!s.items[w] && s.money > it.price + 40000) {
      s.money -= it.price;
      s.items[w] = true;
      s.week.expense.push(['Покупка', it.price]);
    }
  }
  if (s.phase === 'career' && s.housing === 'room' && s.money > 250000 && dream !== 'flat') return can('move') ? 'move' : null;
  if (s.slot === 3) {
    const nightOk = s.energy > 45 && s.stress < 62 && !s.burnout.active;
    if (s.phase === 'career' && nightOk && chance(0.35)) return can('night_duty') ? 'night_duty' : can('gig_night') ? 'gig_night' : 'sleep';
    if (s.phase !== 'career' && nightOk && chance(0.25) && can('gig_nurse')) return 'gig_nurse';
    if (can('swap_night')) return 'swap_night';
    return 'sleep';
  }
  if (s.stress > 65) {
    for (const id of ['therapy', 'balint', 'walk', 'gym', 'cafe']) if (can(id)) return id;
  }
  if (s.energy < 30 && can('nap')) return 'nap';
  if (s.phase === 'career') {
    for (const id of ['gig_commission', 'gig_online', 'gig_teach']) if (can(id) && chance(0.55)) return id;
    if (dream === 'science' && can('article') && chance(0.5)) return 'article';
  } else {
    if (G.inDebt(s) && can('otrabotka')) return 'otrabotka';
    for (const id of ['gig_courier', 'gig_tutor', 'gig_callcenter']) if (can(id) && chance(0.45)) return id;
  }
  if (can('study') && chance(0.5)) return 'study';
  for (const id of ['walk', 'series', 'nap', 'sleep_early']) if (can(id)) return id;
  return ok.filter((a) => !a.free)[0]?.id || 'sleep';
}

const lines = [];
function log(t) {
  lines.push(t);
  if (!quiet) console.log(t);
}
let guard = 0;
let lastWeek = 0;
while (s.day <= days && !s.ended && guard++ < 20000) {
  if (s.activity) {
    resolveStep();
    continue;
  }
  const id = choose();
  if (!id) break;
  G.perform(id, pickArg(id));
  for (const k of ['money', 'energy', 'stress', 'health', 'rep', 'xp']) if (!Number.isFinite(s[k])) throw new Error(`${k} не число на дне ${s.day} после ${id}`);
  const w = Math.floor((s.day - 1) / 7);
  if (w !== lastWeek) {
    lastWeek = w;
    log(
      `нед ${String(w + 1).padStart(2)} день ${String(s.day).padStart(3)} ${s.phase.padEnd(8)} ₽${String(Math.round(s.money)).padStart(8)} энерг ${String(Math.round(s.energy)).padStart(3)} стресс ${String(Math.round(s.stress)).padStart(3)} здор ${String(Math.round(s.health)).padStart(3)} реп ${String(Math.round(s.rep)).padStart(3)} xp ${String(s.xp).padStart(5)} знания ${G.knowAvg(s).toFixed(0)}${s.burnout.active ? ' ВЫГОРАНИЕ' : ''}${s.career ? ' ' + s.career.job : ''}`
    );
  }
}
console.log('---');
const pr = (s.ward && s.ward.practice) || {};
const wd = (s.ward && s.ward.done) || [];
console.log(`Отделение: обходов ${wardStats.rounds}, назначений ${wardStats.rx}, грубых ошибок ${wardStats.errs}; практика — обходов ${pr.rounds || 0}/${pr.days || 0}, ср. ${pr.avg || 0}, зачёт ${pr.grade}; выписано ${wd.filter((x) => x.how === 'discharge').length} (ср. ${wd.length ? Math.round(wd.reduce((a, x) => a + x.score, 0) / wd.length) : 0}), диплом ${s.study.diploma ? s.study.diploma.number : '—'}, аккредитация ${s.study.accr ? 'да' : 'нет'}`);
console.log(`Итог: день ${s.day}, фаза ${s.phase}, деньги ${Math.round(s.money)}, реп ${Math.round(s.rep)}, ранг «${G.rank(s).name}», случаев ${s.stats.cases}, верных дз ${s.stats.dxRight}, ночей ${s.stats.nights}, выгораний ${s.burnout.episodes}, экзамены ${JSON.stringify(Object.fromEntries(Object.entries(s.study.exams).map(([k, v]) => [k, v.grade])))}, достижений ${Object.keys(s.ach).length}, сохранение ${(JSON.stringify(s).length / 1024).toFixed(0)} КБ`);
if (guard >= 20000) console.log('ВНИМАНИЕ: превышен лимит шагов (зацикливание?)');
if (argv.includes('--ward')) {
  const P = A.pharma;
  for (const x of (s.ward && s.ward.done) || []) console.log('  выписка/передача', x.tpl, x.how, x.score, 'дн', x.end - x.admit, 'тяжесть', x.sev0, '→', x.sev, x.rx.map((r) => r.id + ':' + r.dose).join(','));
  for (const pt of A.ward.active(s)) console.log('  в отделении', pt.tpl, pt.mode, 'день', s.day - pt.admitDay, 'тяжесть', Math.round(pt.sev0), '→', Math.round(pt.sev), pt.rx.map((r) => r.id + ':' + r.dose).join(','), 'события', pt.events.map((e) => e.k).join(','));
}
{
  const ad = (s.amb && s.amb.done) || [];
  const rare = ad.filter((x) => x.how === 'rare');
  console.log(`Амбулаторный приём: дней ${ambStats.days}, визитов ${ambStats.visits}, звонков ${ambStats.calls}; на участке ${A.clinic ? A.clinic.active(s).length : 0}; переведены на редкие визиты ${rare.length} (ср. ${rare.length ? Math.round(rare.reduce((a, x) => a + x.score, 0) / rare.length) : 0}), переданы ${ad.length - rare.length}`);
}
if (argv.includes('--ward')) {
  console.log('  последний обход: день', s.ward.lastRound, '; сегодня', s.day, '; работа', s.career && s.career.job);
  for (const pt of A.ward.active(s)) console.log('  выписка возможна?', pt.tpl, JSON.stringify(A.ward.canDischarge(s, pt)), 'pending', pt.pending && pt.pending.k, 'away', JSON.stringify(pt.away));
}
