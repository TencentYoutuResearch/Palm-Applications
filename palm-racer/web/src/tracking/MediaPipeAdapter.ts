/**
 * MediaPipeAdapter - MediaPipe Hands 初始化与视频帧处理
 *
 * 使用原生 getUserMedia 获取摄像头流，手动在 requestAnimationFrame
 * 循环中将帧发送给 MediaPipe Hands 进行处理。
 * 不使用 @mediapipe/camera_utils 的 Camera 类，避免与 Babylon.js 冲突。
 */

import { HandLandmarks } from './types';
import { logger } from '@/utils/logger';
import { getI18nT } from '@/main';
import {
  MEDIAPIPE_LIB_LOAD_TIMEOUT,
  MEDIAPIPE_MODEL_INIT_TIMEOUT,
  MEDIAPIPE_FRAME_SKIP,
  MEDIAPIPE_CHECK_INTERVAL,
} from '@/config/constants';

/** Callback fired when MediaPipe returns hand results for a frame. */
export type OnResultsCallback = (landmarks: HandLandmarks | null) => void;

/** Progress callback: (percent 0-100, message). */
export type ProgressCallback = (percent: number, message: string) => void;

export class MediaPipeAdapter {
  private hands_: any = null;
  private videoElement_: HTMLVideoElement | null = null;
  private isTracking_ = false;
  private onResults_: OnResultsCallback | null = null;
  private animFrameId_ = 0;
  private processing_ = false;

  setOnResults(cb: OnResultsCallback): void {
    this.onResults_ = cb;
  }

  async init(
    videoElement: HTMLVideoElement,
    onProgress?: ProgressCallback
  ): Promise<void> {
    this.videoElement_ = videoElement;

    if (onProgress) {
      onProgress(5, getI18nT()('game.loading.loadingMediaPipe'));
    }
    await this.waitForMediaPipe_(MEDIAPIPE_LIB_LOAD_TIMEOUT);

    if (onProgress) {
      onProgress(20, getI18nT()('game.loading.loadingHandModel'));
    }

    const HandsCtor = (window as any).Hands;

    this.hands_ = new HandsCtor({
      locateFile: (file: string) =>
        `./mediapipe/${file}`,
    });

    this.hands_.setOptions({
      selfieMode: true,
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.4,
    });

    this.hands_.onResults((results: any) => this.handleResults_(results));

    if (onProgress) {
      onProgress(40, getI18nT()('game.loading.initModel'));
    }

    // 检测移动端环境，决定分辨率
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    // 发送一帧空图片触发模型加载（使用与摄像头匹配的分辨率）
    const initW = isMobile ? 320 : 640;
    const initH = isMobile ? 240 : 480;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = initW;
    tempCanvas.height = initH;
    await this.withTimeout_(
      this.hands_.send({ image: tempCanvas }),
      MEDIAPIPE_MODEL_INIT_TIMEOUT,
      getI18nT()('game.loading.modelTimeout')
    );

    if (onProgress) {
      onProgress(60, getI18nT()('game.loading.requestingCamera'));
    }

    // 使用原生 getUserMedia 获取摄像头流
    // 在移动端使用更低分辨率以减少 MediaPipe WASM 内存占用
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: isMobile ? 320 : 640 },
        height: { ideal: isMobile ? 240 : 480 },
      },
      audio: false,
    });

    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('autoplay', 'true');
    videoElement.muted = true;
    await videoElement.play();

    // 等待视频就绪
    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= 2) {
        resolve();
      } else {
        videoElement.onloadeddata = () => resolve();
      }
    });

    logger.debug(
      'MediaPipe',
      `Camera ready: ${videoElement.videoWidth}x${videoElement.videoHeight}`
    );

    this.isTracking_ = true;

    // 启动手动帧处理循环
    this.startFrameLoop_();

    if (onProgress) {
      onProgress(90, getI18nT()('game.loading.trackingReady'));
    }
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement_;
  }

  pause(): void {
    this.isTracking_ = false;
  }

  resume(): void {
    this.isTracking_ = true;
  }

  dispose(): void {
    this.isTracking_ = false;
    cancelAnimationFrame(this.animFrameId_);

    if (this.hands_) {
      try { this.hands_.close(); } catch { /* ignore */ }
      this.hands_ = null;
    }

    if (this.videoElement_ && this.videoElement_.srcObject) {
      const stream = this.videoElement_.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      this.videoElement_.srcObject = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 手动帧处理循环：每帧将视频画面发送给 MediaPipe。
   * 限制为每 2 帧处理 1 次（~30fps），降低 CPU 负载。
   */
  private startFrameLoop_(): void {
    let frameCount = 0;
    let sendCount = 0;

    const loop = async (): Promise<void> => {
      this.animFrameId_ = requestAnimationFrame(loop);

      if (!this.isTracking_ || !this.hands_ || !this.videoElement_) return;
      if (this.videoElement_.readyState < 2) return;

      // 每 3 帧处理 1 次（~20fps），给 Babylon.js 更多 GPU 时间
      frameCount++;
      if (frameCount % MEDIAPIPE_FRAME_SKIP !== 0) return;

      // 防止并发调用
      if (this.processing_) return;
      this.processing_ = true;

      try {
        await this.hands_.send({ image: this.videoElement_ });
        sendCount++;
        if (sendCount <= 3 || sendCount % 30 === 0) {
          logger.debug('MediaPipe', `Frame sent #${sendCount}, video: ${this.videoElement_.videoWidth}x${this.videoElement_.videoHeight}`);
        }
      } catch (e) {
        logger.warn('MediaPipe', 'Frame send error:', e);
      } finally {
        this.processing_ = false;
      }
    };

    this.animFrameId_ = requestAnimationFrame(loop);
  }

  private resultCount_ = 0;

  private handleResults_(results: any): void {
    this.resultCount_++;
    const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

    if (this.resultCount_ <= 5 || this.resultCount_ % 30 === 0) {
      logger.debug('MediaPipe', `Result #${this.resultCount_}: hand=${hasHand}, count=${results.multiHandLandmarks?.length ?? 0}`);
    }

    if (hasHand) {
      // 如果检测到多个手掌，选择面积最大的（手腕到中指尖距离最大的）
      const hands = results.multiHandLandmarks as HandLandmarks[];
      let bestIdx = 0;
      if (hands.length > 1) {
        let maxArea = 0;
        for (let i = 0; i < hands.length; i++) {
          const wrist = hands[i][0];
          const middleTip = hands[i][12];
          const dx = middleTip.x - wrist.x;
          const dy = middleTip.y - wrist.y;
          const area = dx * dx + dy * dy;
          if (area > maxArea) {
            maxArea = area;
            bestIdx = i;
          }
        }
        logger.debug('MediaPipe', `Multiple hands: ${hands.length}, selected index=${bestIdx} (largest palm)`);
      }
      this.onResults_?.(hands[bestIdx]);
    } else {
      this.onResults_?.(null);
    }
  }

  private waitForMediaPipe_(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = (): void => {
        if (typeof (window as any).Hands !== 'undefined') {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(getI18nT()('game.loading.mediaPipeTimeout')));
        } else {
          setTimeout(check, MEDIAPIPE_CHECK_INTERVAL);
        }
      };
      check();
    });
  }

  private withTimeout_<T>(
    promise: Promise<T>,
    ms: number,
    message: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), ms)
      ),
    ]);
  }
}
