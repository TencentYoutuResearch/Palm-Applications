// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palmracer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import com.edgesenseai.palm.core.WebViewBridge;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.net.ssl.HttpsURLConnection;

import com.edgesenseai.palmracer.util.HttpUtils;

/**
 * MainActivity is the single Activity for Palm Racer.
 *
 * It hosts a full-screen, hardware-accelerated WebView that loads the game
 * from bundled assets via WebViewAssetLoader. The Activity also creates
 * a {@link WebViewBridge} and a {@link PalmRacerBridge} to expose native
 * capabilities (palm recognition / verification, device info) to the web layer.
 */
public class MainActivity extends AppCompatActivity {

  private static final String TAG = "PalmRacerMain";
  private static final String ASSET_URL = "https://appassets.androidplatform.net/assets/web/index.html";

  /**
   * API 代理路径前缀。WebView 中发往此路径的请求会被 Native 层拦截并转发到真实后端，
   * 从而绕过 CORS 限制（WebView origin 是 appassets.androidplatform.net）。
   */
  private static final String API_PROXY_PREFIX = "/api-proxy/";

  /**
   * 真实后端 API 地址。Native 层会将 /api-proxy/xxx 转发到此地址的 /api/xxx。
   */
  private String apiBackendBaseURL;

  private WebView webView;
  private FrameLayout rootLayout;
  private WebViewBridge bridge;
  private PalmRacerBridge palmRacerBridge;

  private PermissionRequest pendingPermissionRequest;
  private android.hardware.display.DisplayManager displayManager;
  private int lastRotation = -1;
  private ViewTreeObserver.OnGlobalLayoutListener keyboardLayoutListener;

  private final ActivityResultLauncher<String> cameraPermissionLauncher =
      registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
        if (pendingPermissionRequest != null) {
          if (granted) {
            pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
          } else {
            pendingPermissionRequest.deny();
          }
          pendingPermissionRequest = null;
        }
      });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    // 从 SharedPreferences 读取后端地址，默认使用 BuildConfig 中的配置
    apiBackendBaseURL = getSharedPreferences("palm_racer", 0)
        .getString("api_base_url", BuildConfig.DEFAULT_API_BASE_URL);
    // 确保不以 / 结尾
    if (apiBackendBaseURL.endsWith("/")) {
      apiBackendBaseURL = apiBackendBaseURL.substring(0, apiBackendBaseURL.length() - 1);
    }
    Log.d(TAG, "API backend base URL: " + apiBackendBaseURL);

    webView = new WebView(this);
    rootLayout = new FrameLayout(this);
    rootLayout.addView(webView, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT));
    setContentView(rootLayout);

    setupKeyboardListener();
    setupWebView();
    setupBridges();

    // 公有云环境：无需认证，直接加载 App
    Log.d(TAG, "Loading app directly");
    webView.loadUrl(ASSET_URL);

    // 异步检查 App 版本更新（不阻塞主流程）
    new AppUpdateChecker(this, apiBackendBaseURL).check();

    // Monitor display rotation changes (sensorLandscape: ROTATION_90 ↔ ROTATION_270)
    displayManager = (android.hardware.display.DisplayManager) getSystemService(DISPLAY_SERVICE);
    lastRotation = getWindowManager().getDefaultDisplay().getRotation();
    displayManager.registerDisplayListener(new android.hardware.display.DisplayManager.DisplayListener() {
      @Override
      public void onDisplayChanged(int displayId) {
        int newRotation = getWindowManager().getDefaultDisplay().getRotation();
        if (newRotation != lastRotation) {
          Log.d(TAG, "Display rotation changed: " + lastRotation + " -> " + newRotation);
          lastRotation = newRotation;
          if (palmRacerBridge != null) {
            palmRacerBridge.updateRotation(newRotation);
          }
        }
      }

      @Override
      public void onDisplayAdded(int displayId) {}

      @Override
      public void onDisplayRemoved(int displayId) {}
    }, null);
  }

  @Override
  protected void onResume() {
    super.onResume();
    enterImmersiveMode();
    if (bridge != null) {
      bridge.broadcast(WebViewBridge.Event.APP_RESUME, null);
    }
    // Update hand tracker rotation on resume (in case orientation changed)
    if (palmRacerBridge != null) {
      palmRacerBridge.updateRotation(getWindowManager().getDefaultDisplay().getRotation());
    }
  }

  @Override
  protected void onPause() {
    super.onPause();
    if (bridge != null) {
      bridge.broadcast(WebViewBridge.Event.APP_PAUSE, null);
    }
  }

  @Override
  public void onConfigurationChanged(@NonNull android.content.res.Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    // Update hand tracker rotation when screen rotates
    if (palmRacerBridge != null) {
      palmRacerBridge.updateRotation(getWindowManager().getDefaultDisplay().getRotation());
    }
    enterImmersiveMode();
  }

  @Override
  protected void onDestroy() {
    if (palmRacerBridge != null) {
      palmRacerBridge.destroy();
    }
    if (bridge != null) {
      bridge.destroy();
    }
    if (webView != null) {
      webView.destroy();
    }
    super.onDestroy();
  }

  // ---------------------------------------------------------------------------
  // Back button
  // ---------------------------------------------------------------------------

  @SuppressWarnings("deprecation")
  @Override
  public void onBackPressed() {
    if (webView != null) {
      // Ask WebView JS to handle back navigation.
      // JS will call history.back() if appropriate, or do nothing (let app exit).
      webView.evaluateJavascript(
          "(function() {"
          + "  var path = window.location.hash || window.location.pathname;"
          + "  if (path === '#/' || path === '/' || path === '#/login'"
          + "      || path.indexOf('/login') !== -1) {"
          + "    return 'exit';"
          + "  } else if (path === '#/menu' || path.indexOf('/menu') !== -1) {"
          + "    window.location.hash = '#/login';"
          + "    return 'login';"
          + "  } else {"
          + "    window.history.back();"
          + "    return 'back';"
          + "  }"
          + "})()",
          value -> {
            if (value != null && value.contains("exit")) {
              finish();
            }
          }
      );
    } else {
      super.onBackPressed();
    }
  }

  // ---------------------------------------------------------------------------
  // WebView setup
  // ---------------------------------------------------------------------------

  @SuppressLint("SetJavaScriptEnabled")
  private void setupWebView() {
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setSupportZoom(false);

    // 允许从 HTTPS 页面（appassets.androidplatform.net）发起 HTTP 请求
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

    // Hardware acceleration is set at the window level by the manifest theme;
    // enabling it on the view layer as well for WebGL.
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

    // 仅在 Debug 构建时启用 WebView 调试，Release 版本关闭以提升性能
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

    // Asset loader — serves files from assets/web/ under the appassets domain.
    WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
        .build();

    webView.setWebViewClient(new WebViewClient() {

      @Override
      @Nullable
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String path = request.getUrl().getPath();

        // ---------------------------------------------------------------
        // API 代理：拦截 /api-proxy/xxx 请求，由 Native 层转发到真实后端
        // 这样 WebView 中的 JS 发起的是同源请求，不会触发 CORS
        // ---------------------------------------------------------------
        if (path != null && path.startsWith(API_PROXY_PREFIX)) {
          return proxyApiRequest(request);
        }

        // For binary asset files (.data/.binarypb/.wasm), bypass AssetLoader and
        // serve directly from AssetManager with correct MIME type and no encoding,
        // to prevent WebView from corrupting binary content.
        if (path != null && path.startsWith("/assets/")) {
          String assetPath = path.substring("/assets/".length()); // strip /assets/ prefix
          if (path.endsWith(".data") || path.endsWith(".binarypb") || path.endsWith(".wasm")) {
            try {
              java.io.InputStream is = getAssets().open(assetPath);
              String mime = path.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
              return new WebResourceResponse(mime, null, is);
            } catch (java.io.IOException e) {
              Log.w(TAG, "Asset not found: " + assetPath, e);
            }
          }
        }

        WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
        return (response != null) ? response : super.shouldInterceptRequest(view, request);
      }

      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        Log.d(TAG, "Page started: " + url);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        Log.d(TAG, "Page finished: " + url);
      }
    });

    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
        String msg = consoleMessage.message();
        String src = consoleMessage.sourceId() + ":" + consoleMessage.lineNumber();
        switch (consoleMessage.messageLevel()) {
          case ERROR:
            Log.e(TAG, "JS ERROR: " + msg + " @ " + src);
            break;
          case WARNING:
            Log.w(TAG, "JS WARN: " + msg + " @ " + src);
            break;
          default:
            Log.d(TAG, "JS LOG: " + msg + " @ " + src);
            break;
        }
        return true;
      }

      @Override
      public void onPermissionRequest(PermissionRequest request) {
        for (String resource : request.getResources()) {
          if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
            handleCameraPermissionRequest(request);
            return;
          }
        }
        request.deny();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // API 代理 — 将 WebView 中的 /api-proxy/xxx 请求转发到真实后端
  // ---------------------------------------------------------------------------

  /**
   * 将 WebView 发起的 API 请求代理到真实后端服务器。
   *
   * <p>WebView 中 JS 发起 GET/POST 到
   * https://appassets.androidplatform.net/api-proxy/palm/create_token，
   * Native 层会将其转发到 https://backend-host/api/palm/create_token，
   * 并将响应原样返回给 WebView，从而完全绕过 CORS 限制。</p>
   *
   * @param request WebView 拦截到的请求
   * @return 代理后的响应，或错误响应
   */
  @Nullable
  private WebResourceResponse proxyApiRequest(WebResourceRequest request) {
    String path = request.getUrl().getPath();
    String backendPath = "/api" + path.substring(API_PROXY_PREFIX.length() - 1);
    String query = request.getUrl().getQuery();
    String targetUrl = apiBackendBaseURL + backendPath + (query != null ? "?" + query : "");
    String method = request.getMethod();

    Log.d(TAG, "API Proxy: " + method + " " + targetUrl);

    HttpURLConnection conn = null;
    try {
      conn = openProxyConnection(targetUrl, method);
      String proxyBody = forwardRequestHeaders(request, conn);
      writeRequestBody(conn, proxyBody);

      int statusCode = conn.getResponseCode();
      String statusMessage = conn.getResponseMessage();
      byte[] responseBytes = readResponseBytes(conn);

      String[] contentTypeParts = parseContentType(conn.getContentType());
      Map<String, String> responseHeaders = buildResponseHeaders(conn);

      WebResourceResponse webResponse = new WebResourceResponse(
          contentTypeParts[0], contentTypeParts[1], statusCode,
          statusMessage != null ? statusMessage : "OK",
          responseHeaders, new ByteArrayInputStream(responseBytes));

      Log.d(TAG, "API Proxy response: " + statusCode + " " + contentTypeParts[0]
          + " (" + responseBytes.length + " bytes)");
      return webResponse;

    } catch (Exception e) {
      Log.e(TAG, "API Proxy error: " + e.getMessage(), e);
      return buildErrorResponse(e.getMessage());
    } finally {
      if (conn != null) {
        conn.disconnect();
      }
    }
  }

  /**
   * 打开到后端的 HTTP 连接并配置基本参数。
   */
  private HttpURLConnection openProxyConnection(String targetUrl, String method) throws Exception {
    URL url = new URL(targetUrl);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    if (conn instanceof HttpsURLConnection && BuildConfig.DEBUG) {
      HttpUtils.trustAllCerts((HttpsURLConnection) conn);
    }
    conn.setRequestMethod(method);
    conn.setConnectTimeout(15000);
    conn.setReadTimeout(15000);
    conn.setInstanceFollowRedirects(true);
    conn.setDoInput(true);
    return conn;
  }

  /**
   * 转发请求头到后端连接，提取并返回 Base64 编码的请求体。
   */
  @Nullable
  private String forwardRequestHeaders(WebResourceRequest request, HttpURLConnection conn) {
    String proxyBody = null;
    Map<String, String> requestHeaders = request.getRequestHeaders();
    if (requestHeaders == null) {
      return null;
    }
    for (Map.Entry<String, String> entry : requestHeaders.entrySet()) {
      String key = entry.getKey();
      if ("X-Proxy-Body".equalsIgnoreCase(key)) {
        try {
          proxyBody = new String(
              android.util.Base64.decode(entry.getValue(), android.util.Base64.NO_WRAP), "UTF-8");
        } catch (Exception e) {
          Log.w(TAG, "Failed to decode X-Proxy-Body", e);
        }
        continue;
      }
      if ("Origin".equalsIgnoreCase(key) || "Referer".equalsIgnoreCase(key)) {
        continue;
      }
      conn.setRequestProperty(key, entry.getValue());
    }
    return proxyBody;
  }

  /**
   * 将请求体写入连接（POST/PUT/PATCH）。
   */
  private void writeRequestBody(HttpURLConnection conn, @Nullable String proxyBody) throws IOException {
    if (proxyBody == null || proxyBody.isEmpty()) {
      return;
    }
    conn.setDoOutput(true);
    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
    byte[] bodyBytes = proxyBody.getBytes("UTF-8");
    conn.setFixedLengthStreamingMode(bodyBytes.length);
    OutputStream os = conn.getOutputStream();
    os.write(bodyBytes);
    os.flush();
    os.close();
  }

  /**
   * 读取响应体字节。
   */
  private byte[] readResponseBytes(HttpURLConnection conn) throws IOException {
    InputStream responseStream;
    try {
      responseStream = conn.getInputStream();
    } catch (IOException e) {
      responseStream = conn.getErrorStream();
    }
    if (responseStream == null) {
      return new byte[0];
    }
    byte[] bytes = HttpUtils.readAllBytes(responseStream);
    responseStream.close();
    return bytes;
  }

  /**
   * 解析 Content-Type 头，返回 [mimeType, encoding]。
   */
  private String[] parseContentType(@Nullable String contentType) {
    String mimeType = "application/json";
    String encoding = "UTF-8";
    if (contentType != null) {
      String[] parts = contentType.split(";");
      mimeType = parts[0].trim();
      for (int i = 1; i < parts.length; i++) {
        String part = parts[i].trim();
        if (part.toLowerCase().startsWith("charset=")) {
          encoding = part.substring("charset=".length()).trim();
        }
      }
    }
    return new String[]{mimeType, encoding};
  }

  /**
   * 构建响应头，包含 CORS 头和后端转发的头。
   */
  private Map<String, String> buildResponseHeaders(HttpURLConnection conn) {
    Map<String, String> responseHeaders = new HashMap<>();
    responseHeaders.put("Access-Control-Allow-Origin", "*");
    responseHeaders.put("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    responseHeaders.put("Access-Control-Allow-Headers", "Content-Type, X-Traceid, Authorization");

    Map<String, List<String>> headerFields = conn.getHeaderFields();
    if (headerFields != null) {
      for (Map.Entry<String, List<String>> entry : headerFields.entrySet()) {
        String key = entry.getKey();
        if (key == null || key.isEmpty()) {
          continue;
        }
        if (entry.getValue() == null || entry.getValue().isEmpty()) {
          continue;
        }
        if (key.toLowerCase().startsWith("access-control-")) {
          continue;
        }
        responseHeaders.put(key, entry.getValue().get(0));
      }
    }
    return responseHeaders;
  }

  /**
   * 构建 502 错误响应。
   */
  private WebResourceResponse buildErrorResponse(String errorMessage) {
    String safeMsg = (errorMessage != null) ? errorMessage.replace("\"", "\\\"") : "unknown";
    String errorJson = "{\"error\":\"proxy_error\",\"message\":\"" + safeMsg + "\"}";
    Map<String, String> errorHeaders = new HashMap<>();
    errorHeaders.put("Access-Control-Allow-Origin", "*");
    return new WebResourceResponse(
        "application/json", "UTF-8", 502, "Bad Gateway",
        errorHeaders, new ByteArrayInputStream(errorJson.getBytes()));
  }

  // ---------------------------------------------------------------------------
  // Bridges
  // ---------------------------------------------------------------------------

  private void setupBridges() {
    bridge = WebViewBridge.install(webView);
    palmRacerBridge = new PalmRacerBridge(this, bridge);
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  private void handleCameraPermissionRequest(PermissionRequest request) {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        == PackageManager.PERMISSION_GRANTED) {
      request.grant(request.getResources());
    } else {
      pendingPermissionRequest = request;
      cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard detection — 全屏沉浸模式下 adjustResize 不生效，
  // 需要手动检测键盘弹出并调整 WebView 的布局高度
  // ---------------------------------------------------------------------------

  private void setupKeyboardListener() {
    keyboardLayoutListener = () -> {
      if (rootLayout == null || webView == null) {
        return;
      }

      Rect r = new Rect();
      rootLayout.getWindowVisibleDisplayFrame(r);

      int screenHeight = rootLayout.getRootView().getHeight();
      int screenWidth = rootLayout.getRootView().getWidth();
      int visibleHeight = r.height();
      int visibleWidth = r.width();

      // 横屏时键盘可能在底部或侧面，检测可视区域是否显著缩小
      int heightDiff = screenHeight - visibleHeight;
      int widthDiff = screenWidth - visibleWidth;

      // 键盘弹出阈值：屏幕尺寸的 15%
      int threshold = Math.max(screenHeight, screenWidth) * 15 / 100;

      FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) webView.getLayoutParams();

      if (heightDiff > threshold || widthDiff > threshold) {
        // 键盘弹出了，调整 WebView 大小以适应可视区域
        params.width = visibleWidth;
        params.height = visibleHeight;
        params.leftMargin = r.left;
        params.topMargin = r.top;
        webView.setLayoutParams(params);
        Log.d(TAG, "Keyboard detected, resizing WebView to " + visibleWidth + "x" + visibleHeight);
      } else {
        // 键盘收起，恢复全屏
        params.width = FrameLayout.LayoutParams.MATCH_PARENT;
        params.height = FrameLayout.LayoutParams.MATCH_PARENT;
        params.leftMargin = 0;
        params.topMargin = 0;
        webView.setLayoutParams(params);
      }
    };

    rootLayout.getViewTreeObserver().addOnGlobalLayoutListener(keyboardLayoutListener);
  }

  // ---------------------------------------------------------------------------
  // Immersive mode
  // ---------------------------------------------------------------------------

  private void enterImmersiveMode() {
    View decorView = getWindow().getDecorView();
    decorView.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
  }
}
