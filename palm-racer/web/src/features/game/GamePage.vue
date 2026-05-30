<template>
  <div class="page game-page">
    <!-- Babylon.js 渲染画布 -->
    <canvas ref="renderCanvas" class="render-canvas" />

    <!-- 驾驶舱 HUD 画布 -->
    <canvas ref="cockpitHUD" class="cockpit-hud" />

    <!-- 摄像头画面（隐藏，供 MediaPipe 使用） -->
    <video ref="cameraVideo" class="camera-hidden" autoplay playsinline muted />

    <!-- 摄像头预览小窗 -->
    <CameraPreview
      ref="cameraPreviewRef"
      :visible="handTrackerReady && settingsStore.cameraEnabled"
      :hand-detected="loop.handDetected.value"
      :is-native-mode="isNativeMode"
      :get-tracker="() => tracker"
      :get-video="() => cameraVideo"
    />

    <!-- 游戏 HUD -->
    <GameHUD />

    <!-- 控制按钮 -->
    <div v-if="gameStore.state === 'playing'" class="game-controls">
      <button class="ctrl-btn" @click="loop.pauseGame">⏸️ {{ t('game.pause') }}</button>
      <button class="ctrl-btn" @click="loop.switchView">🎥 {{ t('game.switchView') }}</button>
      <button class="ctrl-btn ctrl-btn-danger" @click="loop.forceEndGame">🏁 {{ t('game.endGame') }}</button>
    </div>

    <!-- 作弊检测 Toast -->
    <div v-if="loop.cheatToast.value" class="cheat-toast">{{ loop.cheatToast.value }}</div>

    <!-- 倒计时 -->
    <CountdownOverlay v-if="showCountdown" @complete="loop.onCountdownComplete();showCountdown=false" />

    <!-- 暂停菜单 -->
    <div v-if="gameStore.state === 'paused' && !loop.showEndConfirm.value && !loop.showMenuConfirm.value" class="pause-overlay">
      <div class="pause-menu card">
        <h2>{{ t('game.pause') }}</h2>
        <button class="btn-primary" @click="loop.resumeGame">{{ t('game.resume') }}</button>
        <button class="btn-secondary" @click="loop.requestBackToMenu">{{ t('gameover.menu') }}</button>
      </div>
    </div>

    <!-- 回退到菜单确认 -->
    <div v-if="loop.showMenuConfirm.value" class="pause-overlay">
      <div class="pause-menu card">
        <h2>{{ t('game.confirm.exitTitle') }}</h2>
        <p class="confirm-hint">{{ t('game.confirm.exitHint') }}</p>
        <button class="btn-primary" @click="loop.cancelBackToMenu">{{ t('game.confirm.continue') }}</button>
        <button class="btn-secondary" @click="loop.confirmBackToMenu">{{ t('game.confirm.confirmExit') }}</button>
      </div>
    </div>

    <!-- 结束游戏确认 -->
    <div v-if="loop.showEndConfirm.value" class="pause-overlay">
      <div class="pause-menu card">
        <h2>{{ t('game.confirm.endTitle') }}</h2>
        <p class="confirm-hint">{{ t('game.confirm.endHint') }}</p>
        <button class="btn-primary" @click="loop.cancelEndGame">{{ t('game.confirm.continue') }}</button>
        <button class="btn-secondary" @click="loop.confirmEndGame">{{ t('game.confirm.confirmEnd') }}</button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-bar">
          <div class="loading-fill" :style="{ width: loadingPercent + '%' }" />
        </div>
        <p class="loading-text">{{ loadingMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';
import { useSettingsStore } from '@/stores/settings';
import { Game3DEngine } from '@/engine/Game3DEngine';
import { HandTracker } from '@/tracking/HandTracker';
import { getPlatformService } from '@/platform/index';
import { logger } from '@/utils/logger';
import { isNative } from '@/utils/environment';
import GameHUD from './GameHUD.vue';
import CountdownOverlay from './CountdownOverlay.vue';
import CameraPreview from './CameraPreview.vue';
import { useGameLoop } from './composables/useGameLoop';

const { t } = useI18n();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const isNativeMode = isNative();

const renderCanvas = ref<HTMLCanvasElement>();
const cockpitHUD = ref<HTMLCanvasElement>();
const cameraVideo = ref<HTMLVideoElement>();
const cameraPreviewRef = ref<InstanceType<typeof CameraPreview>>();
const showCountdown = ref(false);
const loading = ref(true);
const loadingPercent = ref(0);
const loadingMessage = ref('');
const handTrackerReady = ref(false);

let engine: Game3DEngine | null = null;
let tracker: HandTracker | null = null;

const loop = useGameLoop({
  getEngine: () => engine,
  getTracker: () => tracker,
  onPreviewDraw: () => cameraPreviewRef.value?.drawPreview(),
});

onMounted(async () => {
  if (!renderCanvas.value) return;

  engine = new Game3DEngine(renderCanvas.value, cockpitHUD.value ?? undefined);
  engine.onGameOver = loop.handleGameOver;
  engine.onStageChange = (stage) => {
    logger.debug('Game', `Stage ${stage.level}: ${stage.name} - ${stage.description}`);
  };

  const enginePromise = engine.init((percent, message) => {
    loadingPercent.value = percent * 0.8;
    loadingMessage.value = message;
  }).catch((err) => {
    logger.error('GamePage', 'Engine init failed:', err);
    loadingMessage.value = t('game.loading.engineFailed');
    return 'engine_failed' as const;
  });

  let trackerPromise: Promise<unknown> = Promise.resolve();
  if (cameraVideo.value) {
    tracker = new HandTracker();
    trackerPromise = tracker.init(cameraVideo.value, (percent, msg) => {
      loadingPercent.value = Math.max(loadingPercent.value, 80 + percent * 0.2);
      loadingMessage.value = msg ?? t('game.loading.handModel');
    }).then(() => {
      handTrackerReady.value = true;
      if (isNativeMode && tracker) {
        tracker.setOnFrame((base64: string) => {
          cameraPreviewRef.value?.onNativeFrame(base64);
        });
        tracker.setOnFullFrame((fullBase64: string) => {
          const platform = getPlatformService();
          if ('setLatestFrame' in platform) {
            (platform as any).setLatestFrame(fullBase64);
          }
        });
      }
      logger.debug('GamePage', 'Hand tracker ready');
    }).catch((err) => {
      logger.warn('GamePage', 'Hand tracker init failed:', err);
    });
  }

  const engineResult = await enginePromise;
  if (engineResult === 'engine_failed') return;

  await Promise.race([
    trackerPromise,
    new Promise((r) => setTimeout(r, 5000)),
  ]);

  loading.value = false;
  showCountdown.value = true;
});

onBeforeUnmount(() => {
  loop.stopLoop();
  loop.stopAntiCheat();
  tracker?.dispose();
  tracker = null;
  engine?.dispose();
  engine = null;
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.game-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.render-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  outline: none;
  touch-action: none;
}

.cockpit-hud {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 55%;
  pointer-events: none;
  z-index: 10;
}

.camera-hidden {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 640px;
  height: 480px;
  pointer-events: none;
}

.cheat-toast {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  z-index: 200;
  pointer-events: none;
  animation: toastSlideUp 0.3s ease;
}

@keyframes toastSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.game-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
  z-index: 20;

  .ctrl-btn {
    padding: 8px 14px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    backdrop-filter: blur(4px);
    white-space: nowrap;

    &:active { background: rgba(255, 255, 255, 0.2); }

    &.ctrl-btn-danger {
      background: rgba(244, 67, 54, 0.5);
    }
  }
}

.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
}

.pause-menu {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  min-width: 240px;

  h2 { font-size: 28px; margin-bottom: 8px; }
  button { width: 100%; }

  .confirm-hint {
    font-size: 14px;
    color: $color-text-secondary;
    margin: -8px 0 4px;
  }
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  z-index: 300;
}

.loading-content {
  text-align: center;
  min-width: 280px;
}

.loading-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.loading-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-primary, $color-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.loading-text {
  margin-top: 12px;
  color: $color-text-secondary;
  font-size: 14px;
}
</style>
