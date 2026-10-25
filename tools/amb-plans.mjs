/* Сценарии для tools/amb-sim.mjs: ideal — по КР, bad — типичные ошибки, none — без изменений лечения.
   Сценарий — функция визита (k — номер визита с нуля) → { acts, next }.
   Действия: ['rx', id, путь, доза, время?] | ['int', id] | ['dose', id, доза] | ['stop', id] | ['order', тест] | ['home', метка]
   | ['time', id, время] | ['talk', тема] | ['hosp']. */
const sev = (pt) => pt.sev;
const at = (map, k, def) => (map[k] !== undefined ? map[k] : def);
// стабильный — реже, нестабильный — чаще
const auto = (pt) => (pt.sev >= 55 ? 7 : pt.sev >= 30 ? 14 : 28);

export const PLANS = {
  _default: {
    none: { dx: 0, visit: (k, pt) => ({ acts: [], next: 28 }), monitor: false },
  },

  a_dep_first: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'safety'], ['talk', 'goal'], ['rx', 'sertraline', 'po', 50]], next: 3 },
            1: { acts: [], next: 7 },
            2: { acts: sev(pt) > 30 ? [['dose', 'sertraline', 100]] : [], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: {
      dx: 1,
      visit: (k, pt) => at({ 0: { acts: [['rx', 'amitriptyline', 'po', 150]], next: 28 }, 1: { acts: [['stop', 'amitriptyline']], next: 28 } }, k, { acts: [], next: 28 }),
      monitor: false,
      decide: 'worst',
    },
  },

  a_dep_bip: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'safety'], ['talk', 'family'], ['order', 'glucose'], ['order', 'lipids'], ['rx', 'quetiapine', 'po', 50]], next: 3 },
            1: { acts: [['dose', 'quetiapine', 150]], next: 7 },
            2: { acts: [['dose', 'quetiapine', 300]], next: 14 },
          },
          k,
          { acts: [['talk', 'lifestyle']], next: auto(pt) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'sertraline', 'po', 50]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_dep_elderly: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'safety'], ['talk', 'family'], ['order', 'bio'], ['home', 'thiazide'], ['rx', 'mirtazapine', 'po', 7.5]], next: 3 },
            1: { acts: [['dose', 'mirtazapine', 15], ['dose', 'phenazepam', 0.25]], next: 14 },
            2: { acts: [['stop', 'phenazepam'], ['order', 'bio']], next: 14 },
            3: { acts: sev(pt) > 30 ? [['dose', 'mirtazapine', 30]] : [], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    sertraline: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'safety'], ['talk', 'family'], ['order', 'bio'], ['home', 'thiazide'], ['rx', 'sertraline', 'po', 25]], next: 3 },
            1: { acts: [['dose', 'sertraline', 50], ['dose', 'phenazepam', 0.25], ['order', 'bio']], next: 14 },
            2: { acts: [['stop', 'phenazepam']], next: 14 },
            3: { acts: sev(pt) > 30 ? [['dose', 'sertraline', 100], ['order', 'bio']] : [], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'amitriptyline', 'po', 75]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_panic: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'goal'], ['rx', 'escitalopram', 'po', 5], ['int', 'psychotherapy_cbt']], next: 7 },
            1: { acts: [['dose', 'escitalopram', 10]], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'phenazepam', 'po', 3]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_ocd: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'goal'], ['rx', 'sertraline', 'po', 50], ['int', 'exposure_erp']], next: 3 },
            1: { acts: [['dose', 'sertraline', 100]], next: 14 },
            2: { acts: [['dose', 'sertraline', 150]], next: 14 },
            3: { acts: sev(pt) > 42 ? [['dose', 'sertraline', 200]] : [], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'haloperidol', 'po', 10]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_ptsd: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'safety'], ['talk', 'alcohol'], ['rx', 'sertraline', 'po', 25], ['int', 'trauma_therapy']], next: 3 },
            1: { acts: [['dose', 'sertraline', 50]], next: 14 },
            2: { acts: sev(pt) > 40 ? [['dose', 'sertraline', 100]] : [], next: 14 },
            3: { acts: sev(pt) > 40 ? [['dose', 'sertraline', 150]] : [], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { dx: 3, visit: (k) => at({ 0: { acts: [['rx', 'phenazepam', 'po', 1.5]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_alc: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'alcohol'], ['talk', 'family'], ['order', 'bio'], ['rx', 'naltrexone', 'po', 25], ['int', 'rehab_groups']], next: 7 },
            1: { acts: [['dose', 'naltrexone', 50]], next: 14 },
          },
          k,
          { acts: [], next: Math.min(14, auto(pt)) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'phenazepam', 'po', 2]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_dementia: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'family'], ['talk', 'explain'], ['order', 'ecg'], ['stop', 'amitriptyline'], ['rx', 'donepezil', 'po', 5], ['int', 'dementia_care']], next: 14 },
            1: { acts: [], next: 14 },
            2: { acts: [['dose', 'donepezil', 10]], next: 28 },
          },
          k,
          { acts: [], next: 28 }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['rx', 'phenazepam', 'po', 0.5]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_insomnia: {
    ideal: {
      dx: 0,
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'sleep'], ['talk', 'explain'], ['int', 'psychotherapy_cbti']], next: 14 },
            1: { acts: [['dose', 'zopiclone', 3.75]], next: 14 },
            2: { acts: [['stop', 'zopiclone']], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { dx: 1, visit: (k) => at({ 0: { acts: [['stop', 'zopiclone'], ['rx', 'phenazepam', 'po', 1]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_gad_bzd: {
    ideal: {
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'goal'], ['talk', 'alcohol'], ['rx', 'escitalopram', 'po', 5], ['int', 'psychotherapy_cbt']], next: 7 },
            1: { acts: [['dose', 'escitalopram', 10]], next: 14 },
            2: { acts: [['dose', 'phenazepam', 2]], next: 7 },
            3: { acts: [['dose', 'phenazepam', 1.5]], next: 7 },
            4: { acts: [['dose', 'phenazepam', 1]], next: 7 },
            5: { acts: [['dose', 'phenazepam', 0.5]], next: 7 },
            6: { acts: [['stop', 'phenazepam']], next: 14 },
          },
          k,
          { acts: [], next: auto(pt) }
        ),
    },
    bad: { visit: (k) => at({ 0: { acts: [['dose', 'phenazepam', 5]], next: 28 }, 1: { acts: [['stop', 'phenazepam']], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_dep_maint: {
    ideal: {
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'goal'], ['talk', 'explain'], ['rx', 'vortioxetine', 'po', 10], ['dose', 'paroxetine', 10]], next: 14 },
            1: { acts: [['stop', 'paroxetine']], next: 14 },
          },
          k,
          { acts: [], next: 28 }
        ),
    },
    bad: { visit: (k) => at({ 0: { acts: [['stop', 'paroxetine']], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_scz_depot: {
    ideal: {
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'explain'], ['talk', 'family'], ['order', 'prolactin'], ['order', 'glucose']], next: 14 },
            1: { acts: pt.lab.prl > 45 ? [['dose', 'paliperidone', 75]] : [], next: 14 },
          },
          k,
          { acts: [], next: 14 }
        ),
    },
    bad: { visit: (k) => at({ 0: { acts: [['stop', 'paliperidone'], ['rx', 'risperidone', 'po', 4]], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_scz_olz: {
    ideal: {
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'lifestyle'], ['talk', 'goal'], ['order', 'glucose'], ['order', 'lipids'], ['rx', 'aripiprazole', 'po', 5]], next: 7 },
            1: { acts: [['dose', 'aripiprazole', 10], ['dose', 'olanzapine', 10]], next: 14 },
            2: { acts: [['dose', 'olanzapine', 5]], next: 14 },
            3: { acts: [['stop', 'olanzapine']], next: 14 },
          },
          k,
          { acts: [], next: 28 }
        ),
    },
    bad: { visit: (k) => at({ 0: { acts: [['stop', 'olanzapine']], next: 28 } }, k, { acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_scz_cloz: {
    ideal: {
      visit: (k, pt) =>
        at({ 0: { acts: [['talk', 'explain'], ['talk', 'family']], next: 7 } }, k, {
          acts: pt.quitSmoking && pt.rx.some((r) => r.id === 'clozapine' && r.dose > 250) ? [['dose', 'clozapine', 250]] : [],
          next: 14,
        }),
    },
    bad: { visit: (k) => ({ acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_bip_li: {
    ideal: {
      visit: (k, pt) =>
        at({ 0: { acts: [['order', 'lithium'], ['order', 'bio'], ['order', 'tsh'], ['talk', 'explain']], next: 14 } }, k, {
          acts: (pt.meds_home.some((m) => m.tag === 'nsaid') ? [['home', 'nsaid'], ['order', 'lithium']] : []).concat(pt.rx.some((r) => r.id === 'lithium' && r.held) ? [['dose', 'lithium', 750], ['order', 'lithium']] : []),
          next: pt.rx.some((r) => r.id === 'lithium' && r.held) ? 7 : 14,
        }),
    },
    bad: { visit: (k) => ({ acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },

  a_bip_vpa: {
    ideal: {
      visit: (k, pt) =>
        at(
          {
            0: { acts: [['talk', 'pregnancy'], ['talk', 'goal'], ['order', 'hcg'], ['rx', 'lamotrigine', 'po', 12.5]], next: 14 },
            1: { acts: [['dose', 'lamotrigine', 25]], next: 14 },
            2: { acts: [['dose', 'lamotrigine', 50], ['dose', 'valproate', 500]], next: 14 },
            3: { acts: [['dose', 'lamotrigine', 100], ['stop', 'valproate']], next: 14 },
            4: { acts: [['dose', 'lamotrigine', 150]], next: 14 },
            5: { acts: [['dose', 'lamotrigine', 200]], next: 14 },
          },
          k,
          { acts: [], next: 28 }
        ),
    },
    bad: { visit: (k) => ({ acts: [], next: 28 }), monitor: false, decide: 'worst' },
  },
};
