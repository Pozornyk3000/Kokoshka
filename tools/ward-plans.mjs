/* Сценарии назначений для tools/ward-sim.mjs: ideal — по КР, bad — типичные ошибки, none — без лечения.
   Действия по дням госпитализации: ['rx', id, путь, доза] | ['dose', id, доза] | ['stop', id] | ['int', id] | ['order', тест] | ['home', метка]. */
const MET = [['order', 'ecg'], ['order', 'glucose'], ['order', 'lipids'], ['order', 'weight']];
export const PLANS = {
  _default: {
    none: { days: {}, monitor: false },
  },
  w_scz_first: {
    ideal: { days: { 0: [...MET, ['order', 'tox'], ['rx', 'risperidone', 'po', 2], ['int', 'psychoeducation_family']], 2: [['dose', 'risperidone', 3]], 6: [['dose', 'risperidone', 4]] } },
    olanzapine: { days: { 0: [...MET, ['rx', 'olanzapine', 'po', 10]] } },
    bad: { days: { 0: [['rx', 'haloperidol', 'po', 15], ['rx', 'chlorpromazine', 'po', 200]], 3: [['dose', 'haloperidol', 20]] }, monitor: false },
  },
  w_scz_relapse: {
    ideal: {
      days: {
        0: [...MET, ['rx', 'risperidone', 'po', 2], ['int', 'psychoeducation_family']],
        1: [['dose', 'risperidone', 4]],
        12: [['rx', 'paliperidone', 'depot', 100]],
        14: [['stop', 'risperidone']],
      },
    },
    bad: { days: { 0: [['rx', 'haloperidol', 'po', 10], ['rx', 'trihexyphenidyl', 'po', 4]] }, monitor: false },
  },
  w_scz_resistant: {
    ideal: {
      days: {
        0: [['order', 'cbc'], ['order', 'ecg'], ['order', 'glucose'], ['order', 'weight'], ['int', 'observation_strict'], ['rx', 'clozapine', 'po', 12.5]],
        1: [['dose', 'clozapine', 25]],
        2: [['dose', 'clozapine', 50]],
        4: [['dose', 'clozapine', 100]],
        6: [['dose', 'clozapine', 150], ['dose', 'olanzapine', 15]],
        8: [['dose', 'clozapine', 200]],
        9: [['dose', 'olanzapine', 10]],
        10: [['dose', 'clozapine', 250]],
        12: [['dose', 'clozapine', 300], ['dose', 'olanzapine', 5]],
        15: [['stop', 'olanzapine']],
      },
    },
    bad: { days: { 0: [['rx', 'haloperidol', 'po', 10]] }, monitor: false },
  },
  w_mania_euphoric: {
    ideal: { days: { 0: [...MET, ['rx', 'olanzapine', 'po', 15]] } },
    lithium: {
      days: {
        0: [['home', 'nsaid'], ['order', 'bio'], ['order', 'tsh'], ['order', 'ecg'], ['rx', 'lithium', 'po', 600], ['rx', 'lorazepam', 'po', 2]],
        3: [['dose', 'lithium', 900]],
        8: [['stop', 'lorazepam']],
      },
    },
    bad: { days: { 0: [['rx', 'lithium', 'po', 1200], ['rx', 'haloperidol', 'po', 10]] }, monitor: false },
  },
  w_mania_irritable: {
    ideal: { days: { 0: [['order', 'hcg'], ...MET, ['rx', 'olanzapine', 'po', 15]] } },
    acuphase: { days: { 0: [['order', 'hcg'], ...MET, ['rx', 'zuclopenthixol', 'im', 100], ['rx', 'olanzapine', 'im', 10]], 3: [['rx', 'quetiapine', 'po', 100]], 4: [['dose', 'quetiapine', 200]], 5: [['dose', 'quetiapine', 300]], 6: [['dose', 'quetiapine', 400]] } },
    bad: { days: { 0: [['rx', 'valproate', 'po', 1000]] }, monitor: false },
  },
  w_bipolar_dep: {
    ideal: {
      days: {
        0: [...MET, ['int', 'observation_strict'], ['rx', 'quetiapine', 'po', 50], ['dose', 'paroxetine', 10]],
        1: [['dose', 'quetiapine', 100]],
        2: [['dose', 'quetiapine', 200]],
        3: [['dose', 'quetiapine', 300]],
        7: [['stop', 'paroxetine']],
      },
    },
    bad: { days: { 0: [['dose', 'paroxetine', 40], ['rx', 'amitriptyline', 'po', 75]] }, monitor: false },
  },
  w_dep_elderly: {
    ideal: { days: { 0: [['order', 'ecg'], ['order', 'bio'], ['int', 'observation_strict'], ['int', 'psychotherapy_support'], ['rx', 'mirtazapine', 'po', 15]], 7: [['dose', 'mirtazapine', 30]] } },
    bad: { days: { 0: [['rx', 'amitriptyline', 'po', 75], ['rx', 'diazepam', 'po', 15]] }, monitor: false },
  },
  w_dep_young: {
    ideal: { days: { 0: [['int', 'observation_strict'], ['int', 'psychotherapy_cbt'], ['rx', 'sertraline', 'po', 50]], 14: [['dose', 'sertraline', 100]] } },
    bad: { days: { 0: [['rx', 'amitriptyline', 'po', 150]] }, monitor: false },
  },
  w_dep_psychotic: {
    ideal: {
      days: {
        0: [['order', 'ecg'], ['order', 'bio'], ['int', 'observation_strict'], ['int', 'infusion'], ['rx', 'venlafaxine', 'po', 75], ['rx', 'olanzapine', 'po', 5]],
        3: [['dose', 'venlafaxine', 150], ['dose', 'olanzapine', 10]],
        5: [['int', 'ect']],
      },
    },
    bad: { days: { 0: [['rx', 'amitriptyline', 'po', 75], ['rx', 'haloperidol', 'po', 5]] }, monitor: false },
  },
  w_gad_bzd: {
    ideal: { days: { 0: [['rx', 'escitalopram', 'po', 5], ['int', 'psychotherapy_cbt']], 7: [['dose', 'escitalopram', 10]], 10: [['dose', 'phenazepam', 2.5]], 17: [['dose', 'phenazepam', 2]] } },
    bad: { days: { 0: [['stop', 'phenazepam'], ['rx', 'paroxetine', 'po', 40]] }, monitor: false },
  },
  w_panic: {
    ideal: { days: { 0: [['rx', 'escitalopram', 'po', 5], ['rx', 'hydroxyzine', 'po', 25], ['int', 'psychotherapy_cbt']], 7: [['dose', 'escitalopram', 10], ['stop', 'hydroxyzine']] } },
    bad: { days: { 0: [['rx', 'alprazolam', 'po', 2]] }, monitor: false },
  },
  w_ocd: {
    ideal: { days: { 0: [['dose', 'fluoxetine', 40], ['int', 'exposure_erp']], 7: [['dose', 'fluoxetine', 60]] } },
    bad: { days: { 0: [['rx', 'risperidone', 'po', 2], ['rx', 'clonazepam', 'po', 2]] }, monitor: false },
  },
  w_ptsd: {
    ideal: { days: { 0: [['rx', 'sertraline', 'po', 25], ['int', 'trauma_therapy']], 4: [['dose', 'sertraline', 50]], 11: [['dose', 'sertraline', 100]] } },
    bad: { days: { 0: [['rx', 'phenazepam', 'po', 2]] }, monitor: false },
  },
  w_alc_withdrawal: {
    ideal: {
      days: {
        0: [['rx', 'lorazepam', 'po', 8], ['rx', 'thiamine', 'im', 200], ['int', 'infusion']],
        2: [['dose', 'lorazepam', 6]],
        3: [['dose', 'lorazepam', 4]],
        4: [['dose', 'lorazepam', 2], ['stop', 'infusion']],
        5: [['dose', 'lorazepam', 1]],
        6: [['stop', 'lorazepam'], ['rx', 'naltrexone', 'po', 50]],
      },
      minDays: 6,
    },
    bad: { days: { 0: [['rx', 'haloperidol', 'po', 5], ['int', 'infusion'], ['rx', 'disulfiram', 'po', 250]] }, monitor: false },
  },
  w_dt: {
    ideal: {
      days: {
        0: [['rx', 'lorazepam', 'po', 8], ['rx', 'thiamine', 'im', 500], ['int', 'infusion'], ['int', 'observation_strict']],
        3: [['dose', 'lorazepam', 6]],
        5: [['dose', 'lorazepam', 4], ['stop', 'observation_strict']],
        7: [['dose', 'lorazepam', 2], ['stop', 'infusion']],
        9: [['dose', 'lorazepam', 1]],
        11: [['stop', 'lorazepam']],
      },
      minDays: 11,
    },
    bad: { days: { 0: [['rx', 'chlorpromazine', 'po', 100], ['int', 'infusion']] }, monitor: false },
  },
  w_dementia: {
    ideal: {
      days: {
        0: [['int', 'dementia_care'], ['stop', 'chlorprothixene'], ['dose', 'phenazepam', 0.5], ['order', 'ecg'], ['rx', 'donepezil', 'po', 5]],
        6: [['stop', 'phenazepam']],
      },
    },
    bad: { days: { 0: [['rx', 'haloperidol', 'po', 3], ['dose', 'phenazepam', 2]] }, monitor: false },
  },
  w_bpd: {
    ideal: {
      days: {
        0: [['int', 'observation_strict'], ['int', 'psychotherapy_dbt'], ['int', 'psychotherapy_support'], ['dose', 'alprazolam', 0.75], ['stop', 'fluoxetine']],
        4: [['dose', 'alprazolam', 0.5], ['stop', 'observation_strict']],
        7: [['dose', 'alprazolam', 0.25]],
        9: [['stop', 'alprazolam']],
      },
    },
    bad: { days: { 0: [['rx', 'diazepam', 'po', 15], ['rx', 'olanzapine', 'po', 10]] }, monitor: false },
  },
};
