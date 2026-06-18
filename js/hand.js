/**
 * hand.js — 手部检测模块
 * 使用 MediaPipe Hands 进行实时手部关键点检测
 */

class HandDetector {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.isRunning = false;
    this.onResultsCallback = null;

    // 手部状态
    this.palmPositions = []; // 当前帧所有手掌中心位置 [{x, y}]
    this.isOpenPalm = [];    // 每只手是否张开
    this.landmarks = [];     // 原始关键点数据
  }

  /**
     * 初始化 MediaPipe Hands
     */
  async init(videoElement) {
    this.videoElement = videoElement;

    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this._onResults(results));
  }

  /**
     * 启动摄像头和检测
     */
  async start() {
    if (this.isRunning) return;

    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.hands && this.isRunning) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: 640,
      height: 480
    });

    this.isRunning = true;

    // 添加超时处理，防止摄像头启动卡住
    const cameraStartPromise = this.camera.start();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('摄像头启动超时（10秒），请检查摄像头权限设置')), 10000);
    });

    try {
      await Promise.race([cameraStartPromise, timeoutPromise]);
    } catch (err) {
      this.isRunning = false;
      throw err;
    }
  }

  /**
     * 停止检测
     */
  stop() {
    this.isRunning = false;
    if (this.camera) {
      this.camera.stop();
    }
  }

  /**
     * 处理检测结果
     */
  _onResults(results) {
    this.palmPositions = [];
    this.isOpenPalm = [];
    this.landmarks = results.multiHandLandmarks || [];

    if (results.multiHandLandmarks) {
      for (const handLandmarks of results.multiHandLandmarks) {
        // 计算手掌中心（使用手腕和中指根部的中点）
        // 注意：前置摄像头是镜像的，需要翻转 x 坐标，让手掌移动方向与画面一致
        const wrist = handLandmarks[0];
        const middleBase = handLandmarks[9];
        const palmCenter = {
          x: 1 - ((wrist.x + middleBase.x) / 2),
          y: (wrist.y + middleBase.y) / 2
        };
        this.palmPositions.push(palmCenter);

        // 检测手掌是否张开
        const isOpen = this._detectOpenPalm(handLandmarks);
        this.isOpenPalm.push(isOpen);
      }
    }

    // 回调通知
    if (this.onResultsCallback) {
      this.onResultsCallback({
        palmPositions: this.palmPositions,
        isOpenPalm: this.isOpenPalm,
        landmarks: this.landmarks
      });
    }
  }

  /**
     * 检测手掌是否张开（五指展开）
     * 通过比较每个指尖到手腕的距离与指根到手腕的距离来判断
     */
  _detectOpenPalm(landmarks) {
    const wrist = landmarks[0];

    // 指尖索引: 拇指4, 食指8, 中指12, 无名指16, 小指20
    const fingerTips = [4, 8, 12, 16, 20];
    // 指根索引: 拇指2, 食指5, 中指9, 无名指13, 小指17
    const fingerBases = [2, 5, 9, 13, 17];

    let extendedFingers = 0;

    for (let i = 0; i < 5; i++) {
      const tip = landmarks[fingerTips[i]];
      const base = landmarks[fingerBases[i]];

      const tipDist = this._distance(tip, wrist);
      const baseDist = this._distance(base, wrist);

      // 如果指尖到手腕的距离大于指根到手腕的距离，认为手指伸展
      if (tipDist > baseDist * 1.2) {
        extendedFingers++;
      }
    }

    // 至少3根手指伸展认为手掌张开
    return extendedFingers >= 3;
  }

  /**
     * 计算两点之间的距离
     */
  _distance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2)
            + Math.pow(a.y - b.y, 2)
            + Math.pow((a.z || 0) - (b.z || 0), 2)
    );
  }

  /**
     * 在 Canvas 上绘制手部关键点（用于摄像头小窗口）
     */
  drawLandmarks(canvasCtx, canvasWidth, canvasHeight) {
    canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!this.landmarks || this.landmarks.length === 0) return;

    for (let h = 0; h < this.landmarks.length; h++) {
      const handLandmarks = this.landmarks[h];
      const isOpen = this.isOpenPalm[h];

      // 绘制连接线
      const connections = [
        [0,1],[1,2],[2,3],[3,4],       // 拇指
        [0,5],[5,6],[6,7],[7,8],       // 食指
        [0,9],[9,10],[10,11],[11,12],   // 中指
        [0,13],[13,14],[14,15],[15,16], // 无名指
        [0,17],[17,18],[18,19],[19,20], // 小指
        [5,9],[9,13],[13,17]            // 手掌
      ];

      canvasCtx.strokeStyle = isOpen ? '#4ecdc4' : '#ff6b6b';
      canvasCtx.lineWidth = 2;

      for (const [i, j] of connections) {
        const a = handLandmarks[i];
        const b = handLandmarks[j];
        canvasCtx.beginPath();
        canvasCtx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
        canvasCtx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
        canvasCtx.stroke();
      }

      // 绘制关键点
      for (const lm of handLandmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 3, 0, 2 * Math.PI);
        canvasCtx.fillStyle = isOpen ? '#4ecdc4' : '#ff6b6b';
        canvasCtx.fill();
      }
    }
  }
}
