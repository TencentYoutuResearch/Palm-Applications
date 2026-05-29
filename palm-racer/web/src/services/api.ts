import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { isNative } from '@/utils/environment';
import { logger } from '@/utils/logger';
import { generateTraceId } from '@/utils/traceId';

// In native WebView, the origin is appassets.androidplatform.net (no backend).
// API requests go through the same-origin proxy path /api-proxy/ which is
// intercepted by the Android Native layer (shouldInterceptRequest) and forwarded
// to the real Go backend, completely bypassing CORS restrictions.
function getBaseURL(): string {
  if (isNative()) {
    // Native WebView: 使用同源代理路径，由 Android Native 层拦截并转发到真实后端
    // /api-proxy/palm/xxx -> Native 代理 -> https://backend/api/palm/xxx
    return '/api-proxy';
  }
  // Web: 使用相对路径，确保在 Ingress 子路径部署时（如 /palm-racer/）
  // 请求能正确拼接为 /palm-racer/api/xxx，而不是 /api/xxx。
  // 注意：这要求页面 URL 以 / 结尾（如 /palm-racer/），
  // 服务端已对 /palm-racer 做了 301 重定向到 /palm-racer/。
  return './api';
}

/**
 * 动态更新 API baseURL（供原生侧通过 JSBridge 调用）。
 * 更新后会持久化到 localStorage，后续请求自动使用新地址。
 */
export function setApiBaseURL(url: string): void {
  localStorage.setItem('palmRacer_apiBaseURL', url);
  api.defaults.baseURL = url;
  logger.debug('API', `baseURL updated to: ${url}`);
}

/** Header name for per-request trace id, matching backend convention (X-Traceid). */
const TRACE_ID_HEADER = 'X-Traceid';

const api: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  // 15s：默认值需要覆盖跨公网 MySQL 查询 + 刷掌平台代理等较慢场景。
  // 更长的业务（如轮询识别）请在调用侧单独设置 timeout。
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject a fresh trace id on every outgoing request so the backend can
// correlate logs end-to-end. Callers can still override by setting
// X-Traceid explicitly on the request config.
api.interceptors.request.use((config) => {
  const headers: any = config.headers ?? {};
  const existing =
    headers[TRACE_ID_HEADER] ??
    headers[TRACE_ID_HEADER.toLowerCase()] ??
    headers['X-TraceId'];
  if (!existing) {
    const traceId = generateTraceId();
    if (typeof headers.set === 'function') {
      // AxiosHeaders instance (axios >= 1.x)
      headers.set(TRACE_ID_HEADER, traceId);
    } else {
      headers[TRACE_ID_HEADER] = traceId;
    }
    config.headers = headers;
  }
  return config;
});

// Native WebView API 代理拦截器：
// Android WebView 的 shouldInterceptRequest 无法获取 POST 请求体，
// 因此将 body 以 Base64 编码放入自定义 header X-Proxy-Body 中传递给 Native 层。
if (isNative()) {
  api.interceptors.request.use((config) => {
    if (config.data != null) {
      const bodyStr = typeof config.data === 'string'
        ? config.data
        : JSON.stringify(config.data);
      const headers: any = config.headers ?? {};
      // Base64 编码 body，Native 层会解码并作为请求体转发
      if (typeof headers.set === 'function') {
        headers.set('X-Proxy-Body', btoa(unescape(encodeURIComponent(bodyStr))));
      } else {
        headers['X-Proxy-Body'] = btoa(unescape(encodeURIComponent(bodyStr)));
      }
      config.headers = headers;
    }
    return config;
  });
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    logger.error('API', error.message);
    return Promise.reject(error);
  }
);

export default api;
