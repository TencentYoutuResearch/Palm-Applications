<template>
  <div class="page register-page" :class="{ 'keyboard-open': isKeyboardOpen }">
    <!-- 顶部标题 -->
    <div class="register-header">
      <button class="btn-back" @click="goBack">{{ t('register.back') }}</button>
      <h1 class="register-title">{{ t('register.title') }}</h1>
      <p class="register-subtitle">
        {{ stage === 'form' ? t('register.formSubtitle') : t('register.scanSubtitle') }}
      </p>
    </div>

    <!-- Stage 1: 填写 User ID 表单 -->
    <div v-if="stage === 'form'" class="register-form-section">
      <div class="form-card">
        <label class="register-label" for="register-user-id">{{ t('register.usernameLabel') }}</label>
        <input
          id="register-user-id"
          ref="userIdInputRef"
          v-model.trim="userId"
          class="register-input"
          :class="{ invalid: !!userIdError }"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="64"
          :placeholder="t('register.usernamePlaceholder')"
          @focus="onInputFocus"
          @blur="onInputBlur"
          @keyup.enter="startRegister"
        />
        <p class="register-hint" :class="{ error: !!userIdError }">
          {{ userIdError || t('register.usernameHint') }}
        </p>

        <div class="form-actions">
          <button class="btn-cancel" @click="goBack">{{ t('register.cancel') }}</button>
          <button
            class="btn-start"
            :disabled="!isUserIdValid"
            @click="startRegister"
          >
            {{ t('register.startRegister') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stage 2: 摄像头采集（横屏左右布局） -->
    <div v-else class="register-scan-section">
      <div class="scan-body">
        <!-- 左侧：摄像头预览区 -->
        <div class="scan-left">
          <div class="scan-preview-wrapper" :class="previewState">
            <video
              ref="videoRef"
              autoplay
              playsinline
              muted
              class="scan-video-hidden"
            />
            <canvas ref="canvasRef" class="scan-canvas" />
            <div v-if="previewState === 'scanning'" class="scan-line" />
            <ScanGuide />
          </div>
        </div>

        <!-- 右侧：状态、结果、按钮 -->
        <div class="scan-right">
          <p class="scan-message" :class="messageClass">{{ scanMessage }}</p>

          <!-- 成功后展示用户名 -->
          <div v-if="stage === 'success'" class="register-success">
            <div class="register-success-icon">✅</div>
            <div class="register-success-title">{{ t('register.success') }}</div>
            <div class="register-success-userid">{{ t('register.successUser', { userId }) }}</div>
            <div class="register-success-hint">{{ t('register.autoLogin') }}</div>
          </div>

          <div class="scan-actions">
            <button
              v-if="showRetry"
              class="btn-secondary"
              @click="retryRegister"
            >
              {{ t('register.retry') }}
            </button>
            <button class="btn-secondary" @click="cancelRegister">
              {{ t('register.cancelScan') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { palmRegister } from '@/platform/PalmAuthService';
import { getPlatformService } from '@/platform/index';
import { USER_CANCELLED_PALM } from '@/config/platformConfig';
import { logger } from '@/utils/logger';
import { useCameraPreview } from '@/composables/useCameraPreview';
import ScanGuide from '@/components/ScanGuide.vue';

type RegisterStage = 'form' | 'scanning' | 'success';

const USER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const USER_ID_MAX_LEN = 64;

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const stage = ref<RegisterStage>('form');
const userId = ref('');
const userIdInputRef = ref<HTMLInputElement | null>(null);
const isRegistering = ref(false);
const isKeyboardOpen = ref(false);
let inputFocused = false;

const {
  videoRef,
  canvasRef,
  previewState,
  messageClass,
  scanMessage,
  showRetry,
  startDrawFrame,
  stopDrawFrame,
  handleStateChange: baseHandleStateChange,
} = useCameraPreview();

// ==================== 键盘适配 ====================

/** 监听 visualViewport 变化，检测键盘弹出/收起 */
function handleViewportResize(): void {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  // 横屏时键盘弹出会导致 viewport 高度或宽度显著缩小
  const screenH = window.screen.height;
  const screenW = window.screen.width;
  const isLandscape = vv.width > vv.height;

  if (isLandscape) {
    // 横屏：键盘弹出时 viewport 宽度会缩小（键盘在左/右侧）
    const ratio = vv.width / Math.max(screenW, screenH);
    isKeyboardOpen.value = inputFocused && ratio < 0.85;
  } else {
    // 竖屏：键盘弹出时 viewport 高度会缩小
    const ratio = vv.height / Math.max(screenH, screenW);
    isKeyboardOpen.value = inputFocused && ratio < 0.75;
  }
}

function onInputFocus(): void {
  inputFocused = true;
  // 延迟检测，等键盘动画完成
  setTimeout(handleViewportResize, 300);
  setTimeout(handleViewportResize, 600);
}

function onInputBlur(): void {
  inputFocused = false;
  isKeyboardOpen.value = false;
}

onMounted(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
  }
});

onBeforeUnmount(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize);
  }
});

// ==================== 表单校验 ==

const userIdError = computed<string>(() => {
  const v = userId.value;
  if (!v) return '';
  if (v.length > USER_ID_MAX_LEN) return t('register.usernameTooLong', { max: USER_ID_MAX_LEN });
  if (!USER_ID_PATTERN.test(v)) return t('register.usernameInvalid');
  return '';
});

const isUserIdValid = computed<boolean>(() => {
  const v = userId.value;
  return v.length > 0 && v.length <= USER_ID_MAX_LEN && USER_ID_PATTERN.test(v);
});

// ==================== 注册状态回调 ====================

function handleStateChange(state: import('@/platform/PlatformService').PalmLoginState, msg: string): void {
  logger.debug('RegisterPage', state, msg);
  baseHandleStateChange(state, msg);
}

// ==================== 注册流程 ====================

async function startRegister(): Promise<void> {
  if (!isUserIdValid.value || isRegistering.value) return;
  isRegistering.value = true;
  showRetry.value = false;
  stage.value = 'scanning';
  previewState.value = '';
  messageClass.value = '';
  scanMessage.value = t('register.ready');

  await nextTick();

  try {
    const result = await palmRegister({
      userId: userId.value,
      videoElement: videoRef.value ?? undefined,
      onStateChange: handleStateChange,
      isForce: false,
    });
    logger.debug('RegisterPage', 'palmRegister success', result);

    stage.value = 'success';
    previewState.value = 'success';
    messageClass.value = 'success';
    scanMessage.value = `${t('register.success')}！${t('register.successUser', { userId: result.userId })}`;

    // 简短停顿后自动登录
    await new Promise((r) => setTimeout(r, 1500));
    stopDrawFrame();
    isRegistering.value = false;

    userStore.login({
      userId: result.userId,
      userName: result.userId,
    });
    await router.push('/menu');
  } catch (e) {
    logger.error('RegisterPage', 'palmRegister failed:', e);
    const rawMsg = e instanceof Error ? e.message : t('register.failed');
    stopDrawFrame();

    if (rawMsg === USER_CANCELLED_PALM) {
      goBack();
    } else {
      previewState.value = 'error';
      messageClass.value = 'error';
      scanMessage.value = rawMsg;
      showRetry.value = true;
    }
    isRegistering.value = false;
  }
}

function cancelRegister(): void {
  stopDrawFrame();
  const platform = getPlatformService();
  if ('cancelLogin' in platform && typeof platform.cancelLogin === 'function') {
    (platform as any).cancelLogin();
  }
  isRegistering.value = false;
  goBack();
}

function retryRegister(): void {
  showRetry.value = false;
  stage.value = 'form';
}

function goBack(): void {
  router.push('/login');
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.register-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 16px;
  background: $color-bg;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ==================== 顶部标题 ==================== */
.register-header {
  width: 100%;
  max-width: 480px;
  text-align: center;
  margin-bottom: 20px;
  position: relative;
}

.btn-back {
  position: absolute;
  left: 0;
  top: 4px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  transition: color $transition-fast;

  &:hover {
    color: #fff;
  }
}

.register-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 4px;
  color: $color-text;
}

.register-subtitle {
  font-size: 14px;
  color: $color-text-secondary;
  margin: 0;
}

/* ==================== 表单区域 ==================== */
.register-form-section {
  width: 100%;
  max-width: 480px;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: 24px 20px;
  border-radius: $border-radius-lg;
  background: linear-gradient(145deg, rgba(30, 30, 60, 0.95), rgba(15, 15, 40, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.register-label {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 4px;
}

.register-input {
  width: 100%;
  padding: 12px 14px;
  font-size: 16px; /* 16px 防止 iOS 自动缩放 */
  border-radius: $border-radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: $color-text;
  outline: none;
  box-sizing: border-box;
  transition: border-color $transition-fast, box-shadow $transition-fast;

  &::placeholder { color: rgba(255, 255, 255, 0.3); }
  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 3px rgba($color-primary, 0.15);
  }
  &.invalid {
    border-color: $color-danger;
    box-shadow: 0 0 0 3px rgba($color-danger, 0.15);
  }
}

.register-hint {
  font-size: 12px;
  color: $color-text-secondary;
  margin: 0 0 12px;
  min-height: 16px;

  &.error { color: $color-danger; }
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}

.btn-cancel {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $border-radius-sm;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    color: $color-text;
  }
}

.btn-start {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: $border-radius-sm;
  background: linear-gradient(135deg, #ff6b35, #e85d26);
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.2s;

  &:active { transform: scale(0.97); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

/* ==================== 扫描区域 ==================== */
.register-scan-section {
  width: 100%;
  max-width: 720px;
}

.scan-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: $border-radius-lg;
  background: linear-gradient(145deg, rgba(30, 30, 60, 0.95), rgba(15, 15, 40, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.scan-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scan-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.scan-preview-wrapper {
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

.scan-video-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.scan-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.scan-line {
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

.scan-guide {
  position: absolute;
  inset: 10%;
  pointer-events: none;
  width: auto;
  height: auto;
}

:deep(.scan-guide-svg) {
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
}

.scan-message {
  font-size: 14px;
  margin: 0 0 16px;
  color: $color-text-secondary;
  min-height: 20px;

  &.scanning { color: $color-primary; }
  &.success { color: $color-success; font-weight: 600; }
  &.error { color: $color-danger; }
}

.scan-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-secondary {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: $border-radius-sm;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    color: $color-text;
  }
}

/* ==================== 注册成功 ==================== */
.register-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 6px 0 14px;

  .register-success-icon {
    font-size: 36px;
    line-height: 1;
    margin-bottom: 4px;
  }
  .register-success-title {
    font-size: 18px;
    font-weight: 700;
    color: $color-success;
  }
  .register-success-userid {
    font-size: 14px;
    color: $color-text;
    word-break: break-all;
    text-align: center;
  }
  .register-success-hint {
    font-size: 12px;
    color: $color-text-secondary;
  }
}

/* ==================== 键盘弹出时的适配 ==================== */
.register-page.keyboard-open {
  /* 键盘弹出时，隐藏标题区域，让输入框尽量靠上 */
  .register-header {
    display: none;
  }

  .register-form-section {
    /* 让表单区域居中对齐，充分利用可视空间 */
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
  }

  .form-card {
    padding: 12px 16px;
    gap: 4px;
  }

  .register-label {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .register-input {
    padding: 10px 12px;
  }

  .register-hint {
    margin: 0 0 4px;
    font-size: 11px;
  }

  .form-actions {
    margin-top: 4px;
    gap: 8px;
  }

  .btn-cancel,
  .btn-start {
    padding: 8px 18px;
    font-size: 13px;
  }
}

/* ==================== 横屏适配 ==================== */
@media (orientation: landscape) and (max-height: 500px) {
  .register-page {
    padding: 8px 16px;
  }

  .register-header {
    margin-bottom: 8px;
  }

  .register-title {
    font-size: 1.2rem;
  }

  .register-subtitle {
    font-size: 12px;
  }

  /* 横屏时表单也要紧凑 */
  .form-card {
    padding: 14px 16px;
    gap: 4px;
  }

  .register-input {
    padding: 8px 12px;
    font-size: 16px;
  }

  .register-hint {
    margin: 0 0 6px;
  }

  .form-actions {
    margin-top: 4px;
  }

  .scan-body {
    flex-direction: row;
    gap: 18px;
    align-items: stretch;
    padding: 14px 18px;
  }

  .scan-left {
    flex: 1 1 55%;
    min-width: 0;
  }

  .scan-right {
    flex: 1 1 45%;
    min-width: 0;
    justify-content: center;
    gap: 8px;
  }

  .scan-preview-wrapper {
    aspect-ratio: 4 / 3;
    max-height: 60vh;
  }

  .scan-message {
    font-size: 12px;
    margin: 0 0 8px;
  }

  .btn-secondary {
    padding: 6px 16px;
    font-size: 12px;
  }
}

/* 横屏 + 键盘弹出：极致紧凑 */
@media (orientation: landscape) and (max-height: 500px) {
  .register-page.keyboard-open {
    padding: 4px 12px;
    justify-content: center;

    .register-form-section {
      max-width: 360px;
    }

    .form-card {
      padding: 8px 12px;
      gap: 2px;
      border-radius: $border-radius-sm;
    }

    .register-label {
      font-size: 12px;
    }

    .register-input {
      padding: 6px 10px;
      font-size: 16px;
    }

    .register-hint {
      font-size: 10px;
      margin: 0 0 2px;
      min-height: 12px;
    }

    .form-actions {
      margin-top: 2px;
    }

    .btn-cancel,
    .btn-start {
      padding: 6px 14px;
      font-size: 12px;
    }
  }
}
</style>
