/**
 * Palm biometric API service (Web mode only).
 *
 * In native mode, palm operations go through JSBridge → PalmMobileManager SDK.
 * In web mode, they go through this service → Go backend → Palm Platform.
 */
import api from './api';
import { SEARCH_TIMEOUT } from '@/config/platformConfig';

/** Response from 1:N palm recognition API. */
export interface PalmSearchResponse {
  /** API return code: 0 = matched, non-zero = error. */
  code: number;
  message: string;
  userId: string;
  userName: string;
  tenantName: string;
}

/**
 * Perform 1:N palm recognition via the Go backend proxy.
 *
 * Never throws on API-level errors (code != 0) — always returns
 * a structured response so callers can handle each code explicitly.
 * Only throws on network / transport errors.
 */
export async function searchRgbPalm(
  imageBase64: string,
  _imageDigest?: string
): Promise<PalmSearchResponse> {
  const resp: any = await api.post(
    '/palm/search_rgb_palm',
    {
      RgbImage: {
        Data: imageBase64,
        ImageType: 1,
      },
    },
    { timeout: SEARCH_TIMEOUT }
  );

  const code = resp.Code ?? resp.code ?? -1;
  const message = resp.Message ?? resp.message ?? '';
  const data = resp.Data ?? resp.data ?? {};

  return {
    code,
    message,
    userId: data.UserId || data.userId || '',
    userName: data.UserName || data.userName || data.UserId || data.userId || '',
    tenantName: data.TenantName || data.tenantName || '',
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
  const resp: any = await api.post(
    '/palm/register_rgb_palm',
    {
      UserId: userId,
      RgbImage: {
        Data: imageBase64,
        ImageType: 1,
      },
      IsForce: isForce,
    },
    { timeout: SEARCH_TIMEOUT }
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
