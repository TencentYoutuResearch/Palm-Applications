// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palm.core;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import com.google.gson.reflect.TypeToken;

import java.lang.ref.WeakReference;
import java.lang.reflect.Type;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class WebViewBridge {
    private static final String TAG = "WebViewBridge";

    // =======================================================================
    // Protocol Constants - MUST match JSBridge.ts
    // =======================================================================
    private static final String DEFAULT_BRIDGE_NAME = "JSBridge";
    private static final String CALLBACK_NAMESPACE_SUFFIX = "Callbacks";
    private static final String CALLBACK_ID_PREFIX = "cb_";
    private static final String INVOKE_CALLBACK_ID_PREFIX = "invoke_";

    private static final int RESPONSE_CODE_SUCCESS = 0;
    private static final int RESPONSE_CODE_ERROR = -1;
    private static final int RESPONSE_CODE_NO_HANDLER = -2;
    private static final int RESPONSE_CODE_HANDLER_FAILED = -3;
    private static final int RESPONSE_CODE_PARSE_ERROR = -4;

    // JavaScript execution formats
    private static final String JS_CALLBACK_FORMAT =
        "window.%s" + CALLBACK_NAMESPACE_SUFFIX + "('%s', %s)";
    private static final String JS_DISPATCH_EVENT_FORMAT =
        "window.dispatchEvent(new CustomEvent('%s', { detail: %s }))";

    private final WeakReference<WebView> webViewRef;
    private final String bridgeName;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Gson gson = new Gson();
    private final Map<String, RegisteredHandler<?>> handlers = new ConcurrentHashMap<>();

    public WebViewBridge(@NonNull WebView webView, @NonNull String bridgeName) {
        this.webViewRef = new WeakReference<>(webView);
        this.bridgeName = bridgeName;
    }

    @SuppressLint("SetJavaScriptEnabled")
    public static WebViewBridge install(@NonNull WebView webView, @NonNull String bridgeName) {
        if (!webView.getSettings().getJavaScriptEnabled()) {
            webView.getSettings().setJavaScriptEnabled(true);
        }
        WebViewBridge bridge = new WebViewBridge(webView, bridgeName);
        webView.addJavascriptInterface(bridge.new BridgeInterface(), bridge.bridgeName);
        return bridge;
    }

    public static WebViewBridge install(@NonNull WebView webView) {
        return install(webView, DEFAULT_BRIDGE_NAME);
    }

    /**
     * Registers a handler for a specific method name.
     *
     * @param methodName The method name to listen for.
     * @param typeToken  The type token for deserializing the params.
     * @param handler    The handler to execute.
     * @param <T>        The type of the params object.
     */
    public <T> void registerCall(
        @NonNull String methodName,
        @NonNull TypeToken<T> typeToken,
        @NonNull CallHandler<T> handler) {
        handlers.put(methodName, new RegisteredHandler<>(handler, typeToken.getType()));
    }

    public <T> void registerCall(
        @NonNull String methodName,
        @NonNull Class<T> paramType,
        @NonNull CallHandler<T> handler) {
        registerCall(methodName, TypeToken.get(paramType), handler);
    }

    /**
     * Registers a handler specifically for the 'invoke' pattern from JS.
     * This method abstracts away the boilerplate of extracting the __eventName
     * that the JS invoke call automatically injects.
     *
     * Your handler should perform its async work and then use
     * webViewBridge.broadcast(eventName, result) to send the result back
     * to the correct invoke call in JavaScript.
     *
     * @param methodName The method name to listen for.
     * @param typeToken  The type token for deserializing the params.
     * @param handler    The handler to execute.
     * @param <T>        The type of the params object.
     */
    public <T> void registerInvoke(
        @NonNull String methodName,
        @NonNull TypeToken<T> typeToken,
        @NonNull InvokeHandler<T> handler) {
        registerCall(methodName, JsonObject.class, (json, responder) -> {
            String eventName = methodName;
            if (json != null && json.has("__eventName")) {
                eventName = json.remove("__eventName").getAsString();
            }
            T params = gson.fromJson(json, typeToken.getType());
            handler.handle(params, eventName);
        });
    }

    public <T> void registerInvoke(
        @NonNull String methodName,
        @NonNull Class<T> paramType,
        @NonNull InvokeHandler<T> handler) {
        registerInvoke(methodName, TypeToken.get(paramType), handler);
    }

    /**
     * Broadcasts a global event to the WebView.
     * This is independent of any call/invoke cycle and can be triggered at any time.
     *
     * @param eventName The name of the event.
     * @param data      The payload to send with the event.
     */
    public void broadcast(@NonNull String eventName, @Nullable Object data) {
        String dataJson = gson.toJson(data);
        executeJs(String.format(JS_DISPATCH_EVENT_FORMAT, eventName, dataJson));
    }

    public void destroy() {
        WebView webView = webViewRef.get();
        if (webView != null) {
            webView.removeJavascriptInterface(this.bridgeName);
        }
        handlers.clear();
        mainHandler.removeCallbacksAndMessages(null);
        webViewRef.clear();
        Log.d(TAG, "WebViewBridge destroyed.");
    }

    private void sendCallback(String callbackId, NativeResponse<?> response) {
        // Ignore callbacks for 'invoke' calls, as they are fire-and-forget.
        if (callbackId == null || callbackId.isEmpty() || callbackId.startsWith(INVOKE_CALLBACK_ID_PREFIX)) {
            return;
        }
        String responseJson = gson.toJson(response);
        executeJs(String.format(JS_CALLBACK_FORMAT, this.bridgeName, callbackId, responseJson));
    }

    private void executeJs(final String script) {
        WebView webView = webViewRef.get();
        if (webView != null) {
            mainHandler.post(() -> webView.evaluateJavascript(script, null));
        } else {
            Log.w(TAG, "Cannot execute JS, WebView has been destroyed.");
        }
    }

    public interface Responder {
        /**
         * Responds directly to the JS caller via its callbackId.
         * This is used to resolve the promise returned by `bridge.call()`.
         *
         * @param result The data to send back. Can be null.
         */
        void resolve(@Nullable Object result);

        /**
         * Rejects the JS caller's promise with a custom error code and message.
         *
         * @param code         A specific error code.
         * @param errorMessage A descriptive error message.
         */
        void reject(int code, @NonNull String errorMessage);
    }

    @FunctionalInterface
    public interface CallHandler<T> {
        /**
         * Handles the incoming request.
         *
         * @param params    The deserialized parameters from JS. Can be null.
         * @param responder A tool to send a response back to JS.
         */
        void handle(@Nullable T params, @NonNull Responder responder);
    }

    @FunctionalInterface
    public interface InvokeHandler<T> {
        /**
         * Handles the invoked method.
         *
         * @param params    The deserialized parameters from JavaScript. Can be null.
         * @param eventName The event name to use when broadcasting the result.
         *                  This is crucial for the `invoke` promise on the JS side to resolve.
         */
        void handle(@Nullable T params, @NonNull String eventName);
    }

    /**
     * Event constants - MUST match JSBridge.ts NativeEvent
     */
    public static final class Event {
        public static final String BRIDGE_READY = "bridge:ready";
        public static final String APP_RESUME = "app:resume";
        public static final String APP_PAUSE = "app:pause";
        public static final String SYSTEM_BACK_PRESSED = "system:backPressed";
        public static final String SYSTEM_NETWORK_CHANGE = "system:networkChange";
        public static final String SYSTEM_APPEARANCE_CHANGE = "system:appearanceChange";

        private Event() {
        }
    }

    private static class NativeResponse<T> {
        int code;
        String msg;
        T data;

        static <T> NativeResponse<T> success(@Nullable T data) {
            NativeResponse<T> res = new NativeResponse<>();
            res.code = RESPONSE_CODE_SUCCESS;
            res.msg = "Success";
            res.data = data;
            return res;
        }

        static <T> NativeResponse<T> failure(int code, @NonNull String msg) {
            NativeResponse<T> res = new NativeResponse<>();
            res.code = code;
            res.msg = msg;
            return res;
        }
    }

    private final class BridgeInterface {
        @JavascriptInterface
        public void call(final String methodName, final String paramsJson, final String callbackId) {
            mainHandler.post(() -> {
                final RegisteredHandler<?> registeredHandler = handlers.get(methodName);
                if (registeredHandler != null) {
                    registeredHandler.execute(paramsJson, callbackId);
                } else {
                    String errorMsg = "No handler registered for method: " + methodName;
                    Log.e(TAG, errorMsg);
                    if (callbackId != null && !callbackId.startsWith(INVOKE_CALLBACK_ID_PREFIX)) {
                        sendCallback(callbackId, NativeResponse.failure(RESPONSE_CODE_NO_HANDLER, errorMsg));
                    }
                }
            });
        }
    }

    private class RegisteredHandler<T> {
        private final CallHandler<T> handler;
        private final Type paramType;

        RegisteredHandler(CallHandler<T> handler, Type paramType) {
            this.handler = handler;
            this.paramType = paramType;
        }

        void execute(String paramsJson, String callbackId) {
            try {
                T params = gson.fromJson(paramsJson, this.paramType);
                Responder responder = new Responder() {
                    @Override
                    public void resolve(@Nullable Object result) {
                        sendCallback(callbackId, NativeResponse.success(result));
                    }

                    @Override
                    public void reject(int code, @NonNull String errorMessage) {
                        sendCallback(callbackId, NativeResponse.failure(code, errorMessage));
                    }
                };
                this.handler.handle(params, responder);
            } catch (JsonSyntaxException e) {
                String errorMsg = "Failed to parse JSON params for method: " + e.getMessage();
                sendCallback(callbackId, NativeResponse.failure(RESPONSE_CODE_PARSE_ERROR, errorMsg));
            } catch (Exception e) {
                String errorMsg = "Native handler execution failed: " + e.getMessage();
                sendCallback(callbackId, NativeResponse.failure(RESPONSE_CODE_HANDLER_FAILED, errorMsg));
            }
        }
    }
}
