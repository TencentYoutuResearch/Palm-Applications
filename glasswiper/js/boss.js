/**
 * boss.js — Boss 关卡模块（两阶段设计）
 * 阶段一：擦玻璃找 Boss（Boss 隐藏在背景中）
 * 阶段二：Boss 从背景跳出，在屏幕里乱窜，玩家用手掌扣它
 */

// roundRect polyfill（兼容不支持的浏览器）
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

class BossFight {
  constructor() {
    // Canvas 引用
    this.canvas = null;
    this.ctx = null;
    this.bgCanvas = null;
    this.bgCtx = null;
    this.cursorCanvas = null;
    this.cursorCtx = null;

    this.width = 0;
    this.height = 0;

    // ===== 阶段管理 =====
    // 'searching' = 擦玻璃找Boss, 'emerging' = Boss跳出动画, 'fighting' = 打Boss
    this.phase = 'searching';

    // ===== Boss 属性 =====
    this.boss = {
      x: 0.5,        // 归一化坐标
      y: 0.5,
      size: 80,       // Boss 显示大小（像素）
      hp: 100,
      maxHp: 100,
      speed: 0.003,
      targetX: 0.5,
      targetY: 0.5,
      state: 'idle',  // idle, moving, hit, stunned, dodging
      stateTimer: 0,
      hitFlash: 0,
      dodgeCooldown: 0,
      direction: 1,
      bobOffset: 0,
      bobSpeed: 0.05,
      anger: 0,
      // Boss 在背景中的隐藏位置（阶段一用）
      hiddenX: 0.5,
      hiddenY: 0.5,
      // 跳出动画相关
      emergeProgress: 0,  // 0-1 跳出动画进度
      emergeScale: 0,     // 跳出时的缩放
    };

    // Boss 关卡配置
    this.config = {
      time: 60,           // 总时间（两阶段共用）
      bossHp: 100,
      hitDamage: 8,
      hitCooldown: 500,
      dodgeChance: 0.2,
      moveInterval: 2000,
      // 阶段一配置
      searchThreshold: 40, // 擦除多少百分比后发现Boss
    };

    // 战斗状态
    this.lastHitTime = 0;
    this.hitCount = 0;
    this.comboHits = 0;
    this.maxCombo = 0;
    this.isActive = false;

    // 特效
    this.effects = [];
    this.particles = [];

    // 动画帧计数
    this.frameCount = 0;

    // 跳出动画计时
    this.emergeTimer = 0;
    this.emergeDuration = 60; // 60帧 ≈ 1秒
  }

  /**
     * 初始化 Boss 关卡
     */
  init(imageCanvas, dirtCanvas, cursorCanvas) {
    this.bgCanvas = imageCanvas;
    this.bgCtx = imageCanvas.getContext('2d');
    this.canvas = dirtCanvas;
    this.ctx = dirtCanvas.getContext('2d');
    this.cursorCanvas = cursorCanvas;
    this.cursorCtx = cursorCanvas.getContext('2d');
  }

  /**
     * 调整尺寸
     */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
     * 开始 Boss 战（阶段一：擦玻璃找Boss）
     * @param {number} bossLevel - 第几次 Boss 战（影响难度）
     */
  startFight(bossLevel = 1) {
    this.isActive = true;
    this.phase = 'searching'; // 从擦玻璃阶段开始
    this.hitCount = 0;
    this.comboHits = 0;
    this.maxCombo = 0;
    this.lastHitTime = 0;
    this.effects = [];
    this.particles = [];
    this.frameCount = 0;
    this.emergeTimer = 0;

    // 根据 Boss 等级调整难度
    const difficulty = Math.min(bossLevel, 5);
    this.config.bossHp = 80 + (difficulty * 20);
    this.config.hitDamage = Math.max(5, 10 - difficulty);
    this.config.dodgeChance = Math.min(0.5, 0.15 + (difficulty * 0.07));
    this.config.moveInterval = Math.max(800, 2000 - (difficulty * 200));
    this.config.time = 50 + (difficulty * 10);
    this.config.searchThreshold = Math.max(25, 40 - (difficulty * 3));

    // 初始化 Boss
    this.boss.hp = this.config.bossHp;
    this.boss.maxHp = this.config.bossHp;
    this.boss.state = 'idle';
    this.boss.stateTimer = 0;
    this.boss.hitFlash = 0;
    this.boss.dodgeCooldown = 0;
    this.boss.anger = 0;
    this.boss.speed = 0.003 + (difficulty * 0.001);
    this.boss.size = Math.min(100, 70 + (difficulty * 5));
    this.boss.emergeProgress = 0;
    this.boss.emergeScale = 0;

    // Boss 在背景中的随机隐藏位置（避免太靠近边缘）
    this.boss.hiddenX = 0.25 + ((Math.random() * 0.5));
    this.boss.hiddenY = 0.25 + ((Math.random() * 0.5));
    this.boss.x = this.boss.hiddenX;
    this.boss.y = this.boss.hiddenY;
  }

  /**
     * 获取阶段一的关卡配置（供 game.js 使用，复用擦玻璃逻辑）
     */
  getSearchLevelConfig(bossLevel = 1) {
    return {
      level: 'BOSS',
      time: this.config.time,
      dirtType: 'fog',
      dirtOpacity: 0.85,
      brushRadius: 45,
      targetPercent: 100, // 设为100，由Boss模块自己控制阶段切换
      imageUrl: null, // 由 SceneManager 异步获取动漫图片
      imageName: window.i18n.t('bossHiddenLevel')
    };
  }

  /**
     * 检查阶段一是否应该切换到阶段二（擦除进度达到阈值）
     * @param {number} cleanedPercent - 当前擦除百分比
     * @returns {boolean} 是否发现了Boss
     */
  checkBossFound(cleanedPercent) {
    if (this.phase !== 'searching') return false;
    return cleanedPercent >= this.config.searchThreshold;
  }

  /**
     * 触发Boss跳出动画（从阶段一切换到阶段二）
     */
  triggerBossEmerge() {
    this.phase = 'emerging';
    this.emergeTimer = 0;
    this.boss.emergeProgress = 0;
    this.boss.emergeScale = 0;

    // 添加发现特效
    this.effects.push({
      type: 'found',
      x: this.boss.hiddenX,
      y: this.boss.hiddenY,
      text: window.i18n.t('bossFound'),
      life: 1.0,
      vy: -0.001,
      scale: 2.0
    });

    // 添加爆炸粒子
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.003 + ((Math.random() * 0.008));
      this.particles.push({
        x: this.boss.hiddenX,
        y: this.boss.hiddenY,
        vx: Math.cos(angle) * speed,
        vy: (Math.sin(angle) * speed) - 0.003,
        life: 1.0,
        decay: 0.01 + ((Math.random() * 0.015)),
        size: 4 + ((Math.random() * 8)),
        color: ['#ff4444', '#ffd700', '#ff6b6b', '#ff8e53'][Math.floor(Math.random() * 4)]
      });
    }
  }

  /**
     * 检测手掌是否命中 Boss（阶段二）
     */
  checkHit(handX, handY) {
    if (!this.isActive || this.phase !== 'fighting') return false;
    if (this.boss.state === 'stunned') return false;

    const now = Date.now();
    if (now - this.lastHitTime < this.config.hitCooldown) return false;

    // 计算距离
    const bossRadiusX = (this.boss.size / this.width) * 0.8;
    const bossRadiusY = (this.boss.size / this.height) * 0.8;
    const dx = (handX - this.boss.x) / bossRadiusX;
    const dy = (handY - this.boss.y) / bossRadiusY;
    const dist = Math.sqrt((dx * dx) + (dy * dy));

    if (dist > 1.5) return false;

    // 闪避判定
    if (this.boss.dodgeCooldown <= 0 && Math.random() < this.config.dodgeChance + (this.boss.anger * 0.1)) {
      this._dodge(handX, handY);
      return false;
    }

    // 命中！
    this.lastHitTime = now;
    this.hitCount++;
    this.comboHits++;
    this.maxCombo = Math.max(this.maxCombo, this.comboHits);

    // 计算伤害（连击加成）
    let damage = this.config.hitDamage;
    if (this.comboHits >= 5) damage *= 1.5;
    if (this.comboHits >= 10) damage *= 2;

    this.boss.hp = Math.max(0, this.boss.hp - damage);
    this.boss.hitFlash = 15;
    this.boss.state = 'hit';
    this.boss.stateTimer = 10;

    // 更新愤怒值
    this.boss.anger = 1 - (this.boss.hp / this.boss.maxHp);
    this.boss.speed = (0.003 + (this.boss.anger * 0.005));

    // 受击方向
    this.boss.direction = handX < this.boss.x ? 1 : -1;

    // 添加打击特效
    this._addHitEffect(this.boss.x, this.boss.y, damage);
    this._addHitParticles(this.boss.x, this.boss.y);

    return true;
  }

  /**
     * Boss 闪避
     */
  _dodge(handX, handY) {
    const dodgeDist = 0.2 + ((Math.random() * 0.1));
    const angle = Math.atan2(this.boss.y - handY, this.boss.x - handX);

    this.boss.targetX = (Math.max(0.1, Math.min(0.9, this.boss.x + (Math.cos(angle) * dodgeDist))));
    this.boss.targetY = (Math.max(0.15, Math.min(0.8, this.boss.y + (Math.sin(angle) * dodgeDist))));
    this.boss.state = 'dodging';
    this.boss.stateTimer = 20;
    this.boss.dodgeCooldown = 60;

    this.effects.push({
      type: 'dodge',
      x: this.boss.x,
      y: this.boss.y,
      text: window.i18n.t('dodge'),
      life: 1.0,
      vy: -0.001
    });
  }

  /**
     * 添加打击特效
     */
  _addHitEffect(x, y, damage) {
    this.effects.push({
      type: 'damage',
      x: x + ((Math.random() - 0.5) * 0.05),
      y: y - 0.05,
      text: `-${Math.round(damage)}`,
      life: 1.0,
      vy: -0.002,
      scale: damage > 10 ? 1.5 : 1.0
    });

    this.effects.push({
      type: 'flash',
      x: x,
      y: y,
      life: 1.0,
      radius: 0.08
    });

    if (this.comboHits >= 3) {
      this.effects.push({
        type: 'combo',
        x: 0.5,
        y: 0.15,
        text: window.i18n.t('comboPrefixSuffix')(this.comboHits),
        life: 1.0,
        vy: -0.0005,
        scale: 1 + (this.comboHits * 0.05)
      });
    }
  }

  /**
     * 添加受击粒子
     */
  _addHitParticles(x, y) {
    const count = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.002 + ((Math.random() * 0.005));
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: (Math.sin(angle) * speed) - 0.002,
        life: 1.0,
        decay: 0.02 + ((Math.random() * 0.02)),
        size: 3 + ((Math.random() * 5)),
        color: Math.random() > 0.5 ? '#ffd700' : '#ff6b6b'
      });
    }
  }

  /**
     * 选择新的移动目标
     */
  _pickNewTarget() {
    this.boss.targetX = 0.1 + ((Math.random() * 0.8));
    this.boss.targetY = 0.15 + ((Math.random() * 0.65));
    this.boss.state = 'moving';
  }

  /**
     * 更新 Boss 状态（每帧调用）
     */
  update() {
    if (!this.isActive) return;

    this.frameCount++;

    // 根据阶段更新
    if (this.phase === 'emerging') {
      this._updateEmerge();
    } else if (this.phase === 'fighting') {
      this._updateFighting();
    }
    // 'searching' 阶段不需要更新Boss，由game.js的擦玻璃逻辑驱动

    // 更新特效和粒子
    this._updateEffects();
    this._updateParticles();
  }

  /**
     * 更新跳出动画（emerging 阶段）
     */
  _updateEmerge() {
    this.emergeTimer++;
    const progress = Math.min(1, this.emergeTimer / this.emergeDuration);
    this.boss.emergeProgress = progress;

    // 缓动函数：弹性效果
    const easeOutBack = (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + (c3 * Math.pow(t - 1, 3)) + (c1 * Math.pow(t - 1, 2));
    };

    this.boss.emergeScale = easeOutBack(progress);

    // Boss 从隐藏位置跳到屏幕中央
    this.boss.x = this.boss.hiddenX + ((0.5 - this.boss.hiddenX) * progress);
    this.boss.y = this.boss.hiddenY + ((0.4 - this.boss.hiddenY) * progress);

    // 动画完成，进入战斗阶段
    if (progress >= 1) {
      this.phase = 'fighting';
      this.boss.x = 0.5;
      this.boss.y = 0.4;
      this.boss.emergeScale = 1;
      this._pickNewTarget();

      // 添加"开战"特效
      this.effects.push({
        type: 'found',
        x: 0.5,
        y: 0.3,
        text: window.i18n.t('bossHitIt'),
        life: 1.5,
        vy: -0.0005,
        scale: 1.5
      });
    }
  }

  /**
     * 更新战斗阶段
     */
  _updateFighting() {
    // 更新浮动动画
    this.boss.bobOffset = Math.sin(this.frameCount * this.boss.bobSpeed) * 5;

    // 更新闪烁
    if (this.boss.hitFlash > 0) this.boss.hitFlash--;

    // 更新闪避冷却
    if (this.boss.dodgeCooldown > 0) this.boss.dodgeCooldown--;

    // 更新状态计时器
    if (this.boss.stateTimer > 0) {
      this.boss.stateTimer--;
      if (this.boss.stateTimer <= 0) {
        if (this.boss.state === 'hit' || this.boss.state === 'dodging') {
          this.boss.state = 'moving';
          this._pickNewTarget();
        }
      }
    }

    // 移动 Boss
    if (this.boss.state === 'moving' || this.boss.state === 'dodging') {
      const dx = this.boss.targetX - this.boss.x;
      const dy = this.boss.targetY - this.boss.y;
      const dist = Math.sqrt((dx * dx) + (dy * dy));

      const speed = this.boss.state === 'dodging'
        ? this.boss.speed * 3
        : this.boss.speed * (1 + this.boss.anger);

      if (dist > 0.01) {
        this.boss.x += (dx / dist) * speed;
        this.boss.y += (dy / dist) * speed;
        this.boss.direction = dx > 0 ? 1 : -1;
      } else if (this.boss.state === 'moving') {
        this.boss.state = 'idle';
        this.boss.stateTimer = Math.floor(this.config.moveInterval / 16);
      }
    }

    // idle 状态计时结束后重新移动
    if (this.boss.state === 'idle' && this.boss.stateTimer <= 0) {
      this._pickNewTarget();
    }

    // 连击超时重置
    if (Date.now() - this.lastHitTime > 1500) {
      this.comboHits = 0;
    }
  }

  /**
     * 更新特效
     */
  _updateEffects() {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= 0.02;
      if (e.vy) e.y += e.vy;
      if (e.life <= 0) {
        this.effects.splice(i, 1);
      }
    }
  }

  /**
     * 更新粒子
     */
  _updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.0001;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
     * 渲染 Boss 战场景（阶段二：emerging 和 fighting）
     */
  render() {
    if (!this.isActive) return;
    if (this.phase === 'searching') return; // 阶段一由 glassRenderer 渲染

    if (this.phase === 'emerging' || this.phase === 'fighting') {
      // 清除污渍层，用来绘制Boss
      this.ctx.clearRect(0, 0, this.width, this.height);

      // 绘制 Boss 角色
      this._renderBoss();

      // 绘制特效和粒子（在光标层）
      this._renderEffects();
    }
  }

  /**
     * 渲染 Boss 角色
     */
  _renderBoss() {
    const ctx = this.ctx;

    const bx = this.boss.x * this.width;
    const by = (this.boss.y * this.height) + (this.phase === 'fighting' ? this.boss.bobOffset : 0);
    const size = this.boss.size;
    const dir = this.boss.direction;

    // 跳出动画缩放
    const scale = this.phase === 'emerging' ? this.boss.emergeScale : 1;

    // 受击闪烁
    if (this.boss.hitFlash > 0 && this.boss.hitFlash % 3 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(dir * scale, scale);

    // 阴影
    ctx.beginPath();
    ctx.ellipse(0, size * 0.7, size * 0.5, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // 身体
    const bodyColor = this.boss.hitFlash > 0 ? '#ff4444' : this._getBossColor();
    ctx.beginPath();
    ctx.roundRect(-size * 0.35, -size * 0.1, size * 0.7, size * 0.7, 8);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // BOSS 文字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.2}px 'Noto Sans SC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.scale(dir, 1);
    ctx.fillText('BOSS', 0, size * 0.2);
    ctx.scale(dir, 1);

    // 头部
    const headColor = this.boss.hitFlash > 0 ? '#ffaaaa' : '#ffe0bd';
    ctx.beginPath();
    ctx.arc(0, -size * 0.25, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = headColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 表情
    ctx.scale(dir, 1);
    this._drawBossExpression(ctx, size);
    ctx.scale(dir, 1);

    // 手臂
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = 'round';

    // 左臂
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, size * 0.05);
    if (this.boss.state === 'hit') {
      ctx.lineTo(-size * 0.55, size * 0.3);
    } else if (this.boss.state === 'dodging') {
      ctx.lineTo(-size * 0.6, -size * 0.1);
    } else {
      ctx.lineTo(-size * 0.5, size * 0.15);
    }
    ctx.stroke();

    // 右臂
    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.05);
    if (this.boss.state === 'hit') {
      ctx.lineTo(size * 0.55, size * 0.3);
    } else if (this.boss.state === 'dodging') {
      ctx.lineTo(size * 0.6, -size * 0.1);
    } else {
      ctx.lineTo(size * 0.5, size * 0.15);
    }
    ctx.stroke();

    // 腿
    ctx.strokeStyle = '#445';
    ctx.lineWidth = size * 0.1;
    const legAnim = Math.sin(this.frameCount * 0.1) * (this.boss.state === 'moving' ? 0.15 : 0.03);

    ctx.beginPath();
    ctx.moveTo(-size * 0.15, size * 0.55);
    ctx.lineTo(-(size * 0.2) + (legAnim * size), (size * 0.75));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.15, size * 0.55);
    ctx.lineTo((size * 0.2) - (legAnim * size), (size * 0.75));
    ctx.stroke();

    // 愤怒特效
    if (this.boss.anger > 0.5) {
      this._drawAngerEffect(ctx, size);
    }

    ctx.restore();

    // 血条（仅战斗阶段显示）
    if (this.phase === 'fighting') {
      this._renderHealthBar(ctx, bx, by - (size * (0.55 * scale)));
    }
  }

  /**
     * 获取 Boss 身体颜色
     */
  _getBossColor() {
    const anger = this.boss.anger;
    const r = Math.floor(80 + (anger * 150));
    const g = Math.floor(50 - (anger * 30));
    const b = Math.floor(120 - (anger * 80));
    return `rgb(${r}, ${Math.max(0, g)}, ${Math.max(0, b)})`;
  }

  /**
     * 绘制 Boss 表情
     */
  _drawBossExpression(ctx, size) {
    const state = this.boss.state;
    const anger = this.boss.anger;

    // 跳出阶段：惊讶表情
    if (this.phase === 'emerging') {
      // 大眼睛 O_O
      ctx.fillStyle = '#fff';
      [-1, 1].forEach(side => {
        const ex = side * size * 0.1;
        const ey = -size * 0.28;
        ctx.beginPath();
        ctx.arc(ex, ey, size * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, ey, size * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.fillStyle = '#fff';
      });
      // 张嘴 O
      ctx.beginPath();
      ctx.arc(0, -size * 0.14, size * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = '#800';
      ctx.fill();
      return;
    }

    if (state === 'hit') {
      // 痛苦 X_X
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      const eyeSize = size * 0.06;
      [-1, 1].forEach(side => {
        const ex = side * size * 0.1;
        const ey = -size * 0.28;
        ctx.beginPath();
        ctx.moveTo(ex - eyeSize, ey - eyeSize);
        ctx.lineTo(ex + eyeSize, ey + eyeSize);
        ctx.moveTo(ex + eyeSize, ey - eyeSize);
        ctx.lineTo(ex - eyeSize, ey + eyeSize);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(-size * 0.1, -size * 0.15);
      ctx.quadraticCurveTo(-size * 0.05, -size * 0.12, 0, -size * 0.15);
      ctx.quadraticCurveTo(size * 0.05, -size * 0.18, size * 0.1, -size * 0.15);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (state === 'dodging') {
      // 得意 ^_^
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      [-1, 1].forEach(side => {
        const ex = side * size * 0.1;
        const ey = -size * 0.28;
        ctx.beginPath();
        ctx.arc(ex, ey + (size * 0.03), (size * 0.06), Math.PI, 0);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(0, -size * 0.18, size * 0.08, 0, Math.PI);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 普通/愤怒
      ctx.fillStyle = '#333';
      [-1, 1].forEach(side => {
        const ex = side * size * 0.1;
        const ey = -size * 0.28;
        ctx.beginPath();
        ctx.ellipse(ex, ey, size * 0.05, size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + (size * 0.02), ey - (size * 0.02), (size * 0.015), 0, (Math.PI * 2));
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.fillStyle = '#333';
      });

      if (anger > 0.3) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        [-1, 1].forEach(side => {
          const ex = side * size * 0.1;
          const ey = -size * 0.35;
          ctx.beginPath();
          ctx.moveTo(ex - (side * (size * 0.08)), ey + (size * 0.02));
          ctx.lineTo(ex + (side * (size * 0.08)), ey - (size * 0.02));
          ctx.stroke();
        });
      }

      ctx.beginPath();
      if (anger > 0.6) {
        ctx.arc(0, -size * 0.15, size * 0.08, 0, Math.PI);
        ctx.fillStyle = '#800';
        ctx.fill();
      } else {
        ctx.arc(0, -size * 0.18, size * 0.06, 0.1, Math.PI - 0.1);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  /**
     * 绘制愤怒特效
     */
  _drawAngerEffect(ctx, size) {
    const intensity = (this.boss.anger - 0.5) * 2;
    const count = Math.floor(3 + (intensity * 4));

    for (let i = 0; i < count; i++) {
      const offset = ((i / count) * (Math.PI * 2)) + (this.frameCount * 0.1);
      const fx = Math.cos(offset) * size * 0.2;
      const fy = -(size * 0.45) - (Math.abs(Math.sin((this.frameCount * 0.15) + i)) * (size * 0.15));

      ctx.beginPath();
      ctx.moveTo(fx - 4, fy);
      ctx.quadraticCurveTo(fx, fy - 12 - (intensity * 8), fx + 4, fy);
      ctx.fillStyle = `rgba(255, ${Math.floor(100 + ((Math.random() * 100)))}, 0, ${0.5 + (intensity * 0.3)})`;
      ctx.fill();
    }
  }

  /**
     * 渲染血条
     */
  _renderHealthBar(ctx, x, y) {
    const barWidth = 120;
    const barHeight = 12;
    const hpRatio = this.boss.hp / this.boss.maxHp;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - (barWidth / 2) - 2, y - 2, barWidth + 4, barHeight + 4, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(100, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x - (barWidth / 2), y, barWidth, barHeight, 3);
    ctx.fill();

    const hpColor = hpRatio > 0.5 ? '#4ecdc4' : hpRatio > 0.25 ? '#ffd700' : '#ff4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(x - (barWidth / 2), y, (barWidth * hpRatio), barHeight, 3);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Noto Sans SC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.boss.hp)} / ${this.boss.maxHp}`, x, y + (barHeight / 2));
  }

  /**
     * 渲染特效和粒子
     */
  _renderEffects() {
    const ctx = this.cursorCtx;

    // 绘制粒子
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x * this.width, p.y * this.height, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 绘制特效
    for (const e of this.effects) {
      const ex = e.x * this.width;
      const ey = e.y * this.height;

      ctx.save();
      ctx.globalAlpha = Math.min(1, e.life);

      switch (e.type) {
      case 'damage':
        ctx.font = `bold ${24 * (e.scale || 1)}px Noto Sans SC`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(e.text, ex, ey);
        ctx.fillText(e.text, ex, ey);
        break;

      case 'flash': {
        const flashR = e.radius * this.width * (2 - e.life);
        const flashGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, flashR);
        flashGrad.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        flashGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, flashR, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'combo':
        ctx.font = `bold ${32 * (e.scale || 1)}px Noto Sans SC`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(e.text, ex, ey);
        ctx.fillText(e.text, ex, ey);
        break;

      case 'dodge':
        ctx.font = 'bold 22px Noto Sans SC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#aaa';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(e.text, ex, ey);
        ctx.fillText(e.text, ex, ey);
        break;

      case 'found':
        ctx.font = `bold ${36 * (e.scale || 1)}px Noto Sans SC`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(e.text, ex, ey);
        ctx.fillText(e.text, ex, ey);
        break;
      }

      ctx.restore();
    }
  }

  /**
     * 绘制手掌光标（Boss 战版本 — 拳头/巴掌图标）
     */
  drawCursor(positions, isOpenPalm) {
    const ctx = this.cursorCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 先渲染特效
    this._renderEffects();

    if (!positions || positions.length === 0) return;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const isOpen = isOpenPalm[i];
      const px = pos.x * this.width;
      const py = pos.y * this.height;

      ctx.save();

      if (isOpen) {
        // 张开手掌 — 攻击状态
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 50);
        gradient.addColorStop(0, 'rgba(255, 100, 100, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👋', px, py);
      } else {
        // 握拳 — 非攻击状态
        ctx.font = '32px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✊', px, py);

        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(px, py, 40, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
     * 在背景图上绘制隐藏的Boss轮廓（阶段一用，让玩家有线索）
     * 在背景图加载完成后调用
     */
  drawHiddenBossOnBackground(bgCtx, width, height) {
    if (this.phase !== 'searching') return;
    if (!bgCtx) {
      console.warn('[BossFight] drawHiddenBossOnBackground: bgCtx is null');
      return;
    }

    try {
      const bx = this.boss.hiddenX * width;
      const by = this.boss.hiddenY * height;
      const size = this.boss.size * 1.2;

      bgCtx.save();
      bgCtx.globalAlpha = 0.4; // 半透明，被污渍遮住后更难看到

      // 绘制一个简单的Boss轮廓在背景上
      // 身体
      bgCtx.beginPath();
      bgCtx.roundRect(bx - (size * 0.35), by - (size * 0.1), (size * 0.7), (size * 0.7), 8);
      bgCtx.fillStyle = '#5a2d82';
      bgCtx.fill();

      // 头部
      bgCtx.beginPath();
      bgCtx.arc(bx, by - (size * 0.25), (size * 0.25), 0, (Math.PI * 2));
      bgCtx.fillStyle = '#ffe0bd';
      bgCtx.fill();

      // 眼睛
      bgCtx.fillStyle = '#333';
      [-1, 1].forEach(side => {
        bgCtx.beginPath();
        bgCtx.arc(bx + (side * (size * 0.1)), by - (size * 0.28), (size * 0.05), 0, (Math.PI * 2));
        bgCtx.fill();
      });

      // BOSS 文字
      bgCtx.fillStyle = '#fff';
      bgCtx.font = `bold ${size * 0.18}px 'Noto Sans SC', sans-serif`;
      bgCtx.textAlign = 'center';
      bgCtx.textBaseline = 'middle';
      bgCtx.fillText('BOSS', bx, by + (size * 0.2));

      // 问号提示
      bgCtx.font = `bold ${size * 0.3}px 'Noto Sans SC', sans-serif`;
      bgCtx.fillStyle = '#ffd700';
      bgCtx.fillText('?', bx, by - (size * 0.55));

      bgCtx.restore();
    } catch (err) {
      console.error('[BossFight] drawHiddenBossOnBackground 出错:', err);
    }
  }

  /**
     * 停止 Boss 战
     */
  stop() {
    this.isActive = false;
  }

  /**
     * Boss 是否已被击败
     */
  isDefeated() {
    return this.phase === 'fighting' && this.boss.hp <= 0;
  }

  /**
     * 获取当前阶段
     */
  getPhase() {
    return this.phase;
  }

  /**
     * 获取 Boss 战得分详情
     */
  getScoreDetails() {
    const baseScore = 200;
    const hitBonus = this.hitCount * 5;
    const comboBonus = this.maxCombo * 20;
    const total = baseScore + hitBonus + comboBonus;

    return {
      baseScore,
      hitBonus,
      hitCount: this.hitCount,
      comboBonus,
      maxCombo: this.maxCombo,
      totalScore: total
    };
  }
}

// 导出 BossFight
window.BossFight = BossFight;
