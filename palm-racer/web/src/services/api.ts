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

// Auto-inject `Authorization: Bearer <token>` from localStorage so
// scoring/auth-protected endpoints work transparently. Read directly from
// localStorage instead of pinia store to avoid module init order issues
// (this file is imported by services that may load before the store).
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('palmRacer_user');
    if (!raw) return config;
    const parsed = JSON.parse(raw);
    const token: string = parsed?.token ?? '';
    if (!token) return config;
    const headers: any = config.headers ?? {};
    const has = headers['Authorization'] ?? headers['authorization']
      ?? (typeof headers.get === 'function' ? headers.get('Authorization') : undefined);
    if (has) return config;
    if (typeof headers.set === 'function') {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }
    config.headers = headers;
  } catch { /* ignore */ }
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

// 服务端登录态错误码：
//   2001 token 缺失/非法（签名错、格式错、被篡改）→ 严格踢登录
//   2006 token 签名合法但已过期                     → 同样跳登录，但语义更友好
// 两者前端处理方式当前一致（都跳登录页），保留两个常量便于未来差异化（如
// 2006 时保留 game store 状态、2001 时彻底清理等）。
const UNAUTHORIZED_CODE = 2001;
const TOKEN_EXPIRED_CODE = 2006;
const USER_STORAGE_KEY = 'palmRacer_user';

/**
 * 处理身份 token 失效：清空持久化用户 + 跳到登录页。
 *
 * - localStorage 清空：刷新或下次启动时不会再用旧 token
 * - 页面 reload：让 pinia store 从空 localStorage 重建，触发路由守卫重定向。
 *   单纯改 hash 不够，因为 pinia 内存里的 userId 还在 → isLoggedIn=true →
 *   守卫不会重定向，会被卡在错误的页面上。
 *
 * 在此模块里直接用 window.location 而不引入 vue-router/pinia，避免循环依赖。
 * 仅在非登录页时执行，避免登录流程被自身误触。
 */
function handleUnauthorized(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch { /* ignore */ }
  if (window.location.hash.includes('/login')) return;
  logger.warn('API', 'identity token rejected, redirect to login');
  // 先把 hash 切到 /login（带 reason 让登录页显示提示），再 reload：
  // reload 后路由直接落在登录页，而非先回到旧路由再跳一次。
  window.location.hash = '#/login?reason=expired';
  window.location.reload();
}

api.interceptors.response.use(
  (response) => {
    // grpc-gateway 风格的业务错误码（HTTP 200 + Code 字段）
    const data: any = response.data;
    if (data && typeof data === 'object') {
      if (data.Code === UNAUTHORIZED_CODE || data.Code === TOKEN_EXPIRED_CODE) {
        handleUnauthorized();
      }
    }
    return data;
  },
  (error) => {
    logger.error('API', error.message);
    return Promise.reject(error);
  }
);

export default api;
