/**
 * Obstacle type definitions and game constants.
 *
 * Shared by ObstacleManager, ObstaclePool, and ObstacleMeshFactory.
 */

import { Mesh } from '@babylonjs/core/Meshes/mesh';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Obstacle type identifier. */
export type ObstacleKind = 'npc' | 'barrier' | 'barrel' | 'boost' | 'coin' | 'heart';

/** Collision response returned via callbacks. */
export interface CollisionResponse {
  /** Damage to player lives (negative = heal). */
  livesChange: number;
  /** Score delta. */
  scoreDelta: number;
  /** Speed multiplier applied on impact (e.g. 0.5 = lose 50% speed). */
  speedMultiplier: number;
  /** Minimum speed floor after impact (km/h). */
  speedFloor: number;
  /** Lateral push direction (-1 left, +1 right, 0 none). */
  pushDirection: number;
  /** Push magnitude. */
  pushMagnitude: number;
  /** Screen shake duration (seconds). */
  shakeDuration: number;
  /** Red flash duration (seconds). */
  flashDuration: number;
  /** Invincibility duration granted (seconds, 0 = none). */
  invincibleDuration: number;
  /** Whether this obstacle grants a speed boost. */
  isBoost: boolean;
  /** Computed boost amount (only meaningful when isBoost is true). */
  boostAmount: number;
  /** Sound key to play. */
  sound: 'coin' | 'boost' | 'heart' | 'slowdown' | 'crash' | null;
}

/** Internal obstacle data. */
export interface Obstacle {
  kind: ObstacleKind;
  mesh: Mesh;
  extraMeshes: Mesh[];
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  selfSpeed: number;
  collected: boolean;

  // Behaviour flags (match original booleans)
  coin: boolean;
  boost: boolean;
  heal: boolean;
  slowdown: boolean;
  damage: boolean;

  // Animation state
  spinAngle: number;
  bobPhase: number;
}

/** Road configuration consumed by the manager. */
export interface RoadConfig {
  width: number;
  laneCount: number;
}

/** Difficulty stage definition. */
export interface DifficultyStageConfig {
  /** Time threshold in seconds to enter this stage. */
  timeThreshold: number;
  /** Base spawn interval in seconds. */
  spawnInterval: number;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
}

/** Spawn weight definition per obstacle kind. */
export interface SpawnWeight {
  kind: ObstacleKind;
  /** Base chance at stage 0. */
  base: number;
  /** Additional chance per difficulty stage. */
  perStage: number;
  /** Optional minimum clamp. */
  min?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Spawn-weight table.
 *
 * At stage 0 the effective probabilities are:
 *   NPC 25%, barrier 12%, barrel 8%, boost 12%, heart 8%, coin = remainder (~35%)
 *
 * At stage 5 the effective probabilities shift towards:
 *   NPC ~49%, barrier ~22%, barrel ~13%, boost 12%, heart ~3%, coin = remainder
 */
export const SPAWN_WEIGHTS: SpawnWeight[] = [
  { kind: 'npc',     base: 0.25, perStage: 0.04 },
  { kind: 'barrier', base: 0.12, perStage: 0.02 },
  { kind: 'barrel',  base: 0.08, perStage: 0.01 },
  { kind: 'boost',   base: 0.12, perStage: 0 },
  { kind: 'heart',   base: 0.08, perStage: -0.01, min: 0.04 },
  // coin is implicit remainder
];

export const DIFFICULTY_STAGES: DifficultyStageConfig[] = [
  { timeThreshold: 0,   spawnInterval: 1.5,  name: 'Warm-up',       description: 'Get familiar' },
  { timeThreshold: 30,  spawnInterval: 1.2,  name: 'City Circuit',  description: 'More obstacles' },
  { timeThreshold: 60,  spawnInterval: 0.9,  name: 'Highway',       description: 'Speed up' },
  { timeThreshold: 100, spawnInterval: 0.7,  name: 'Speed Trial',   description: 'Multi obstacles' },
  { timeThreshold: 150, spawnInterval: 0.5,  name: 'Death Race',    description: 'Extreme dodge' },
  { timeThreshold: 210, spawnInterval: 0.35, name: 'Hell Mode',     description: 'Survival' },
];

/** Car collision half-extents (AABB). */
export const CAR_HALF_W = 0.9;
export const CAR_HALF_D = 2.1;

/** Z position where obstacles are spawned. */
export const SPAWN_Z = -80;

/** Z position beyond which obstacles are removed (+Z = behind car). */
export const DESPAWN_Z = 15;

/** Score awarded when an NPC car passes the player without collision. */
export const NPC_DODGE_SCORE = 30;

/** Maximum pool size per obstacle kind. */
export const POOL_MAX_PER_KIND = 12;
