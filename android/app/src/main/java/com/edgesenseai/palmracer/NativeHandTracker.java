// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palmracer;

import android.content.Context;
import android.util.Log;
import android.util.Size;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker;
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;

import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * NativeHandTracker uses CameraX + MediaPipe Tasks Vision HandLandmarker
 * to detect hand landmarks natively, then broadcasts results to WebView
 * via JSBridge.
 *
 * This avoids the memory/WebGL conflict caused by running MediaPipe WASM
 * inside the WebView alongside Babylon.js.
 */
public class NativeHandTracker {

  private static final String TAG = "NativeHandTracker";
  private static final String MODEL_ASSET = "hand_landmarker.task";

  /** Preview frame dimensions (low-res for camera preview widget). */
  private static final int PREVIEW_WIDTH = 160;
  private static final int PREVIEW_HEIGHT = 120;
  /** JPEG quality for preview frames. */
  private static final int PREVIEW_JPEG_QUALITY = 50;
  /** JPEG quality for full-res anti-cheat frames (same quality as login capture). */
  private static final int ANTICHEAT_JPEG_QUALITY = 85;

  public interface LandmarkListener {
    /**
     * Callback for hand landmark detection results.
     *
     * @param jsonArray      landmarks JSON or "null"
     * @param previewBase64  low-res preview frame (160x120, for camera widget)
     * @param fullBase64     full-res frame (original bitmap size, for anti-cheat)
     */
    void onLandmarks(String jsonArray, String previewBase64, String fullBase64);
  }

  private HandLandmarker handLandmarker;
  private ProcessCameraProvider cameraProvider;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private LandmarkListener listener;
  private boolean isRunning = false;
  private long frameCount = 0;
  private ImageAnalysis imageAnalysis;
  private Context startContext;
  private LifecycleOwner startLifecycleOwner;

  // Track whether the screen is in "reverse landscape" (ROTATION_270)
  // In ROTATION_270, the front camera image is flipped 180° relative to ROTATION_90
  private volatile boolean isReverseLandscape = false;

  /**
   * Initialize the HandLandmarker model.
   */
  public void init(@NonNull Context context) {
    try {
      BaseOptions baseOptions = BaseOptions.builder()
          .setModelAssetPath(MODEL_ASSET)
          .build();

      HandLandmarker.HandLandmarkerOptions options =
          HandLandmarker.HandLandmarkerOptions.builder()
              .setBaseOptions(baseOptions)
              .setRunningMode(RunningMode.IMAGE)
              .setNumHands(2)
              .setMinHandDetectionConfidence(0.5f)
              .setMinTrackingConfidence(0.4f)
              .setMinHandPresenceConfidence(0.5f)
              .build();

      handLandmarker = HandLandmarker.createFromOptions(context, options);
      Log.d(TAG, "HandLandmarker initialized");
    } catch (Exception e) {
      Log.e(TAG, "Failed to init HandLandmarker", e);
    }
  }

  public void setListener(LandmarkListener listener) {
    this.listener = listener;
  }

  /**
   * Start the camera and begin processing frames.
   */
  public void start(@NonNull Context context, @NonNull LifecycleOwner lifecycleOwner) {
    if (handLandmarker == null) {
      Log.e(TAG, "HandLandmarker not initialized");
      return;
    }

    startContext = context;
    startLifecycleOwner = lifecycleOwner;

    // Initialize rotation state
    int rotation = ((android.app.Activity) context).getWindowManager()
        .getDefaultDisplay().getRotation();
    isReverseLandscape = (rotation == android.view.Surface.ROTATION_270);
    Log.d(TAG, "Initial rotation=" + rotation + " isReverseLandscape=" + isReverseLandscape);

    ListenableFuture<ProcessCameraProvider> future =
        ProcessCameraProvider.getInstance(context);

    future.addListener(() -> {
      try {
        cameraProvider = future.get();

        imageAnalysis = new ImageAnalysis.Builder()
            .setTargetResolution(new Size(320, 240))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build();

        imageAnalysis.setAnalyzer(executor, this::processFrame);

        CameraSelector cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA;

        cameraProvider.unbindAll();
        cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, imageAnalysis);

        isRunning = true;
        Log.d(TAG, "Camera started for hand tracking, isReverseLandscape=" + isReverseLandscape);
      } catch (Exception e) {
        Log.e(TAG, "Failed to start camera", e);
      }
    }, ContextCompat.getMainExecutor(context));
  }

  /**
   * Update display rotation. Called when screen orientation changes.
   * ROTATION_90 = normal landscape, ROTATION_270 = reverse landscape.
   */
  public void updateRotation(int displayRotation) {
    // android.view.Surface.ROTATION_270 = 3
    boolean wasReverse = isReverseLandscape;
    isReverseLandscape = (displayRotation == android.view.Surface.ROTATION_270);
    if (wasReverse != isReverseLandscape) {
      Log.d(TAG, "Rotation changed: isReverseLandscape=" + isReverseLandscape
          + " (displayRotation=" + displayRotation + ")");
    }
  }

  /**
   * Stop camera and release resources.
   */
  public void stop() {
    isRunning = false;
    if (cameraProvider != null) {
      cameraProvider.unbindAll();
      cameraProvider = null;
    }
    Log.d(TAG, "Hand tracking stopped");
  }

  public void destroy() {
    stop();
    if (handLandmarker != null) {
      handLandmarker.close();
      handLandmarker = null;
    }
    executor.shutdown();
    Log.d(TAG, "NativeHandTracker destroyed");
  }

  private void processFrame(@NonNull ImageProxy imageProxy) {
    if (!isRunning || handLandmarker == null) {
      imageProxy.close();
      return;
    }

    frameCount++;

    // Log first few frames to confirm camera is delivering
    if (frameCount <= 5 || frameCount % 60 == 0) {
      Log.d(TAG, "processFrame #" + frameCount + " format=" + imageProxy.getFormat()
          + " size=" + imageProxy.getWidth() + "x" + imageProxy.getHeight());
    }

    // Skip frames: process every 3rd frame (~10fps) to reduce CPU load
    if (frameCount % 3 != 0) {
      imageProxy.close();
      return;
    }

    try {
      Bitmap bitmap = imageProxyToBitmap(imageProxy);
      if (bitmap == null) {
        imageProxy.close();
        return;
      }

      MPImage mpImage = new BitmapImageBuilder(bitmap).build();
      HandLandmarkerResult result = handLandmarker.detect(mpImage);

      String frameBase64 = encodeBitmapToPreviewBase64(bitmap);
      String fullBase64 = encodeFullFrameBase64(bitmap);
      bitmap.recycle();

      boolean hasHand = result.landmarks() != null && !result.landmarks().isEmpty();

      logDetectionResult(hasHand, result);

      if (hasHand) {
        String landmarksJson = buildLandmarksJson(result.landmarks());
        notifyListener(landmarksJson, frameBase64, fullBase64);
      } else {
        notifyListener("null", frameBase64, fullBase64);
      }
    } catch (Exception e) {
      if (frameCount % 30 == 0) {
        Log.w(TAG, "Frame processing error", e);
      }
    } finally {
      imageProxy.close();
    }
  }

  /**
   * 周期性记录检测结果日志。
   */
  private void logDetectionResult(boolean hasHand, HandLandmarkerResult result) {
    if (frameCount <= 15 || frameCount % 60 == 0) {
      Log.d(TAG, "detect result: hasHand=" + hasHand
          + " landmarks=" + (result.landmarks() != null ? result.landmarks().size() : 0)
          + " listener=" + (listener != null));
    }
  }

  /**
   * 从多个检测到的手掌中选择面积最大的，构建 landmarks JSON。
   */
  private String buildLandmarksJson(
      java.util.List<java.util.List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>> allHands) {
    int bestIdx = selectBestHand(allHands);
    var landmarks = allHands.get(bestIdx);
    boolean flip = isReverseLandscape;

    JsonArray arr = new JsonArray();
    for (var lm : landmarks) {
      JsonObject pt = new JsonObject();
      pt.addProperty("x", flip ? (1.0f - lm.x()) : lm.x());
      pt.addProperty("y", flip ? (1.0f - lm.y()) : lm.y());
      pt.addProperty("z", lm.z());
      arr.add(pt);
    }
    return arr.toString();
  }

  /**
   * 从多个手掌中选择面积最大的（手腕到中指尖距离最大的）。
   */
  private int selectBestHand(
      java.util.List<java.util.List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>> allHands) {
    if (allHands.size() <= 1) {
      return 0;
    }
    int bestIdx = 0;
    float maxArea = 0;
    for (int i = 0; i < allHands.size(); i++) {
      var hand = allHands.get(i);
      float dx = hand.get(12).x() - hand.get(0).x();
      float dy = hand.get(12).y() - hand.get(0).y();
      float area = dx * dx + dy * dy;
      if (area > maxArea) {
        maxArea = area;
        bestIdx = i;
      }
    }
    Log.d(TAG, "Multiple hands detected: " + allHands.size()
        + ", selected index=" + bestIdx + " (largest palm)");
    return bestIdx;
  }

  /**
   * 通知监听器 landmarks 数据。
   */
  private void notifyListener(String landmarksJson, String frameBase64, String fullBase64) {
    if (listener != null) {
      listener.onLandmarks(landmarksJson, frameBase64, fullBase64);
    }
  }

  /**
   * Encode a bitmap as a low-resolution JPEG base64 string for WebView preview.
   * Scales down to PREVIEW_WIDTH x PREVIEW_HEIGHT to minimize JSBridge payload.
   * In reverse landscape (ROTATION_270), rotates the preview 180° so the image
   * appears upright in the WebView (the source bitmap is intentionally NOT rotated
   * for MediaPipe detection, but the preview must look correct to the user).
   */
  private String encodeBitmapToPreviewBase64(Bitmap bitmap) {
    try {
      // Scale down for preview
      Bitmap preview = Bitmap.createScaledBitmap(bitmap, PREVIEW_WIDTH, PREVIEW_HEIGHT, true);

      // Rotate 180° if in reverse landscape so the preview looks upright
      if (isReverseLandscape) {
        Matrix matrix = new Matrix();
        matrix.postRotate(180);
        Bitmap rotated = Bitmap.createBitmap(preview, 0, 0,
            preview.getWidth(), preview.getHeight(), matrix, true);
        preview.recycle();
        preview = rotated;
      }

      ByteArrayOutputStream baos = new ByteArrayOutputStream();
      preview.compress(Bitmap.CompressFormat.JPEG, PREVIEW_JPEG_QUALITY, baos);
      preview.recycle();
      byte[] bytes = baos.toByteArray();
      return Base64.encodeToString(bytes, Base64.NO_WRAP);
    } catch (Exception e) {
      Log.w(TAG, "Failed to encode preview frame", e);
      return null;
    }
  }

  /**
   * Encode bitmap at full resolution as JPEG base64 for anti-cheat recognition.
   * Uses the same quality as the login capture flow (~640x480, q=85).
   */
  private String encodeFullFrameBase64(Bitmap bitmap) {
    try {
      Bitmap full = bitmap;
      // Apply 180° rotation for reverse landscape (same as preview)
      if (isReverseLandscape) {
        Matrix matrix = new Matrix();
        matrix.postRotate(180);
        full = Bitmap.createBitmap(bitmap, 0, 0,
            bitmap.getWidth(), bitmap.getHeight(), matrix, true);
      }
      ByteArrayOutputStream baos = new ByteArrayOutputStream();
      full.compress(Bitmap.CompressFormat.JPEG, ANTICHEAT_JPEG_QUALITY, baos);
      if (full != bitmap) {
        full.recycle();
      }
      byte[] bytes = baos.toByteArray();
      return Base64.encodeToString(bytes, Base64.NO_WRAP);
    } catch (Exception e) {
      Log.w(TAG, "Failed to encode full frame", e);
      return null;
    }
  }

  /**
   * Convert ImageProxy (YUV_420_888) to Bitmap.
   */
  private Bitmap imageProxyToBitmap(ImageProxy image) {
    if (image.getFormat() != ImageFormat.YUV_420_888) {
      return null;
    }

    ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
    ByteBuffer uBuffer = image.getPlanes()[1].getBuffer();
    ByteBuffer vBuffer = image.getPlanes()[2].getBuffer();

    int ySize = yBuffer.remaining();
    int uSize = uBuffer.remaining();
    int vSize = vBuffer.remaining();

    byte[] nv21 = new byte[ySize + uSize + vSize];
    yBuffer.get(nv21, 0, ySize);
    vBuffer.get(nv21, ySize, vSize);
    uBuffer.get(nv21, ySize + vSize, uSize);

    YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21,
        image.getWidth(), image.getHeight(), null);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    yuvImage.compressToJpeg(
        new Rect(0, 0, image.getWidth(), image.getHeight()), 80, out);

    byte[] jpegBytes = out.toByteArray();
    Bitmap bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.length);

    // Rotate based on image rotation
    int rotation = image.getImageInfo().getRotationDegrees();
    if (frameCount <= 5 || frameCount % 120 == 0) {
      Log.d(TAG, "imageProxy rotation=" + rotation + " size=" + bitmap.getWidth() + "x" + bitmap.getHeight()
          + " isReverseLandscape=" + isReverseLandscape);
    }
    // For 90/270 rotation, rotate the bitmap so MediaPipe gets an upright image.
    // For 180 rotation (reverse landscape), do NOT rotate the bitmap —
    // MediaPipe handles inverted images better than manually rotated ones.
    // Instead, we flip the output coordinates via isReverseLandscape.
    if (rotation != 0 && rotation != 180) {
      Matrix matrix = new Matrix();
      matrix.postRotate(rotation);
      Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0,
          bitmap.getWidth(), bitmap.getHeight(), matrix, true);
      bitmap.recycle();
      return rotated;
    }

    return bitmap;
  }
}
