/**
 * useGameLoop - Composable encapsulating game loop,
 * anti-cheat, and game state control logic.
 */

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import { useUserStore } from '@/stores/user';
import { useSettingsStore } from '@/stores/settings';
import { antiCheatVerify } from '@/platform/PalmAuthService';
import { BestFrameCollector } from '@/utils/BestFrameCollector';
import type { FrameCapturer } from '@/utils/BestFrameCollector';
import { captureFrameFromVideo } from '@/utils/videoCapture';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';
import type { Game3DEngine } from '@/engine/Game3DEngine';
import type { HandTracker } from '@/tracking/HandTracker';
import type { GameStats } from '@/engine/types';

export interface UseGameLoopOptions {
  getEngine: () => Game3DEngine | null;
  getTracker: () => HandTracker | null;
  onPreviewDraw: () => void;
}

export function useGameLoop(options: UseGameLoopOptions) {
  const router = useRouter();
  const gameStore = useGameStore();
  const userStore = useUserStore();
  const settingsStore = useSettingsStore();

  const cheatToast = ref('');
  const showEndConfirm = ref(false);
  const showMenuConfirm = ref(false);
  const handDetected = ref(false);

  let animFrameId = 0;

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------

  function gameLoop(): void {
    const engine = options.getEngine();
    const tracker = options.getTracker();
    if (!engine) return;

    let steerX: number = NaN;
    let throttle = 0;
    let isBraking = false;

    if (tracker?.isReady) {
      const gesture = tracker.getCurrentGesture();
      handDetected.value = gesture.isHandDetected;

      if (gesture.isHandDetected) {
        steerX = gesture.steerX;
        throttle = gesture.throttle;
        isBraking = gesture.isBraking;
      }
    }

    engine.applyHandInput(steerX, throttle, isBraking);

    gameStore.score = engine.score;
    gameStore.speed = engine.carSpeed;
    gameStore.lives = engine.lives;
    gameStore.gameTime = engine.gameTime;
    if (engine.carSpeed > gameStore.maxSpeed) {
      gameStore.maxSpeed = engine.carSpeed;
    }

    options.onPreviewDraw();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function startLoop(): void {
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function stopLoop(): void {
    cancelAnimationFrame(animFrameId);
  }

  // -----------------------------------------------------------------------
  // Anti-cheat
  // -----------------------------------------------------------------------

  const CHEAT_MAX_WARNINGS = 3;
  const ANTI_CHEAT_INTERVAL = 5000;
  let antiCheatTimer: ReturnType<typeof setInterval> | null = null;
  let antiCheatStartTimer: ReturnType<typeof setTimeout> | null = null;

  // 最优帧采集器：在防作弊间隔内持续采集帧，选出质量最高的一帧用于 1:N 识别
  const frameCollector = new BestFrameCollector(1000, 5);

  function startAntiCheat(): void {
    if (!userStore.isLoggedIn || userStore.isGuest) return;
    userStore.cheatCount = 0;

    // 初始化帧采集器：将 HandTracker 和摄像头作为帧源
    const tracker = options.getTracker();
    if (tracker) {
      const capturer: FrameCapturer = {
        captureFrame: () => {
          // Web 模式：从 video 元素截帧
          const video = document.querySelector('video') as HTMLVideoElement | null;
          if (video && video.srcObject) {
            return captureFrameFromVideo(video);
          }
          // Native 模式：从 HandTracker 截帧
          const frame = tracker.captureFrame();
          if (frame) {
            // captureFrame 返回 data URL，需要提取 base64 部分
            const base64 = frame.includes(',') ? frame.split(',')[1] : frame;
            let hash = 0;
            for (let i = 0; i < Math.min(base64.length, 200); i++) {
              hash = ((hash << 5) - hash + base64.charCodeAt(i)) | 0;
            }
            const digest = Math.abs(hash).toString(16).padStart(8, '0');
            // Native 模式下无法直接获取分辨率，使用 CameraX 配置的默认值
            return { base64, digest, width: 320, height: 240 };
          }
          return null;
        },
        getPalmQuality: () => {
          const gesture = tracker.getCurrentGesture();
          return gesture.palmQuality;
        },
        isPalmGoodForRecognition: () => {
          return tracker.isPalmGoodForRecognition;
        },
      };
      frameCollector.setCapturer(capturer);
      frameCollector.start();
    }

    antiCheatStartTimer = setTimeout(() => {
      doAntiCheatCheck();
      antiCheatTimer = setInterval(doAntiCheatCheck, ANTI_CHEAT_INTERVAL);
    }, 3000);
  }

  async function doAntiCheatCheck(): Promise<void> {
    const engine = options.getEngine();
    if (gameStore.state !== 'playing' || !engine) return;
    try {
      // 从帧采集器中获取最优帧
      const bestFrame = frameCollector.getBestFrame();
      // 清空缓冲区，开始新一轮采集
      frameCollector.clear();

      if (!bestFrame) {
        logger.debug('AntiCheat', 'No quality frame, skip check');
        return;
      }

      logger.warn('AntiCheat',
        `Best frame: quality=${bestFrame.quality.toFixed(3)}, ` +
        `resolution=${bestFrame.width}x${bestFrame.height}, ` +
        `digest=${bestFrame.digest}, ` +
        `base64Len=${bestFrame.base64.length}, ` +
        `bufferFrames=${frameCollector.frameCount}`);

      const result = await antiCheatVerify(
        userStore.userId,
        { base64: bestFrame.base64, digest: bestFrame.digest }
      );
      if (!result.passed) {
        userStore.incrementCheat();
        const count = userStore.cheatCount;
        const remaining = CHEAT_MAX_WARNINGS - count;
        const t = getI18nT();

        const isUnknownPalm = result.cheatType === 'unknown_palm';
        const cheatTypeText = isUnknownPalm ? t('game.cheat.unknownPalm') : t('game.cheat.cheatPlay');

        const cheatUserDisplay = (!isUnknownPalm && result.detectedUserId)
          ? t('game.cheat.cheatUser', { userId: result.detectedUserId })
          : '';

        logger.warn('AntiCheat', `${cheatTypeText} detected (${count}/${CHEAT_MAX_WARNINGS})`,
          result.detectedUserId || '');

        if (count >= CHEAT_MAX_WARNINGS) {
          engine.setCheated();
          if (!isUnknownPalm && result.detectedUserId) {
            engine.setCheatUserId(result.detectedUserId);
          }
          stopAntiCheat();
          cheatToast.value = isUnknownPalm
            ? t('game.cheat.terminated')
            : t('game.cheat.terminatedCheat', { display: cheatUserDisplay });
          setTimeout(() => engine.forceGameOver(), 1500);
        } else {
          if (!isUnknownPalm && result.detectedUserId) {
            engine.setCheatUserId(result.detectedUserId);
          }
          cheatToast.value = isUnknownPalm
            ? t('game.cheat.warningUnknown', { count, max: CHEAT_MAX_WARNINGS, remaining })
            : t('game.cheat.warningCheat', { type: cheatTypeText, display: cheatUserDisplay, count, max: CHEAT_MAX_WARNINGS, remaining });
          setTimeout(() => { cheatToast.value = ''; }, 5000);
        }
      } else {
        logger.debug('AntiCheat', 'Verification passed');
      }
    } catch (e) {
      logger.debug('AntiCheat', 'Check error, skipping:', (e as Error).message);
    }
  }

  function stopAntiCheat(): void {
    if (antiCheatStartTimer) { clearTimeout(antiCheatStartTimer); antiCheatStartTimer = null; }
    if (antiCheatTimer) { clearInterval(antiCheatTimer); antiCheatTimer = null; }
    frameCollector.stop();
  }

  // -----------------------------------------------------------------------
  // Game state control
  // -----------------------------------------------------------------------

  function pauseGame(): void {
    const engine = options.getEngine();
    const tracker = options.getTracker();
    if (gameStore.state === 'playing') {
      gameStore.state = 'paused';
      engine?.pause();
      tracker?.pause();
      cancelAnimationFrame(animFrameId);
    }
  }

  function resumeGame(): void {
    const engine = options.getEngine();
    const tracker = options.getTracker();
    gameStore.state = 'playing';
    engine?.resume();
    tracker?.resume();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function switchView(): void {
    const engine = options.getEngine();
    const views: Array<'chase' | 'cockpit' | 'top'> = ['chase', 'cockpit', 'top'];
    const current = engine?.getCameraMode() ?? 'chase';
    const idx = (views.indexOf(current) + 1) % views.length;
    settingsStore.cameraView = views[idx];
    engine?.switchCamera(views[idx]);
  }

  function endGame(): void {
    cancelAnimationFrame(animFrameId);
    stopAntiCheat();
    options.getEngine()?.stop();
    router.push('/menu');
  }

  /** 暂停菜单中点击"回退到菜单"时，弹出确认提示 */
  function requestBackToMenu(): void {
    showMenuConfirm.value = true;
  }

  /** 确认回退到菜单（分数不保存） */
  function confirmBackToMenu(): void {
    showMenuConfirm.value = false;
    endGame();
  }

  /** 取消回退，回到暂停菜单 */
  function cancelBackToMenu(): void {
    showMenuConfirm.value = false;
  }

  function forceEndGame(): void {
    if (!options.getEngine()) return;
    pauseGame();
    showEndConfirm.value = true;
  }

  function confirmEndGame(): void {
    showEndConfirm.value = false;
    if (!options.getEngine()) return;
    stopAntiCheat();
    options.getEngine()!.forceGameOver();
  }

  function cancelEndGame(): void {
    showEndConfirm.value = false;
    resumeGame();
  }

  function handleGameOver(stats: GameStats): void {
    cancelAnimationFrame(animFrameId);
    stopAntiCheat();
    gameStore.setGameOver(stats);
    router.push('/gameover');
  }

  function onCountdownComplete(): void {
    const engine = options.getEngine();
    gameStore.state = 'playing';
    engine?.start();
    engine?.switchCamera(settingsStore.cameraView);
    startLoop();
    startAntiCheat();
  }

  return {
    // State
    cheatToast,
    showEndConfirm,
    showMenuConfirm,
    handDetected,

    // Game control
    pauseGame,
    resumeGame,
    switchView,
    endGame,
    requestBackToMenu,
    confirmBackToMenu,
    cancelBackToMenu,
    forceEndGame,
    confirmEndGame,
    cancelEndGame,
    handleGameOver,
    onCountdownComplete,

    // Loop control
    startLoop,
    stopLoop,
    startAntiCheat,
    stopAntiCheat,
  };
}
