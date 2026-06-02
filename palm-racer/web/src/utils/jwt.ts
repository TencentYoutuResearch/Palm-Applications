/**
 * JWT 本地解析工具（仅读 payload，不验签——验签是服务端的事）。
 *
 * 用途：在不发请求的前提下判断 token 是否已过期，避免「明知会失败」的请求
 * 浪费往返时延、也避免误把过期 token 带进游戏导致中途被踢。
 *
 * 安全说明：本地解析的结果不能作为安全决策依据（任何人都能伪造一个
 * "exp 在未来" 的 token）。这里仅用于体验优化——服务端仍会做完整验签。
 */

/** JWT payload 中我们关心的字段。其它字段（iat、uid 等）按需扩展。 */
export interface JWTPayload {
  exp?: number; // unix 秒；未设置表示永不过期
  uid?: string;
  iat?: number;
}

/** base64url → utf-8 字符串。Web 平台原生 atob 用的是 base64（带 +/）。 */
function base64UrlDecode(input: string): string {
  // base64url 把 '+/' 替换成了 '-_'，'=' padding 也省略了，先还原。
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  // atob 返回二进制字符串，需要按 utf-8 解码以支持非 ASCII 内容。
  const bin = atob(b64);
  try {
    return decodeURIComponent(
      bin
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return bin; // 退化为 ASCII，仍能解 exp/uid 这种数字/英文字段
  }
}

/**
 * 解析 JWT payload；token 格式非法时返回 null。
 * 不做签名校验——签名信任完全交给服务端。
 */
export function parseJwtPayload(token: string): JWTPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * 判断 token 是否已过期。
 *
 * 行为：
 *   - 空字符串 / 解析失败 → 视为已过期（保守策略，让流程提早走重新登录）
 *   - 没有 exp 字段       → 视为永不过期（与服务端 ttl=0 行为对齐）
 *   - exp <= now          → 已过期
 *
 * skewSeconds 为允许的客户端时钟漂移（默认 5 秒），对临界状态稍微宽容，
 * 避免「服务端判 OK 客户端判过期」造成误拦。
 */
export function isJwtExpired(token: string, skewSeconds = 5): boolean {
  const payload = parseJwtPayload(token);
  if (!payload) return true;
  if (!payload.exp || payload.exp <= 0) return false; // 不过期
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp + skewSeconds <= nowSec;
}
