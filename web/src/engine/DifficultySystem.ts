/**
 * DifficultySystem - Six-stage progressive difficulty for PalmRacer 3D.
 *
 * Stage thresholds (seconds): [0, 30, 60, 100, 150, 210]
 * Each stage adjusts obstacle spawn interval and speed multiplier.
 */

import { getI18nT } from '../main';

/** Public description of a single difficulty stage. */
export interface DifficultyStage {
  /** Stage index (0-5). */
  level: number;
  /** Display name with emoji prefix. */
  name: string;
  /** Short description of the stage. */
  description: string;
  /** Time between obstacle spawns (seconds). */
  spawnInterval: number;
  /** Multiplier applied to obstacle / NPC speed. */
  speedMultiplier: number;
}

// ---- Static stage data (mirrors original JS exactly) ----

const STAGE_THRESHOLDS: readonly number[] = [0, 30, 60, 100, 150, 210];

const STAGE_NAME_KEYS: readonly string[] = [
  'game.difficulty.stage0',
  'game.difficulty.stage1',
  'game.difficulty.stage2',
  'game.difficulty.stage3',
  'game.difficulty.stage4',
  'game.difficulty.stage5',
];

const STAGE_DESC_KEYS: readonly string[] = [
  'game.difficulty.desc0',
  'game.difficulty.desc1',
  'game.difficulty.desc2',
  'game.difficulty.desc3',
  'game.difficulty.desc4',
  'game.difficulty.desc5',
];

const STAGE_SPAWN_INTERVALS: readonly number[] = [1.5, 1.2, 0.9, 0.7, 0.5, 0.35];

const STAGE_SPEED_MULTIPLIERS: readonly number[] = [1.0, 1.0, 1.2, 1.4, 1.6, 1.8];

export class DifficultySystem {
  private currentLevel_: number = 0;

  constructor() {
    this.reset();
  }

  /**
   * Call once per frame with the total elapsed game time.
   *
   * @param gameTime - Elapsed game time in seconds.
   * @returns The new DifficultyStage if the stage just changed, or `null`
   *          if no change occurred.
   */
  update(gameTime: number): DifficultyStage | null {
    let newLevel = this.currentLevel_;
    for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; --i) {
      if (gameTime >= STAGE_THRESHOLDS[i]) {
        newLevel = i;
        break;
      }
    }

    if (newLevel !== this.currentLevel_) {
      this.currentLevel_ = newLevel;
      return this.buildStage_(newLevel);
    }
    return null;
  }

  /** Get the current difficulty stage descriptor. */
  getCurrentStage(): DifficultyStage {
    return this.buildStage_(this.currentLevel_);
  }

  /** Convenience: get the current spawn interval in seconds. */
  getSpawnInterval(): number {
    return STAGE_SPAWN_INTERVALS[this.currentLevel_] ?? 0.35;
  }

  /** Get the current stage speed multiplier. */
  getSpeedMultiplier(): number {
    return STAGE_SPEED_MULTIPLIERS[this.currentLevel_] ?? 1.8;
  }

  /** Get the current stage level (0-5). */
  get level(): number {
    return this.currentLevel_;
  }

  /** Reset to stage 0. */
  reset(): void {
    this.currentLevel_ = 0;
  }

  // ---- Private ----

  private buildStage_(level: number): DifficultyStage {
    const t = getI18nT();
    return {
      level,
      name: STAGE_NAME_KEYS[level] ? t(STAGE_NAME_KEYS[level]) : '',
      description: STAGE_DESC_KEYS[level] ? t(STAGE_DESC_KEYS[level]) : '',
      spawnInterval: STAGE_SPAWN_INTERVALS[level] ?? 0.35,
      speedMultiplier: STAGE_SPEED_MULTIPLIERS[level] ?? 1.8,
    };
  }
}
