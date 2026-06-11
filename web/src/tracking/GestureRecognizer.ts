/**
 * GestureRecognizer - 从 MediaPipe 原始关键点推导游戏输入
 *
 * 功能：
 *  - 转向：手掌 X 位置（关键点 0,5,9,13,17 平均）映射到 -1 ~ 1
 *  - 油门：手掌大小（手腕到中指尖距离）映射到 0 ~ 1
 *  - 握拳检测：5 根手指弯曲 + 防抖（5 帧）
 *  - 手掌质量评估（朝向、张开度、可见性）
 *  - 指数移动平均平滑
 */

import { GestureState, HandLandmark, HandLandmarks } from './types';

/** Internal smoothed state kept between frames. */
interface SmoothedState {
  palmX: number;
  palmY: number;
  palmSize: number;
}

/**
 * GestureRecognizer converts raw hand landmarks into game-ready
 * {@link GestureState} values.
 */
export class GestureRecognizer {
  // Smoothed values
  private smooth_: SmoothedState = { palmX: 0.5, palmY: 0.5, palmSize: 0.2 };

  /** Smoothing factor (0-1, higher = more responsive). */
  private readonly kSmoothFactor: number = 0.15;

  /** Whether to mirror X axis (true for WASM mode where camera is mirrored). */
  private mirrorX_: boolean = true;

  /** Steering sensitivity multiplier (higher = more responsive to small movements). */
  private steerSensitivity_: number = 1.0;

  // Fist debounce
  private fistFrameCount_: number = 0;
  private readonly kFistThreshold: number = 5;

  // Hand loss tolerance — keep last known position for N frames after hand disappears
  private handLostFrames_: number = 0;
  private readonly kHandLostTolerance: number = 5; // ~0.25s at 20fps
  private lastValidGesture_: GestureState = {
    steerX: 0,
    throttle: 0.5,
    isBraking: false,
    palmQuality: 0,
    isHandDetected: false,
  };

  // Palm quality outputs (updated each frame)
  private palmFacing_: number = 0;
  private palmSpread_: number = 0;
  private palmQuality_: number = 0;
  private isPalmFullyVisible_: boolean = false;
  private isPalmGoodForRecognition_: boolean = false;

  /**
   * Process a single frame of landmarks and return the corresponding
   * {@link GestureState}.
   *
   * @param landmarks Raw 21-point hand landmarks, or `null` if no hand.
   */
  update(landmarks: HandLandmarks | null): GestureState {
    if (!landmarks || landmarks.length === 0) {
      // Hand lost — keep last known position for a while, then decay
      this.handLostFrames_++;

      if (this.handLostFrames_ <= this.kHandLostTolerance) {
        // Within tolerance: return last valid gesture (hold position)
        return { ...this.lastValidGesture_, isHandDetected: false };
      }

      // Beyond tolerance: gradually decay to neutral
      this.smooth_.palmX += (0.5 - this.smooth_.palmX) * 0.05;
      this.smooth_.palmSize += (0.15 - this.smooth_.palmSize) * 0.05;
      this.fistFrameCount_ = Math.max(this.fistFrameCount_ - 1, 0);

      this.palmFacing_ = 0;
      this.palmSpread_ = 0;
      this.palmQuality_ = 0;
      this.isPalmFullyVisible_ = false;
      this.isPalmGoodForRecognition_ = false;

      const steerX = (this.smooth_.palmX - 0.5) * 2;
      return {
        steerX,
        throttle: 0,
        isBraking: false,
        palmQuality: 0,
        isHandDetected: false,
      };
    }

    // Hand detected — reset lost counter
    this.handLostFrames_ = 0;

    // -- Visibility check (all landmarks within safe margin) --
    const kMargin = 0.02;
    this.isPalmFullyVisible_ = landmarks.every(
      (lm) =>
        lm.x >= kMargin &&
        lm.x <= 1 - kMargin &&
        lm.y >= kMargin &&
        lm.y <= 1 - kMargin
    );

    // -- Palm quality --
    this.evaluatePalmQuality_(landmarks);

    // -- Steering (hand X position) --
    // Average X of landmarks 0, 5, 9, 13, 17 (wrist + 4 MCP joints)
    const steerLandmarks = [0, 5, 9, 13, 17];
    let avgX = 0;
    for (const idx of steerLandmarks) {
      avgX += landmarks[idx].x;
    }
    avgX /= steerLandmarks.length;
    // Use raw X directly or mirror based on mode
    const rawX = this.mirrorX_ ? (1 - avgX) : avgX;

    // -- Palm center Y (landmark 9) --
    const rawY = landmarks[9].y;

    // -- Palm size (wrist to middle fingertip) --
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    const rawSize = this.distance_(wrist, middleTip);

    // -- Fist detection --
    const fistDetected = this.detectFist_(landmarks);

    // -- Exponential moving average smoothing --
    this.smooth_.palmX = this.lerp_(
      this.smooth_.palmX,
      rawX,
      this.kSmoothFactor
    );
    this.smooth_.palmY = this.lerp_(
      this.smooth_.palmY,
      rawY,
      this.kSmoothFactor
    );
    this.smooth_.palmSize = this.lerp_(
      this.smooth_.palmSize,
      rawSize,
      this.kSmoothFactor * 0.5
    );

    // -- Fist debounce --
    if (fistDetected) {
      this.fistFrameCount_ = Math.min(
        this.fistFrameCount_ + 1,
        this.kFistThreshold + 5
      );
    } else {
      this.fistFrameCount_ = Math.max(this.fistFrameCount_ - 2, 0);
    }
    const isFist = this.fistFrameCount_ >= this.kFistThreshold;

    // -- Map to game inputs --
    // steerX: 0-1 palmX → -1 to +1, with sensitivity multiplier
    const rawSteer = (this.smooth_.palmX - 0.5) * 2;
    const steerX = Math.max(-1, Math.min(1, rawSteer * this.steerSensitivity_));

    // throttle: full throttle when hand open, brake when fist
    const throttle = isFist ? 0 : 1.0;

    const result: GestureState = {
      steerX,
      throttle,
      isBraking: isFist,
      palmQuality: this.palmQuality_,
      isHandDetected: true,
    };

    // Save as last valid gesture for hand-loss tolerance
    this.lastValidGesture_ = result;
    return result;
  }

  /** Whether the palm is currently good for recognition / anti-cheat. */
  get isPalmGoodForRecognition(): boolean {
    return this.isPalmGoodForRecognition_;
  }

  /** Set whether to mirror X axis. Native mode = false, WASM mode = true. */
  setMirrorX(mirror: boolean): void {
    this.mirrorX_ = mirror;
  }

  /** Set steering sensitivity multiplier (default 1.0, use 2-4 for mobile). */
  setSteerSensitivity(value: number): void {
    this.steerSensitivity_ = value;
  }

  /** Current palm facing score 0-1. */
  get palmFacing(): number {
    return this.palmFacing_;
  }

  /** Current finger spread score 0-1. */
  get palmSpread(): number {
    return this.palmSpread_;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Evaluate palm quality: facing direction, finger spread, visibility.
   * Weights: facing 40%, spread 30%, visible 30%.
   */
  private evaluatePalmQuality_(landmarks: HandLandmarks): void {
    // 1. Palm facing – cross product of (wrist→indexMCP) × (wrist→pinkyMCP)
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];

    const v1 = {
      x: indexMCP.x - wrist.x,
      y: indexMCP.y - wrist.y,
      z: indexMCP.z - wrist.z,
    };
    const v2 = {
      x: pinkyMCP.x - wrist.x,
      y: pinkyMCP.y - wrist.y,
      z: pinkyMCP.z - wrist.z,
    };

    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x,
    };
    const normalLen = Math.sqrt(
      normal.x ** 2 + normal.y ** 2 + normal.z ** 2
    );

    if (normalLen > 0.0001) {
      this.palmFacing_ = Math.abs(normal.z / normalLen);
    } else {
      this.palmFacing_ = 0;
    }

    // 2. Finger spread
    const palmCenter = landmarks[9];
    const fingerTips = [8, 12, 16, 20];
    const fingerMCPs = [5, 9, 13, 17];

    let spreadScore = 0;
    for (let i = 0; i < fingerTips.length; ++i) {
      const tip = landmarks[fingerTips[i]];
      const mcp = landmarks[fingerMCPs[i]];
      const tipDist = this.distance_(tip, palmCenter);
      const mcpDist = this.distance_(mcp, palmCenter);
      if (mcpDist > 0.001) {
        const ratio = tipDist / mcpDist;
        spreadScore += Math.min(1, Math.max(0, (ratio - 1) / 1.5));
      }
    }

    // Thumb
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2];
    const thumbDist = this.distance_(thumbTip, wrist);
    const thumbBaseDist = this.distance_(thumbMCP, wrist);
    if (thumbBaseDist > 0.001) {
      const thumbRatio = thumbDist / thumbBaseDist;
      spreadScore += Math.min(1, Math.max(0, (thumbRatio - 1) / 1.0));
    }

    this.palmSpread_ = spreadScore / 5;

    // 3. Composite quality
    // 手掌不完全可见时，质量直接大幅降低（最多 0.3），
    // 确保不完整的手掌不会被 BestFrameCollector 采集
    if (this.isPalmFullyVisible_) {
      this.palmQuality_ =
        this.palmFacing_ * 0.4 +
        this.palmSpread_ * 0.3 +
        1.0 * 0.3;
    } else {
      // 不完全可见时，质量上限为 0.3（低于 BestFrameCollector 的 0.4 阈值）
      this.palmQuality_ =
        (this.palmFacing_ * 0.4 + this.palmSpread_ * 0.3) * 0.4;
    }

    // 4. Good-for-recognition flag
    this.isPalmGoodForRecognition_ =
      this.isPalmFullyVisible_ &&
      this.palmFacing_ > 0.5 &&
      this.palmSpread_ > 0.5 &&
      this.palmQuality_ > 0.6;
  }

  /**
   * Detect fist gesture: at least 4 of 5 fingers bent.
   *
   * For index/middle/ring/pinky: tip.y > pip.y means bent.
   * For thumb: tip closer to wrist (x) than IP joint means tucked.
   */
  private detectFist_(landmarks: HandLandmarks): boolean {
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];

    let bentCount = 0;
    for (let i = 0; i < fingerTips.length; ++i) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];
      if (tip.y > pip.y) {
        bentCount++;
      }
    }

    // Thumb
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const wrist = landmarks[0];
    const thumbBent =
      Math.abs(thumbTip.x - wrist.x) < Math.abs(thumbIP.x - wrist.x);
    if (thumbBent) {
      bentCount++;
    }

    return bentCount >= 4;
  }

  /** Euclidean distance between two 3D landmarks. */
  private distance_(a: HandLandmark, b: HandLandmark): number {
    return Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
    );
  }

  /** Linear interpolation. */
  private lerp_(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
