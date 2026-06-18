# Palm Racer ProGuard Rules

# 保留 WebView JavaScript 接口
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留 MediaPipe 相关类
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**

# 保留 Gson 序列化
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# 保留应用主要类
-keep class com.edgesenseai.palmracer.** { *; }
-keep class com.edgesenseai.palm.** { *; }
