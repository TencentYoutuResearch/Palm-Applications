/**
 * @file Game3DEngine.ts
 * @description Main game engine class that coordinates all subsystems.
 *
 * Orchestrates: SceneSetup, RoadSystem, CarController, CarModel,
 * ObstacleManager, CameraSystem, ParticleEffects, DifficultySystem,
 * ComboSystem, and HUDRenderer.
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/loaders/glTF';

// Babylon.js side-effect imports required for tree-shaking builds
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';

import { SceneSetup } from './SceneSetup';
import { RoadSystem, kDefaultRoadConfig } from './RoadSystem';
import { CarController } from './CarController';
import { CarModel } from './CarModel';
import { ObstacleManager, type CollisionResponse } from './ObstacleManager';
import { CameraSystem } from './CameraSystem';
import { ParticleEffects } from './ParticleEffects';
import { DifficultySystem } from './DifficultySystem';
import { ComboSystem } from './ComboSystem';
import { HUDRenderer } from './HUDRenderer';
import { SoundManager } from '../audio/SoundManager';
import { logger } from '../utils/logger';
import { getI18nT } from '../main';
import type { GameStats, CameraMode } from './types';

/** Default 3D model URL — use relative path for WebView asset loading. */
const kDefaultModelPath = './models/';
const kDefaultModelFile = 'ferrari_laferrari.glb';

/**
 * Game3DEngine is the top-level orchestrator for the PalmRacer 3D game.
 *
 * Usage:
 *   const engine = new Game3DEngine(canvas);
 *   await engine.init();
 *   engine.start();
 *   // each frame, call engine.applyHandInput(...)
 *   engine.dispose();
 */
export class Game3DEngine {
  // ---- Public callbacks ----
  onGameOver: ((stats: GameStats) => void) | null = null;
  onStageChange: ((stage: { level: number; name: string; description: string }) => void) | null = null;

  // ---- Public read-only state ----
  get score(): number { return this.score_; }
  get lives(): number { return this.lives_; }
  get maxLives(): number { return 3; }
  get gameTime(): number { return this.gameTime_; }
  get carSpeed(): number { return this.carController_.state.speed; }
  get carMaxSpeed(): number { return this.carController_.state.maxSpeed; }
  get carX(): number { return this.carController_.state.x; }
  get comboMultiplier(): number { return this.comboSystem_.multiplier; }
  get comboCount(): number { return this.comboSystem_.count; }

  // ---- Babylon core ----
  private babylonEngine_: Engine;
  private scene_: Scene | null = null;
  private canvas_: HTMLCanvasElement;

  // ---- Subsystems ----
  private sceneSetup_!: SceneSetup;
  private roadSystem_!: RoadSystem;
  private carController_: CarController;
  private carModel_!: CarModel;
  private obstacleManager_!: ObstacleManager;
  private cameraSystem_!: CameraSystem;
  private particleEffects_!: ParticleEffects;
  private difficultySystem_: DifficultySystem;
  private comboSystem_: ComboSystem;
  private hudRenderer_: HUDRenderer | null = null;
  private soundManager_: SoundManager;

  // ---- Game state ----
  private state_: 'idle' | 'playing' | 'paused' | 'gameover' = 'idle';
  private score_ = 0;
  private lives_ = 3;
  private gameTime_ = 0;
  private maxSpeedReached_ = 0;
  private steeringAngle_ = 0;
  private cheated_ = false;
  /** 最后一个替玩用户的 userId（多个不同替玩用户以最后1个为准） */
  private cheatUserId_ = '';

  /**
   * Speed-based score multiplier (same as Web 3D version _getMultiplier).
   */
  private static getSpeedMultiplier_(speed: number): number {
    if (speed >= 350) return 5;
    if (speed >= 280) return 4;
    if (speed >= 200) return 3;
    if (speed >= 140) return 2;
    if (speed >= 80) return 1.5;
    return 1;
  }

  /** Get current speed multiplier (for HUD display). */
  get speedMultiplier(): number {
    return Game3DEngine.getSpeedMultiplier_(this.carController_.state.speed);
  }

  /** Mark this game session as cheated (by anti-cheat system). */
  setCheated(): void {
    this.cheated_ = true;
  }

  /** 记录替玩用户 ID（多个不同替玩用户以最后1个为准） */
  setCheatUserId(userId: string): void {
    if (userId) {
      this.cheatUserId_ = userId;
    }
  }

  /** Force trigger game over (used by anti-cheat when max warnings reached). */
  forceGameOver(): void {
    if (this.state_ === 'playing' || this.state_ === 'paused') {
      this.lives_ = 0;
      this.triggerGameOver_();
    }
  }

  // ---- Input state ----
  private inputSteerX_ = 0;
  private inputThrottle_ = 0;
  private inputBraking_ = false;

  constructor(canvas: HTMLCanvasElement, cockpitHudCanvas?: HTMLCanvasElement) {
    this.canvas_ = canvas;
    this.babylonEngine_ = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    this.carController_ = new CarController();
    this.difficultySystem_ = new DifficultySystem();
    this.comboSystem_ = new ComboSystem(3.0);
    this.soundManager_ = new SoundManager();

    if (cockpitHudCanvas) {
      this.hudRenderer_ = new HUDRenderer(cockpitHudCanvas);
    }

    window.addEventListener('resize', () => this.babylonEngine_.resize());
  }

  /**
   * Initialize the 3D scene, load models, and set up all subsystems.
   */
  async init(
    onProgress?: (percent: number, message: string) => void
  ): Promise<void> {
    const progress = onProgress ?? (() => {});
    const t = getI18nT();

    progress(5, t('game.loading.initScene'));
    this.scene_ = new Scene(this.babylonEngine_);
    this.scene_.clearColor = new Color4(0.05, 0.05, 0.12, 1);
    this.scene_.ambientColor = new Color3(0.3, 0.3, 0.35);
    this.scene_.collisionsEnabled = true;

    // Scene setup (lights, skybox, environment)
    this.sceneSetup_ = new SceneSetup(this.scene_, this.babylonEngine_);

    progress(10, t('game.loading.createLights'));
    this.sceneSetup_.createLights();
    this.sceneSetup_.createEnvironmentTexture();

    progress(15, t('game.loading.createSkybox'));
    this.sceneSetup_.createSkybox();

    // Road
    progress(20, t('game.loading.generateTrack'));
    this.roadSystem_ = new RoadSystem(this.scene_, kDefaultRoadConfig);
    this.roadSystem_.create();

    // Car model
    progress(30, t('game.loading.loadCarModel'));
    this.carModel_ = new CarModel(this.scene_);
    const shadowGen = this.sceneSetup_.getShadowGenerator();
    if (shadowGen) {
      this.carModel_.setShadowGenerator(shadowGen);
    }
    await this.carModel_.load(kDefaultModelPath, kDefaultModelFile);

    // Obstacles
    this.obstacleManager_ = new ObstacleManager(this.scene_, {
      width: kDefaultRoadConfig.width,
      laneCount: kDefaultRoadConfig.laneCount,
    });
    if (shadowGen) {
      this.obstacleManager_.setShadowGenerator(shadowGen);
    }
    this.setupObstacleCallbacks_();

    // Camera
    progress(85, t('game.loading.setupCamera'));
    this.cameraSystem_ = new CameraSystem(this.scene_, this.canvas_);
    if (this.carModel_.mesh) {
      this.cameraSystem_.createCameras(this.carModel_.mesh);
    }

    // Particles
    this.particleEffects_ = new ParticleEffects(this.scene_);
    this.particleEffects_.createSpeedLines();

    // Post-processing
    progress(90, t('game.loading.loadPostProcess'));
    const cameras = this.cameraSystem_.getAllCameras();
    this.sceneSetup_.createPostProcessing(cameras);

    // Start render loop (render only, no game logic until start())
    this.babylonEngine_.runRenderLoop(() => {
      if (this.scene_) {
        if (this.state_ === 'playing') {
          this.updateGameLoop_();
        }
        this.scene_.render();
      }
    });

    progress(95, t('game.loading.engineReady'));
    logger.debug('Game3DEngine', 'Init complete');
  }

  /** Start the game. */
  start(): void {
    this.state_ = 'playing';
    this.score_ = 0;
    this.lives_ = 3;
    this.gameTime_ = 0;
    this.maxSpeedReached_ = 0;
    this.cheated_ = false;
    this.cheatUserId_ = '';
    this.carController_.reset();
    this.difficultySystem_.reset();
    this.comboSystem_.reset();
    this.obstacleManager_.reset();

    // Initialize sound (safe after user interaction) and start engine
    this.soundManager_.init();
    this.soundManager_.startEngine();

    logger.debug('Game3DEngine', 'Game started');
  }

  /** Pause the game. */
  pause(): void {
    if (this.state_ === 'playing') {
      this.state_ = 'paused';
      this.soundManager_.stopEngine();
    }
  }

  /** Resume from pause. */
  resume(): void {
    if (this.state_ === 'paused') {
      this.state_ = 'playing';
      this.soundManager_.startEngine();
    }
  }

  /** Stop the game (called externally, e.g. leaving page). */
  stop(): void {
    this.state_ = 'idle';
  }

  /**
   * Apply hand tracking input. Called by the Vue component each frame.
   */
  applyHandInput(steerX: number, throttle: number, isBraking: boolean): void {
    this.inputSteerX_ = steerX;
    this.inputThrottle_ = throttle;
    this.inputBraking_ = isBraking;
  }

  /** Switch camera view mode. */
  switchCamera(mode: CameraMode): void {
    this.cameraSystem_?.switchTo(mode);
  }

  /** Get current camera mode. */
  getCameraMode(): CameraMode {
    return (this.cameraSystem_?.activeMode as CameraMode) ?? 'chase';
  }

  /** Dispose all resources. */
  dispose(): void {
    this.state_ = 'idle';
    this.soundManager_.dispose();
    this.hudRenderer_?.dispose();
    this.particleEffects_?.dispose();
    this.obstacleManager_?.dispose();
    this.cameraSystem_?.dispose();
    this.carModel_?.dispose();
    this.roadSystem_?.dispose();
    this.scene_?.dispose();
    this.babylonEngine_?.dispose();
    logger.debug('Game3DEngine', 'Disposed');
  }

  // ================================================================
  // Private: main game loop (called every frame while playing)
  // ================================================================

  private updateGameLoop_(): void {
    const dt = this.babylonEngine_.getDeltaTime() / 1000;
    if (dt <= 0 || dt > 0.1) return; // skip abnormal frames

    this.gameTime_ += dt;

    // Map throttle input to target speed
    const targetSpeed = this.inputThrottle_ * this.carController_.state.maxSpeed;
    this.carController_.state.targetSpeed = targetSpeed;

    // Update car physics
    const halfRoad = kDefaultRoadConfig.width / 2;
    // Map steerX (-1..1) to road coordinate (-halfRoad..halfRoad)
    const steerXInRoadSpace = this.inputSteerX_ * halfRoad;
    this.carController_.update(
      dt,
      steerXInRoadSpace,
      targetSpeed,
      this.inputBraking_,
      halfRoad
    );

    // Track max speed
    if (this.carController_.state.speed > this.maxSpeedReached_) {
      this.maxSpeedReached_ = this.carController_.state.speed;
    }

    // Update car model visuals
    this.carModel_.updateFromState(this.carController_.state, this.inputBraking_);
    this.carModel_.updateWheels(this.carController_.state.speed, dt);
    this.carModel_.updateTailLights(
      this.carController_.state.speed,
      this.inputBraking_,
      this.gameTime_
    );
    this.carModel_.setInvincibilityBlink(
      this.carController_.state.invincible,
      this.gameTime_
    );

    // Update road scrolling
    this.roadSystem_.update(dt, this.carController_.state.speed);

    // Update engine sound
    this.soundManager_.updateEngine(this.carController_.state.speed, this.inputBraking_);

    // Update obstacles
    this.obstacleManager_.update(
      dt,
      this.carController_.state.x,
      this.carController_.state.speed,
      this.gameTime_,
      this.carController_.state.invincible
    );

    // Update difficulty
    const stageChange = this.difficultySystem_.update(this.gameTime_);
    if (stageChange) {
      this.onStageChange?.(stageChange);
    }

    // Update particle effects
    this.particleEffects_.updateSpeedLines(dt, this.carController_.state.speed);

    // Update camera
    this.cameraSystem_.update(dt, this.carController_.state);

    // Update combo system
    this.comboSystem_.update(dt);

    // Per-frame speed score (same as Web 3D: speed/10 * multiplier * dt)
    const speedMultiplier = Game3DEngine.getSpeedMultiplier_(this.carController_.state.speed);
    this.score_ += Math.round((this.carController_.state.speed / 10) * speedMultiplier * dt);

    // Update steering angle for HUD (使用 car.tilt，与旧版 3D 一致)
    const targetSteer = -this.carController_.state.tilt * 0.8;
    this.steeringAngle_ += (targetSteer - this.steeringAngle_) * 0.15;

    // Update cockpit HUD (only in cockpit mode)
    if (this.cameraSystem_?.activeMode === 'cockpit') {
      this.hudRenderer_?.render(
        this.carController_.state.speed,
        this.carController_.state.maxSpeed,
        this.steeringAngle_
      );
    } else {
      this.hudRenderer_?.clear();
    }

    // Check game over
    if (this.lives_ <= 0) {
      this.triggerGameOver_();
    }
  }

  // ================================================================
  // Private: obstacle collision callbacks
  // ================================================================

  private setupObstacleCallbacks_(): void {
    this.obstacleManager_.onCollision = (response: CollisionResponse, obs) => {
      if (this.carController_.state.invincible) return;

      this.lives_ += response.livesChange;
      this.score_ = Math.max(0, this.score_ + response.scoreDelta);

      // Play collision sound effect
      if (response.sound) {
        this.soundManager_.playSfx(response.sound);
      }

      if (response.livesChange < 0) {
        // Damage: reset combo, apply collision effects
        this.comboSystem_.reset();
        this.carController_.takeDamage(response.invincibleDuration);
        if (response.pushMagnitude) {
          this.carController_.applyCollisionPush(
            response.pushDirection * response.pushMagnitude
          );
        }
        // Speed reduction
        this.carController_.state.speed *= response.speedMultiplier;
        this.carController_.state.targetSpeed *= response.speedMultiplier;

        // Collision particle effect
        this.particleEffects_?.playCollisionEffect(
          this.carModel_.mesh?.position ?? { x: 0, y: 0.5, z: 0 } as any
        );
      }

      // Handle collectibles via collision callback
      if (obs.kind === 'coin') {
        const combo = this.comboSystem_.addCombo();
        this.score_ += combo.bonus;
      } else if (obs.kind === 'boost' && response.isBoost) {
        this.carController_.state.speed = Math.min(
          this.carController_.state.speed + response.boostAmount,
          this.carController_.state.maxSpeed
        );
        this.particleEffects_?.playBoostEffect(
          this.carModel_.mesh?.position ?? { x: 0, y: 0.5, z: 0 } as any
        );
      }
      // heart: 生命值已在上方 lives_ += response.livesChange 中处理（livesChange=1），
      // 此处只需 clamp 到上限即可。
      this.lives_ = Math.min(this.lives_, this.maxLives);
    };

    this.obstacleManager_.onDodge = (_kind, dodgeScore) => {
      this.score_ += dodgeScore;
    };
  }

  private triggerGameOver_(): void {
    this.state_ = 'gameover';
    this.soundManager_.stopEngine();
    const stats: GameStats = {
      score: this.score_,
      maxSpeed: this.maxSpeedReached_,
      surviveTime: this.gameTime_,
      comboMax: this.comboSystem_.count,
      cheated: this.cheated_,
      cheatUserId: this.cheatUserId_,
    };
    this.onGameOver?.(stats);
  }
}
