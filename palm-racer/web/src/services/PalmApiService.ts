/**
 * Palm biometric API service.
 *
 * In native mode, palm API requests go through JSBridge → Native HttpURLConnection
 * to bypass WebView's header size limitation for large base64 image bodies.
 * In web mode, they go through axios → Go backend → Palm Platform.
 */
import api from './api';
import { SEARCH_TIMEOUT } from '@/config/platformConfig';
import { isNative } from '@/utils/environment';
import bridge from '@/bridge/JSBridge';
import { logger } from '@/utils/logger';

/**
 * 通过 Native JSBridge 发送 POST 请求（绕过 WebView header 大小限制）。
 * 仅在 Native 模式下使用。
 */
async function nativePost(path: string, body: Record<string, unknown>, timeout: number): Promise<any> {
  const baseUrl = localStorage.getItem('palmRacer_apiBaseURL') || '';

  let fullUrl: string;
  if (baseUrl.startsWith('http')) {
    // 完整 URL，如 https://open.intl.palm.tencent.com/palm-racer/api
    fullUrl = baseUrl + path;
  } else {
    // 兜底：如果 localStorage 中没有完整 URL，尝试通过 JSBridge 获取
    try {
      const config = await bridge.call<{ apiBaseURL?: string }>('getApiConfig', {}, { timeout: 3000 });
      if (config?.apiBaseURL?.startsWith('http')) {
        fullUrl = config.apiBaseURL + path;
      } else {
        throw new Error('Cannot determine backend URL for native POST');
      }
    } catch (e) {
      throw new Error('Cannot determine backend URL: ' + (e as Error).message);
    }
  }

  logger.debug('PalmAPI', `nativePost: ${fullUrl}`);

  const result = await bridge.call<{ status: number; body: string }>(
    'nativePost',
    { url: fullUrl, body: JSON.stringify(body), timeout },
    { timeout: timeout + 5000 } // JSBridge 超时比 HTTP 超时多 5s
  );

  if (!result || result.status >= 400) {
    throw new Error(`HTTP ${result?.status || 'unknown'}: ${result?.body || 'No response'}`);
  }

  // 解析 JSON 响应
  try {
    return JSON.parse(result.body);
  } catch {
    throw new Error(`Invalid JSON response: ${result.body?.substring(0, 100)}`);
  }
}

/**
 * 统一的 POST 请求方法：Native 模式走 JSBridge，Web 模式走 axios。
 */
async function palmPost(path: string, body: Record<string, unknown>, timeout: number): Promise<any> {
  if (isNative()) {
    return nativePost(path, body, timeout);
  }
  return api.post(path, body, { timeout });
}

/** Response from 1:N palm recognition API. */
export interface PalmSearchResponse {
  /** API return code: 0 = matched, non-zero = error. */
  code: number;
  message: string;
  userId: string;
  userName: string;
  tenantName: string;
  /** 服务端在 1:N 登录成功时下发的身份 token（仅登录场景非空）。 */
  token: string;
}

/**
 * Perform 1:N palm recognition via the Go backend proxy.
 *
 * Never throws on API-level errors (code != 0) — always returns
 * a structured response so callers can handle each code explicitly.
 * Only throws on network / transport errors.
 *
 * @param imageBase64  掌纹图片 base64
 * @param _imageDigest 兼容参数，未使用
 * @param sid          可选：传入则告知服务端这是「局中反作弊核身」，用于为该单局 session 续期
 *                     并在核到他人时标记替玩；登录场景留空。
 */
export async function searchRgbPalm(
  imageBase64: string,
  _imageDigest?: string,
  sid?: string
): Promise<PalmSearchResponse> {
  const body: Record<string, unknown> = {
    RgbImage: {
      Data: imageBase64,
      ImageType: 1,
    },
  };
  if (sid) body.Sid = sid;

  const resp: any = await palmPost('/palm/search_rgb_palm', body, SEARCH_TIMEOUT);

  const code = resp.Code ?? resp.code ?? -1;
  const message = resp.Message ?? resp.message ?? '';
  const data = resp.Data ?? resp.data ?? {};
  const token = resp.Token ?? resp.token ?? '';

  return {
    code,
    message,
    userId: data.UserId || data.userId || '',
    userName: data.UserName || data.userName || data.UserId || data.userId || '',
    tenantName: data.TenantName || data.tenantName || '',
    token,
  };
}

/** Response from palm registration API. */
export interface PalmRegisterResponse {
  /** API return code: 0 = success, non-zero = error. */
  code: number;
  message: string;
  /** 掌纹 ID */
  palmId: string;
}

/**
 * 注册 RGB 手掌到刷掌平台。
 *
 * @param userId 用户自定义 ID
 * @param imageBase64 base64 编码的 JPEG 图像
 * @param _imageDigest 图像摘要（不再需要，保留参数兼容）
 * @param isForce 是否强制换绑，默认 true
 */
export async function registerRgbPalm(
  userId: string,
  imageBase64: string,
  _imageDigest?: string,
  isForce = true
): Promise<PalmRegisterResponse> {
  const resp: any = await palmPost(
    '/palm/register_rgb_palm',
    {
      UserId: userId,
      RgbImage: {
        Data: imageBase64,
        ImageType: 1,
      },
      IsForce: isForce,
    },
    SEARCH_TIMEOUT
  );

  const code = resp.Code ?? resp.code ?? -1;
  const message = resp.Message ?? resp.message ?? '';
  const data = resp.Data ?? resp.data ?? {};

  return {
    code,
    message,
    palmId: data.PalmId || data.palmId || '',
  };
}
