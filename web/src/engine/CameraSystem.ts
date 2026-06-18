/**
 * CameraSystem - Multi-view camera management for PalmRacer 3D.
 *
 * Supports three modes:
 *  - chase:   third-person low-angle behind car (NFS-style)
 *  - cockpit: first-person driver POV
 *  - top:     bird's-eye overhead view
 */

import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { CarState, CameraMode } from "./types";

export class CameraSystem {
  private scene_: Scene;
  private canvas_: HTMLCanvasElement;
  private cameras_: Record<string, FreeCamera> = {};
  private activeMode_: CameraMode = "chase";

  // Reusable temp vector (avoid per-frame allocation).
  private tmpTarget_: Vector3 = new Vector3(0, 0, 0);

  // Cockpit interior root (toggled on mode switch).
  private cockpitInterior_: TransformNode | null = null;
  // GLB car model root (hidden in cockpit mode).
  private glbRoot_: TransformNode | null = null;
  // Cockpit HUD canvas element.
  private cockpitHUD_: HTMLElement | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene_ = scene;
    this.canvas_ = canvas;
    this.cockpitHUD_ = document.getElementById("cockpitHUD");
  }

  /**
   * Create all three cameras. Must be called after the car mesh is ready.
   *
   * @param carMesh - The car's root TransformNode (used for cockpit parenting).
   */
  createCameras(carMesh: TransformNode): void {
    // ---- Chase camera (third-person, behind car) ----
    const chaseCamera = new FreeCamera(
      "chaseCamera",
      new Vector3(0, 3.5, 8),
      this.scene_
    );
    chaseCamera.setTarget(new Vector3(0, 0.5, -25));
    chaseCamera.fov = 1.1;
    chaseCamera.inputs.clear();
    this.cameras_["chase"] = chaseCamera;

    // ---- Cockpit camera (first-person, driver POV with hood visible) ----
    const cockpitCamera = new FreeCamera(
      "cockpitCamera",
      new Vector3(0, 1.9, 1.2),
      this.scene_
    );
    cockpitCamera.setTarget(new Vector3(0, 0.8, -30));
    cockpitCamera.fov = 1.1;
    cockpitCamera.minZ = 0.1;
    cockpitCamera.inputs.clear();
    this.cameras_["cockpit"] = cockpitCamera;

    // ---- Top camera (bird's-eye) ----
    const topCamera = new FreeCamera(
      "topCamera",
      new Vector3(0, 18, 4),
      this.scene_
    );
    topCamera.setTarget(new Vector3(0, 0, -8));
    topCamera.inputs.clear();
    this.cameras_["top"] = topCamera;

    // Default to chase view.
    this.switchTo("chase");
  }

  /**
   * Register external references that the camera system needs to toggle
   * visibility when switching modes.
   */
  setExternalRefs(
    cockpitInterior: TransformNode | null,
    glbRoot: TransformNode | null
  ): void {
    this.cockpitInterior_ = cockpitInterior;
    this.glbRoot_ = glbRoot;
  }

  /**
   * Switch to the given camera mode.
   */
  switchTo(mode: CameraMode): void {
    this.activeMode_ = mode;
    const camera = this.cameras_[mode];
    if (camera) {
      this.scene_.activeCamera = camera;
    }

    // Toggle cockpit interior visibility.
    if (this.cockpitInterior_) {
      this.cockpitInterior_.setEnabled(mode === "cockpit");
      this.cockpitInterior_.getChildMeshes(false).forEach((mesh) => {
        mesh.isVisible = mode === "cockpit";
      });
    }

    // Toggle 2D cockpit HUD overlay.
    if (this.cockpitHUD_) {
      this.cockpitHUD_.style.display = mode === "cockpit" ? "block" : "none";
    }

    // Hide glb car body in cockpit mode (avoid seeing interior faces).
    if (this.glbRoot_) {
      this.glbRoot_.setEnabled(mode !== "cockpit");
    }
  }

  /**
   * Cycle through modes in order: chase -> cockpit -> top -> chase ...
   * Returns the newly active mode.
   */
  cycle(): CameraMode {
    const modes: CameraMode[] = ["chase", "cockpit", "top"];
    const idx = modes.indexOf(this.activeMode_);
    const next = modes[(idx + 1) % modes.length];
    this.switchTo(next);
    return next;
  }

  /**
   * Per-frame update. Moves and adjusts cameras based on car state.
   *
   * @param dt        - Delta time in seconds.
   * @param carState  - Current car state (speed, positionX, etc.).
   * @param tilt      - Car tilt value for cockpit look direction.
   * @param maxSpeed  - Car maximum speed in km/h (default 350).
   */
  update(dt: number, carState: CarState, tilt: number = 0, maxSpeed: number = 350): void {
    const carX = carState.x;

    switch (this.activeMode_) {
      case "chase": {
        const cam = this.cameras_["chase"];
        const speedRatio = carState.speed / maxSpeed;
        const targetY = 2.8 + speedRatio * 1.8;
        const targetZ = 6 + speedRatio * 3;
        const lookAheadZ = -18 - speedRatio * 18;

        cam.position.x = lerp(cam.position.x, carX * 0.65, 0.1);
        cam.position.y = lerp(cam.position.y, targetY, 0.06);
        cam.position.z = lerp(cam.position.z, targetZ, 0.06);
        this.tmpTarget_.set(
          lerp(cam.getTarget().x, carX * 0.45, 0.1),
          0.3,
          lookAheadZ
        );
        cam.setTarget(this.tmpTarget_);
        break;
      }

      case "cockpit": {
        const cam = this.cameras_["cockpit"];
        cam.position.x = carX;
        cam.position.y = 1.2;
        cam.position.z = -0.2;
        this.tmpTarget_.set(carX + carState.tilt * 6, 0.3, -30);
        cam.setTarget(this.tmpTarget_);

        const speedRatio2 = carState.speed / maxSpeed;
        cam.fov = lerp(cam.fov, 1.3 + speedRatio2 * 0.2, 0.05);
        break;
      }

      case "top": {
        const cam = this.cameras_["top"];
        cam.position.x = lerp(cam.position.x, carX * 0.3, 0.05);
        cam.position.y = 18;
        cam.position.z = 11;
        this.tmpTarget_.set(
          lerp(cam.getTarget().x, carX * 0.2, 0.05),
          0,
          -9
        );
        cam.setTarget(this.tmpTarget_);
        break;
      }
    }
  }

  /**
   * Apply speed-dependent FOV and high-speed camera shake.
   * Call this after update() each frame (mirrors _updateEffects FOV section).
   *
   * @param speed    - Current speed in km/h.
   * @param maxSpeed - Maximum speed in km/h (default 350).
   */
  applySpeedEffects(speed: number, maxSpeed: number = 350): void {
    const cam = this.cameras_[this.activeMode_];
    if (!cam) return;

    // FOV for non-cockpit views (cockpit handled in update).
    if (this.activeMode_ !== "cockpit") {
      let targetFov: number;
      if (this.activeMode_ === "chase") {
        if (speed < 100) {
          targetFov = 1.0 + (speed / 100) * 0.1;
        } else if (speed < 250) {
          targetFov = 1.1 + ((speed - 100) / 150) * 0.15;
        } else {
          targetFov = 1.25 + ((speed - 250) / 100) * 0.2;
        }
      } else {
        targetFov = 0.9; // Top view: fixed FOV.
      }
      cam.fov = lerp(cam.fov, targetFov, 0.04);
    }

    // High-speed camera shake (chase mode only).
    if (this.activeMode_ === "chase" && speed > 100) {
      const intensity = Math.pow((speed - 100) / 250, 2) * 0.04;
      cam.position.x += (Math.random() - 0.5) * intensity;
      cam.position.y += (Math.random() - 0.5) * intensity * 0.3;
    }
  }

  /**
   * Apply crash/collision camera shake.
   *
   * @param shakeForce - Shake intensity (typically crashShakeTimer * 0.15).
   */
  applyCrashShake(shakeForce: number): void {
    const cam = this.cameras_[this.activeMode_];
    if (cam) {
      cam.position.x += (Math.random() - 0.5) * shakeForce;
      cam.position.y += (Math.random() - 0.5) * shakeForce * 0.6;
    }
  }

  /** Get the currently active camera mode. */
  get activeMode(): CameraMode {
    return this.activeMode_;
  }

  /** Get a specific camera by mode. */
  getCamera(mode: CameraMode): FreeCamera | undefined {
    return this.cameras_[mode];
  }

  /** Get all cameras (for pipeline attachment, etc.). */
  getAllCameras(): FreeCamera[] {
    return Object.values(this.cameras_);
  }

  /** Clean up all cameras. */
  dispose(): void {
    for (const cam of Object.values(this.cameras_)) {
      cam.dispose();
    }
    this.cameras_ = {};
  }
}

// ---- Private helpers ----

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
