<template>
  <div class="page login-page">
    <!-- 右上角语言切换 -->
    <div class="lang-selector">
      <select
        class="lang-select"
        :value="settingsStore.locale"
        @change="switchLocale(($event.target as HTMLSelectElement).value as Locale)"
      >
        <option value="zh">简体中文</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
      <span class="lang-select-arrow">▾</span>
    </div>

    <div class="login-logo">
      <h1 class="title">🏎️ PalmRacer <span class="badge-3d">3D</span></h1>
      <p class="subtitle">{{ t('login.subtitle') }}</p>
      <div class="racing-stripe"></div>
    </div>
    <div class="login-actions">
      <p class="login-hint">{{ t('login.hint') }}</p>
      <router-link to="/register" class="btn-register">
        {{ t('login.palmRegister') }}
      </router-link>
      <button class="btn-palm" @click="handlePalmLogin" :disabled="isLoggingIn">
        {{ isLoggingIn ? t('login.palmLoginLoading') : '🖐️ ' + t('login.palmLogin') }}
      </button>
      <button class="btn-guest" @click="handleGuestLogin">
        🎮 {{ t('login.guestLogin') }}
      </button>
      <p v-if="loginError" class="login-error">{{ loginError }}</p>
      <!-- APK 下载功能暂时屏蔽，待 COS/CDN 托管方案就绪后恢复
      <router-link to="/download" class="link-download-app">
        📱 下载安卓 App
      </router-link>
      -->
    </div>

    <!-- 刷掌登录弹窗 -->
    <Teleport to="body">
      <div v-if="showScanModal" class="palm-scan-overlay">
        <div class="palm-scan-modal">
          <button class="palm-scan-close" @click="cancelScan">&times;</button>

          <!-- 横屏左右布局容器 -->
          <div class="palm-scan-body">
            <!-- 左侧：摄像头预览区 -->
            <div class="palm-scan-left">
          <h2 class="palm-scan-title">{{ t('login.scan.title') }}</h2>
              <p class="palm-scan-subtitle">{{ t('login.scan.subtitle') }}</p>
              <div class="palm-scan-preview-wrapper" :class="previewState">
                <!-- 隐藏的 video 元素（供 getUserMedia 绑定） -->
                <video
                  ref="scanVideoRef"
                  autoplay
                  playsinline
                  muted
                  class="palm-scan-video-hidden"
                />
                <!-- 实际可见的 canvas（通过 rAF 从 video 绘制，兼容 WebView） -->
                <canvas ref="scanCanvasRef" class="palm-scan-canvas" />
                <!-- 扫描线动画 -->
                <div v-if="previewState === 'scanning'" class="palm-scan-line" />
                <!-- 手掌引导框 -->
                <ScanGuide class="palm-scan-guide" />
              </div>
            </div>

            <!-- 右侧：步骤、状态、按钮 -->
            <div class="palm-scan-right">
              <!-- 步骤指示器 -->
              <div class="palm-scan-steps">
                <div class="scan-step" :class="stepClass(0)">
                  <span class="scan-step-dot" />
                  <span class="scan-step-text">{{ t('login.scan.steps.camera') }}</span>
                </div>
                <div class="scan-step-line" />
                <div class="scan-step" :class="stepClass(1)">
                  <span class="scan-step-dot" />
                  <span class="scan-step-text">{{ t('login.scan.steps.recognize') }}</span>
                </div>
                <div class="scan-step-line" />
                <div class="scan-step" :class="stepClass(2)">
                  <span class="scan-step-dot" />
                  <span class="scan-step-text">{{ t('login.scan.steps.success') }}</span>
                </div>
              </div>

              <!-- 状态消息 -->
              <p class="palm-scan-message" :class="messageClass">{{ scanMessage }}</p>

              <!-- 操作按钮 -->
              <div class="palm-scan-actions">
                <button v-if="showRetry" class="btn-secondary palm-scan-btn" @click="retryScan">
                  {{ t('login.scan.retry') }}
                </button>
                <button class="btn-secondary palm-scan-btn" @click="cancelScan">
                  {{ t('login.scan.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { useSettingsStore } from '@/stores/settings';
import type { Locale } from '@/stores/settings';
import { palmLogin } from '@/platform/PalmAuthService';
import { getPlatformService } from '@/platform/index';
import { USER_CANCELLED_PALM } from '@/config/platformConfig';
import { logger } from '@/utils/logger';
import { useCameraPreview } from '@/composables/useCameraPreview';
import ScanGuide from '@/components/ScanGuide.vue';

const router = useRouter();
const { t, locale } = useI18n();
const userStore = useUserStore();
const settingsStore = useSettingsStore();

function switchLocale(lang: Locale): void {
  settingsStore.locale = lang;
  locale.value = lang;
}
const loginError = ref('');
const isLoggingIn = ref(false);

// Scan modal state
const showScanModal = ref(false);
const currentStep = ref(-1);

const {
  videoRef: scanVideoRef,
  canvasRef: scanCanvasRef,
  previewState,
  messageClass,
  scanMessage,
  showRetry,
  startDrawFrame,
  stopDrawFrame,
  handleStateChange: baseHandleStateChange,
} = useCameraPreview();

const STATE_TO_STEP: Record<string, number> = {
  camera: 0,
  camera_ok: 0,
  searching: 1,
  matched: 2,
  error: -1,
};

function stepClass(index: number): string {
  if (index < currentStep.value) return 'done';
  if (index === currentStep.value) return 'active';
  return '';
}

function handleStateChange(state: import('@/platform/PlatformService').PalmLoginState, msg: string): void {
  logger.debug('PalmScan', state, msg);
  currentStep.value = STATE_TO_STEP[state] ?? -1;
  baseHandleStateChange(state, msg);
}

async function handlePalmLogin(): Promise<void> {
  if (isLoggingIn.value) return;
  isLoggingIn.value = true;
  loginError.value = '';

  // Show modal and wait for video element to mount
  showScanModal.value = true;
  showRetry.value = false;
  previewState.value = '';
  currentStep.value = -1;
  scanMessage.value = t('login.scan.ready');

  await nextTick();

  try {
    const user = await palmLogin({
      videoElement: scanVideoRef.value ?? undefined,
      onStateChange: handleStateChange,
    });
    logger.debug('Login', 'palmLogin resolved, user=', user);

    // Brief pause to show success state
    await new Promise((r) => setTimeout(r, 1200));
    stopDrawFrame();
    showScanModal.value = false;

    userStore.login(user);
    logger.debug('Login', 'userStore.login called, isLoggedIn=', userStore.isLoggedIn);
    await router.push('/menu');
    logger.debug('Login', 'router.push(/menu) done, hash=', location.hash);
  } catch (e) {
    logger.error('Login', 'Palm login failed:', e);
    const rawMsg = e instanceof Error ? e.message : t('login.loginFailed');
    stopDrawFrame();

    // Translate technical errors to user-friendly messages
    let errMsg = rawMsg;
    const lower = rawMsg.toLowerCase();
    if (lower.includes('network error') || lower.includes('econnrefused') || lower.includes('timeout')) {
      errMsg = t('login.networkError');
    }

    if (rawMsg === USER_CANCELLED_PALM) {
      showScanModal.value = false;
    } else {
      previewState.value = 'error';
      messageClass.value = 'error';
      scanMessage.value = errMsg;
      showRetry.value = true;
      loginError.value = errMsg;
    }
  } finally {
    isLoggingIn.value = false;
  }
}

function cancelScan(): void {
  stopDrawFrame();
  const platform = getPlatformService();
  if ('cancelLogin' in platform && typeof platform.cancelLogin === 'function') {
    (platform as any).cancelLogin();
  }
  showScanModal.value = false;
  isLoggingIn.value = false;
}

function retryScan(): void {
  showScanModal.value = false;
  showRetry.value = false;
  setTimeout(() => handlePalmLogin(), 300);
}

function handleGuestLogin(): void {
  userStore.guestLogin();
  router.push('/menu');
}



</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.login-page {
  gap: 32px;
  background: $color-bg;
  position: relative;
}

.lang-selector {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: inline-block;
}

.lang-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 6px 32px 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  backdrop-filter: blur(8px);
  outline: none;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.4);
  }

  &:focus {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }

  option {
    background: #1a1a3a;
    color: #fff;
  }
}

.lang-select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.login-logo {
  text-align: center;

  .title {
    font-size: 3.2rem;
    font-weight: 900;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #ff6b35 0%, #f7c948 40%, #00ff88 70%, #00d4ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.3));
    animation: titleGlow 3s ease-in-out infinite alternate;
    margin-bottom: 6px;
  }

  .badge-3d {
    display: inline-block;
    background: linear-gradient(135deg, #00d4ff, #7b2ff7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 2rem;
    font-weight: 900;
    vertical-align: super;
    margin-left: 4px;
    animation: badge3dPulse 2s ease-in-out infinite;
  }

  .subtitle {
    font-size: 0.85rem;
    color: $color-text-secondary;
    letter-spacing: 2px;
    font-weight: 500;
    margin-bottom: 0;
  }

  .racing-stripe {
    width: 100%;
    max-width: 400px;
    height: 3px;
    margin: 20px auto 0;
    border-radius: 2px;
    background: linear-gradient(90deg,
      transparent 0%, #ff6b35 20%, #f7c948 40%,
      #00ff88 60%, #7b2ff7 80%, transparent 100%);
    background-size: 200% 100%;
    animation: stripeGlow 2s linear infinite;
  }
}

@keyframes titleGlow {
  0% { filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.3)); }
  50% { filter: drop-shadow(0 0 30px rgba(0, 212, 255, 0.4)); }
  100% { filter: drop-shadow(0 0 20px rgba(0, 255, 136, 0.3)); }
}

@keyframes badge3dPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes stripeGlow {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.login-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 240px;
}

.login-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.btn-palm {
  width: 100%;
  padding: 10px 28px;
  font-size: 0.9rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #ff6b35, #e85d26);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
  animation: btnPulse 2s ease-in-out infinite;

  &:active { transform: scale(0.97); }
  &:disabled { opacity: 0.6; animation: none; }
}



.btn-register {
  display: block;
  width: 100%;
  padding: 10px 28px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid rgba(0, 212, 255, 0.4);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.18), rgba(123, 47, 247, 0.18));
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(10px);
  text-decoration: none;
  text-align: center;
  transition: transform 0.15s, box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 212, 255, 0.35);
  }
  &:active { transform: scale(0.97); }
}

.btn-guest {
  width: 100%;
  padding: 10px 28px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: transform 0.15s, box-shadow 0.2s, background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.1);
  }
  &:active { transform: scale(0.97); }
}

@keyframes btnPulse {
  0%, 100% { box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4); }
  50% { box-shadow: 0 4px 35px rgba(255, 107, 53, 0.7); }
}

.login-error {
  color: #f44336;
  font-size: 14px;
  text-align: center;
  margin: -8px 0;
}

.link-download-app {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  letter-spacing: 0.5px;
  transition: color 0.2s;
  margin-top: 4px;

  &:hover {
    color: rgba(0, 212, 255, 0.85);
  }
}

/* ==================== 刷掌弹窗 ==================== */
.palm-scan-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: safe center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
}

.palm-scan-modal {
  position: relative;
  width: 90%;
  max-width: 420px;
  max-height: none;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 28px 24px;
  border-radius: $border-radius-lg;
  background: linear-gradient(145deg, rgba(30, 30, 60, 0.95), rgba(15, 15, 40, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  text-align: center;
  color: $color-text;
  margin: auto;
}

.palm-scan-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  transition: color $transition-fast;

  &:hover {
    color: #fff;
  }
}

.palm-scan-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
}

.palm-scan-subtitle {
  font-size: 14px;
  color: $color-text-secondary;
  margin: 0 0 18px;
}

/* 横屏左右布局容器（竖屏时为纵向堆叠） */
.palm-scan-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.palm-scan-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.palm-scan-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Camera preview wrapper */
.palm-scan-preview-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: $border-radius;
  overflow: hidden;
  background: #000;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transition: border-color $transition-normal;

  &.scanning {
    border-color: $color-primary;
    box-shadow: 0 0 20px rgba($color-primary, 0.3);
  }

  &.success {
    border-color: $color-success;
    box-shadow: 0 0 20px rgba($color-success, 0.3);
  }

  &.error {
    border-color: $color-danger;
    box-shadow: 0 0 20px rgba($color-danger, 0.3);
  }
}

.palm-scan-video-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.palm-scan-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* Mirror for front camera */
}

/* Scanning line animation */
.palm-scan-line {
  position: absolute;
  left: 5%;
  right: 5%;
  height: 2px;
  background: linear-gradient(90deg, transparent, $color-primary, transparent);
  box-shadow: 0 0 12px $color-primary;
  animation: scanLine 2s ease-in-out infinite;
}

@keyframes scanLine {
  0%, 100% { top: 10%; }
  50% { top: 85%; }
}

/* Hand guide frame */
.palm-scan-guide {
  position: absolute;
  inset: 10%;
  pointer-events: none;
}

.palm-scan-guide :deep(.scan-guide) {
  width: 100%;
  height: 100%;
}

.palm-scan-guide :deep(.scan-guide-svg) {
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
}

/* Steps indicator */
.palm-scan-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin: 18px 0 12px;
}

.scan-step {
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.4;
  transition: opacity $transition-fast;

  &.active {
    opacity: 1;

    .scan-step-dot {
      background: $color-primary;
      box-shadow: 0 0 6px $color-primary;
    }
  }

  &.done {
    opacity: 0.8;

    .scan-step-dot {
      background: $color-success;
    }
  }
}

.scan-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all $transition-fast;
}

.scan-step-text {
  font-size: 11px;
  white-space: nowrap;
}

.scan-step-line {
  width: 16px;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
}

/* Status message */
.palm-scan-message {
  font-size: 14px;
  margin: 0 0 16px;
  color: $color-text-secondary;
  min-height: 20px;

  &.scanning {
    color: $color-primary;
  }

  &.success {
    color: $color-success;
    font-weight: 600;
  }

  &.error {
    color: $color-danger;
  }
}

/* Action buttons */
.palm-scan-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.palm-scan-btn {
  padding: 8px 20px;
  font-size: 14px;
  border-radius: $border-radius-sm;
}



/* ==================== 横屏小屏幕适配（安卓手机横屏） ==================== */
@media (orientation: landscape) and (max-height: 500px) {
  .palm-scan-modal {
    padding: 14px 18px;
    max-width: 90vw;
    max-height: 96vh;
  }

  /* 横屏时标题和副标题在左侧预览区上方，缩小字号 */
  .palm-scan-title {
    font-size: 15px;
    margin: 0 0 2px;
  }

  .palm-scan-subtitle {
    font-size: 11px;
    margin: 0 0 6px;
  }

  /* 横屏时改为左右布局 */
  .palm-scan-body {
    flex-direction: row;
    gap: 18px;
    align-items: stretch;
  }

  .palm-scan-left {
    flex: 1 1 55%;
    min-width: 0;
  }

  .palm-scan-right {
    flex: 1 1 45%;
    min-width: 0;
    justify-content: center;
    gap: 8px;
  }

  /* 横屏时预览区占满左侧高度，保持 4:3 比例 */
  .palm-scan-preview-wrapper {
    aspect-ratio: 4 / 3;
    max-height: 60vh;
  }

  /* 横屏时步骤指示器改为纵向排列 */
  .palm-scan-steps {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin: 4px 0 8px;
  }

  .scan-step-line {
    width: 1px;
    height: 10px;
    margin: 0 0 0 3.5px;
  }

  .palm-scan-message {
    font-size: 12px;
    margin: 0 0 8px;
  }

  .palm-scan-actions {
    gap: 8px;
  }

  .palm-scan-btn {
    padding: 6px 16px;
    font-size: 12px;
  }
}
</style>
