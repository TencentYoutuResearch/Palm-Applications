/**
 * ObstacleManager - Obstacle spawning, movement, collision and recycling system.
 *
 * Manages all obstacle lifecycle including:
 * - Difficulty-staged spawning with weighted random obstacle types
 * - Multi-lane combo obstacles at high difficulty
 * - AABB collision detection
 * - Object pooling for mesh reuse (delegated to ObstaclePool)
 * - Event-driven collision/collect callbacks
 *
 * Mesh creation is delegated to ObstacleMeshFactory.
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

import type {
  ObstacleKind,
  CollisionResponse,
  Obstacle,
  RoadConfig,
  DifficultyStageConfig,
} from './obstacle/types';
import {
  SPAWN_WEIGHTS,
  DIFFICULTY_STAGES,
  CAR_HALF_W,
  CAR_HALF_D,
  SPAWN_Z,
  DESPAWN_Z,
  NPC_DODGE_SCORE,
} from './obstacle/types';
import { ObstaclePool, disposeMeshes } from './obstacle/ObstaclePool';
import { ObstacleMeshFactory } from './obstacle/ObstacleMeshFactory';

// Re-export types for consumers that import from this file
export type { ObstacleKind, CollisionResponse, Obstacle, RoadConfig, DifficultyStageConfig };

export class ObstacleManager {
  // Dependencies
  private scene: Scene;
  private roadConfig: RoadConfig;

  // Active obstacles
  private obstacles: Obstacle[] = [];

  // Spawn timing
  private spawnTimer = 0;
  private spawnInterval = 1.5;

  // Difficulty
  private difficultyStage = 0;
  private gameTime = 0;

  // Delegates
  private pool: ObstaclePool;
  private meshFactory: ObstacleMeshFactory;

  // Event callbacks
  public onCollision: ((response: CollisionResponse, obstacle: Obstacle) => void) | null = null;
  public onCollect: ((kind: ObstacleKind, obstacle: Obstacle) => void) | null = null;
  public onDodge: ((kind: ObstacleKind, score: number) => void) | null = null;
  public onStageChange: ((stage: number, config: DifficultyStageConfig) => void) | null = null;

  constructor(scene: Scene, roadConfig: RoadConfig) {
    this.scene = scene;
    this.roadConfig = roadConfig;
    this.pool = new ObstaclePool();
    this.meshFactory = new ObstacleMeshFactory(scene);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Attach an optional shadow generator so NPC cars cast shadows. */
  setShadowGenerator(sg: ShadowGenerator): void {
    this.meshFactory.setShadowGenerator(sg);
  }

  /** Current difficulty stage index (0-5). */
  get stage(): number {
    return this.difficultyStage;
  }

  /** Current difficulty stage config. */
  get stageConfig(): DifficultyStageConfig {
    return DIFFICULTY_STAGES[this.difficultyStage];
  }

  /** Read-only view of active obstacles. */
  get activeObstacles(): ReadonlyArray<Obstacle> {
    return this.obstacles;
  }

  /**
   * Main per-frame update.
   *
   * @param dt          Delta time in seconds.
   * @param carX        Car lateral position (normalised -1..1 mapped to road).
   * @param carSpeed    Car speed in km/h (used for scroll speed).
   * @param gameTime    Total elapsed game time in seconds.
   * @param isInvincible Whether the car is currently invincible.
   */
  update(
    dt: number,
    carX: number,
    carSpeed: number,
    gameTime: number,
    isInvincible: boolean,
  ): void {
    this.gameTime = gameTime;
    const scrollSpeed = carSpeed * 0.278; // km/h -> m/s

    // ----- Difficulty progression -----
    this.updateDifficulty();

    // ----- Spawn timing -----
    this.updateSpawning(dt);

    // ----- Update all active obstacles -----
    this.updateObstacles(dt, scrollSpeed, carX, carSpeed, isInvincible);
  }

  /**
   * Update spawn timer and trigger spawning when interval is reached.
   */
  private updateSpawning(dt: number): void {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }
  }

  /**
   * Update all active obstacles: movement, animations, collisions, and despawning.
   */
  private updateObstacles(
    dt: number,
    scrollSpeed: number,
    carX: number,
    carSpeed: number,
    isInvincible: boolean,
  ): void {
    for (let i = this.obstacles.length - 1; i >= 0; --i) {
      const obs = this.obstacles[i];

      // Update position based on scroll speed
      this.updateObstaclePosition(obs, scrollSpeed, dt);

      // Update animations (spin, bob, etc.)
      this.updateObstacleAnimations(obs, dt);

      // Check despawn behind player
      if (obs.z > DESPAWN_Z) {
        if (obs.kind === 'npc') {
          this.onDodge?.('npc', NPC_DODGE_SCORE);
        }
        this.recycleObstacle(obs, i);
        continue;
      }

      // Handle collision if not already collected
      if (!obs.collected && this.checkCollision(obs, carX)) {
        this.handleCollision(obs, i, carX, carSpeed, isInvincible);
      }
    }
  }

  /**
   * Update obstacle position based on scroll speed.
   * NPC cars have their own forward speed; relative speed determines scroll.
   */
  private updateObstaclePosition(obs: Obstacle, scrollSpeed: number, dt: number): void {
    obs.z += (scrollSpeed - obs.selfSpeed) * dt;

    // Sync mesh position
    if (obs.mesh && !obs.mesh.isDisposed()) {
      obs.mesh.position.z = obs.z;
    }

    // Sync extra mesh positions with offsets
    for (const m of obs.extraMeshes) {
      if (m && !m.isDisposed()) {
        m.position.z = obs.z + ((m as any)._offsetZ ?? 0);
      }
    }
  }

  /**
   * Update obstacle animations (spin, bob, etc.).
   */
  private updateObstacleAnimations(obs: Obstacle, dt: number): void {
    // Coin spin animation
    if (obs.coin && obs.mesh && !obs.mesh.isDisposed()) {
      this.updateCoinAnimation(obs, dt);
    }

    // Heart bob animation
    if (obs.heal && obs.mesh && !obs.mesh.isDisposed()) {
      this.updateHeartAnimation(obs, dt);
    }
  }

  /**
   * Update coin spin animation on both primary and extra meshes.
   */
  private updateCoinAnimation(obs: Obstacle, dt: number): void {
    obs.spinAngle += dt * 3;
    obs.mesh!.rotation.x = Math.PI / 2;
    obs.mesh!.rotation.y = obs.spinAngle;

    for (const m of obs.extraMeshes) {
      if (m && !m.isDisposed()) {
        m.rotation.y = obs.spinAngle;
      }
    }
  }

  /**
   * Update heart bob animation on both primary and extra meshes.
   */
  private updateHeartAnimation(obs: Obstacle, dt: number): void {
    obs.bobPhase += dt * 3;
    const bobY = 0.9 + Math.sin(obs.bobPhase) * 0.12;
    obs.mesh!.position.y = bobY;

    for (const m of obs.extraMeshes) {
      if (m && !m.isDisposed()) {
        // Keep relative Y offsets for composite hearts
        if (obs.kind === 'heart') {
          const baseY = (m as any)._baseY ?? m.position.y;
          (m as any)._baseY = baseY;
          m.position.y = baseY + Math.sin(obs.bobPhase) * 0.12;
        }
      }
    }
  }

  /**
   * External collision query. Returns the first colliding obstacle or null.
   */
  queryCollision(carX: number): Obstacle | null {
    for (const obs of this.obstacles) {
      if (!obs.collected && this.checkCollision(obs, carX)) {
        return obs;
      }
    }
    return null;
  }

  /** Force-spawn a single obstacle (useful for testing). */
  spawnObstacle(): void {
    const stage = this.difficultyStage;
    const laneWidth = this.roadConfig.width / this.roadConfig.laneCount;

    // High-difficulty multi-lane combo
    const multiLaneChance = stage >= 3 ? 0.25 + (stage - 3) * 0.1 : 0;
    if (Math.random() < multiLaneChance) {
      this.spawnMultiLaneObstacle();
      return;
    }

    const lane = Math.floor(Math.random() * this.roadConfig.laneCount);
    const x = -this.roadConfig.width / 2 + laneWidth / 2 + lane * laneWidth;

    const obs = this.createObstacleByWeight(x, SPAWN_Z, stage);
    this.obstacles.push(obs);
  }

  /** Reset all obstacles and timers (e.g. on game restart). */
  reset(): void {
    this.clearAll();
    this.spawnTimer = 0;
    this.spawnInterval = DIFFICULTY_STAGES[0].spawnInterval;
    this.difficultyStage = 0;
    this.gameTime = 0;
  }

  /** Dispose all meshes, pools and materials. */
  dispose(): void {
    this.clearAll();
    this.pool.dispose();
    this.meshFactory.dispose();
  }

  // -----------------------------------------------------------------------
  // Difficulty
  // -----------------------------------------------------------------------

  private updateDifficulty(): void {
    let newStage = this.difficultyStage;
    for (let i = DIFFICULTY_STAGES.length - 1; i >= 0; --i) {
      if (this.gameTime >= DIFFICULTY_STAGES[i].timeThreshold) {
        newStage = i;
        break;
      }
    }
    if (newStage !== this.difficultyStage) {
      this.difficultyStage = newStage;
      this.spawnInterval = DIFFICULTY_STAGES[newStage].spawnInterval;
      this.onStageChange?.(newStage, DIFFICULTY_STAGES[newStage]);
    }
  }

  // -----------------------------------------------------------------------
  // Spawning
  // -----------------------------------------------------------------------

  private createObstacleByWeight(x: number, z: number, stage: number): Obstacle {
    const rand = Math.random();
    let cumulative = 0;

    for (const sw of SPAWN_WEIGHTS) {
      let chance = sw.base + stage * sw.perStage;
      if (sw.min !== undefined) {
        chance = Math.max(sw.min, chance);
      }
      cumulative += chance;
      if (rand < cumulative) {
        const obs = this.createObstacle(sw.kind, x, z);
        // Higher stage -> faster NPC
        if (sw.kind === 'npc' && stage >= 2) {
          obs.selfSpeed = 30 + Math.random() * 60 + stage * 10;
        }
        return obs;
      }
    }

    // Remainder -> coin
    return this.createObstacle('coin', x, z);
  }

  private spawnMultiLaneObstacle(): void {
    const laneWidth = this.roadConfig.width / this.roadConfig.laneCount;
    const safeLane = Math.floor(Math.random() * this.roadConfig.laneCount);

    for (let lane = 0; lane < this.roadConfig.laneCount; ++lane) {
      const x = -this.roadConfig.width / 2 + laneWidth / 2 + lane * laneWidth;
      if (lane === safeLane) {
        const kind: ObstacleKind = Math.random() < 0.6 ? 'coin' : 'boost';
        this.obstacles.push(this.createObstacle(kind, x, SPAWN_Z));
      } else {
        const r = Math.random();
        const kind: ObstacleKind = r < 0.5 ? 'npc' : r < 0.75 ? 'barrier' : 'barrel';
        this.obstacles.push(this.createObstacle(kind, x, SPAWN_Z));
      }
    }
  }

  // -----------------------------------------------------------------------
  // Obstacle creation (pool + factory)
  // -----------------------------------------------------------------------

  private createObstacle(kind: ObstacleKind, x: number, z: number): Obstacle {
    // Try pool first
    const pooled = this.pool.acquire(kind);
    if (pooled) {
      pooled.x = x;
      pooled.z = z;
      this.repositionObstacle(pooled, x, z);
      return pooled;
    }

    return this.meshFactory.create(kind, x, z);
  }

  private repositionObstacle(obs: Obstacle, x: number, z: number): void {
    if (obs.mesh && !obs.mesh.isDisposed()) {
      obs.mesh.position.x = x;
      obs.mesh.position.z = z;
    }
    for (const m of obs.extraMeshes) {
      if (m && !m.isDisposed()) {
        m.position.x = x + ((m as any)._offsetX ?? 0);
        m.position.z = z + ((m as any)._offsetZ ?? 0);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Collision
  // -----------------------------------------------------------------------

  private checkCollision(obs: Obstacle, carX: number): boolean {
    return (
      Math.abs(carX - obs.x) < (CAR_HALF_W + obs.halfW) &&
      Math.abs(0 - obs.z) < (CAR_HALF_D + obs.halfD)
    );
  }

  private handleCollision(
    obs: Obstacle,
    index: number,
    carX: number,
    carSpeed: number,
    isInvincible: boolean,
  ): void {
    if (obs.collected) return;

    const pushDir = carX > obs.x ? 1 : -1;

    if (obs.coin) {
      obs.collected = true;
      const response = this.createCoinResponse();
      this.onCollision?.(response, obs);
      this.onCollect?.('coin', obs);
      this.recycleObstacle(obs, index);

    } else if (obs.boost) {
      obs.collected = true;
      const response = this.createBoostResponse(carSpeed);
      this.onCollision?.(response, obs);
      this.onCollect?.('boost', obs);
      this.recycleObstacle(obs, index);

    } else if (obs.heal) {
      obs.collected = true;
      const response = this.createHealResponse();
      this.onCollision?.(response, obs);
      this.onCollect?.('heart', obs);
      this.recycleObstacle(obs, index);

    } else if (obs.slowdown) {
      if (!isInvincible) {
        obs.collected = true;
        const response = this.createSlowdownResponse(pushDir);
        this.spawnExplosionParticles(obs.x, obs.z);
        this.onCollision?.(response, obs);
        this.recycleObstacle(obs, index);
      }

    } else if (obs.damage) {
      if (!isInvincible) {
        obs.collected = true;
        const response = this.createDamageResponse(pushDir);
        this.spawnExplosionParticles(obs.x, obs.z);
        this.onCollision?.(response, obs);
        this.recycleObstacle(obs, index);
      }
    }
  }

  /**
   * Create collision response for coin collection.
   * Coins provide score reward with no other effects.
   */
  private createCoinResponse(): CollisionResponse {
    return {
      livesChange: 0,
      scoreDelta: 50,
      speedMultiplier: 1,
      speedFloor: 0,
      pushDirection: 0,
      pushMagnitude: 0,
      shakeDuration: 0,
      flashDuration: 0,
      invincibleDuration: 0,
      isBoost: false,
      boostAmount: 0,
      sound: 'coin',
    };
  }

  /**
   * Create collision response for boost collection.
   * Boost amount is inversely scaled by current speed (higher speed = less boost).
   * @param carSpeed Current speed in km/h (0-400).
   */
  private createBoostResponse(carSpeed: number): CollisionResponse {
    const boostAmount = 80 * (1 - carSpeed / 350) + 20;
    return {
      livesChange: 0,
      scoreDelta: 20,
      speedMultiplier: 1,
      speedFloor: 0,
      pushDirection: 0,
      pushMagnitude: 0,
      shakeDuration: 0,
      flashDuration: 0,
      invincibleDuration: 0,
      isBoost: true,
      boostAmount,
      sound: 'boost',
    };
  }

  /**
   * Create collision response for healing (heart collection).
   * Heals one life point with no other effects.
   */
  private createHealResponse(): CollisionResponse {
    return {
      livesChange: 1,
      scoreDelta: 0,
      speedMultiplier: 1,
      speedFloor: 0,
      pushDirection: 0,
      pushMagnitude: 0,
      shakeDuration: 0,
      flashDuration: 0,
      invincibleDuration: 0,
      isBoost: false,
      boostAmount: 0,
      sound: 'heart',
    };
  }

  /**
   * Create collision response for slowdown obstacle.
   * Reduces speed to 50% with temporary invincibility and camera shake.
   * @param pushDir Direction push force (-1 or 1).
   */
  private createSlowdownResponse(pushDir: number): CollisionResponse {
    return {
      livesChange: -1,
      scoreDelta: 0,
      speedMultiplier: 0.5,
      speedFloor: 20,
      pushDirection: pushDir,
      pushMagnitude: 0.5,
      shakeDuration: 0.4,
      flashDuration: 0.2,
      invincibleDuration: 1.5,
      isBoost: false,
      boostAmount: 0,
      sound: 'slowdown',
    };
  }

  /**
   * Create collision response for damage obstacle.
   * Reduces speed to 60% with stronger push, longer invincibility, and shake.
   * @param pushDir Direction push force (-1 or 1).
   */
  private createDamageResponse(pushDir: number): CollisionResponse {
    return {
      livesChange: -1,
      scoreDelta: 0,
      speedMultiplier: 0.6,
      speedFloor: 30,
      pushDirection: pushDir,
      pushMagnitude: 0.8,
      shakeDuration: 0.5,
      flashDuration: 0.3,
      invincibleDuration: 2,
      isBoost: false,
      boostAmount: 0,
      sound: 'crash',
    };
  }

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  private spawnExplosionParticles(x: number, z: number): void {
    const ps = new ParticleSystem('explosion', 200, this.scene);
    ps.emitter = new Vector3(x, 0.5, z);
    ps.minEmitBox = new Vector3(-0.5, 0, -0.5);
    ps.maxEmitBox = new Vector3(0.5, 0.5, 0.5);
    ps.color1 = new Color4(1, 0.5, 0, 1);
    ps.color2 = new Color4(1, 0.2, 0, 1);
    ps.colorDead = new Color4(0.3, 0.1, 0, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 500;
    ps.direction1 = new Vector3(-2, 2, -2);
    ps.direction2 = new Vector3(2, 4, 2);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 5;
    ps.gravity = new Vector3(0, -9.8, 0);
    ps.targetStopDuration = 0.1;
    ps.disposeOnStop = true;
    ps.start();
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private recycleObstacle(obs: Obstacle, index: number): void {
    if (!this.pool.release(obs)) {
      disposeMeshes(obs);
    }
    this.obstacles.splice(index, 1);
  }

  private clearAll(): void {
    for (const obs of this.obstacles) {
      disposeMeshes(obs);
    }
    this.obstacles = [];
  }
}
