// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palmracer;

import android.app.Activity;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.LifecycleOwner;

import com.google.gson.JsonObject;
import com.edgesenseai.palm.core.WebViewBridge;

/**
 * PalmRacerBridge registers game-specific JSBridge handlers on top of
 * {@link WebViewBridge}.
 */
public class PalmRacerBridge {

  private static final String TAG = "PalmRacerBridge";

  private final Activity activity;
  private final WebViewBridge bridge;
  private NativeHandTracker handTracker;
  private long broadcastCount = 0;

  public PalmRacerBridge(@NonNull Activity activity, @NonNull WebViewBridge bridge) {
    this.activity = activity;
    this.bridge = bridge;
    registerHandlers();
  }

  private void registerHandlers() {
    registerPalmRecognition();
    registerPalmVerification();
    registerGetDeviceInfo();
    registerGetApiConfig();
    registerStartHandTracking();
    registerStopHandTracking();
  }

  /**
   * startHandTracking — starts native CameraX + MediaPipe hand tracking.
   * Landmarks are broadcast as "nativeHandLandmarks" events.
   */
  private void registerStartHandTracking() {
    bridge.registerCall("startHandTracking", JsonObject.class, (params, responder) -> {
      Log.d(TAG, "startHandTracking invoked");

      if (handTracker != null) {
        responder.resolve(makeResult("already_running"));
        return;
      }

      try {
        handTracker = new NativeHandTracker();
        handTracker.init(activity);
        handTracker.setListener((jsonLandmarks, frameBase64, fullBase64) -> {
          // Broadcast landmarks + frames to WebView
          JsonObject data = new JsonObject();
          if ("null".equals(jsonLandmarks)) {
            data.addProperty("landmarks", (String) null);
          } else {
            data.addProperty("landmarks", jsonLandmarks);
          }
          // Low-res preview frame for camera widget
          if (frameBase64 != null) {
            data.addProperty("frame", frameBase64);
          }
          // Full-res frame for anti-cheat recognition
          if (fullBase64 != null) {
            data.addProperty("fullFrame", fullBase64);
          }
          bridge.broadcast("nativeHandLandmarks", data);

          // Log occasionally to confirm broadcast is happening
          if (!"null".equals(jsonLandmarks)) {
            long count = broadcastCount++;
            if (count <= 3 || count % 30 == 0) {
              Log.d(TAG, "Broadcast landmarks #" + count + " len=" + jsonLandmarks.length());
            }
          }
        });

        if (activity instanceof LifecycleOwner) {
          handTracker.start(activity, (LifecycleOwner) activity);
          responder.resolve(makeResult("started"));
        } else {
          responder.reject(-1, "Activity is not a LifecycleOwner");
        }
      } catch (Exception e) {
        Log.e(TAG, "startHandTracking failed", e);
        responder.reject(-1, "Failed to start hand tracking: " + e.getMessage());
      }
    });
  }

  /**
   * stopHandTracking — stops native hand tracking and releases camera.
   */
  private void registerStopHandTracking() {
    bridge.registerCall("stopHandTracking", JsonObject.class, (params, responder) -> {
      Log.d(TAG, "stopHandTracking invoked");
      if (handTracker != null) {
        handTracker.destroy();
        handTracker = null;
      }
      responder.resolve(makeResult("stopped"));
    });
  }

  public void destroy() {
    if (handTracker != null) {
      handTracker.destroy();
      handTracker = null;
    }
  }

  public void updateRotation(int displayRotation) {
    if (handTracker != null) {
      handTracker.updateRotation(displayRotation);
    }
  }

  private void registerPalmRecognition() {
    bridge.registerInvoke("palmRecognition", JsonObject.class, (params, eventName) -> {
      Log.d(TAG, "palmRecognition invoked (stub)");
      JsonObject data = new JsonObject();
      data.addProperty("userId", "stub_user");
      data.addProperty("userName", "Stub Player");
      data.addProperty("tenantName", "PalmRacer Dev");
      bridge.broadcast(eventName, data);
    });
  }

  private void registerPalmVerification() {
    bridge.registerInvoke("palmVerification", JsonObject.class, (params, eventName) -> {
      Log.d(TAG, "palmVerification invoked (stub)");
      JsonObject data = new JsonObject();
      data.addProperty("verified", true);
      bridge.broadcast(eventName, data);
    });
  }

  private void registerGetDeviceInfo() {
    bridge.registerCall("getDeviceInfo", JsonObject.class, (params, responder) -> {
      JsonObject info = new JsonObject();
      info.addProperty("platform", "android");
      info.addProperty("model", Build.MODEL);
      info.addProperty("sdkVersion", String.valueOf(Build.VERSION.SDK_INT));
      info.addProperty("nativeHandTracking", true);
      responder.resolve(info);
    });
  }

  /**
   * getApiConfig — 返回后端 API 配置，让 Web 层能正确连接 Go 后端。
   * Web 层在 NativePlatform 初始化时调用此方法获取后端地址。
   */
  private void registerGetApiConfig() {
    bridge.registerCall("getApiConfig", JsonObject.class, (params, responder) -> {
      JsonObject config = new JsonObject();
      // 公有云后端地址，可通过 SharedPreferences 覆盖
      String apiBaseURL = activity.getSharedPreferences("palm_racer", 0)
          .getString("api_base_url", BuildConfig.DEFAULT_API_BASE_URL + "/api");
      config.addProperty("apiBaseURL", apiBaseURL);
      responder.resolve(config);
    });
  }

  private JsonObject makeResult(String status) {
    JsonObject obj = new JsonObject();
    obj.addProperty("status", status);
    return obj;
  }
}
