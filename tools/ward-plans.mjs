/* Сценарии назначений для tools/ward-sim.mjs: ideal — по КР, bad — типичные ошибки, none — без лечения. */
export const PLANS = {
  _default: {
    none: { days: {}, monitor: false },
  },
  w_scz_first: {
    ideal: {
      days: {
        0: [['order', 'ecg'], ['order', 'glucose'], ['order', 'lipids'], ['order', 'weight'], ['order', 'tox'], ['rx', 'risperidone', 'po', 2], ['int', 'psychoeducation_family']],
        2: [['dose', 'risperidone', 3]],
        6: [['dose', 'risperidone', 4]],
      },
    },
    olanzapine: {
      days: {
        0: [['order', 'ecg'], ['order', 'glucose'], ['order', 'lipids'], ['order', 'weight'], ['rx', 'olanzapine', 'po', 10]],
      },
    },
    bad: {
      days: {
        0: [['rx', 'haloperidol', 'po', 15], ['rx', 'chlorpromazine', 'po', 200]],
        3: [['dose', 'haloperidol', 20]],
      },
      monitor: false,
    },
  },
  w_gad_bzd: {
    ideal: {
      days: {
        0: [['rx', 'escitalopram', 'po', 5], ['int', 'psychotherapy_cbt']],
        7: [['dose', 'escitalopram', 10]],
        10: [['dose', 'phenazepam', 2.5]],
        17: [['dose', 'phenazepam', 2]],
      },
    },
    bad: {
      days: {
        0: [['stop', 'phenazepam'], ['rx', 'paroxetine', 'po', 40]],
      },
      monitor: false,
    },
  },
};
