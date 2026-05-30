// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palmracer.util;

import android.annotation.SuppressLint;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * HTTP utility methods shared across the app.
 */
public final class HttpUtils {

  private static final String TAG = "HttpUtils";

  private HttpUtils() {} // no instances

  /**
   * Read all bytes from an InputStream.
   */
  public static byte[] readAllBytes(InputStream is) throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] data = new byte[4096];
    int bytesRead;
    while ((bytesRead = is.read(data, 0, data.length)) != -1) {
      buffer.write(data, 0, bytesRead);
    }
    return buffer.toByteArray();
  }

  /**
   * Trust all HTTPS certificates (DEBUG builds only).
   * WARNING: Never use in production.
   */
  @SuppressLint("TrustAllX509TrustManager")
  public static void trustAllCerts(HttpsURLConnection conn) {
    try {
      TrustManager[] trustManagers = new TrustManager[]{
          new X509TrustManager() {
            public java.security.cert.X509Certificate[] getAcceptedIssuers() {
              return new java.security.cert.X509Certificate[0];
            }

            public void checkClientTrusted(
                java.security.cert.X509Certificate[] certs, String authType) {
            }

            public void checkServerTrusted(
                java.security.cert.X509Certificate[] certs, String authType) {
            }
          }
      };
      SSLContext sc = SSLContext.getInstance("TLS");
      sc.init(null, trustManagers, new java.security.SecureRandom());
      conn.setSSLSocketFactory(sc.getSocketFactory());
      conn.setHostnameVerifier((hostname, session) -> true);
    } catch (Exception e) {
      Log.w(TAG, "trustAllCerts failed", e);
    }
  }
}
