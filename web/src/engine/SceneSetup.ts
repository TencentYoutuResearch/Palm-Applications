/**
 * @file SceneSetup.ts
 * @description Scene environment setup including lights, skybox, and post-processing effects.
 */

import { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import {
  DefaultRenderingPipeline,
} from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { logger } from "../utils/logger";

/**
 * SceneSetup handles the creation of lights, skybox, environment texture,
 * and post-processing effects for the 3D racing scene.
 */
class SceneSetup {
 public sunLight: DirectionalLight | null = null;

 private scene_: Scene;
 private engine_: Engine;
 private shadowGenerator_: ShadowGenerator | null = null;
 private glowLayer_: GlowLayer | null = null;
 private pipeline_: DefaultRenderingPipeline | null = null;

  constructor(scene: Scene, engine: Engine) {
    this.scene_ = scene;
    this.engine_ = engine;
  }

  /**
   * getShadowGenerator returns the shadow generator created by createLights().
   */
  getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator_;
  }

  /**
   * getGlowLayer returns the glow layer created by createPostProcessing().
   */
  getGlowLayer(): GlowLayer | null {
    return this.glowLayer_;
  }

  /**
   * getPipeline returns the default rendering pipeline created by createPostProcessing().
   */
  getPipeline(): DefaultRenderingPipeline | null {
    return this.pipeline_;
  }

  /**
   * createEnvironmentTexture loads the prefiltered environment texture for PBR reflections
   * and assigns it to the scene.
   */
  createEnvironmentTexture(): void {
    try {
      const envTex = CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env",
        this.scene_
      );
      (envTex as any).onError = () => {
        logger.warn("SceneSetup", "Environment texture failed to load, using default");
      };
      this.scene_.environmentTexture = envTex;
    } catch (e) {
      logger.warn("SceneSetup", "Environment texture creation failed:", e);
    }
  }

  /**
   * createLights sets up hemispheric ambient light, directional sun light with shadows,
   * and a fill light for enhanced metallic highlights.
   */
  createLights(): void {
    // Hemispheric light (ambient) - enhanced for metallic paint effect
    const hemiLight = new HemisphericLight(
      "hemiLight",
      new Vector3(0, 1, 0),
      this.scene_
    );
    hemiLight.intensity = 0.9;
    hemiLight.diffuse = new Color3(0.95, 0.95, 1.0);
    hemiLight.groundColor = new Color3(0.3, 0.35, 0.3);
    hemiLight.specular = new Color3(0.5, 0.5, 0.5);

    // Directional light (sun + shadows) - shines from front-above, matching forward track view
    this.sunLight = new DirectionalLight(
      "sunLight",
      new Vector3(-0.3, -1, -0.5),
      this.scene_
    );
    this.sunLight.intensity = 1.2;
    this.sunLight.diffuse = new Color3(1.0, 0.95, 0.85);
    this.sunLight.specular = new Color3(1.0, 0.95, 0.9);

    // Fill light (from behind, enhances car body outline and metallic highlights)
    const fillLight = new DirectionalLight(
      "fillLight",
      new Vector3(0.2, -0.5, 0.8),
      this.scene_
    );
    fillLight.intensity = 0.4;
    fillLight.diffuse = new Color3(0.8, 0.85, 1.0);
    fillLight.specular = new Color3(0.6, 0.6, 0.7);

    // Shadow generator (high resolution)
    this.shadowGenerator_ = new ShadowGenerator(2048, this.sunLight);
    this.shadowGenerator_.useBlurExponentialShadowMap = true;
    this.shadowGenerator_.blurKernel = 32;
    this.shadowGenerator_.darkness = 0.4;
  }

  /**
   * createSkybox creates a gradient sky sphere using a dynamic texture.
   */
  createSkybox(): void {
    // Gradient sky (no external textures needed)
    const skyMaterial = new StandardMaterial("skyMat", this.scene_);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;

    // Sky sphere
    const sky = MeshBuilder.CreateSphere(
      "sky",
      { diameter: 500, segments: 16 },
      this.scene_
    );
    sky.material = skyMaterial;

    // Gradient texture to simulate sky
    const skyTexture = new DynamicTexture(
      "skyTex",
      { width: 512, height: 512 },
      this.scene_
    );
    const skyCtx = skyTexture.getContext();
    const gradient = skyCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#0a0a2e");    // Deep blue (zenith)
    gradient.addColorStop(0.3, "#1a1a4e");  // Deep purple-blue
    gradient.addColorStop(0.6, "#2d1b69");  // Purple
    gradient.addColorStop(0.8, "#ff6b35");  // Orange (horizon)
    gradient.addColorStop(1.0, "#ff4444");  // Red
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 512, 512);
    skyTexture.update();
    skyMaterial.emissiveTexture = skyTexture;
  }

  /**
   * createPostProcessing sets up glow layer, bloom, FXAA, tone mapping,
   * vignette, and image processing effects.
   *
   * @param cameras - Array of cameras to attach the rendering pipeline to.
   */
  createPostProcessing(cameras: Camera[]): void {
    // Glow effect
    const gl = new GlowLayer("glow", this.scene_);
    gl.intensity = 0.4;
    this.glowLayer_ = gl;

    // Tone mapping (default rendering pipeline)
    const pipeline = new DefaultRenderingPipeline(
      "defaultPipeline",
      true,
      this.scene_,
      cameras
    );
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.6;
    pipeline.bloomWeight = 0.3;
    pipeline.bloomKernel = 64;
    pipeline.fxaaEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.5;
    pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    pipeline.imageProcessing.contrast = 1.2;
    pipeline.imageProcessing.exposure = 1.1;

    this.pipeline_ = pipeline;
  }
}

export { SceneSetup };
