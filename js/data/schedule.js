/* Расписание семестра: учебные дни (будни недель 1–3) → лекция утром и семинар-разбор днём. */
(function (A) {
  'use strict';
  const D = (A.data = A.data || {});
  D.schedule = [
    { day: 1, lecture: 'l01', seminar: 'c_adjust' },
    { day: 2, lecture: 'l02', seminar: 'c_bonnet' },
    { day: 3, lecture: 'l03', seminar: 'c_delusional' },
    { day: 4, lecture: 'l04', seminar: 'c_korsakoff' },
    { day: 5, lecture: 'l05', seminar: 'c_depression' },
    { day: 8, lecture: 'l06', seminar: 'c_schizo_first' },
    { day: 9, lecture: 'l07', seminar: 'c_panic' },
    { day: 10, lecture: 'l08', seminar: 'c_ptsd' },
    { day: 11, lecture: 'l09', seminar: 'c_dt' },
    { day: 12, lecture: 'l10', seminar: 'c_alzheimer' },
    { day: 15, lecture: 'l11', seminar: 'c_lithium' },
    { day: 16, lecture: 'l12', seminar: 'c_nms' },
    { day: 17, lecture: 'l13', seminar: 'c_adhd' },
    { day: 18, lecture: 'l14', seminar: 'c_bpd' },
    { day: 19, lecture: 'l15', seminar: 'c_mania' },
  ];

  /** Индексы по id — строятся после загрузки всех файлов данных. */
  D.index = function () {
    D.lectures = (D.lectures || []).slice().sort((a, b) => a.n - b.n);
    D.lectureById = {};
    D.lectures.forEach((L) => (D.lectureById[L.id] = L));
    D.cases = D.cases || [];
    D.caseById = {};
    D.cases.forEach((c) => (D.caseById[c.id] = c));
    D.minis = D.minis || [];
    D.miniById = {};
    D.minis.forEach((m) => (D.miniById[m.id] = m));
  };
})((window.A = window.A || {}));
