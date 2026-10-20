/* Календарь игры: день 1 — понедельник, 1 сентября. Сутки делятся на четыре части. */
(function (A) {
  'use strict';
  const MONTH_LEN = [30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31]; // сентябрь … август
  const MONTH_IDX = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];
  const C = (A.cal = {
    MONTHS_GEN: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    MONTHS_SHORT: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    WD: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
    WD_SHORT: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
    WD_ACC: ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'],
    SLOTS: ['Утро', 'День', 'Вечер', 'Ночь'],
    SLOTS_LOW: ['утро', 'день', 'вечер', 'ночь'],
    SLOT_TIME: ['8:00', '13:00', '18:00', '23:00'],
    SLOT_WHEN: ['утром', 'днём', 'вечером', 'ночью'],
  });

  C.date = function (day) {
    let d = day - 1;
    let i = 0;
    while (d >= MONTH_LEN[i % 12]) {
      d -= MONTH_LEN[i % 12];
      i++;
    }
    return { d: d + 1, m: MONTH_IDX[i % 12], wd: (day - 1) % 7, week: Math.floor((day - 1) / 7) + 1 };
  };
  /** Номер игрового дня для даты (месяц 0–11, число) первого учебного года. */
  C.dayOf = function (month, dom) {
    let day = 1;
    let i = 0;
    while (MONTH_IDX[i % 12] !== month) {
      day += MONTH_LEN[i % 12];
      i++;
    }
    return day + dom - 1;
  };
  C.wd = (day) => (day - 1) % 7;
  C.isWeekend = (day) => C.wd(day) >= 5;
  C.week = (day) => Math.floor((day - 1) / 7) + 1;
  C.fmt = function (day) {
    const x = C.date(day);
    return x.d + ' ' + C.MONTHS_GEN[x.m] + ', ' + C.WD[x.wd];
  };
  C.fmtShort = function (day) {
    const x = C.date(day);
    return x.d + ' ' + C.MONTHS_SHORT[x.m] + ' · ' + C.WD_SHORT[x.wd];
  };
  C.fmtDate = function (day) {
    const x = C.date(day);
    return x.d + ' ' + C.MONTHS_GEN[x.m];
  };
  C.season = function (day) {
    const m = C.date(day).m;
    if (m >= 8 && m <= 10) return 'autumn';
    if (m === 11 || m <= 1) return 'winter';
    if (m >= 2 && m <= 4) return 'spring';
    return 'summer';
  };
})((window.A = window.A || {}));
