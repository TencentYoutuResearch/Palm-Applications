/**
 * glass.js — 玻璃/污渍渲染模块
 * 负责污渍层的绘制、擦除效果、进度计算
 */

class GlassRenderer {
  constructor() {
    this.imageCanvas = null;
    this.imageCtx = null;
    this.dirtCanvas = null;
    this.dirtCtx = null;
    this.cursorCanvas = null;
    this.cursorCtx = null;

    this.width = 0;
    this.height = 0;

    // 擦除相关
    this.brushRadius = 40;       // 擦除笔刷半径
    this.cleanedPercent = 0;     // 已擦除百分比
    this.totalPixels = 0;
    this.cleanedPixels = 0;
    this.initialDirtyCount = 0;  // 初始有污渍的采样点数量（用于局部污渍的进度计算）

    // 多层污渍相关
    this.dirtLayers = 1;         // 当前关卡的污渍层数
    this.currentDirtLayer = 1;   // 当前剩余层数
    this.layerSnapshots = [];    // 每层污渍的快照（ImageData）

    // 当前关卡配置
    this.levelConfig = null;

    // 隐藏图片
    this.hiddenImage = null;

    // 水光特效点
    this.shineEffects = [];

    // 临时擦除 canvas（用于多层污渍时合并一次滑动的所有笔刷）
    this._wipeTempCanvas = null;
    this._wipeTempCtx = null;
  }

  /**
     * 初始化 Canvas 引用
     */
  init(imageCanvas, dirtCanvas, cursorCanvas) {
    this.imageCanvas = imageCanvas;
    this.imageCtx = imageCanvas.getContext('2d');
    this.dirtCanvas = dirtCanvas;
    this.dirtCtx = dirtCanvas.getContext('2d');
    this.cursorCanvas = cursorCanvas;
    this.cursorCtx = cursorCanvas.getContext('2d');
  }

  /**
     * 绘制圆角矩形路径（兼容不支持 roundRect 的浏览器）
     */
  _roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
     * 调整 Canvas 尺寸
     */
  resize(width, height) {
    this.width = width;
    this.height = height;

    [this.imageCanvas, this.dirtCanvas, this.cursorCanvas].forEach(c => {
      c.width = width;
      c.height = height;
    });

    this.totalPixels = width * height;

    // 同步调整临时擦除 canvas 尺寸
    if (!this._wipeTempCanvas) {
      this._wipeTempCanvas = document.createElement('canvas');
      this._wipeTempCtx = this._wipeTempCanvas.getContext('2d');
    }
    this._wipeTempCanvas.width = width;
    this._wipeTempCanvas.height = height;
  }

  /**
     * 加载关卡
     */
  async loadLevel(levelConfig) {
    this.levelConfig = levelConfig;
    this.cleanedPercent = 0;
    this.cleanedPixels = 0;
    this.shineEffects = [];

    // 多层污渍配置
    this.dirtLayers = levelConfig.dirtLayers || 1;
    this.currentDirtLayer = this.dirtLayers;
    this.layerSnapshots = [];

    // 设置笔刷大小
    this.brushRadius = levelConfig.brushRadius || 40;

    // 加载隐藏图片
    await this._loadHiddenImage(levelConfig.imageUrl);

    // 绘制隐藏图片到底层
    this._drawHiddenImage();

    // 绘制污渍层
    // 多层污渍时，增加污渍的初始透明度，让污渍看起来更厚
    const effectiveOpacity = this.dirtLayers > 1
      ? ((Math.min(1.0, levelConfig.dirtOpacity * (1 + ((this.dirtLayers - 1) * 0.3)))))
      : levelConfig.dirtOpacity;
    this._drawDirtLayer(levelConfig.dirtType, effectiveOpacity);

    // 记录初始有污渍的像素数（用于局部污渍类型的进度计算）
    this._recordInitialDirtyPixels();
  }

  /**
     * 加载隐藏图片
     */
  _loadHiddenImage(url) {
    console.log('[GlassRenderer] _loadHiddenImage 被调用，url =', url);
    return new Promise((resolve, reject) => {
      if (!url) {
        console.warn('[GlassRenderer] url 为空，使用备用渐变');
        this.hiddenImage = null;
        resolve();
        return;
      }

      const img = new Image();

      // 超时处理：10秒后如果图片还没加载完，使用备用
      const timeout = setTimeout(() => {
        console.warn('[GlassRenderer] 图片加载超时，使用备用');
        img.onload = null;
        img.onerror = null;
        this.hiddenImage = null;
        resolve();
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        console.log('[GlassRenderer] ✅ 图片加载成功！尺寸:', img.width, 'x', img.height);
        this.hiddenImage = img;
        resolve();
      };
      img.onerror = (e) => {
        clearTimeout(timeout);
        console.error('[GlassRenderer] ❌ 图片加载失败！url =', url, '错误:', e);
        // 加载失败时使用渐变色作为备用
        this.hiddenImage = null;
        resolve();
      };
      img.src = url;
    });
  }

  /**
     * 绘制隐藏图片
     */
  _drawHiddenImage() {
    const ctx = this.imageCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.hiddenImage) {
      // 保持比例填充
      const imgRatio = this.hiddenImage.width / this.hiddenImage.height;
      const canvasRatio = this.width / this.height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgRatio > canvasRatio) {
        drawHeight = this.height;
        drawWidth = drawHeight * imgRatio;
        offsetX = (this.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = this.width;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (this.height - drawHeight) / 2;
      }

      ctx.drawImage(this.hiddenImage, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      // 备用：绘制彩色渐变
      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(0.5, '#764ba2');
      gradient.addColorStop(1, '#f093fb');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Noto Sans SC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🖼️ 隐藏图片', this.width / 2, this.height / 2);
    }
  }

  /**
     * 绘制污渍层
     */
  _drawDirtLayer(dirtType = 'normal', opacity = 0.85) {
    const ctx = this.dirtCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 雾气、混合、普通类型都铺全屏底色
    // 普通类型铺一层较薄的底色，确保有足够的覆盖面积
    const needFullScreenBase = ['fog', 'mixed', 'normal'].includes(dirtType);

    if (needFullScreenBase) {
      // 基础玻璃效果 - 半透明背景
      // 普通类型用更薄的底色，其他类型用标准底色
      const baseAlpha = dirtType === 'normal' ? 0.18 : 0.3;
      ctx.fillStyle = `rgba(240, 240, 245, ${baseAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);

      // 添加玻璃纹理
      this._addGlassTexture(ctx);
    }

    // 根据污渍类型添加污渍效果
    switch (dirtType) {
    case 'fog':
      this._addFogEffect(ctx, opacity);
      break;
    case 'thick':
      this._addThickDirt(ctx, opacity);
      break;
    case 'oil':
      this._addOilStains(ctx, opacity);
      break;
    case 'mixed':
      this._addFogEffect(ctx, opacity * 0.7);
      this._addOilStains(ctx, opacity * 0.8);
      break;
    default:
      this._addNormalDirt(ctx, opacity);
      break;
    }

    // 只有全屏底色类型才添加反光和边缘预擦除
    if (needFullScreenBase) {
      // 添加玻璃反光效果
      this._addGlassReflection(ctx);

      // 预擦除边缘区域，降低边缘难度（normal类型底色较薄，不做预擦除）
      if (dirtType !== 'normal') {
        this._preCleanEdges(ctx);
      }
    }
  }

  /**
     * 添加玻璃纹理
     */
  _addGlassTexture(ctx) {
    // 添加细微的玻璃纹理
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // 添加轻微的玻璃纹理噪点
      const noise = (Math.random() - 0.5) * 5;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
     * 绘制不规则形状（贝塞尔曲线随机变形，替代正圆）
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx - 中心X
     * @param {number} cy - 中心Y
     * @param {number} r - 基础半径
     * @param {number} irregularity - 不规则程度 (0-1)
     * @param {number} points - 控制点数量
     */
  _drawIrregularShape(ctx, cx, cy, r, irregularity = 0.4, points = 8) {
    const angleStep = (Math.PI * 2) / points;
    const pts = [];

    for (let i = 0; i < points; i++) {
      const angle = angleStep * i;
      const radiusVariation = r * (1 + ((Math.random() - 0.5) * (2 * irregularity)));
      pts.push({
        x: cx + (Math.cos(angle) * radiusVariation),
        y: cy + (Math.sin(angle) * radiusVariation)
      });
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      // 使用二次贝塞尔曲线连接各点，控制点在两点中间偏移
      const cpX = ((curr.x + next.x) / 2) + ((Math.random() - 0.5) * (r * (irregularity * 0.5)));
      const cpY = ((curr.y + next.y) / 2) + ((Math.random() - 0.5) * (r * (irregularity * 0.5)));
      ctx.quadraticCurveTo(cpX, cpY, next.x, next.y);
    }

    ctx.closePath();
  }

  /**
     * 添加普通污渍
     */
  _addNormalDirt(ctx, opacity) {
    // 添加不规则灰尘颗粒（大量、大尺寸，确保足够覆盖面积）
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = 20 + ((Math.random() * 50));

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(60, 55, 50, ${opacity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(80, 75, 70, ${opacity * 0.55})`);
      gradient.addColorStop(0.8, `rgba(90, 85, 80, ${opacity * 0.25})`);
      gradient.addColorStop(1, `rgba(90, 85, 80, 0)`);

      ctx.fillStyle = gradient;
      this._drawIrregularShape(ctx, x, y, r, 0.5, 6);
      ctx.fill();
    }

    // 添加水渍痕迹（不规则条纹，更多更宽）
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const w = 80 + ((Math.random() * 200));
      const h = 10 + ((Math.random() * 25));
      const angle = (Math.random() - 0.5) * 0.4;

      ctx.save();
      ctx.translate(x + (w / 2), y + (h / 2));
      ctx.rotate(angle);
      // 用圆角矩形代替直角矩形
      const rr = Math.min(h / 2, 6);
      this._roundRectPath(ctx, -w / 2, -h / 2, w, h, rr);
      ctx.fillStyle = `rgba(120, 110, 100, ${opacity * 0.55})`;
      ctx.fill();
      ctx.restore();
    }
  }

  /**
     * 添加噪点纹理
     */
  _addNoiseTexture(ctx, baseOpacity) {
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 30;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
     * 添加雾气效果
     */
  _addFogEffect(ctx, opacity) {
    // 创建雾气层
    ctx.fillStyle = `rgba(200, 200, 210, ${opacity * 0.55})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // 添加不均匀的雾气区域
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = 80 + ((Math.random() * 140));

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(180, 180, 190, ${opacity * 0.75})`);
      gradient.addColorStop(1, `rgba(180, 180, 190, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /**
     * 添加厚污渍（不规则形状）
     */
  _addThickDirt(ctx, opacity) {
    // 不铺全屏底色，只绘制局部厚污渍斑块

    // 添加不规则污渍斑块（数量增多、尺寸增大，覆盖更多区域）
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = 40 + ((Math.random() * 80));

      // 使用径向渐变 + 不规则形状
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(50, 40, 30, ${opacity * 0.75})`);
      gradient.addColorStop(0.6, `rgba(65, 55, 45, ${opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(80, 70, 60, 0)`);

      ctx.fillStyle = gradient;
      this._drawIrregularShape(ctx, x, y, r, 0.5, 10);
      ctx.fill();
    }

    // 添加不规则污渍条纹（带旋转和弧度）
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const w = 120 + ((Math.random() * 200));
      const h = 10 + ((Math.random() * 25));
      const angle = (Math.random() - 0.5) * 0.6;

      ctx.save();
      ctx.translate(x + (w / 2), y + (h / 2));
      ctx.rotate(angle);
      const rr = Math.min(h / 2, 6);
      this._roundRectPath(ctx, -w / 2, -h / 2, w, h, rr);
      ctx.fillStyle = `rgba(60, 50, 40, ${opacity * 0.6})`;
      ctx.fill();
      ctx.restore();
    }
  }

  /**
     * 添加油渍（不规则形状 + 流痕）
     */
  _addOilStains(ctx, opacity) {
    // 只绘制局部油渍斑块，不铺全屏底色
    // 油渍数量更多、尺寸更大
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = 30 + ((Math.random() * 70));

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(140, 130, 90, ${opacity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(120, 110, 80, ${opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(120, 110, 80, 0)`);

      ctx.fillStyle = gradient;
      this._drawIrregularShape(ctx, x, y, r, 0.45, 9);
      ctx.fill();
    }

    // 添加油渍流痕（弯曲的不规则条纹）
    for (let i = 0; i < 8; i++) {
      const startX = Math.random() * this.width;
      const startY = Math.random() * this.height * 0.5;
      const length = 80 + ((Math.random() * 160));
      const width = 6 + ((Math.random() * 12));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX - (width / 2), startY);
      // 用贝塞尔曲线画弯曲的流痕
      const cp1x = startX + ((Math.random() - 0.5) * 30);
      const cp1y = startY + (length * 0.3);
      const cp2x = startX + ((Math.random() - 0.5) * 20);
      const cp2y = startY + (length * 0.7);
      const endX = startX + ((Math.random() - 0.5) * 15);
      const endY = startY + length;

      ctx.bezierCurveTo(cp1x - (width / 2), cp1y, cp2x - (width / 2), cp2y, endX - (width / 2), endY);
      ctx.lineTo(endX + (width / 2), endY);
      ctx.bezierCurveTo(cp2x + (width / 2), cp2y, cp1x + (width / 2), cp1y, startX + (width / 2), startY);
      ctx.closePath();

      ctx.fillStyle = `rgba(150, 140, 100, ${opacity * 0.5})`;
      ctx.fill();
      ctx.restore();
    }
  }

  /**
     * 预擦除边缘区域 — 让边缘的污渍更薄，降低擦拭难度
     * 边缘 10% 的区域会被自动减淡，越靠近边缘越透明
     */
  _preCleanEdges(ctx) {
    const edgeRatio = 0.10; // 边缘区域占比 10%
    const edgeW = this.width * edgeRatio;
    const edgeH = this.height * edgeRatio;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    // 左边缘
    const leftGrad = ctx.createLinearGradient(0, 0, edgeW, 0);
    leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, edgeW, this.height);

    // 右边缘
    const rightGrad = ctx.createLinearGradient(this.width - edgeW, 0, this.width, 0);
    rightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(this.width - edgeW, 0, edgeW, this.height);

    // 上边缘
    const topGrad = ctx.createLinearGradient(0, 0, 0, edgeH);
    topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, this.width, edgeH);

    // 下边缘
    const bottomGrad = ctx.createLinearGradient(0, this.height - edgeH, 0, this.height);
    bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, this.height - edgeH, this.width, edgeH);

    ctx.restore();
  }

  /**
     * 获取当前剩余污渍层数（兼容接口，始终返回1）
     */
  getRemainingLayers() {
    return 1;
  }

  /**
     * 记录初始有污渍的采样点数量
     * 用于局部污渍（thick/oil）的进度计算
     */
  _recordInitialDirtyPixels() {
    const sampleStep = 4;
    const imageData = this.dirtCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    let dirtyCount = 0;
    let totalSamples = 0;

    for (let y = 0; y < this.height; y += sampleStep) {
      for (let x = 0; x < this.width; x += sampleStep) {
        const idx = ((y * this.width) + x) * 4;
        if (data[idx + 3] >= 50) {
          dirtyCount++;
        }
        totalSamples++;
      }
    }

    this.initialDirtyCount = dirtyCount;
    // 如果几乎没有污渍像素（异常情况），回退到总采样数
    if (this.initialDirtyCount < totalSamples * 0.05) {
      this.initialDirtyCount = totalSamples;
    }
  }

  /**
     * 添加玻璃反光效果
     */
  _addGlassReflection(ctx) {
    // 对角线反光
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#fff';

    ctx.beginPath();
    ctx.moveTo(this.width * 0.1, 0);
    ctx.lineTo(this.width * 0.3, 0);
    ctx.lineTo(0, this.height * 0.5);
    ctx.lineTo(0, this.height * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.width * 0.6, 0);
    ctx.lineTo(this.width * 0.8, 0);
    ctx.lineTo(this.width * 0.2, this.height);
    ctx.lineTo(0, this.height);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
     * 擦除指定位置的污渍（单点擦除，用于单次点击）
     * @param {number} x - 归一化坐标 (0-1)
     * @param {number} y - 归一化坐标 (0-1)
     * @param {number} pressure - 擦拭力度 (0-1)
     */
  wipe(x, y, pressure = 1) {
    const px = x * this.width;
    const py = y * this.height;
    const edgeBoost = this._getEdgeBoost(x, y);
    const radius = this.brushRadius * pressure * edgeBoost;

    if (this.dirtLayers > 1) {
      // 多层污渍：通过临时 canvas 合并后一次性应用，防止重叠累积
      this._wipeTempCtx.clearRect(0, 0, this.width, this.height);
      this._drawBrushStroke(this._wipeTempCtx, px, py, radius);
      this._applyWipeTemp();
    } else {
      // 单层污渍：直接擦除（全力度）
      const ctx = this.dirtCtx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      this._drawBrushStroke(ctx, px, py, radius);
      ctx.restore();
    }

    // 添加水光特效
    this.shineEffects.push({
      x: px, y: py,
      radius: radius * 0.8,
      alpha: 0.6,
      life: 1.0
    });

    // 更新擦除进度
    this._updateCleanedPercent();
  }

  /**
     * 在指定 ctx 上绘制一个柔和的圆形笔刷
     */
  _drawBrushStroke(ctx, px, py, radius) {
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
     * 将临时擦除 canvas 的内容以降低后的力度应用到污渍层
     * 临时 canvas 上白色/黑色区域表示要擦除的区域
     * 通过 globalAlpha 控制每次擦除只减少一部分污渍
     */
  _applyWipeTemp() {
    // 计算擦除力度：层数越多，每次擦除力度越小
    // dirtLayers=2: 力度0.35（约需3次完全擦干净）
    // dirtLayers=3: 力度0.22（约需5次完全擦干净）
    const wipeStrength = Math.max(0.15, 0.7 / this.dirtLayers);

    const ctx = this.dirtCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = wipeStrength;
    ctx.drawImage(this._wipeTempCanvas, 0, 0);
    ctx.restore();
  }

  /**
     * 计算边缘区域的笔刷放大倍率
     * 越靠近边缘，笔刷越大，最多放大到 1.6 倍
     * @param {number} x - 归一化坐标 (0-1)
     * @param {number} y - 归一化坐标 (0-1)
     * @returns {number} 放大倍率 (1.0 - 1.6)
     */
  _getEdgeBoost(x, y) {
    const edgeThreshold = 0.15; // 边缘区域占比 15%
    const maxBoost = 1.6;

    // 计算到最近边缘的距离（归一化 0-0.5）
    const distToEdgeX = Math.min(x, 1 - x);
    const distToEdgeY = Math.min(y, 1 - y);
    const distToEdge = Math.min(distToEdgeX, distToEdgeY);

    if (distToEdge >= edgeThreshold) {
      return 1.0; // 不在边缘区域，不放大
    }

    // 线性插值：越靠近边缘，boost 越大
    const t = 1 - (distToEdge / edgeThreshold);
    return 1.0 + (t * (maxBoost - 1.0));
  }

  /**
     * 在两点之间进行连续擦除（避免快速移动时出现断裂）
     * 多层污渍时，先将所有笔刷绘制到临时 canvas，再一次性应用到污渍层
     * 这样同一个像素无论被多少个重叠笔刷覆盖，每次滑动最多只减少 wipeStrength 的 alpha
     */
  wipeLine(x1, y1, x2, y2, pressure = 1) {
    const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const steps = Math.max(1, Math.floor(dist * Math.max(this.width, this.height) / (this.brushRadius * 0.5)));

    if (this.dirtLayers > 1) {
      // 多层污渍：先把所有笔刷画到临时 canvas 上，再一次性应用
      this._wipeTempCtx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + ((x2 - x1) * t);
        const y = y1 + ((y2 - y1) * t);
        const px = x * this.width;
        const py = y * this.height;
        const edgeBoost = this._getEdgeBoost(x, y);
        const radius = this.brushRadius * pressure * edgeBoost;

        this._drawBrushStroke(this._wipeTempCtx, px, py, radius);

        // 添加水光特效
        this.shineEffects.push({
          x: px, y: py,
          radius: radius * 0.8,
          alpha: 0.6,
          life: 1.0
        });
      }

      // 一次性将临时 canvas 以降低的力度应用到污渍层
      this._applyWipeTemp();

      // 更新擦除进度
      this._updateCleanedPercent();
    } else {
      // 单层污渍：直接逐点擦除（保持原有行为）
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + ((x2 - x1) * t);
        const y = y1 + ((y2 - y1) * t);
        this.wipe(x, y, pressure);
      }
    }
  }

  /**
     * 更新擦除百分比
     * 多层污渍不再使用快照切换，而是通过降低每次擦除力度实现
     * 进度计算统一基于当前 canvas 上的污渍像素
     */
  _updateCleanedPercent() {
    // 采样检测（全像素检测太慢，每隔几个像素采样一次）
    const sampleStep = 4;
    const imageData = this.dirtCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    let transparentCount = 0;
    let totalSamples = 0;

    for (let y = 0; y < this.height; y += sampleStep) {
      for (let x = 0; x < this.width; x += sampleStep) {
        const idx = ((y * this.width) + x) * 4;
        // alpha 通道小于 50 认为已擦除
        if (data[idx + 3] < 50) {
          transparentCount++;
        }
        totalSamples++;
      }
    }

    // 计算擦除进度
    // 对于局部污渍（thick/oil），基于初始有污渍的像素来计算
    // 已擦除的污渍像素 = 当前透明像素 - 初始就透明的像素
    const initialCleanCount = totalSamples - this.initialDirtyCount;
    const newlyCleaned = Math.max(0, transparentCount - initialCleanCount);
    this.cleanedPercent = this.initialDirtyCount > 0
      ? Math.round((newlyCleaned / this.initialDirtyCount) * 100)
      : Math.round((transparentCount / totalSamples) * 100);
  }

  /**
     * 绘制手掌光标（抹布图标）
     */
  drawCursor(positions, isOpenPalm) {
    const ctx = this.cursorCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 绘制水光特效
    this._drawShineEffects(ctx);

    if (!positions || positions.length === 0) return;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const isOpen = isOpenPalm[i];
      const px = pos.x * this.width;
      const py = pos.y * this.height;

      // 绘制抹布/手掌指示器
      ctx.save();

      if (isOpen) {
        // 张开手掌 - 显示擦拭光圈
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, this.brushRadius);
        gradient.addColorStop(0, 'rgba(78, 205, 196, 0.3)');
        gradient.addColorStop(0.7, 'rgba(78, 205, 196, 0.1)');
        gradient.addColorStop(1, 'rgba(78, 205, 196, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, this.brushRadius, 0, Math.PI * 2);
        ctx.fill();

        // 外圈
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, this.brushRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 抹布 emoji
        ctx.font = '32px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧽', px, py);
      } else {
        // 握拳 - 显示停止标记
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✊', px, py);

        // 红色虚线圈
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(px, py, this.brushRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
     * 绘制水光特效
     */
  _drawShineEffects(ctx) {
    for (let i = this.shineEffects.length - 1; i >= 0; i--) {
      const effect = this.shineEffects[i];
      effect.life -= 0.05;
      effect.alpha = effect.life * 0.4;

      if (effect.life <= 0) {
        this.shineEffects.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = effect.alpha;

      const gradient = ctx.createRadialGradient(
        effect.x, effect.y, 0,
        effect.x, effect.y, effect.radius
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
     * 获取当前隐藏图片的 Data URL（用于结算画廊）
     */
  getImageDataUrl() {
    try {
      const dataUrl = this.imageCanvas.toDataURL('image/jpeg', 0.6);
      // 检查是否为有效的 data URL（非空白 canvas）
      if (dataUrl && dataUrl.length > 100) {
        return dataUrl;
      }
      return '';
    } catch (e) {
      console.warn('[GlassRenderer] toDataURL 失败:', e.message);
      return '';
    }
  }
}
