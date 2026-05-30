/**
 * @file RoadSystem.ts
 * @description Road system orchestrator — delegates static geometry creation
 * to RoadMeshBuilder and dynamic particles to RoadParticles.
 */

import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';

import type { RoadConfig, RoadsideEntry } from './road/types';
import { kDefaultRoadConfig } from './road/types';
import { buildRoadMeshes } from './road/RoadMeshBuilder';
import { RoadParticles } from './road/RoadParticles';
import { ROAD_KMH_TO_MS, ROAD_ROADSIDE_RESET_THRESHOLD } from '@/config/constants';

// Re-export for backward compatibility
export type { RoadConfig };
export { kDefaultRoadConfig };

/**
 * RoadSystem manages the entire road environment: ground planes, road surface,
 * curbs, barriers, road lights, reflectors, and dynamically spawned markers /
 * speed lines.  All roadside objects use a cycling pool that scrolls toward the
 * camera and wraps back to the far end of the track.
 */
class RoadSystem {
  private scene_: Scene;
  private config_: RoadConfig;

  // Road surface
  private roadMesh_: Mesh | null = null;
  private roadTexture_: DynamicTexture | null = null;
  private roadOffset_ = 0;

  // Grass
  private grassTexture_: DynamicTexture | null = null;
  private grassOffset_ = 0;

  // Roadside cycling pool
  private roadsideObjects_: RoadsideEntry[] = [];
  private roadsideTotalLength_ = 0;

  // Road light meshes (stored separately for disposal)
  private roadLightMeshes_: Mesh[] = [];

  // Dynamic particles delegate
  private particles_: RoadParticles;

  constructor(scene: Scene, roadConfig?: Partial<RoadConfig>) {
    this.scene_ = scene;
    this.config_ = { ...kDefaultRoadConfig, ...roadConfig };
    this.particles_ = new RoadParticles(scene, this.config_);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Returns the current road configuration. */
  getConfig(): Readonly<RoadConfig> {
    return this.config_;
  }

  /**
   * create builds all static road geometry: grass, road surface, curbs,
   * barriers, road lights, and reflectors.
   */
  create(): void {
    const result = buildRoadMeshes(this.scene_, this.config_);
    this.roadMesh_ = result.roadMesh;
    this.roadTexture_ = result.roadTexture;
    this.grassTexture_ = result.grassTexture;
    this.roadsideObjects_ = result.roadsideObjects;
    this.roadLightMeshes_ = result.roadLightMeshes;

    // Record the total cycling length (equals visible road length).
    this.roadsideTotalLength_ = this.config_.segmentLength;
  }

  /**
   * update advances road scroll, roadside object cycling, road markers, and
   * speed lines by the given delta time and current car speed.
   *
   * @param dt - Delta time in seconds.
   * @param speed - Current car speed in km/h.
   */
  update(dt: number, speed: number): void {
    this.updateRoadScroll_(dt, speed);
    this.updateRoadsideScroll_(dt, speed);
    this.particles_.update(dt, speed);
  }

  /**
   * dispose removes all meshes and materials created by this system.
   */
  dispose(): void {
    // Roadside objects
    for (const obj of this.roadsideObjects_) {
      if (obj.mesh && !obj.mesh.isDisposed()) {
        obj.mesh.dispose();
      }
    }
    this.roadsideObjects_ = [];

    // Road light meshes
    for (const mesh of this.roadLightMeshes_) {
      if (mesh && !mesh.isDisposed()) {
        mesh.dispose();
      }
    }
    this.roadLightMeshes_ = [];

    // Road mesh
    if (this.roadMesh_ && !this.roadMesh_.isDisposed()) {
      this.roadMesh_.dispose();
    }
    this.roadMesh_ = null;

    // Textures
    if (this.roadTexture_) {
      this.roadTexture_.dispose();
      this.roadTexture_ = null;
    }
    if (this.grassTexture_) {
      this.grassTexture_.dispose();
      this.grassTexture_ = null;
    }

    // Dynamic particles
    this.particles_.dispose();
  }

  // -----------------------------------------------------------------------
  // Per-frame scroll helpers
  // -----------------------------------------------------------------------

  /** Scrolls road and grass textures to simulate forward movement. */
  private updateRoadScroll_(dt: number, speed: number): void {
    const scrollSpeed = speed * ROAD_KMH_TO_MS;
    this.roadOffset_ += scrollSpeed * dt;

    if (this.roadMesh_ && this.roadMesh_.material) {
      const diffuse =
        (this.roadMesh_.material as StandardMaterial).diffuseTexture as Texture | null;
      if (diffuse) {
        diffuse.vOffset = this.roadOffset_;
      }
    }

    // Grass texture follows
    if (this.grassTexture_) {
      this.grassOffset_ += scrollSpeed * dt;
      this.grassTexture_.vOffset = this.grassOffset_;
    }
  }

  /**
   * Moves all roadside objects along +Z and wraps them back to the far end
   * once they pass the camera threshold.
   */
  private updateRoadsideScroll_(dt: number, speed: number): void {
    if (!this.roadsideObjects_.length || !this.roadsideTotalLength_) {
      return;
    }

    const scrollSpeed = speed * ROAD_KMH_TO_MS;
    const totalLen = this.roadsideTotalLength_;

    for (let i = 0; i < this.roadsideObjects_.length; i++) {
      const obj = this.roadsideObjects_[i];
      if (!obj.mesh || obj.mesh.isDisposed()) {
        continue;
      }

      obj.mesh.position.z += scrollSpeed * dt;

      if (obj.mesh.position.z > ROAD_ROADSIDE_RESET_THRESHOLD) {
        obj.mesh.position.z -= totalLen;
      }
    }
  }
}

export { RoadSystem };
