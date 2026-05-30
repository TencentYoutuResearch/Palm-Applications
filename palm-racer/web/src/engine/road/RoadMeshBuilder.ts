/**
 * RoadMeshBuilder - Creates all static road geometry.
 *
 * Handles grass planes, road surface with dynamic lane-line texture,
 * curbs, barriers, road lights, reflectors, and edge markers.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import type { RoadConfig, RoadsideEntry } from './types';

/** Result of building all static road geometry. */
export interface RoadMeshBuildResult {
  roadMesh: Mesh;
  roadTexture: DynamicTexture;
  grassTexture: DynamicTexture;
  roadsideObjects: RoadsideEntry[];
  roadLightMeshes: Mesh[];
}

/**
 * Builds all static road geometry and returns the meshes/textures for
 * the caller (RoadSystem) to own and update.
 */
export function buildRoadMeshes(scene: Scene, config: RoadConfig): RoadMeshBuildResult {
  const roadsideObjects: RoadsideEntry[] = [];
  const roadLightMeshes: Mesh[] = [];
  const roadWidth = config.width;
  const roadLength = config.segmentLength;

  const grassTexture = createGrass(scene, roadWidth, roadLength);
  const { roadMesh, roadTexture } = createRoadSurface(scene, config, roadWidth, roadLength);
  createCurbs(scene, roadWidth, roadLength, roadsideObjects);
  createBarriers(scene, roadWidth, roadLength, roadsideObjects);
  createRoadLights(scene, config, roadWidth, roadLength, roadsideObjects, roadLightMeshes);

  return { roadMesh, roadTexture, grassTexture, roadsideObjects, roadLightMeshes };
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function createGrass(
  scene: Scene,
  roadWidth: number,
  roadLength: number,
): DynamicTexture {
  const grassMat = new StandardMaterial('grassMat', scene);
  grassMat.diffuseColor = new Color3(0.15, 0.4, 0.1);
  grassMat.specularColor = new Color3(0, 0, 0);
  grassMat.specularPower = 0;

  const grassTexture = new DynamicTexture(
    'grassTex', { width: 512, height: 512 }, scene,
  );
  const grassCtx = grassTexture.getContext();
  grassCtx.fillStyle = '#1a5c12';
  grassCtx.fillRect(0, 0, 512, 512);
  // 使用更小的随机点和更多变化，避免产生线条感
  for (let i = 0; i < 8000; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const brightness = 20 + Math.floor(Math.random() * 40);
    grassCtx.fillStyle =
      `rgb(${brightness}, ${50 + brightness}, ${brightness - 10})`;
    const size = 1 + Math.random() * 2;
    grassCtx.fillRect(gx, gy, size, size);
  }
  grassTexture.update();
  grassMat.diffuseTexture = grassTexture;
  (grassMat.diffuseTexture as Texture).uScale = 4;
  (grassMat.diffuseTexture as Texture).vScale = 4;

  const grassLeft = MeshBuilder.CreateGround(
    'grassLeft', { width: 40, height: roadLength }, scene,
  );
  grassLeft.position.x = -(roadWidth / 2 + 20);
  grassLeft.position.z = -roadLength / 2 + 10;
  grassLeft.material = grassMat;
  grassLeft.receiveShadows = true;

  const grassRight = MeshBuilder.CreateGround(
    'grassRight', { width: 40, height: roadLength }, scene,
  );
  grassRight.position.x = roadWidth / 2 + 20;
  grassRight.position.z = -roadLength / 2 + 10;
  grassRight.material = grassMat;
  grassRight.receiveShadows = true;

  return grassTexture;
}

function createRoadSurface(
  scene: Scene,
  config: RoadConfig,
  roadWidth: number,
  roadLength: number,
): { roadMesh: Mesh; roadTexture: DynamicTexture } {
  const roadMat = new StandardMaterial('roadMat', scene);
  roadMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  roadMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const roadTexture = new DynamicTexture(
    'roadTex', { width: 512, height: 1024 }, scene,
  );
  drawRoadTexture(roadTexture, config);
  roadMat.diffuseTexture = roadTexture;
  (roadMat.diffuseTexture as Texture).uScale = 1;
  (roadMat.diffuseTexture as Texture).vScale = 10;

  const roadMesh = MeshBuilder.CreateGround(
    'road', { width: roadWidth, height: roadLength }, scene,
  );
  roadMesh.position.z = -roadLength / 2 + 10;
  roadMesh.material = roadMat;
  roadMesh.receiveShadows = true;

  return { roadMesh, roadTexture };
}

function drawRoadTexture(texture: DynamicTexture, config: RoadConfig): void {
  const ctx = texture.getContext();
  const w = 512;
  const h = 1024;

  // Asphalt base
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(0, 0, w, h);

  // Asphalt grain noise
  for (let i = 0; i < 2000; i++) {
    const rx = Math.random() * w;
    const ry = Math.random() * h;
    const brightness = 30 + Math.random() * 20;
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 5})`;
    ctx.fillRect(rx, ry, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Lane divider dashed lines (white)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 5;
  ctx.setLineDash([40, 30]);
  const laneWidth = w / config.laneCount;
  for (let lane = 1; lane < config.laneCount; lane++) {
    const lx = lane * laneWidth;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Edge lines (solid white)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(10, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w - 10, 0);
  ctx.lineTo(w - 10, h);
  ctx.stroke();

  // Center dashed line (yellow)
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([25, 35]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);

  texture.update();
}

function createCurbs(
  scene: Scene,
  roadWidth: number,
  roadLength: number,
  roadsideObjects: RoadsideEntry[],
): void {
  const curbWidth = 0.5;
  const curbSegments = 40;
  const segLen = roadLength / curbSegments;
  const zOffset = -roadLength / 2 + 10;

  const curbMatRed = new StandardMaterial('curbMat_red', scene);
  curbMatRed.diffuseColor = new Color3(0.9, 0.15, 0.15);
  curbMatRed.specularColor = new Color3(0.1, 0.1, 0.1);

  const curbMatWhite = new StandardMaterial('curbMat_white', scene);
  curbMatWhite.diffuseColor = new Color3(0.95, 0.95, 0.95);
  curbMatWhite.specularColor = new Color3(0.1, 0.1, 0.1);

  for (let i = 0; i < curbSegments; i++) {
    const mat = i % 2 === 0 ? curbMatRed : curbMatWhite;
    const zPos = zOffset - roadLength / 2 + i * segLen + segLen / 2;

    const curbL = MeshBuilder.CreateBox(
      `curbL_${i}`,
      { width: curbWidth, height: 0.05, depth: segLen },
      scene,
    );
    curbL.position.set(-(roadWidth / 2 + curbWidth / 2), 0.025, zPos);
    curbL.material = mat;
    roadsideObjects.push({ mesh: curbL, initZ: zPos });

    const curbR = MeshBuilder.CreateBox(
      `curbR_${i}`,
      { width: curbWidth, height: 0.05, depth: segLen },
      scene,
    );
    curbR.position.set(roadWidth / 2 + curbWidth / 2, 0.025, zPos);
    curbR.material = mat;
    roadsideObjects.push({ mesh: curbR, initZ: zPos });
  }
}

function createBarriers(
  scene: Scene,
  roadWidth: number,
  roadLength: number,
  roadsideObjects: RoadsideEntry[],
): void {
  const barrierMat = new StandardMaterial('barrierMat', scene);
  barrierMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
  barrierMat.specularColor = new Color3(0.3, 0.3, 0.3);

  const railMat = new StandardMaterial('railMat', scene);
  railMat.diffuseColor = new Color3(0.6, 0.6, 0.65);

  const spacing = 8;
  const count = Math.floor(roadLength / spacing);
  const zOffset = -roadLength / 2 + 10;

  for (let i = 0; i < count; i++) {
    const z = zOffset - roadLength / 2 + i * spacing;

    const postL = MeshBuilder.CreateBox(
      `postL_${i}`, { width: 0.15, height: 0.8, depth: 0.15 }, scene,
    );
    postL.position.set(-(roadWidth / 2 + 1.2), 0.4, z);
    postL.material = barrierMat;
    roadsideObjects.push({ mesh: postL, initZ: z });

    const postR = MeshBuilder.CreateBox(
      `postR_${i}`, { width: 0.15, height: 0.8, depth: 0.15 }, scene,
    );
    postR.position.set(roadWidth / 2 + 1.2, 0.4, z);
    postR.material = barrierMat;
    roadsideObjects.push({ mesh: postR, initZ: z });

    const railL = MeshBuilder.CreateBox(
      `railL_${i}`, { width: 0.08, height: 0.08, depth: spacing }, scene,
    );
    railL.position.set(-(roadWidth / 2 + 1.2), 0.65, z + spacing / 2);
    railL.material = railMat;
    roadsideObjects.push({ mesh: railL, initZ: z + spacing / 2 });

    const railR = MeshBuilder.CreateBox(
      `railR_${i}`, { width: 0.08, height: 0.08, depth: spacing }, scene,
    );
    railR.position.set(roadWidth / 2 + 1.2, 0.65, z + spacing / 2);
    railR.material = railMat;
    roadsideObjects.push({ mesh: railR, initZ: z + spacing / 2 });
  }
}

function createRoadLights(
  scene: Scene,
  config: RoadConfig,
  roadWidth: number,
  roadLength: number,
  roadsideObjects: RoadsideEntry[],
  roadLightMeshes: Mesh[],
): void {
  const spacing = 12;
  const count = Math.floor(roadLength / spacing);
  const zOffset = -roadLength / 2 + 10;

  const poleMat = new StandardMaterial('poleMat', scene);
  poleMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
  poleMat.specularColor = new Color3(0.5, 0.5, 0.5);

  const lightBulbMat = new StandardMaterial('lightBulbMat', scene);
  lightBulbMat.diffuseColor = new Color3(1, 0.95, 0.8);
  lightBulbMat.emissiveColor = new Color3(0.9, 0.85, 0.6);

  const reflectorMat = new StandardMaterial('reflectorMat', scene);
  reflectorMat.diffuseColor = new Color3(1, 0.9, 0.5);
  reflectorMat.emissiveColor = new Color3(0.6, 0.5, 0.2);

  const laneReflectorMat = new StandardMaterial('laneReflectorMat', scene);
  laneReflectorMat.diffuseColor = new Color3(0.8, 0.8, 1.0);
  laneReflectorMat.emissiveColor = new Color3(0.3, 0.3, 0.5);

  for (let i = 0; i < count; i++) {
    const z = zOffset - roadLength / 2 + i * spacing;

    const poleL = MeshBuilder.CreateCylinder(
      `poleL_${i}`, { diameter: 0.12, height: 3.5, tessellation: 8 }, scene,
    );
    poleL.position.set(-(roadWidth / 2 + 1.8), 1.75, z);
    poleL.material = poleMat;
    roadsideObjects.push({ mesh: poleL, initZ: z });

    const bulbL = MeshBuilder.CreateSphere(
      `bulbL_${i}`, { diameter: 0.35, segments: 8 }, scene,
    );
    bulbL.position.set(-(roadWidth / 2 + 1.8), 3.6, z);
    bulbL.material = lightBulbMat;
    roadsideObjects.push({ mesh: bulbL, initZ: z });

    const poleR = MeshBuilder.CreateCylinder(
      `poleR_${i}`, { diameter: 0.12, height: 3.5, tessellation: 8 }, scene,
    );
    poleR.position.set(roadWidth / 2 + 1.8, 1.75, z);
    poleR.material = poleMat;
    roadsideObjects.push({ mesh: poleR, initZ: z });

    const bulbR = MeshBuilder.CreateSphere(
      `bulbR_${i}`, { diameter: 0.35, segments: 8 }, scene,
    );
    bulbR.position.set(roadWidth / 2 + 1.8, 3.6, z);
    bulbR.material = lightBulbMat;
    roadsideObjects.push({ mesh: bulbR, initZ: z });

    roadLightMeshes.push(poleL, bulbL, poleR, bulbR);

    const refL = MeshBuilder.CreateBox(
      `refL_${i}`, { width: 0.12, height: 0.04, depth: 0.12 }, scene,
    );
    refL.position.set(-(roadWidth / 2 + 0.3), 0.02, z);
    refL.material = reflectorMat;
    roadsideObjects.push({ mesh: refL, initZ: z });

    const refR = MeshBuilder.CreateBox(
      `refR_${i}`, { width: 0.12, height: 0.04, depth: 0.12 }, scene,
    );
    refR.position.set(roadWidth / 2 + 0.3, 0.02, z);
    refR.material = reflectorMat;
    roadsideObjects.push({ mesh: refR, initZ: z });

    roadLightMeshes.push(refL, refR);
  }

  // Lane divider reflectors
  const reflectorSpacing = 4;
  const reflectorCount = Math.floor(roadLength / reflectorSpacing);
  const laneWidth = roadWidth / config.laneCount;

  for (let lane = 1; lane < config.laneCount; lane++) {
    const lx = -roadWidth / 2 + lane * laneWidth;
    for (let i = 0; i < reflectorCount; i++) {
      const z = zOffset - roadLength / 2 + i * reflectorSpacing;
      const ref = MeshBuilder.CreateBox(
        `laneRef_${lane}_${i}`, { width: 0.08, height: 0.03, depth: 0.08 }, scene,
      );
      ref.position.set(lx, 0.015, z);
      ref.material = laneReflectorMat;
      roadLightMeshes.push(ref);
      roadsideObjects.push({ mesh: ref, initZ: z });
    }
  }

  // Alternating red/white edge markers
  const edgeSpacing = 3;
  const edgeCount = Math.floor(roadLength / edgeSpacing);

  const edgeMatRed = new StandardMaterial('edgeRef_red', scene);
  edgeMatRed.diffuseColor = new Color3(1, 0.2, 0.1);
  edgeMatRed.emissiveColor = new Color3(0.5, 0.05, 0.02);

  const edgeMatWhite = new StandardMaterial('edgeRef_white', scene);
  edgeMatWhite.diffuseColor = new Color3(1, 1, 0.9);
  edgeMatWhite.emissiveColor = new Color3(0.4, 0.4, 0.35);

  for (let i = 0; i < edgeCount; i++) {
    const z = zOffset - roadLength / 2 + i * edgeSpacing;
    const edgeMat = i % 2 === 0 ? edgeMatRed : edgeMatWhite;

    const edgeL = MeshBuilder.CreateBox(
      `edgeL_${i}`, { width: 0.15, height: 0.06, depth: 0.15 }, scene,
    );
    edgeL.position.set(-(roadWidth / 2 + 0.08), 0.03, z);
    edgeL.material = edgeMat;
    roadsideObjects.push({ mesh: edgeL, initZ: z });

    const edgeR = MeshBuilder.CreateBox(
      `edgeR_${i}`, { width: 0.15, height: 0.06, depth: 0.15 }, scene,
    );
    edgeR.position.set(roadWidth / 2 + 0.08, 0.03, z);
    edgeR.material = edgeMat;
    roadsideObjects.push({ mesh: edgeR, initZ: z });

    roadLightMeshes.push(edgeL, edgeR);
  }
}
