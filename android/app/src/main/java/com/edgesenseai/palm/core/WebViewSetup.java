// Copyright (C) 2026 EdgeSenseAI contributors. Licensed under MIT.

package com.edgesenseai.palm.core;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import com.edgesenseai.palmracer.BuildConfig;

public final class WebViewSetup {

    private final WebView webView;
    private Context assetLoaderContext = null;
    private WebViewClient client = null;

    private WebViewSetup(@NonNull WebView webView) {
        this.webView = webView;
    }

    public static WebViewSetup with(@NonNull WebView webView) {
        return new WebViewSetup(webView);
    }

    public WebViewSetup enableAssetLoader(@NonNull Context context) {
        this.assetLoaderContext = context;
        return this;
    }

    public WebViewSetup setClient(@Nullable WebViewClient client) {
        this.client = client;
        return this;
    }

    public void apply() {
        applyWebSettings(webView.getSettings());

        WebViewClient finalClient = this.client;

        if (assetLoaderContext != null) {
            finalClient = new AssetLoaderWebViewClient(assetLoaderContext, finalClient);
        }

        if (finalClient != null) {
            webView.setWebViewClient(finalClient);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void applyWebSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    private static class AssetLoaderWebViewClient extends WebViewClient {
        private final WebViewAssetLoader assetLoader;
        private final WebViewClient delegate;

        AssetLoaderWebViewClient(@NonNull Context context, @Nullable WebViewClient delegate) {
            this.assetLoader = new WebViewAssetLoader.Builder()
                    .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(context))
                    .build();
            this.delegate = (delegate != null) ? delegate : new WebViewClient();
        }

        @Override
        @Nullable
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
            return (response != null) ? response : delegate.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            return delegate.shouldOverrideUrlLoading(v, r);
        }

        @Override
        public void onPageStarted(WebView v, String u, Bitmap b) {
            delegate.onPageStarted(v, u, b);
        }

        @Override
        public void onPageFinished(WebView v, String u) {
            delegate.onPageFinished(v, u);
        }

        @Override
        public void onLoadResource(WebView v, String u) {
            delegate.onLoadResource(v, u);
        }

        @Override
        public void onPageCommitVisible(WebView v, String u) {
            delegate.onPageCommitVisible(v, u);
        }
    }
}
