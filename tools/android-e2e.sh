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

step() { echo; echo "=== [$LABEL] $*"; }
err() { echo "::error::[$LABEL] $*"; FAILS=$((FAILS + 1)); }
shot() { adb exec-out screencap -p > "$RES/$1.png" 2>/dev/null || true; }
check() { node tools/android-check.cjs "$@"; }
pid() { adb shell pidof "$PKG" 2>/dev/null | tr -d '\r'; }

launch() {
  adb shell am start -W -n "$ACT" > /dev/null 2>&1
}

# Ждать в журнале строку «Anamnez: ready=…» (её пишет MainActivity, когда страница загрузилась)
wait_ready() {
  for _ in $(seq 1 60); do
    if adb logcat -d -s Anamnez:I 2>/dev/null | grep -q "ready="; then
      adb logcat -d -s Anamnez:I | grep "ready=" | tail -1
      return 0
    fi
    sleep 1
  done
  return 1
}

# Пробросить DevTools текущего процесса приложения на 127.0.0.1:9222
devtools() {
  local p=""
  for _ in $(seq 1 30); do
    p=$(pid)
    [ -n "$p" ] && break
    sleep 1
  done
  [ -n "$p" ] || return 1
  adb forward --remove-all > /dev/null 2>&1
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$p" > /dev/null || return 1
  for _ in $(seq 1 30); do
    curl -sf http://127.0.0.1:9222/json/version > "$RES/devtools.json" && return 0
    sleep 1
  done
  return 1
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
adb install -r "$APKS/anamnez-debug.apk" || err "не установилась отладочная сборка"
fresh_start
devtools || err "не удалось подключиться к WebView через DevTools"
check info | tee "$RES/info.json" || err "страница не ответила"
grep -q '"localStorage":true' "$RES/info.json" || err "localStorage недоступен"
grep -q '"displayFont":true' "$RES/info.json" || err "шрифт Oranienbaum не загрузился"
grep -q '"textFont":true' "$RES/info.json" || err "шрифт Golos Text не загрузился"
shot 01-title

step "2. Автоигрок проходит первые дни прямо в приложении"
node tools/autoplay.cjs - 320 --cdp http://127.0.0.1:9222 --smart --days 8 --shots "$RES/play" 2>&1 | tee "$RES/autoplay.txt"
[ "${PIPESTATUS[0]}" -eq 0 ] || err "автоигрок нашёл ошибки"
shot 02-after-play

step "3. Сохранение переживает мгновенное закрытие приложения"
KEY=$(check eval "A.state ? A.state.day * 4 + A.state.slot : -1")
echo "позиция в игре: $KEY"
adb shell am force-stop "$PKG"
fresh_start
devtools || err "DevTools после перезапуска"
GOT=$(check eval "A.boot.save ? A.boot.save.day * 4 + A.boot.save.slot : -2")
echo "после перезапуска: $GOT"
[ "$KEY" = "$GOT" ] && [ "$KEY" != "-1" ] || err "сохранение потерялось при закрытии (было $KEY, стало $GOT)"
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
adb shell cmd uimode night yes
sleep 5
devtools || err "DevTools после смены темы"
[ "$(check eval "matchMedia('(prefers-color-scheme: dark)').matches")" = "true" ] || err "тёмная тема не дошла до игры"
GOT=$(check eval "A.boot.save ? A.boot.save.day * 4 + A.boot.save.slot : -2")
[ "$GOT" = "$KEY" ] || [ "$GOT" -ge "$KEY" ] 2>/dev/null || err "после смены темы пропало сохранение"
shot 05-dark-title
check click '[data-act="continue"]' > /dev/null && sleep 1 && shot 06-dark-game
adb shell cmd uimode night no
sleep 3

adb logcat -d > "$RES/logcat-debug.txt" 2>/dev/null
grep -E "AnamnezWeb.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "$RES/logcat-debug.txt" && err "ошибки JavaScript в журнале (отладочная сборка)"
grep -E "FATAL EXCEPTION" -A 12 "$RES/logcat-debug.txt" && err "приложение падало"

# ---------------------------------------------------------------- релизная сборка
step "7. Релизная сборка: установка и запуск"
adb uninstall "$PKG" > /dev/null 2>&1 || true
adb install "$APKS/anamnez.apk" || err "не установилась релизная сборка"
fresh_start
sleep 2
shot 07-release-title
adb logcat -d > "$RES/logcat-release.txt" 2>/dev/null
grep -q "ready=true" "$RES/logcat-release.txt" || err "игра в релизной сборке не запустилась"
grep -E "AnamnezWeb.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "$RES/logcat-release.txt" && err "ошибки JavaScript в журнале (релиз)"
grep -E "FATAL EXCEPTION" -A 12 "$RES/logcat-release.txt" && err "релизная сборка падала"
adb shell run-as "$PKG" true 2>&1 | grep -qi "not debuggable" || err "релизная сборка отлаживаемая"
adb shell dumpsys package "$PKG" | grep -E "versionCode|versionName|targetSdk" | head -3 | tee "$RES/package.txt"

echo
if [ "$FAILS" -gt 0 ]; then
  echo "[$LABEL] Проверок не пройдено: $FAILS"
  exit 1
fi
echo "[$LABEL] Все проверки на эмуляторе пройдены."
