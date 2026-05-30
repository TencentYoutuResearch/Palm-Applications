/**
 * CarModel - 3D car mesh loading, material setup, and visual updates.
 *
 * Handles:
 * - GLB model loading with timeout/retry (LaFerrari)
 * - Auto-scaling and centering based on bounding box
 * - PBR fallback box car when model fails to load
 * - Tail light creation and animation
 * - Mesh position/rotation updates from CarState
 * - Wheel rotation animation
 */

import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import { logger } from "../utils/logger";
import type { CarState } from "./CarController";

/** Linear interpolation helper. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * CarModel manages the 3D visual representation of the player car.
 *
 * It loads a GLB model (or falls back to a simple box), and provides
 * methods to update the mesh transforms from a CarState each frame.
 */
export class CarModel {
  /** Root TransformNode for game-logic positioning. */
  mesh: TransformNode | null = null;

  private scene_: Scene;

  /** Orientation node (flips car to face camera). */
  private orientNode_: TransformNode | null = null;

  /** Reference to the GLB root mesh (for visibility control). */
  private glbRoot_: TransformNode | null = null;

  /** Wheel meshes found in the loaded model. */
  private wheels_: AbstractMesh[] = [];

  /** Tail light material for glow animation. */
  private tailLightMat_: StandardMaterial | null = null;

  /** Tail strip material for secondary glow. */
  private tailStripMat_: StandardMaterial | null = null;

  /** Shadow generator reference (set externally). */
  private shadowGenerator_: ShadowGenerator | null = null;

  constructor(scene: Scene) {
    this.scene_ = scene;
  }

  /**
   * Set the shadow generator for adding shadow casters.
   */
  setShadowGenerator(sg: ShadowGenerator): void {
    this.shadowGenerator_ = sg;
  }

  /**
   * Load the car GLB model with timeout protection and retry.
   *
   * Coordinate system: car nose faces -Z (forward direction), tail faces +Z.
   *
   * @param modelUrl - Base URL path for the model directory.
   * @param modelFile - Filename of the GLB model.
   */
  async load(modelUrl: string, modelFile: string): Promise<void> {
    // Car root node (game logic controls position and rotation)
    const carRoot = new TransformNode("carRoot", this.scene_);

    // Intermediate rotation node (flips car heading, does not affect game logic)
    const orientNode = new TransformNode("carOrient", this.scene_);
    orientNode.parent = carRoot;
    orientNode.rotation.y = Math.PI; // Flip 180° so tail faces camera

    try {
      const result = await this.loadGlbWithRetry_(modelUrl, modelFile);
      logger.debug("CarModel", "GLB model loaded, meshes:", result.meshes.length);

      const rootMesh = result.meshes[0];
      rootMesh.parent = orientNode;

      this.scaleAndCenterModel_(result.meshes, rootMesh);
      this.glbRoot_ = orientNode;
      this.setupShadows_(result.meshes);
      this.findWheelMeshes_(result.meshes);
      this.findTailLightMesh_(result.meshes);

      result.meshes.forEach((m) => logger.debug("CarModel", "  mesh:", m.name));
    } catch (error) {
      logger.error("CarModel", "GLB model load failed, falling back to simple model:", error);
      this.createFallbackCar_(carRoot);
    }

    // Initial car position
    carRoot.position.set(0, 0, 0);
    this.mesh = carRoot;
    this.orientNode_ = orientNode;
  }

  /**
   * 计算模型包围盒并自动缩放、居中。
   */
  private scaleAndCenterModel_(meshes: AbstractMesh[], rootMesh: AbstractMesh): void {
    let bounds: { min: Vector3; max: Vector3 } | null = null;
    for (const mesh of meshes) {
      if (mesh.getBoundingInfo) {
        const bi = mesh.getBoundingInfo();
        if (!bounds) {
          bounds = {
            min: bi.boundingBox.minimumWorld.clone(),
            max: bi.boundingBox.maximumWorld.clone(),
          };
        } else {
          bounds.min = Vector3.Minimize(bounds.min, bi.boundingBox.minimumWorld);
          bounds.max = Vector3.Maximize(bounds.max, bi.boundingBox.maximumWorld);
        }
      }
    }

    if (!bounds) {
      return;
    }

    const size = bounds.max.subtract(bounds.min);
    const currentLen = Math.max(size.x, size.z);
    const targetLen = 4.0;
    const scale = targetLen / currentLen;

    rootMesh.scaling = new Vector3(scale, scale, scale);

    const center = bounds.min.add(bounds.max).scale(0.5);
    rootMesh.position = center.scale(-scale);
    rootMesh.position.y = -bounds.min.y * scale + 0.01;

    logger.debug("CarModel", "Model size:", size, "scale:", scale);
  }

  /**
   * 为模型网格添加阴影投射。
   */
  private setupShadows_(meshes: AbstractMesh[]): void {
    if (!this.shadowGenerator_) {
      return;
    }
    for (const mesh of meshes) {
      if ((mesh as Mesh).geometry) {
        this.shadowGenerator_.addShadowCaster(mesh);
      }
    }
  }

  /**
   * 查找车轮网格（模糊名称匹配）。
   */
  private findWheelMeshes_(meshes: AbstractMesh[]): void {
    this.wheels_ = [];
    for (const mesh of meshes) {
      const name = (mesh.name || "").toLowerCase();
      if (name.includes("wheel") || name.includes("tire") || name.includes("tyre")) {
        this.wheels_.push(mesh);
      }
    }
    logger.debug("CarModel", "Found wheel meshes:", this.wheels_.length);
  }

  /**
   * 查找尾灯网格并设置材质引用。
   */
  private findTailLightMesh_(meshes: AbstractMesh[]): void {
    for (const mesh of meshes) {
      const name = (mesh.name || "").toLowerCase();
      if (name.includes("tail") && name.includes("light")) {
        if (mesh.material && mesh.material instanceof StandardMaterial) {
          this.tailLightMat_ = mesh.material;
          return;
        }
      }
    }
  }

  /**
   * Update car mesh position and rotation based on CarState.
   *
   * @param state - Current car state from CarController.
   * @param isBraking - Whether the brake is currently active.
   */
  updateFromState(state: CarState, isBraking: boolean): void {
    if (!this.mesh) {
      return;
    }

    // Lateral position
    this.mesh.position.x = state.x;

    // Yaw (subtle steering, real racing cars have very small yaw during lane changes)
    this.mesh.rotation.y = state.tilt * 0.5;

    // Roll (slight lean)
    const targetRoll = -state.tilt * 0.4;
    this.mesh.rotation.z = lerp(this.mesh.rotation.z || 0, targetRoll, 0.08);

    // Pitch (nose up under acceleration, nose down under braking)
    let targetPitch = 0;
    if (isBraking && state.speed > 20) {
      targetPitch = 0.03; // Brake dive
    } else if (state.speed > 200) {
      targetPitch = -0.02 * ((state.speed - 200) / 200); // High-speed slight nose-up
    }
    this.mesh.rotation.x = lerp(this.mesh.rotation.x || 0, targetPitch, 0.08);
  }

  /**
   * Update wheel rotation based on current speed.
   *
   * @param speed - Current speed in km/h.
   * @param dt - Delta time in seconds.
   */
  updateWheels(speed: number, dt: number): void {
    if (!this.wheels_.length) {
      return;
    }
    const wheelRotSpeed = speed * 0.12 * dt;
    for (const w of this.wheels_) {
      w.rotation.x += wheelRotSpeed;
    }
  }

  /**
   * Update tail light glow based on speed and braking state.
   *
   * @param speed - Current speed in km/h (unused for glow calc but kept for future use).
   * @param isBraking - Whether the brake is active.
   * @param gameTime - Current game elapsed time in seconds (for pulsing animation).
   */
  updateTailLights(speed: number, isBraking: boolean, gameTime: number): void {
    if (!this.tailLightMat_) {
      return;
    }
    const glow = isBraking ? 1.0 : 0.3 + Math.sin(gameTime * 3) * 0.1;
    this.tailLightMat_.emissiveColor.copyFromFloats(glow, 0, 0);
    if (this.tailStripMat_) {
      this.tailStripMat_.emissiveColor.copyFromFloats(glow * 0.5, 0, 0);
    }
  }

  /**
   * Set invincibility blink effect on the car body.
   *
   * @param blinking - Whether the car should be blinking (true during invincibility).
   * @param gameTime - Game time for blink frequency calculation.
   */
  setInvincibilityBlink(blinking: boolean, gameTime: number): void {
    if (!this.glbRoot_) {
      return;
    }
    if (blinking) {
      const blink = Math.floor(gameTime * 10) % 2 === 0;
      this.glbRoot_.getChildMeshes(false).forEach((m) => {
        m.visibility = blink ? 0.4 : 1;
      });
    } else {
      this.glbRoot_.getChildMeshes(false).forEach((m) => {
        m.visibility = 1;
      });
    }
  }

  /**
   * Get the GLB root node (for external visibility control, e.g. cockpit mode).
   */
  getGlbRoot(): TransformNode | null {
    return this.glbRoot_;
  }

  /** Dispose all car meshes and materials. */
  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose(false, true);
      this.mesh = null;
    }
    this.glbRoot_ = null;
    this.orientNode_ = null;
    this.wheels_ = [];
    this.tailLightMat_ = null;
    this.tailStripMat_ = null;
  }

  /**
   * Load GLB with timeout and single retry.
   */
  private async loadGlbWithRetry_(
    baseUrl: string,
    fileName: string,
  ): Promise<{ meshes: AbstractMesh[] }> {
    const loadGlb = (timeout: number): Promise<{ meshes: AbstractMesh[] }> => {
      const loadPromise = SceneLoader.ImportMeshAsync(
        "",
        baseUrl,
        fileName,
        this.scene_,
      ) as Promise<{ meshes: AbstractMesh[] }>;
      const timeoutPromise = new Promise<never>((__, reject) =>
        setTimeout(() => reject(new Error("Model load timeout")), timeout),
      );
      return Promise.race([loadPromise, timeoutPromise]);
    };

    try {
      return await loadGlb(60000); // First attempt: 60s timeout (26MB file)
    } catch (firstErr) {
      logger.warn("CarModel", "First load attempt failed, retrying...", (firstErr as Error).message);
      return await loadGlb(90000); // Retry: 90s timeout
    }
  }

  /**
   * Create a fallback box car when the GLB model fails to load.
   */
  private createFallbackCar_(parent: TransformNode): void {
    const fallback = MeshBuilder.CreateBox(
      "carFallback",
      { width: 2.0, height: 0.5, depth: 4.8 },
      this.scene_,
    );
    const fallbackMat = new PBRMetallicRoughnessMaterial("fallbackMat", this.scene_);
    fallbackMat.baseColor = new Color3(0.7, 0.04, 0.04);
    fallbackMat.metallic = 0.9;
    fallbackMat.roughness = 0.18;
    fallback.material = fallbackMat;
    fallback.position.y = 0.3;
    fallback.parent = parent;

    if (this.shadowGenerator_) {
      this.shadowGenerator_.addShadowCaster(fallback);
    }
  }
}
