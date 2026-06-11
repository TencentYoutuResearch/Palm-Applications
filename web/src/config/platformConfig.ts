/**
 * @file platformConfig.ts
 * @description Centralized platform timeout and retry configuration.
 *
 * Extracted from NativePlatform.ts and WebPlatform.ts to eliminate
 * inconsistent hardcoded constants and make tuning easier.
 */

/** Maximum number of recognition attempts before giving up. */
export const MAX_RETRIES = 10;

/** Interval between recognition attempts (ms). */
export const RETRY_INTERVAL = 1500;

/** Timeout for opening camera (ms). */
export const CAMERA_TIMEOUT = 8000;

/** Timeout for a single 1:N search call (ms). Upper bound enforced by axios. */
export const SEARCH_TIMEOUT = 30000;

/**
 * Per-platform stabilization delays.
 *
 * Native cameras (CameraX) need more time to stabilize than PC webcams.
 * These values are intentionally different.
 */
export const STABILIZE_DELAY = {
  /** Delay before first capture on native platform (ms). */
  native: 800,
  /** Delay before first capture on web platform (ms). */
  web: 300,
} as const;

/** Anti-cheat consecutive failure threshold before flagging as cheat. */
export const ANTI_CHEAT_FAIL_THRESHOLD = 3;

/**
 * Internal sentinel for user-cancelled palm scan.
 * Used in throw/catch comparisons — NOT displayed to the user.
 */
export const USER_CANCELLED_PALM = 'USER_CANCELLED_PALM';
