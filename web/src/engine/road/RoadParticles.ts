/**
 * RoadParticles - Dynamic road markers and speed line particles.
 *
 * Spawns and moves road surface markers (patches, reflective dots, oil spots)
 * and side-mounted speed lines that enhance the sense of motion.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import type { RoadConfig } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const kKmhToMs = 0.278;
const kMaxSpeedLines = 30;
const kMaxRoadMarkers = 40;
const kSpeedLineMinSpeed = 100;
const kRoadMarkerMinSpeed = 30;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RoadMarkerEntry {
  mesh: Mesh;
  z: number;
}

interface SpeedLineEntry {
  mesh: Mesh;
  z: number;
  life: number;
  maxLife: number;
}

// ---------------------------------------------------------------------------
// RoadParticles
// ---------------------------------------------------------------------------

export class RoadParticles {
  private scene: Scene;
  private config: RoadConfig;

  private roadMarkers: RoadMarkerEntry[] = [];
  private speedLineParticles: SpeedLineEntry[] = [];
  private sharedMaterials: Record<string, StandardMaterial> = {};

  constructor(scene: Scene, config: RoadConfig) {
    this.scene = scene;
    this.config = config;
  }

  /** Per-frame update for markers and speed lines. */
  update(dt: number, speed: number): void {
    this.updateRoadMarkers(dt, speed);
    this.updateSpeedLines(dt, speed);
  }

  /** Dispose all particles and shared materials. */
  dispose(): void {
    for (const marker of this.roadMarkers) {
      if (marker.mesh && !marker.mesh.isDisposed()) {
        marker.mesh.dispose();
      }
    }
    this.roadMarkers = [];

    for (const line of this.speedLineParticles) {
      if (line.mesh && !line.mesh.isDisposed()) {
        line.mesh.dispose();
      }
    }
    this.speedLineParticles = [];

    for (const key of Object.keys(this.sharedMaterials)) {
      this.sharedMaterials[key].dispose();
    }
    this.sharedMaterials = {};
  }

  // -----------------------------------------------------------------------
  // Road markers
  // -----------------------------------------------------------------------

  private updateRoadMarkers(dt: number, speed: number): void {
    const scrollSpeed = speed * kKmhToMs;

    if (speed > kRoadMarkerMinSpeed) {
      const spawnRate = speed / 80;
      if (Math.random() < spawnRate * dt * 5) {
        this.spawnRoadMarker();
      }
    }

    for (let i = this.roadMarkers.length - 1; i >= 0; i--) {
      const marker = this.roadMarkers[i];
      marker.z += scrollSpeed * dt;

      if (marker.mesh) {
        marker.mesh.position.z = marker.z;
      }

      if (marker.z > 15) {
        if (marker.mesh) {
          marker.mesh.dispose();
        }
        this.roadMarkers.splice(i, 1);
      }
    }
  }

  private spawnRoadMarker(): void {
    if (this.roadMarkers.length >= kMaxRoadMarkers) {
      return;
    }

    const halfRoad = this.config.width / 2;
    const x = (Math.random() - 0.5) * (halfRoad * 2 - 2);
    const z = -70 - Math.random() * 20;

    // Lazy-create shared marker materials
    if (!this.sharedMaterials.roadPatch) {
      const m1 = new StandardMaterial('roadPatch_shared', this.scene);
      m1.diffuseColor = new Color3(0.15, 0.15, 0.18);
      m1.emissiveColor = new Color3(0, 0, 0);
      m1.specularColor = new Color3(0.1, 0.1, 0.1);
      this.sharedMaterials.roadPatch = m1;

      const m2 = new StandardMaterial('roadReflect_shared', this.scene);
      m2.diffuseColor = new Color3(0.9, 0.9, 0.7);
      m2.emissiveColor = new Color3(0.3, 0.3, 0.2);
      m2.specularColor = new Color3(0.1, 0.1, 0.1);
      this.sharedMaterials.roadReflect = m2;

      const m3 = new StandardMaterial('roadOil_shared', this.scene);
      m3.diffuseColor = new Color3(0.1, 0.1, 0.12);
      m3.emissiveColor = new Color3(0.02, 0.02, 0.03);
      m3.specularColor = new Color3(0.1, 0.1, 0.1);
      this.sharedMaterials.roadOil = m3;
    }

    const rand = Math.random();
    let mat: StandardMaterial;
    let w: number;
    let d: number;

    if (rand < 0.4) {
      mat = this.sharedMaterials.roadPatch;
      w = 0.3 + Math.random() * 0.8;
      d = 0.5 + Math.random() * 1.5;
    } else if (rand < 0.7) {
      mat = this.sharedMaterials.roadReflect;
      w = 0.08;
      d = 0.08;
    } else {
      mat = this.sharedMaterials.roadOil;
      w = 0.4 + Math.random() * 0.6;
      d = 0.2 + Math.random() * 0.4;
    }

    const mesh = MeshBuilder.CreateBox(
      'roadMarker', { width: w, height: 0.005, depth: d }, this.scene,
    );
    mesh.position.set(x, 0.01, z);
    mesh.material = mat;

    this.roadMarkers.push({ mesh, z });
  }

  // -----------------------------------------------------------------------
  // Speed lines
  // -----------------------------------------------------------------------

  private updateSpeedLines(dt: number, speed: number): void {
    const scrollSpeed = speed * kKmhToMs;

    if (speed > kSpeedLineMinSpeed) {
      const spawnRate = (speed - kSpeedLineMinSpeed) / 50;
      if (Math.random() < spawnRate * dt * 10) {
        this.spawnSpeedLine();
      }
    }

    for (let i = this.speedLineParticles.length - 1; i >= 0; i--) {
      const line = this.speedLineParticles[i];
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
        this.speedLineParticles.splice(i, 1);
      }
    }
  }

  private spawnSpeedLine(): void {
    if (this.speedLineParticles.length >= kMaxSpeedLines) {
      return;
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const halfRoad = this.config.width / 2;
    const x = side * (halfRoad + 1.5 + Math.random() * 4);
    const y = 0.1 + Math.random() * 0.5;
    const z = -60 - Math.random() * 30;

    if (!this.sharedMaterials.speedLine) {
      const mat = new StandardMaterial('speedLine_shared', this.scene);
      mat.diffuseColor = new Color3(0.8, 0.85, 1.0);
      mat.emissiveColor = new Color3(0.4, 0.45, 0.6);
      mat.alpha = 0.5;
      mat.disableLighting = true;
      this.sharedMaterials.speedLine = mat;
    }

    const lineLength = 2 + Math.random() * 4;
    const mesh = MeshBuilder.CreateBox(
      'speedLine', { width: 0.03, height: 0.03, depth: lineLength }, this.scene,
    );
    mesh.position.set(x, y, z);
    mesh.material = this.sharedMaterials.speedLine;

    this.speedLineParticles.push({ mesh, z, life: 1.5, maxLife: 1.5 });
  }
}
