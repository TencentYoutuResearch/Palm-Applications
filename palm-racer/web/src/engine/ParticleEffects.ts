/**
 * ParticleEffects - Speed lines, collision sparks, and boost effects
 * for PalmRacer 3D.
 *
 * Manages pooled 3D speed-line meshes and one-shot particle bursts.
 */

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";

import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

/** Internal representation of a speed-line particle. */
interface SpeedLine {
  mesh: AbstractMesh;
  z: number;
  life: number;
  maxLife: number;
}

export class ParticleEffects {
  private scene_: Scene;
  private speedLines_: SpeedLine[] = [];
  private enabled_: boolean = true;

  // Shared material (created lazily on first spawn).
  private speedLineMat_: StandardMaterial | null = null;

  // Pool limits (from original code).
  private static readonly MAX_SPEED_LINES = 30;
  private static readonly SPEED_LINE_LIFETIME = 1.5;

  // Road dimensions needed for spawn positioning.
  private roadHalfWidth_: number;

  constructor(scene: Scene, roadWidth: number = 12) {
    this.scene_ = scene;
    this.roadHalfWidth_ = roadWidth / 2;
  }

  // ------------------------------------------------------------------
  // Speed Lines
  // ------------------------------------------------------------------

  /**
   * Pre-create the shared speed-line material.
   * Safe to call multiple times; only creates once.
   */
  createSpeedLines(): void {
    if (this.speedLineMat_) return;

    const mat = new StandardMaterial("speedLine_shared", this.scene_);
    mat.diffuseColor = new Color3(0.8, 0.85, 1.0);
    mat.emissiveColor = new Color3(0.4, 0.45, 0.6);
    mat.alpha = 0.5;
    mat.disableLighting = true;
    this.speedLineMat_ = mat;
  }

  /**
   * Update speed lines each frame.
   * Spawns new lines when speed > 100 km/h and moves existing ones.
   *
   * @param dt    - Delta time in seconds.
   * @param speed - Current car speed in km/h.
   */
  updateSpeedLines(dt: number, speed: number): void {
    if (!this.enabled_) return;

    const scrollSpeed = speed * 0.278; // km/h -> m/s

    // Spawn new speed lines when fast enough.
    if (speed > 100) {
      const spawnRate = (speed - 100) / 50;
      if (Math.random() < spawnRate * dt * 10) {
        this.spawnSpeedLine_();
      }
    }

    // Move and fade existing lines (from -Z toward +Z).
    for (let i = this.speedLines_.length - 1; i >= 0; --i) {
      const line = this.speedLines_[i];
      line.z += scrollSpeed * dt;
      line.life -= dt;

      if (line.mesh) {
        line.mesh.position.z = line.z;
        line.mesh.visibility = Math.max(0, line.life / line.maxLife) * 0.6;
      }

      if (line.life <= 0 || line.z > 12) {
        if (line.mesh) {
          line.mesh.dispose();
        }
        this.speedLines_.splice(i, 1);
      }
    }
  }

  /** Spawn a single 3D speed line (shared material, pool-limited). */
  private spawnSpeedLine_(): void {
    if (this.speedLines_.length >= ParticleEffects.MAX_SPEED_LINES) return;

    // Ensure material exists.
    this.createSpeedLines();

    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (this.roadHalfWidth_ + 1.5 + Math.random() * 4);
    const y = 0.1 + Math.random() * 0.5;
    const z = -60 - Math.random() * 30;

    const lineLength = 2 + Math.random() * 4;
    const mesh = MeshBuilder.CreateBox(
      "speedLine",
      { width: 0.03, height: 0.03, depth: lineLength },
      this.scene_
    );
    mesh.position.set(x, y, z);
    mesh.material = this.speedLineMat_;

    this.speedLines_.push({
      mesh,
      z,
      life: ParticleEffects.SPEED_LINE_LIFETIME,
      maxLife: ParticleEffects.SPEED_LINE_LIFETIME,
    });
  }

  // ------------------------------------------------------------------
  // Particle Burst Effects (Collision / Boost)
  // ------------------------------------------------------------------

  /** Create and start a one-shot particle burst with the given config. */
  private playBurst_(config: {
    name: string;
    capacity: number;
    position: Vector3;
    emitBox: [Vector3, Vector3];
    colors: [Color4, Color4, Color4];
    size: [number, number];
    lifeTime: [number, number];
    emitRate: number;
    directions: [Vector3, Vector3];
    power: [number, number];
    gravity: Vector3;
  }): void {
    const ps = new ParticleSystem(config.name, config.capacity, this.scene_);
    ps.emitter = config.position.clone();
    [ps.minEmitBox, ps.maxEmitBox] = config.emitBox;
    [ps.color1, ps.color2, ps.colorDead] = config.colors;
    [ps.minSize, ps.maxSize] = config.size;
    [ps.minLifeTime, ps.maxLifeTime] = config.lifeTime;
    ps.emitRate = config.emitRate;
    [ps.direction1, ps.direction2] = config.directions;
    [ps.minEmitPower, ps.maxEmitPower] = config.power;
    ps.gravity = config.gravity;
    ps.targetStopDuration = 0.1;
    ps.disposeOnStop = true;
    ps.start();
  }

  /**
   * Play a one-shot collision explosion particle burst at the given position.
   */
  playCollisionEffect(position: Vector3): void {
    this.playBurst_({
      name: "explosion",
      capacity: 200,
      position,
      emitBox: [new Vector3(-0.5, 0, -0.5), new Vector3(0.5, 0.5, 0.5)],
      colors: [new Color4(1, 0.5, 0, 1), new Color4(1, 0.2, 0, 1), new Color4(0.3, 0.1, 0, 0)],
      size: [0.1, 0.4],
      lifeTime: [0.2, 0.6],
      emitRate: 500,
      directions: [new Vector3(-2, 2, -2), new Vector3(2, 4, 2)],
      power: [2, 5],
      gravity: new Vector3(0, -9.8, 0),
    });
  }

  /**
   * Play a boost / NOS visual burst at the given position.
   * Uses blue-cyan tones to distinguish from collision sparks.
   */
  playBoostEffect(position: Vector3): void {
    this.playBurst_({
      name: "boost",
      capacity: 150,
      position,
      emitBox: [new Vector3(-0.3, -0.1, -0.3), new Vector3(0.3, 0.1, 0.3)],
      colors: [new Color4(0, 0.6, 1, 1), new Color4(0, 0.3, 1, 0.8), new Color4(0, 0.1, 0.3, 0)],
      size: [0.08, 0.3],
      lifeTime: [0.15, 0.4],
      emitRate: 400,
      directions: [new Vector3(-1, 0.5, 1), new Vector3(1, 2, 3)],
      power: [2, 6],
      gravity: new Vector3(0, -2, 0),
    });
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /** Enable or disable all particle effects. */
  setEnabled(enabled: boolean): void {
    this.enabled_ = enabled;
    if (!enabled) {
      this.clearSpeedLines_();
    }
  }

  /** Dispose of all managed meshes and materials. */
  dispose(): void {
    this.clearSpeedLines_();
    if (this.speedLineMat_) {
      this.speedLineMat_.dispose();
      this.speedLineMat_ = null;
    }
  }

  /** Remove all active speed lines. */
  private clearSpeedLines_(): void {
    for (const line of this.speedLines_) {
      if (line.mesh) {
        line.mesh.dispose();
      }
    }
    this.speedLines_ = [];
  }
}
