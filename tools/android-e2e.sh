#!/usr/bin/env bash
# Проверка APK на эмуляторе Android. Запускается в GitHub Actions внутри android-emulator-runner:
#   bash tools/android-e2e.sh <каталог с anamnez.apk и anamnez-debug.apk> <метка>
# Отладочная сборка проверяется глубоко (игра проходится через DevTools), релизная — запуском.
# Скриншоты и журналы складываются в e2e-out/<метка>/.
set -uo pipefail

APKS=${1:-out}
LABEL=${2:-emulator}
RES="e2e-out/$LABEL"
PKG=io.github.pozornyk3000.anamnez
ACT="$PKG/.MainActivity"
mkdir -p "$RES"
FAILS=0
ADB_BIN=$(command -v adb)
BG=()

err() { echo "::error::[$LABEL] $*"; FAILS=$((FAILS + 1)); }
# Каждый вызов adb ограничен по времени: если эмулятор пропадёт, adb иначе ждёт устройство бесконечно
adb() { timeout "${ADB_T:-90}" "$ADB_BIN" "$@"; }
alive() { [ "$(timeout 15 "$ADB_BIN" get-state 2>/dev/null | tr -d '\r')" = "device" ]; }
shot() { adb exec-out screencap -p > "$RES/$1.png" 2>/dev/null || true; }
check() { timeout 150 node tools/android-check.cjs "$@"; }
pid() { adb shell pidof "$PKG" 2>/dev/null | tr -d '\r'; }

stop_bg() {
  for p in ${BG[@]+"${BG[@]}"}; do
    pkill -P "$p" 2> /dev/null
    kill "$p" 2> /dev/null
  done
  BG=()
}
trap stop_bg EXIT

# Фоном: память машины, эмулятора и устройства раз в 10 с и журнал устройства — чтобы при падении было видно причину
start_watch() {
  (
    while :; do
      host=$(free -m | awk '/^Mem:/ {print $7}')
      emu=$(ps -eo rss=,comm= | awk '/qemu-system/ {s += $1} END {printf "%d", s / 1024}')
      guest=$(timeout 5 "$ADB_BIN" shell "grep MemAvailable /proc/meminfo" 2> /dev/null | awk '{printf "%d", $2 / 1024}')
      echo "$(date +%T) машина: свободно ${host} МБ; эмулятор: ${emu} МБ; устройство: свободно ${guest:-?} МБ; нагрузка $(cut -d' ' -f1 /proc/loadavg)"
      sleep 10
    done
  ) > "$RES/watch.txt" 2>&1 &
  BG+=($!)
  "$ADB_BIN" logcat -v time '*:I' > "$RES/logcat-all.txt" 2>&1 &
  BG+=($!)
}

# Эмулятор пропал: напечатать, что известно, и сразу закончить (иначе задача висит до тайм-аута)
gone_check() {
  alive && return 0
  echo "::error::[$LABEL] эмулятор пропал: adb не видит устройство"
  stop_bg
  echo "--- память машины"
  free -m
  ps -eo pid,rss,etime,args --sort=-rss | head -6 | cut -c1-160
  echo "--- ядро машины (нехватка памяти)"
  sudo -n dmesg -T 2> /dev/null | grep -iE "out of memory|killed process|oom" | tail -10
  if [ -s "$RES/watch.txt" ]; then
    echo "--- память по ходу проверки"
    tail -15 "$RES/watch.txt"
  fi
  if [ -s "$RES/logcat-all.txt" ]; then
    echo "--- журнал устройства перед падением"
    grep -E " [EF]/|lowmemorykiller|lmkd|am_kill|Killing |ANR in|FATAL|Fatal signal|AnamnezWeb" "$RES/logcat-all.txt" | tail -40 | cut -c1-240
  fi
  echo
  echo "[$LABEL] Проверки прерваны: эмулятор не отвечает."
  exit 1
}

step() {
  echo
  echo "=== [$LABEL] $*"
  gone_check
}

launch() {
  adb shell am start -W -n "$ACT" > /dev/null 2>&1
}

# Ждать в журнале строку «Anamnez: ready=…» (её пишет MainActivity, когда страница загрузилась)
wait_ready() {
  for _ in $(seq 1 60); do
    alive || return 1
    if adb logcat -d -s Anamnez:I 2>/dev/null | grep -q "ready="; then
      adb logcat -d -s Anamnez:I | grep "ready=" | tail -1
      return 0
    fi
    sleep 1
  done
  return 1
}

# Дождаться, когда у процесса приложения появится сокет отладки WebView (к нему подключается Playwright)
devtools() {
  local p=""
  for _ in $(seq 1 40); do
    alive || return 1
    p=$(pid)
    if [ -n "$p" ] && adb shell cat /proc/net/unix 2>/dev/null | grep -q "webview_devtools_remote_$p"; then
      export SOCK="webview_devtools_remote_$p"
      return 0
    fi
    sleep 1
  done
  return 1
}

# Флаги пакета из dumpsys: у отладочной сборки есть DEBUGGABLE, у релизной — нет
pkg_flags() {
  adb shell dumpsys package "$PKG" 2>/dev/null | grep -E "flags=\[" | tr -d '\r'
}

fresh_start() {
  adb logcat -c
  launch
  wait_ready || err "страница не загрузилась (нет «ready=» в журнале)"
}

step "Устройство"
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell dumpsys webviewupdate 2>/dev/null | grep -iE "current webview package|valid package" | head -3 | tee "$RES/webview.txt"

# ---------------------------------------------------------------- отладочная сборка
step "1. Отладочная сборка: установка и запуск"
adb uninstall "$PKG" > /dev/null 2>&1 || true
ADB_T=300 adb install -r "$APKS/anamnez-debug.apk" || err "не установилась отладочная сборка"
fresh_start
devtools || err "у WebView нет сокета отладки"
pkg_flags | tee "$RES/flags-debug.txt"
grep -q DEBUGGABLE "$RES/flags-debug.txt" || echo "::warning::[$LABEL] не вижу флага DEBUGGABLE у отладочной сборки — проверка релиза ниже может быть неточной"
check info | tee "$RES/info.json" || err "страница не ответила"
grep -q '"localStorage":true' "$RES/info.json" || err "localStorage недоступен"
grep -q '"displayFont":true' "$RES/info.json" || err "шрифт Oranienbaum не загрузился"
grep -q '"textFont":true' "$RES/info.json" || err "шрифт Golos Text не загрузился"
shot 01-title

step "2. Автоигрок проходит первые дни прямо в приложении"
start_watch
timeout 900 node tools/autoplay.cjs - 320 --android "$PKG" --smart --days 8 --shots "$RES/play" 2>&1 | tee "$RES/autoplay.txt"
[ "${PIPESTATUS[0]}" -eq 0 ] || err "автоигрок нашёл ошибки"
gone_check
echo "память по ходу игры:"
sed -n '1p;$p' "$RES/watch.txt"
shot 02-after-play

step "3. Сохранение переживает мгновенное закрытие приложения"
KEY=$(check eval "A.state ? A.state.day * 4 + A.state.slot : -1")
echo "позиция в игре: $KEY"
adb shell am force-stop "$PKG"
fresh_start
devtools || err "DevTools после перезапуска"
GOT=$(check eval "A.boot.save ? A.boot.save.day * 4 + A.boot.save.slot : -2")
echo "после перезапуска: $GOT"
[[ "$KEY" =~ ^[0-9]+$ ]] && [ "$KEY" = "$GOT" ] || err "сохранение потерялось при закрытии (было '$KEY', стало '$GOT')"
check eval "!!AnamnezAndroid.storeGet('anamnez.save.v1')" | grep -q true || err "нет файла сохранения в приложении"
shot 03-after-restart

step "4. Кнопка «назад»"
check click '[data-act="continue"]' > /dev/null || err "нет кнопки «Продолжить»"
# если сейчас идёт пара или приём — довести до экрана дня не пытаемся, проверяем вкладки, только когда это экран дня
if [ "$(check eval '!A.state.activity')" = "true" ]; then
  check click '[data-act="tab"][data-arg="menu"]' > /dev/null
  shot 04-menu
  adb shell input keyevent KEYCODE_BACK
  sleep 1
  [ "$(check eval 'A.ui.view.tab')" = "hub" ] || err "«назад» на вкладке меню не вернул на экран дня"
  check eval "window.__e2eMarker = 42" > /dev/null
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  adb shell dumpsys window 2>/dev/null | grep -E "mCurrentFocus" | tee "$RES/focus.txt"
  grep -q "$PKG" "$RES/focus.txt" && err "«назад» на экране дня не свернул приложение"
  launch
  sleep 2
  devtools || err "DevTools после возврата"
  [ "$(check eval 'window.__e2eMarker')" = "42" ] || err "после сворачивания игра перезагрузилась"
else
  echo "игра внутри занятия — проверка вкладок пропущена"
  check eval "window.__e2eMarker = 42" > /dev/null
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  adb shell dumpsys window 2>/dev/null | grep -E "mCurrentFocus" | tee "$RES/focus.txt"
  grep -q "$PKG" "$RES/focus.txt" && err "«назад» во время занятия не свернул приложение"
  launch
  sleep 2
  devtools || err "DevTools после возврата"
  [ "$(check eval 'window.__e2eMarker')" = "42" ] || err "после сворачивания игра перезагрузилась"
fi

step "5. Мост приложения"
check eval "AnamnezAndroid.copyText('проверка')" | grep -q true || err "копирование в буфер обмена не работает"
check eval "AnamnezAndroid.version()" | tee "$RES/version.txt"

step "6. Тёмная тема системы"
adb logcat -c
adb shell cmd uimode night yes
wait_ready || err "после смены темы страница не перезагрузилась"
sleep 1
devtools || err "DevTools после смены темы"
check eval "[matchMedia('(prefers-color-scheme: dark)').matches, document.documentElement.getAttribute('data-theme'), getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()].join(' ')" | tee "$RES/dark.txt"
grep -qi "#16201d" "$RES/dark.txt" || err "тёмная тема не дошла до игры"
GOT=$(check eval "A.state ? A.state.day * 4 + A.state.slot : -2")
echo "после смены темы: $GOT"
[[ "$GOT" =~ ^[0-9]+$ ]] && [ "$GOT" -ge "$KEY" ] || err "после смены темы игра не продолжилась сама (позиция '$GOT')"
shot 05-dark-game
check click '[data-act="tab"][data-arg="menu"]' > /dev/null 2>&1 && sleep 1 && shot 06-dark-menu
adb logcat -c
adb shell cmd uimode night no
wait_ready > /dev/null || true
sleep 1

adb logcat -d > "$RES/logcat-debug.txt" 2>/dev/null
grep -E "AnamnezWeb.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "$RES/logcat-debug.txt" && err "ошибки JavaScript в журнале (отладочная сборка)"
grep -A 3 "FATAL EXCEPTION" "$RES/logcat-debug.txt" | grep -q "Process: $PKG" && err "приложение падало"

# ---------------------------------------------------------------- релизная сборка
step "7. Релизная сборка: установка и запуск"
adb uninstall "$PKG" > /dev/null 2>&1 || true
ADB_T=300 adb install "$APKS/anamnez.apk" || err "не установилась релизная сборка"
fresh_start
sleep 2
shot 07-release-title
adb logcat -d > "$RES/logcat-release.txt" 2>/dev/null
grep -q "ready=true" "$RES/logcat-release.txt" || err "игра в релизной сборке не запустилась"
grep -E "AnamnezWeb.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "$RES/logcat-release.txt" && err "ошибки JavaScript в журнале (релиз)"
grep -A 3 "FATAL EXCEPTION" "$RES/logcat-release.txt" | grep -q "Process: $PKG" && err "релизная сборка падала"
pkg_flags | tee "$RES/flags-release.txt"
grep -q DEBUGGABLE "$RES/flags-release.txt" && err "релизная сборка отлаживаемая"
adb shell dumpsys package "$PKG" | grep -E "versionCode|versionName|targetSdk" | head -3 | tee "$RES/package.txt"

stop_bg
echo
echo "::group::[$LABEL] Память по ходу проверки"
cat "$RES/watch.txt"
echo "::endgroup::"
if [ "$FAILS" -gt 0 ]; then
  echo "[$LABEL] Проверок не пройдено: $FAILS"
  exit 1
fi
echo "[$LABEL] Все проверки на эмуляторе пройдены."
