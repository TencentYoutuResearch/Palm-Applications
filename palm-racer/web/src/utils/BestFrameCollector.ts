/**
 * @file BestFrameCollector.ts
 * @description 在防作弊检查间隔内持续采集摄像头帧，结合手掌质量评分，
 * 选出最优帧用于 1:N 掌纹识别，降低因手掌不完整/角度不佳导致的误判。
 *
 * 工作原理：
 *  - 每隔 collectInterval（默认 1s）采集一帧 + 当前 palmQuality 评分
 *  - 保留最近 maxFrames 帧（滑动窗口）
 *  - 调用 getBestFrame() 时返回质量最高的帧
 *  - 每次防作弊检查后调用 clear() 清空缓冲区，开始新一轮采集
 */

import { logger } from '@/utils/logger';

export interface ScoredFrame {
  /** base64 编码的 JPEG 图像数据 */
  base64: string;
  /** 图像摘要（用于去重） */
  digest: string;
  /** 手掌质量评分 0-1 */
  quality: number;
  /** 图片宽度（像素） */
  width: number;
  /** 图片高度（像素） */
  height: number;
  /** 采集时间戳 */
  timestamp: number;
}

export interface FrameCapturer {
  /** 截取当前摄像头帧，返回 base64、digest 和分辨率 */
  captureFrame(): { base64: string; digest: string; width: number; height: number } | null;
  /** 获取当前手掌质量评分 0-1 */
  getPalmQuality(): number;
  /** 手掌是否适合识别（完全可见 + 正面朝向 + 手指张开） */
  isPalmGoodForRecognition(): boolean;
}

/** 帧质量合格的最低阈值 */
const MIN_QUALITY_THRESHOLD = 0.4;

export class BestFrameCollector {
  private frames_: ScoredFrame[] = [];
  private timer_: ReturnType<typeof setInterval> | null = null;
  private capturer_: FrameCapturer | null = null;

  /** 采集间隔（毫秒） */
  private readonly collectInterval_: number;
  /** 缓冲区最大帧数 */
  private readonly maxFrames_: number;

  constructor(collectInterval = 1000, maxFrames = 5) {
    this.collectInterval_ = collectInterval;
    this.maxFrames_ = maxFrames;
  }

  /** 设置帧采集器（摄像头 + 质量评估来源） */
  setCapturer(capturer: FrameCapturer): void {
    this.capturer_ = capturer;
  }

  /** 启动定期采集 */
  start(): void {
    this.stop();
    this.frames_ = [];
    this.timer_ = setInterval(() => this.collectOne_(), this.collectInterval_);
  }

  /** 停止采集 */
  stop(): void {
    if (this.timer_) {
      clearInterval(this.timer_);
      this.timer_ = null;
    }
    this.frames_ = [];
  }

  /** 清空缓冲区（每次防作弊检查后调用，开始新一轮采集） */
  clear(): void {
    this.frames_ = [];
  }

  /**
   * 获取缓冲区中质量最高的帧。
   *
   * @param minQuality 最低质量阈值，低于此值的帧不返回
   * @returns 最优帧，或 null（无合格帧）
   */
  getBestFrame(minQuality = MIN_QUALITY_THRESHOLD): ScoredFrame | null {
    if (this.frames_.length === 0) return null;

    // 按质量降序排序，取最高的
    const sorted = [...this.frames_].sort((a, b) => b.quality - a.quality);
    const best = sorted[0];

    if (best.quality < minQuality) {
      logger.debug('BestFrameCollector',
        `最优帧质量 ${best.quality.toFixed(2)} 低于阈值 ${minQuality}，跳过`);
      return null;
    }

    logger.debug('BestFrameCollector',
      `选出最优帧: quality=${best.quality.toFixed(2)}, ` +
      `缓冲区共 ${this.frames_.length} 帧`);
    return best;
  }

  /** 获取缓冲区中的帧数量 */
  get frameCount(): number {
    return this.frames_.length;
  }

  /** 采集一帧并加入缓冲区 */
  private collectOne_(): void {
    if (!this.capturer_) return;

    // 前置检查：手掌必须适合识别（完全可见 + 正面朝向 + 手指张开）
    // 这是最关键的过滤条件，防止手掌不完整时也被采集
    if (!this.capturer_.isPalmGoodForRecognition()) {
      logger.debug('BestFrameCollector', 'Palm not suitable for recognition (not fully visible/bad angle), skip');
      return;
    }

    const quality = this.capturer_.getPalmQuality();

    // 质量太低的帧直接丢弃，不浪费缓冲区空间
    if (quality < 0.1) {
      logger.debug('BestFrameCollector', `帧质量过低 (${quality.toFixed(2)})，丢弃`);
      return;
    }

    const result = this.capturer_.captureFrame();
    if (!result) return;

    const frame: ScoredFrame = {
      base64: result.base64,
      digest: result.digest,
      quality,
      width: result.width,
      height: result.height,
      timestamp: Date.now(),
    };

    this.frames_.push(frame);

    // 超出最大帧数时，移除质量最低的帧
    if (this.frames_.length > this.maxFrames_) {
      let minIdx = 0;
      for (let i = 1; i < this.frames_.length; i++) {
        if (this.frames_[i].quality < this.frames_[minIdx].quality) {
          minIdx = i;
        }
      }
      this.frames_.splice(minIdx, 1);
    }

    logger.debug('BestFrameCollector',
      `采集帧: quality=${quality.toFixed(2)}, 缓冲区 ${this.frames_.length}/${this.maxFrames_}`);
  }
}
