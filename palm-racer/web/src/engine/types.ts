/**
 * Game engine shared type definitions.
 */

export type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

export interface GameStats {
  score: number;
  maxSpeed: number;
  surviveTime: number;
  comboMax: number;
  cheated: boolean;
  /** 替玩者的 userId（防作弊检测到的最后一个替玩用户） */
  cheatUserId: string;
}

// CarState is defined in CarController.ts and re-exported here for convenience
export type { CarState } from './CarController';

export interface HandInput {
  /** Steering: -1 (full left) to 1 (full right) */
  steerX: number;
  /** Throttle: 0 (idle) to 1 (full throttle) */
  throttle: number;
  /** Braking: true when fist detected */
  isBraking: boolean;
}

export type CameraMode = 'chase' | 'cockpit' | 'top';

export type ProgressCallback = (progress: number) => void;

export interface ObstacleType {
  id: string;
  spawnWeight: number;
  isCollectible: boolean;
  scoreValue: number;
}

export interface DifficultyStage {
  level: number;
  name: string;
  description: string;
  spawnInterval: number;
  speedMultiplier: number;
}
