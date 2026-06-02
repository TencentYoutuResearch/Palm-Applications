/**
 * Game lifecycle API service: start-of-game session bootstrap, etc.
 *
 * StartGame must be called at the beginning of every run by an authenticated
 * (palm-logged-in) user. The server verifies the bearer token and issues a
 * one-shot per-game `sid` that must be presented when submitting the score.
 *
 * The server may also return a refreshed identity token in `Data.Token` when
 * the original token is close to expiry — callers should write it back to the
 * user store so the player stays logged in seamlessly.
 */
import api from './api';

/** Wire format from /api/game/start. */
interface RawStartGameResponse {
  Code?: number;
  Message?: string;
  Data?: {
    Sid?: string;
    /** 续命后的身份 token；为空则无需更新登录态。 */
    Token?: string;
  };
}

/** Result of starting a game session. */
export interface StartGameResult {
  /** 单局 session 标识：必填，用于反作弊核身续期与 SubmitScore。 */
  sid: string;
  /** 服务端续命下发的新身份 token；为空则保持原 token。 */
  refreshedToken: string;
}

/**
 * Begin a new game session. Returns the server-issued `sid` (and an optional
 * refreshed login token to be written back into user store).
 *
 * Throws on transport errors or when the server rejects authentication.
 */
export async function startGame(): Promise<StartGameResult> {
  const resp: RawStartGameResponse = await api.post('/game/start', {});
  if (resp?.Code !== 0 || !resp.Data?.Sid) {
    throw new Error(resp?.Message || 'startGame failed');
  }
  return {
    sid: resp.Data.Sid,
    refreshedToken: resp.Data.Token ?? '',
  };
}
