/**
 * Hand tracking type definitions.
 */

export interface GestureState {
  /** Steering: -1 (full left) to 1 (full right) */
  steerX: number;
  /** Throttle: 0 (idle) to 1 (full throttle) */
  throttle: number;
  /** True when fist gesture is confirmed */
  isBraking: boolean;
  /** Palm quality score 0-1 for login/anti-cheat */
  palmQuality: number;
  /** Whether a hand is currently detected */
  isHandDetected: boolean;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = HandLandmark[];
