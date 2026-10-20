/* Иконки интерфейса: тонкие линии, цвет — currentColor. */
(function (A) {
  'use strict';
  A.art = A.art || {};
  const P = {
    // «День»: солнце над горизонтом
    map: '<path d="M3 18h18"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0"/><path d="M12 6.5V4M5.6 9.1 4 7.5M18.4 9.1 20 7.5M2.5 13.5h2M19.5 13.5h2"/>',
    // зачётка / удостоверение
    card: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4"/><path d="M14.5 10h3.5M14.5 13h3.5"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/><path d="M11 19h2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    cross: '<path d="M7 7l10 10M17 7 7 17"/>',
    bolt: '<path d="M13 3 5.5 13.5H11l-1 7.5 7.5-10.5H12z"/>',
    heart: '<path d="M12 19.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6c0 5.1-7.5 9.7-7.5 9.7z"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-4.5M8.5 14.5H13"/>',
    star: '<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    cat: '<path d="M5 9.5 5.5 4l4 3.2a8 8 0 0 1 5 0l4-3.2.5 5.5c.6 1 1 2.2 1 3.5 0 4-3.6 6.5-8 6.5S4 17 4 13c0-1.3.4-2.5 1-3.5z"/><path d="M9.2 12.5v.5M14.8 12.5v.5"/><path d="M11 15.2h2l-1 1z"/>',
    warn: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    back: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    next: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
    stamp: '<path d="M9 4.5h6v3.5l-1.5 3h-3L9 8z"/><path d="M5 14.5a3 3 0 0 1 3-3.5h8a3 3 0 0 1 3 3.5V16H5z"/><path d="M4.5 19.5h15"/>',
  };
  A.art.icon = function (name) {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || P.info) + '</svg>';
  };
})((window.A = window.A || {}));
