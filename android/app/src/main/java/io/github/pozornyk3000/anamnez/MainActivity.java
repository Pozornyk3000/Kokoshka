package io.github.pozornyk3000.anamnez;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * «Анамнез» для Android: одно окно с WebView. Игра лежит в assets/www и открывается по адресу
 * https://appassets.androidplatform.net/ — этот домен зарезервирован для локальных файлов WebView
 * и никогда не уходит в сеть. Настоящий https-адрес нужен, чтобы у страницы был постоянный origin:
 * от него зависит localStorage, где хранятся сохранения.
 */
public class MainActivity extends Activity {
    static final String TAG = "Anamnez";
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/index.html";

    private FrameLayout root;
    private WebView web;
    private ClipboardManager clipboard;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);

        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.paper));
        if (Build.VERSION.SDK_INT >= 35) {
            // Android 15+ рисует окно под системными панелями: отодвигаем игру от них и от клавиатуры
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets i = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(root);
        styleSystemBars();
        // Окно пересоздано (смена темы, возврат после выгрузки системой) — игра продолжится сама, без титульного экрана
        createWebView(savedInstanceState != null);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createWebView(boolean resume) {
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        try {
            WebView.setWebContentsDebuggingEnabled(debuggable);
            web = new WebView(this);
        } catch (RuntimeException e) {
            // Нет системного WebView (отключён или обновляется) — объясняем, вместо того чтобы упасть
            Log.e(TAG, "WebView недоступен", e);
            web = null;
            TextView t = new TextView(this);
            int pad = Math.round(24 * getResources().getDisplayMetrics().density);
            t.setPadding(pad, pad, pad, pad);
            t.setTextSize(17);
            t.setText(R.string.no_webview);
            root.addView(t);
            return;
        }
        web.setBackgroundColor(getColor(R.color.paper));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(textZoom());

        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                int level = m.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR : Log.INFO;
                Log.println(level, TAG + "Web", m.message() + " @" + m.lineNumber());
                return true;
            }
        });
        // Объект доступен странице до запуска её скриптов: игра по нему понимает, что она в приложении
        web.addJavascriptInterface(new Bridge(), "AnamnezAndroid");
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl(resume ? START_URL + "#resume" : START_URL);
    }

    /** Системный размер шрифта учитываем, но в разумных пределах, чтобы не ломалась вёрстка. В игре есть свой «Крупный текст». */
    private int textZoom() {
        int z = Math.round(getResources().getConfiguration().fontScale * 100f);
        return Math.max(85, Math.min(130, z));
    }

    @SuppressWarnings("deprecation")
    private void styleSystemBars() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        Window w = getWindow();
        int paper = getColor(R.color.paper);
        w.setStatusBarColor(paper);
        // До Android 8 кнопки навигации всегда белые: на светлой панели их не видно, поэтому панель чёрная
        w.setNavigationBarColor(Build.VERSION.SDK_INT < 26 && !night ? Color.BLACK : paper);
        if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(night ? 0 : mask, mask);
            }
        } else {
            View d = w.getDecorView();
            int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
            int f = d.getSystemUiVisibility();
            d.setSystemUiVisibility(night ? (f & ~light) : (f | light));
        }
    }

    /** «Назад»: сначала спрашиваем игру (закрыть окно, вернуться на экран дня), иначе сворачиваемся — игра не теряется. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript(
                "(function(){try{return !!(window.A&&A.ui&&A.ui.back&&A.ui.back())}catch(e){return false}})()",
                v -> {
                    if (!"true".equals(v)) moveTaskToBack(true);
                });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            // Страховка: игра и так сохраняется после каждого действия
            web.evaluateJavascript("try{if(window.A&&A.state&&A.store)A.store.writeLocal('save',A.state)}catch(e){}", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        destroyWebView();
        super.onDestroy();
    }

    private void destroyWebView() {
        if (web == null) return;
        root.removeView(web);
        web.destroy();
        web = null;
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private void openExternal(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http") && !scheme.equals("tel") && !scheme.equals("mailto")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Нечем открыть " + u);
        }
    }

    /* ---------- Файлы игры из assets/www ---------- */

    private static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".woff2")) return "font/woff2";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".webmanifest") || n.endsWith(".json")) return "application/json";
        if (n.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    private WebResourceResponse asset(String path) {
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        if (path.contains("..")) return status(404, "Not Found");
        String name = "www" + path;
        try {
            InputStream in = getAssets().open(name);
            String type = mime(name);
            boolean text = type.startsWith("text/") || type.equals("application/json") || type.equals("image/svg+xml");
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(type, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return status(404, "Not Found");
        }
    }

    private final class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return asset(u.getPath());
            // Игре сеть не нужна: всё остальное не загружаем
            return status(403, "Offline");
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
            openExternal(u);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            view.evaluateJavascript("!!(window.A&&A.ui&&A.ui.render)", v -> Log.i(TAG, "ready=" + v + " " + url));
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // Движок страницы упал или был выгружен системой: создаём WebView заново, сохранение подхватится
            Log.w(TAG, "WebView renderer gone, crash=" + detail.didCrash());
            if (view == web) {
                destroyWebView();
                createWebView(true);
            } else {
                view.destroy();
            }
            return true;
        }
    }

    /** Мост для страницы: window.AnamnezAndroid. Методы вызываются не из главного потока. */
    private final class Bridge {
        @JavascriptInterface
        public boolean copyText(String text) {
            try {
                if (clipboard == null) return false;
                clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.share_title), text));
                return true;
            } catch (RuntimeException e) {
                Log.w(TAG, "clipboard", e);
                return false;
            }
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
                try {
                    startActivity(Intent.createChooser(send, getString(R.string.share_title)));
                } catch (ActivityNotFoundException e) {
                    Log.w(TAG, "Нечем поделиться");
                }
            });
        }

        @JavascriptInterface
        public String version() {
            return versionName();
        }

        /** Тёмная ли тема системы. Старые WebView (до ~103) не передают её странице через
            prefers-color-scheme, поэтому игра спрашивает напрямую и ставит data-theme сама. */
        @JavascriptInterface
        public boolean night() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        }

        /* Сохранения игры в файлах приложения. Запись атомарная и сразу на диск:
           сначала во временный файл, потом переименование поверх старого. */

        @JavascriptInterface
        public boolean storeSet(String key, String value) {
            File f = storeFile(key);
            if (f == null || value == null) return false;
            synchronized (MainActivity.class) {
                File tmp = new File(f.getPath() + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(value.getBytes(StandardCharsets.UTF_8));
                    out.getFD().sync();
                } catch (IOException e) {
                    Log.w(TAG, "storeSet " + key, e);
                    return false;
                }
                return tmp.renameTo(f);
            }
        }

        @JavascriptInterface
        public String storeGet(String key) {
            File f = storeFile(key);
            if (f == null || !f.isFile()) return null;
            synchronized (MainActivity.class) {
                try (InputStream in = new FileInputStream(f)) {
                    ByteArrayOutputStream buf = new ByteArrayOutputStream((int) Math.max(1024, f.length()));
                    byte[] chunk = new byte[16384];
                    int n;
                    while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                    return new String(buf.toByteArray(), StandardCharsets.UTF_8);
                } catch (IOException e) {
                    Log.w(TAG, "storeGet " + key, e);
                    return null;
                }
            }
        }

        @JavascriptInterface
        public void storeRemove(String key) {
            File f = storeFile(key);
            if (f == null) return;
            synchronized (MainActivity.class) {
                if (f.exists() && !f.delete()) Log.w(TAG, "storeRemove " + key);
            }
        }
    }

    /** Файл для ключа вида «anamnez.save.v1»; любые другие символы в ключе не допускаем. */
    private File storeFile(String key) {
        if (key == null || !key.matches("[A-Za-z0-9._-]{1,64}")) return null;
        File dir = new File(getFilesDir(), "saves");
        if (!dir.isDirectory() && !dir.mkdirs()) return null;
        return new File(dir, key + ".json");
    }
}
