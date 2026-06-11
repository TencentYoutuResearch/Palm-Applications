// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palmracer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import javax.net.ssl.HttpsURLConnection;

import com.edgesenseai.palmracer.util.HttpUtils;

/**
 * App 版本检查与升级提示。
 *
 * 启动时异步请求服务端 /api/app/version 接口，对比本地 versionName，
 * 如果服务端版本更高则弹窗提示用户升级。支持强制更新模式。
 */
public class AppUpdateChecker {

  private static final String TAG = "AppUpdateChecker";
  private final Activity activity;
  private final String apiBaseUrl;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  public AppUpdateChecker(Activity activity, String apiBaseUrl) {
    this.activity = activity;
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 异步检查版本更新。
   */
  public void check() {
    new Thread(() -> {
      try {
        String versionUrl = apiBaseUrl + "/api/app/version";
        Log.d(TAG, "Checking version: " + versionUrl);

        URL url = new URL(versionUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        // 开发环境信任所有证书
        if (conn instanceof HttpsURLConnection && BuildConfig.DEBUG) {
          HttpUtils.trustAllCerts((HttpsURLConnection) conn);
        }

        conn.setRequestMethod("POST");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");

        // 发送请求体（包含当前版本信息）
        String localVersion = getLocalVersionName();
        String requestBody = "{\"Platform\":\"android\",\"CurrentVersion\":\"" + localVersion + "\"}";
        byte[] bodyBytes = requestBody.getBytes("UTF-8");
        conn.setFixedLengthStreamingMode(bodyBytes.length);
        java.io.OutputStream os = conn.getOutputStream();
        os.write(bodyBytes);
        os.flush();
        os.close();

        int statusCode = conn.getResponseCode();
        if (statusCode != 200) {
          Log.w(TAG, "Version check failed, status: " + statusCode);
          conn.disconnect();
          return;
        }

        InputStream is = conn.getInputStream();
        byte[] data = HttpUtils.readAllBytes(is);
        is.close();
        conn.disconnect();

        String json = new String(data, "UTF-8");
        Log.d(TAG, "Version response: " + json);

        JSONObject resp = new JSONObject(json);
        if (resp.optInt("code", -1) != 0) {
          Log.w(TAG, "Version API returned error: " + resp.optString("message"));
          return;
        }

        JSONObject respData = resp.getJSONObject("data");
        String remoteVersion = respData.getString("version");
        String downloadUrl = respData.getString("download_url");
        boolean forceUpdate = respData.optBoolean("force_update", false);
        String changelog = respData.optString("changelog", "优化体验，修复已知问题");

        Log.d(TAG, "Local: v" + localVersion + ", Remote: v" + remoteVersion);

        if (compareVersions(remoteVersion, localVersion) > 0) {
          // 有新版本，在主线程弹窗
          mainHandler.post(() -> showUpdateDialog(
              remoteVersion, changelog, downloadUrl, forceUpdate));
        } else {
          Log.d(TAG, "App is up to date");
        }

      } catch (Exception e) {
        Log.w(TAG, "Version check error: " + e.getMessage());
      }
    }).start();
  }

  /**
   * 显示升级提示弹窗。
   */
  private void showUpdateDialog(String newVersion, String changelog,
                                String downloadUrl, boolean forceUpdate) {
    if (activity.isFinishing() || activity.isDestroyed()) {
      return;
    }

    AlertDialog.Builder builder = new AlertDialog.Builder(activity)
        .setTitle("🚀 发现新版本 v" + newVersion)
        .setMessage("更新内容：\n" + changelog)
        .setPositiveButton("立即升级", (dialog, which) -> {
          // 打开浏览器下载 APK
          try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
            activity.startActivity(intent);
          } catch (Exception e) {
            Log.e(TAG, "Failed to open download URL", e);
          }
        });

    if (forceUpdate) {
      // 强制更新：不可取消，无"稍后"按钮
      builder.setCancelable(false);
    } else {
      // 非强制：可取消，有"稍后"按钮
      builder.setCancelable(true);
      builder.setNegativeButton("稍后再说", (dialog, which) -> dialog.dismiss());
    }

    builder.show();
  }

  /**
   * 比较两个语义化版本号（如 "1.2.3"）。
   *
   * @return 正数表示 v1 > v2，负数表示 v1 < v2，0 表示相等
   */
  private int compareVersions(String v1, String v2) {
    if (v1 == null || v2 == null) {
      return 0;
    }
    String[] parts1 = v1.split("\\.");
    String[] parts2 = v2.split("\\.");
    int length = Math.max(parts1.length, parts2.length);
    for (int i = 0; i < length; i++) {
      int num1 = i < parts1.length ? parseVersionPart(parts1[i]) : 0;
      int num2 = i < parts2.length ? parseVersionPart(parts2[i]) : 0;
      if (num1 != num2) {
        return num1 - num2;
      }
    }
    return 0;
  }

  /**
   * 解析版本号中的单个数字部分，忽略非数字后缀（如 "1-beta"）。
   */
  private int parseVersionPart(String part) {
    try {
      // 提取开头的数字部分
      StringBuilder sb = new StringBuilder();
      for (char c : part.toCharArray()) {
        if (Character.isDigit(c)) {
          sb.append(c);
        } else {
          break;
        }
      }
      return sb.length() > 0 ? Integer.parseInt(sb.toString()) : 0;
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  /**
   * 获取本地 versionName。
   */
  private String getLocalVersionName() {
    try {
      PackageInfo pInfo = activity.getPackageManager()
          .getPackageInfo(activity.getPackageName(), 0);
      return pInfo.versionName;
    } catch (PackageManager.NameNotFoundException e) {
      return "unknown";
    }
  }

}
