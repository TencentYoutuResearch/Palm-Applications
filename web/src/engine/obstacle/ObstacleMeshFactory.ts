/**
 * ObstacleMeshFactory - Creates 3D meshes for each obstacle kind.
 *
 * Handles NPC cars (ribbon body + cabin + tail lights + wheels),
 * barriers, barrels, boost pads, coins, and hearts.
 * Manages shared materials to avoid per-obstacle material allocation.
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMetallicRoughnessMaterial } from '@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Obstacle, ObstacleKind } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** NPC car body colours (PBR base colors). */
const NPC_COLORS: Color3[] = [
  new Color3(0.15, 0.3, 0.85),   // Royal blue
  new Color3(0.1, 0.6, 0.15),    // British racing green
  new Color3(0.6, 0.15, 0.6),    // Purple
  new Color3(0.85, 0.45, 0.05),  // Orange
  new Color3(0.1, 0.1, 0.12),    // Black
  new Color3(0.92, 0.92, 0.95),  // Silver
  new Color3(0.9, 0.85, 0.0),    // Yellow
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export class ObstacleMeshFactory {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator | null;
  private sharedMaterials: Map<string, StandardMaterial | PBRMetallicRoughnessMaterial> = new Map();

  constructor(scene: Scene, shadowGenerator: ShadowGenerator | null = null) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  setShadowGenerator(sg: ShadowGenerator): void {
    this.shadowGenerator = sg;
  }

  /** Create an obstacle mesh of the given kind at (x, z). */
  create(kind: ObstacleKind, x: number, z: number): Obstacle {
    switch (kind) {
      case 'npc':     return this.createNPCCar(x, z);
      case 'barrier': return this.createBarrier(x, z);
      case 'barrel':  return this.createBarrel(x, z);
      case 'boost':   return this.createBoost(x, z);
      case 'coin':    return this.createCoin(x, z);
      case 'heart':   return this.createHeart(x, z);
    }
  }

  /** Dispose all shared materials. */
  dispose(): void {
    this.sharedMaterials.forEach((mat) => mat.dispose());
    this.sharedMaterials.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private uid(): string {
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  // --- NPC Car ---

  private createNPCCar(x: number, z: number): Obstacle {
    const id = this.uid();
    const color = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];

    // PBR metallic paint
    const mat = new PBRMetallicRoughnessMaterial(`npcMat_${id}`, this.scene);
    mat.baseColor = color;
    mat.metallic = 0.85;
    mat.roughness = 0.2;

    // Ribbon body
    const NPC_LEN = 3.6;
    const NPC_HALF_W = 0.78;
    const NPC_H = 0.35;
    const NPC_GND = 0.08;
    const N_SEC = 20;
    const N_R = 20;
    const npcPaths: Vector3[][] = [];

    for (let i = 0; i <= N_SEC; ++i) {
      const t = i / N_SEC;
      const zz = -NPC_LEN / 2 + t * NPC_LEN;

      let w: number;
      if (t < 0.08) w = 0.2 + (t / 0.08) * 0.8;
      else if (t < 0.25) w = 1.0;
      else if (t < 0.45) w = 1.0 - ((t - 0.25) / 0.2) * 0.08;
      else if (t < 0.7) w = 0.92 + ((t - 0.45) / 0.25) * 0.08;
      else w = 1.0 - ((t - 0.7) / 0.3) * 0.15;

      let h: number;
      if (t < 0.08) h = 0.15;
      else if (t < 0.2) h = 0.15 + ((t - 0.08) / 0.12) * (NPC_H - 0.15);
      else if (t < 0.7) h = NPC_H;
      else h = NPC_H - ((t - 0.7) / 0.3) * 0.05;

      const ring: Vector3[] = [];
      for (let j = 0; j <= N_R; ++j) {
        const a = (j / N_R) * Math.PI * 2;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        let px: number;
        let py: number;
        if (sinA >= 0) {
          px = cosA * w * NPC_HALF_W;
          py = NPC_GND + h + sinA * h * 0.12;
        } else {
          px = cosA * w * NPC_HALF_W * 1.03;
          py = NPC_GND + (Math.abs(cosA) < 0.7 ? 0 : sinA * 0.04);
        }
        ring.push(new Vector3(px, py, zz));
      }
      npcPaths.push(ring);
    }

    const body = MeshBuilder.CreateRibbon(`npc_${id}`, {
      pathArray: npcPaths,
      closeArray: false,
      closePath: true,
      sideOrientation: Mesh.DOUBLESIDE,
    }, this.scene);
    body.position.set(x, 0, z);
    body.material = mat;
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(body);
    }

    // Cabin (glass)
    const cabinMat = new StandardMaterial(`npcCabin_${id}`, this.scene);
    cabinMat.diffuseColor = new Color3(0.08, 0.1, 0.2);
    cabinMat.specularColor = new Color3(0.6, 0.6, 0.7);
    cabinMat.specularPower = 256;
    cabinMat.alpha = 0.55;

    const cabinPaths: Vector3[][] = [];
    for (let i = 0; i <= 8; ++i) {
      const t = i / 8;
      const cz = -0.6 + t * 1.5;
      let hm = Math.sin(t * Math.PI);
      hm = Math.pow(hm, 0.5);
      const ring: Vector3[] = [];
      for (let j = 0; j <= 12; ++j) {
        const a = (j / 12) * Math.PI;
        ring.push(new Vector3(
          0.38 * Math.cos(a),
          0.2 * hm * Math.sin(a) + NPC_H + NPC_GND + 0.02,
          cz,
        ));
      }
      cabinPaths.push(ring);
    }
    const cabin = MeshBuilder.CreateRibbon(`npcCabin_${id}`, {
      pathArray: cabinPaths,
      closeArray: false,
      closePath: false,
      sideOrientation: Mesh.DOUBLESIDE,
    }, this.scene);
    cabin.position.set(x, 0, z);
    cabin.material = cabinMat;
    (cabin as any)._offsetZ = 0;

    // Tail lights
    const npcTailMat = new StandardMaterial(`npcTail_${id}`, this.scene);
    npcTailMat.emissiveColor = new Color3(0.8, 0, 0);
    npcTailMat.diffuseColor = new Color3(1, 0, 0);

    const npcTailL = MeshBuilder.CreateCylinder(`npcTailL_${id}`, {
      diameter: 0.12, height: 0.03, tessellation: 16,
    }, this.scene);
    npcTailL.rotation.x = Math.PI / 2;
    npcTailL.position.set(x - 0.45, NPC_H + NPC_GND - 0.06, z + NPC_LEN / 2 + 0.01);
    npcTailL.material = npcTailMat;
    (npcTailL as any)._offsetZ = NPC_LEN / 2 + 0.01;

    const npcTailR = MeshBuilder.CreateCylinder(`npcTailR_${id}`, {
      diameter: 0.12, height: 0.03, tessellation: 16,
    }, this.scene);
    npcTailR.rotation.x = Math.PI / 2;
    npcTailR.position.set(x + 0.45, NPC_H + NPC_GND - 0.06, z + NPC_LEN / 2 + 0.01);
    npcTailR.material = npcTailMat;
    (npcTailR as any)._offsetZ = NPC_LEN / 2 + 0.01;

    // Wheels
    const npcWheelMat = new StandardMaterial(`npcWheel_${id}`, this.scene);
    npcWheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
    npcWheelMat.specularColor = new Color3(0.05, 0.05, 0.05);
    npcWheelMat.specularPower = 8;

    const wheelPositions = [
      { wx: -0.78, wz: -1.2 }, { wx: 0.78, wz: -1.2 },
      { wx: -0.8, wz: 1.2 },  { wx: 0.8, wz: 1.2 },
    ];
    const wheels: Mesh[] = [];
    for (let wi = 0; wi < wheelPositions.length; ++wi) {
      const wp = wheelPositions[wi];
      const nw = MeshBuilder.CreateTorus(`npcW_${id}_${wi}`, {
        diameter: 0.38, thickness: 0.14, tessellation: 20,
      }, this.scene);
      nw.rotation.z = Math.PI / 2;
      nw.position.set(x + wp.wx, 0.19, z + wp.wz);
      nw.material = npcWheelMat;
      (nw as any)._offsetZ = wp.wz;
      wheels.push(nw);
    }

    return {
      kind: 'npc',
      mesh: body,
      extraMeshes: [cabin, npcTailL, npcTailR, ...wheels],
      x, z,
      halfW: 0.78, halfD: 1.8,
      selfSpeed: 30 + Math.random() * 60,
      collected: false,
      coin: false, boost: false, heal: false, slowdown: false, damage: true,
      spinAngle: 0, bobPhase: 0,
    };
  }

  // --- Barrier ---

  private createBarrier(x: number, z: number): Obstacle {
    const id = this.uid();

    const baseMat = new PBRMetallicRoughnessMaterial(`barrierBase_${id}`, this.scene);
    baseMat.baseColor = new Color3(0.6, 0.6, 0.62);
    baseMat.metallic = 0.1;
    baseMat.roughness = 0.8;

    const base = MeshBuilder.CreateBox(`barrier_${id}`, {
      width: 3.2, height: 0.7, depth: 0.6,
    }, this.scene);
    base.position.set(x, 0.35, z);
    base.material = baseMat;

    // Red/white stripe
    const stripeMat = new PBRMetallicRoughnessMaterial(`barrierStripe_${id}`, this.scene);
    stripeMat.baseColor = new Color3(0.95, 0.15, 0.1);
    stripeMat.metallic = 0.0;
    stripeMat.roughness = 0.5;
    const stripe = MeshBuilder.CreateBox(`barrierStripe_${id}`, {
      width: 3.3, height: 0.1, depth: 0.62,
    }, this.scene);
    stripe.position.set(x, 0.72, z);
    stripe.material = stripeMat;
    (stripe as any)._offsetZ = 0;

    // Reflector
    const refMat = new StandardMaterial(`barrierRef_${id}`, this.scene);
    refMat.emissiveColor = new Color3(0.9, 0.6, 0.1);
    refMat.disableLighting = true;
    const ref = MeshBuilder.CreateBox(`barrierRef_${id}`, {
      width: 0.15, height: 0.15, depth: 0.01,
    }, this.scene);
    ref.position.set(x, 0.5, z - 0.31);
    ref.material = refMat;
    (ref as any)._offsetZ = -0.31;

    return {
      kind: 'barrier',
      mesh: base, extraMeshes: [stripe, ref],
      x, z,
      halfW: 1.6, halfD: 0.3,
      selfSpeed: 0,
      collected: false,
      coin: false, boost: false, heal: false, slowdown: false, damage: true,
      spinAngle: 0, bobPhase: 0,
    };
  }

  // --- Barrel ---

  private createBarrel(x: number, z: number): Obstacle {
    const id = this.uid();

    const mat = new PBRMetallicRoughnessMaterial(`barrelMat_${id}`, this.scene);
    mat.baseColor = new Color3(0.6, 0.25, 0.05);
    mat.metallic = 0.7;
    mat.roughness = 0.4;

    const mesh = MeshBuilder.CreateCylinder(`barrel_${id}`, {
      diameter: 0.8, height: 1.1, tessellation: 16,
    }, this.scene);
    mesh.position.set(x, 0.55, z);
    mesh.material = mat;

    // Top cap
    const topMat = new PBRMetallicRoughnessMaterial(`barrelTop_${id}`, this.scene);
    topMat.baseColor = new Color3(0.4, 0.4, 0.42);
    topMat.metallic = 0.9;
    topMat.roughness = 0.2;
    const top = MeshBuilder.CreateCylinder(`barrelTop_${id}`, {
      diameter: 0.75, height: 0.05, tessellation: 16,
    }, this.scene);
    top.position.set(x, 1.12, z);
    top.material = topMat;
    (top as any)._offsetZ = 0;

    // Ring band
    const ringMat = new PBRMetallicRoughnessMaterial(`barrelRing_${id}`, this.scene);
    ringMat.baseColor = new Color3(0.35, 0.35, 0.38);
    ringMat.metallic = 0.9;
    ringMat.roughness = 0.25;
    const ring = MeshBuilder.CreateTorus(`barrelRing_${id}`, {
      diameter: 0.82, thickness: 0.04, tessellation: 20,
    }, this.scene);
    ring.position.set(x, 0.55, z);
    ring.material = ringMat;
    (ring as any)._offsetZ = 0;

    return {
      kind: 'barrel',
      mesh, extraMeshes: [top, ring],
      x, z,
      halfW: 0.4, halfD: 0.4,
      selfSpeed: 0,
      collected: false,
      coin: false, boost: false, heal: false, slowdown: true, damage: false,
      spinAngle: 0, bobPhase: 0,
    };
  }

  // --- Boost pad ---

  private createBoost(x: number, z: number): Obstacle {
    const id = this.uid();

    const mat = new StandardMaterial(`boostMat_${id}`, this.scene);
    mat.diffuseColor = new Color3(0, 0.4, 1);
    mat.emissiveColor = new Color3(0, 0.35, 0.9);
    mat.alpha = 0.75;
    mat.disableLighting = true;

    const mesh = MeshBuilder.CreateBox(`boost_${id}`, {
      width: 2.8, height: 0.06, depth: 1.8,
    }, this.scene);
    mesh.position.set(x, 0.03, z);
    mesh.material = mat;

    // Arrow indicator
    const arrowMat = new StandardMaterial(`boostArrow_${id}`, this.scene);
    arrowMat.emissiveColor = new Color3(0.8, 0.9, 1.0);
    arrowMat.disableLighting = true;
    arrowMat.alpha = 0.9;
    const arrow = MeshBuilder.CreateBox(`boostArrow_${id}`, {
      width: 0.6, height: 0.07, depth: 0.8,
    }, this.scene);
    arrow.position.set(x, 0.04, z);
    arrow.rotation.y = Math.PI / 4;
    arrow.material = arrowMat;
    (arrow as any)._offsetZ = 0;

    return {
      kind: 'boost',
      mesh, extraMeshes: [arrow],
      x, z,
      halfW: 1.4, halfD: 0.9,
      selfSpeed: 0,
      collected: false,
      coin: false, boost: true, heal: false, slowdown: false, damage: false,
      spinAngle: 0, bobPhase: 0,
    };
  }

  // --- Coin ---

  private createCoin(x: number, z: number): Obstacle {
    const id = this.uid();

    const mat = new PBRMetallicRoughnessMaterial(`coinMat_${id}`, this.scene);
    mat.baseColor = new Color3(1.0, 0.84, 0.0);
    mat.metallic = 0.95;
    mat.roughness = 0.15;

    const mesh = MeshBuilder.CreateCylinder(`coin_${id}`, {
      diameter: 0.9, height: 0.1, tessellation: 24,
    }, this.scene);
    mesh.position.set(x, 0.8, z);
    mesh.rotation.x = Math.PI / 2;
    mesh.material = mat;

    // Inner relief
    const innerMat = new PBRMetallicRoughnessMaterial(`coinInner_${id}`, this.scene);
    innerMat.baseColor = new Color3(0.85, 0.7, 0.0);
    innerMat.metallic = 0.9;
    innerMat.roughness = 0.3;
    const inner = MeshBuilder.CreateCylinder(`coinInner_${id}`, {
      diameter: 0.6, height: 0.12, tessellation: 24,
    }, this.scene);
    inner.position.set(x, 0.8, z);
    inner.rotation.x = Math.PI / 2;
    inner.material = innerMat;
    (inner as any)._offsetZ = 0;

    return {
      kind: 'coin',
      mesh, extraMeshes: [inner],
      x, z,
      halfW: 0.45, halfD: 0.45,
      selfSpeed: 0,
      collected: false,
      coin: true, boost: false, heal: false, slowdown: false, damage: false,
      spinAngle: 0, bobPhase: 0,
    };
  }

  // --- Heart ---

  private createHeart(x: number, z: number): Obstacle {
    const id = this.uid();

    const mat = new StandardMaterial(`heartMat_${id}`, this.scene);
    mat.diffuseColor = new Color3(1, 0.15, 0.3);
    mat.emissiveColor = new Color3(0.6, 0.08, 0.15);

    // Left half-sphere
    const left = MeshBuilder.CreateSphere(`heartL_${id}`, {
      diameter: 0.45, segments: 12,
    }, this.scene);
    left.position.set(x - 0.15, 0.9, z);
    left.material = mat;

    // Right half-sphere
    const right = MeshBuilder.CreateSphere(`heartR_${id}`, {
      diameter: 0.45, segments: 12,
    }, this.scene);
    right.position.set(x + 0.15, 0.9, z);
    right.material = mat;
    (right as any)._offsetZ = 0;
    (right as any)._offsetX = 0.3;

    // Bottom cone
    const bottom = MeshBuilder.CreateCylinder(`heartB_${id}`, {
      diameterTop: 0.55, diameterBottom: 0, height: 0.5, tessellation: 12,
    }, this.scene);
    bottom.position.set(x, 0.55, z);
    bottom.material = mat;
    (bottom as any)._offsetZ = 0;
    (bottom as any)._offsetX = 0;

    return {
      kind: 'heart',
      mesh: left, extraMeshes: [right, bottom],
      x, z,
      halfW: 0.35, halfD: 0.35,
      selfSpeed: 0,
      collected: false,
      coin: false, boost: false, heal: true, slowdown: false, damage: false,
      spinAngle: 0,
      bobPhase: Math.random() * Math.PI * 2,
    };
  }
}
