/**
 * game.js — 游戏核心逻辑
 * 管理游戏状态、关卡流程、主循环
 */

class Game {
  constructor() {
    this.handDetector = new HandDetector();
    this.glassRenderer = new GlassRenderer();
    this.scoreManager = new ScoreManager();
    this.uiManager = new UIManager();
    this.bossFight = new BossFight();
    this.sceneManager = new SceneManager();

    // 游戏状态
    this.state = 'idle'; // idle, countdown, playing, bossCountdown, bossSearch, bossEmerge, bossFight, bossComplete, levelComplete, ended
    this.currentLevel = 1;
    this.normalLevelsCleared = 0; // 已通过的普通关卡数（用于判断是否触发 Boss）
    this.bossCount = 0;           // 已打过的 Boss 次数
    this.timeRemaining = 60;
    this.totalTime = 60;
    this.timerInterval = null;
    this.animationFrameId = null;

    // 关卡配置
    this.levels = this._generateLevels();

    // 上一帧手掌位置（用于连线擦除）
    this.lastPalmPositions = [];

    // 收集的图片
    this.galleryImages = [];

    // 摄像头 Canvas
    this.cameraOverlay = null;
    this.cameraOverlayCtx = null;

    // 擦拭音效节流
    this.lastSoundTime = 0;
    this.soundInterval = 150; // 毫秒

    // 进度跟踪
    this.lastProgress = 0;
  }

  /**
     * 生成关卡配置
     */
  _generateLevels() {
    // 使用场景管理系统中的场景配置
    const sceneConfigs = this.sceneManager.sceneConfigs;
        
    return [
      {
        level: 1,
        time: 90,
        dirtType: 'fog',
        dirtOpacity: 0.7,
        brushRadius: 50,
        targetPercent: 55,
        dirtLayers: 1,
        sceneKey: 1,
        imageUrl: null,
        imageName: sceneConfigs[1].name
      },
      {
        level: 2,
        time: 80,
        dirtType: 'fog',
        dirtOpacity: 0.8,
        brushRadius: 45,
        targetPercent: 50,
        dirtLayers: 1,
        sceneKey: 2,
        imageUrl: null,
        imageName: sceneConfigs[2].name
      },
      {
        level: 3,
        time: 70,
        dirtType: 'thick',
        dirtOpacity: 0.85,
        brushRadius: 40,
        targetPercent: 65,
        dirtLayers: 2,
        sceneKey: 3,
        imageUrl: null,
        imageName: sceneConfigs[3].name
      },
      {
        level: 4,
        time: 60,
        dirtType: 'oil',
        dirtOpacity: 0.88,
        brushRadius: 35,
        targetPercent: 75,
        dirtLayers: 3,
        sceneKey: 4,
        imageUrl: null,
        imageName: sceneConfigs[4].name
      },
      {
        level: 5,
        time: 50,
        dirtType: 'mixed',
        dirtOpacity: 0.9,
        brushRadius: 30,
        targetPercent: 85,
        dirtLayers: 2,
        sceneKey: 5,
        imageUrl: null,
        imageName: sceneConfigs[5].name
      },
      {
        level: 6,
        time: 45,
        dirtType: 'mixed',
        dirtOpacity: 0.92,
        brushRadius: 28,
        targetPercent: 90,
        dirtLayers: 3,
        sceneKey: 6,
        imageUrl: null,
        imageName: sceneConfigs[6].name
      }
    ];
  }

  /**
     * 获取当前关卡配置（超过预设关卡数则随机生成）
     */
  _getLevelConfig(levelNum) {
    if (levelNum <= this.levels.length) {
      return this.levels[levelNum - 1];
    }

    // 动态生成更高关卡
    const dirtTypes = ['normal', 'fog', 'thick', 'oil', 'mixed'];
    const dirtType = dirtTypes[Math.floor(Math.random() * dirtTypes.length)];
    // 根据污渍类型决定层数
    const layerMap = { normal: 1, fog: 1, thick: 2, oil: 3, mixed: 3 };
    return {
      level: levelNum,
      time: ((Math.max(25, 60 - ((levelNum - 1) * 5)))),
      dirtType: dirtType,
      dirtOpacity: Math.min(0.95, 0.75 + (levelNum * 0.03)),
      brushRadius: Math.max(22, 45 - (levelNum * 3)),
      targetPercent: Math.min(80, 70 + levelNum),
      dirtLayers: layerMap[dirtType] || 1,
      imageUrl: null,
      imageName: window.i18n.t('levelFormat')(levelNum)
    };
  }

  /**
     * 初始化游戏
     */
  async init() {
    // 初始化 Canvas
    const imageCanvas = document.getElementById('canvas-image');
    const dirtCanvas = document.getElementById('canvas-dirt');
    const cursorCanvas = document.getElementById('canvas-cursor');

    this.glassRenderer.init(imageCanvas, dirtCanvas, cursorCanvas);

    // 摄像头覆盖层 Canvas
    this.cameraOverlay = document.getElementById('camera-overlay');
    this.cameraOverlayCtx = this.cameraOverlay.getContext('2d');

    // 调整尺寸
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // 初始化手部检测
    const videoElement = document.getElementById('hand-video');
    await this.handDetector.init(videoElement);

    // 初始化 Boss 战模块
    this.bossFight.init(imageCanvas, dirtCanvas, cursorCanvas);

    // 设置手部检测回调
    this.handDetector.onResultsCallback = (data) => this._onHandResults(data);

    // 初始化音效
    this.uiManager.initAudio();

    // 更新最高分显示
    this.uiManager.updateHighScore(this.scoreManager.highScore);

    // 设置摄像头预览
    this._setupCameraPreview(videoElement);
  }

  /**
     * 调整 Canvas 尺寸
     */
  _resize() {
    const gameArea = document.getElementById('game-area');
    const windowGlass = document.getElementById('window-glass');
    const width = (windowGlass ? windowGlass.clientWidth : gameArea.clientWidth) || window.innerWidth;
    const height = (windowGlass ? windowGlass.clientHeight : gameArea.clientHeight) || window.innerHeight;

    this.glassRenderer.resize(width, height);

    // 同步 Boss 战尺寸
    this.bossFight.resize(width, height);

    // 摄像头覆盖层尺寸
    if (this.cameraOverlay) {
      this.cameraOverlay.width = 240;
      this.cameraOverlay.height = 180;
    }
  }

  /**
     * 设置摄像头预览
     */
  _setupCameraPreview(videoElement) {
    const previewVideo = document.getElementById('camera-video');

    // 当手部检测视频流就绪时，同步到预览窗口
    videoElement.addEventListener('loadeddata', () => {
      if (videoElement.srcObject) {
        previewVideo.srcObject = videoElement.srcObject;
      }
    });

    // 如果已经有流了
    if (videoElement.srcObject) {
      previewVideo.srcObject = videoElement.srcObject;
    }
  }

  /**
     * 开始游戏
     */
  async startGame() {
    this.state = 'idle';
    this.currentLevel = 1;
    this.normalLevelsCleared = 0;
    this.bossCount = 0;
    this.scoreManager.reset();
    this.galleryImages = [];
    this.lastPalmPositions = [];

    // 切换到游戏界面
    this.uiManager.showScreen('game');

    // 显示加载提示
    this.uiManager.showLoading(window.i18n.t('loadingCamera'));

    try {
      // 启动手部检测
      await this.handDetector.start();
    } catch (err) {
      console.error('[GlassWiper] 摄像头启动失败:', err);
      this.uiManager.hideLoading();
      this.uiManager.showScreen('start');
      throw err;
    }

    this.uiManager.showLoading(window.i18n.t('loadingLevel'));

    // 等待一小段时间让摄像头稳定
    await new Promise(r => setTimeout(r, 500));

    this.uiManager.hideLoading();

    // 开始第一关
    await this._startLevel(this.currentLevel);
  }

  /**
     * 开始指定关卡
     */
  async _startLevel(levelNum) {
    const config = this._getLevelConfig(levelNum);
        
    // 加载场景（异步获取动漫美女图片）
    const scene = await this.sceneManager.loadScene(config.sceneKey || levelNum);
        
    // 将获取到的图片URL设置到关卡配置中
    if (scene && scene.image) {
      config.imageUrl = scene.image;
    } else {
      // 本地图片不存在时，imageUrl 为空，GlassRenderer 会使用渐变色备用
      config.imageUrl = null;
    }
        
    // 更新 HUD
    this.uiManager.updateHUD({
      level: window.i18n.t('levelFormat')(levelNum),
      score: this.scoreManager.score,
      time: config.time,
      progress: 0,
      combo: '',
      sceneName: scene ? scene.name : config.imageName
    });

    // 加载关卡
    await this.glassRenderer.loadLevel(config);
        
    // 重置游戏状态
    this.lastProgress = 0;

    // 倒计时
    this.state = 'countdown';
    await this.uiManager.showCountdown();

    // 开始游戏
    this.state = 'playing';
    this.timeRemaining = config.time;
    this.totalTime = config.time;
    this.lastPalmPositions = [];

    // 启动计时器
    this._startTimer();

    // 启动游戏循环
    this._startGameLoop();
  }

  /**
     * 启动计时器
     */
  _startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.state !== 'playing' && this.state !== 'bossFight' && this.state !== 'bossSearch') return;

      this.timeRemaining -= 1;
      this.uiManager.updateHUD({ time: this.timeRemaining });

      // 最后10秒播放滴答声
      if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
        this.uiManager.playTickSound();
      }

      // 时间耗尽
      if (this.timeRemaining <= 0) {
        this._endGame();
      }
    }, 1000);
  }

  /**
     * 启动游戏主循环
     */
  _startGameLoop() {
    const loop = () => {
      if (this.state !== 'playing') return;

      const currentProgress = this.glassRenderer.cleanedPercent;
                
      // 更新进度
      this.uiManager.updateHUD({
        progress: currentProgress,
        combo: this.scoreManager.getComboText()
      });

      // 更新进度显示
      this.lastProgress = currentProgress;

      // 检查是否过关
      const config = this._getLevelConfig(this.currentLevel);
      if (currentProgress >= config.targetPercent) {
        this._completeLevel();
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
     * 手部检测结果回调
     */
  _onHandResults(data) {
    // Boss 战斗阶段（阶段二）
    if (this.state === 'bossFight') {
      this._onHandResultsBoss(data);
      return;
    }

    // Boss 搜索阶段（阶段一）：复用擦玻璃逻辑
    if (this.state === 'bossSearch') {
      // 和普通擦玻璃一样处理
      this._onHandResultsWipe(data);
      return;
    }

    if (this.state !== 'playing') {
      // 即使不在游戏中，也绘制光标和摄像头覆盖层
      this.glassRenderer.drawCursor(data.palmPositions, data.isOpenPalm);
      this._drawCameraOverlay(data);
      return;
    }

    this._onHandResultsWipe(data);
  }

  /**
     * 擦玻璃手部检测处理（普通关卡和Boss搜索阶段共用）
     */
  _onHandResultsWipe(data) {
    const { palmPositions, isOpenPalm } = data;

    // 绘制手掌光标
    this.glassRenderer.drawCursor(palmPositions, isOpenPalm);

    // 绘制摄像头覆盖层（手部关键点）
    this._drawCameraOverlay(data);

    // 处理擦拭
    for (let i = 0; i < palmPositions.length; i++) {
      if (!isOpenPalm[i]) continue; // 握拳不擦拭

      const pos = palmPositions[i];

      // 如果有上一帧位置，进行连线擦除
      if (this.lastPalmPositions[i]) {
        this.glassRenderer.wipeLine(
          this.lastPalmPositions[i].x,
          this.lastPalmPositions[i].y,
          pos.x,
          pos.y
        );
      } else {
        this.glassRenderer.wipe(pos.x, pos.y);
      }

      // 记录连击
      this.scoreManager.recordWipe();

      // 播放擦拭音效（节流）
      const now = Date.now();
      if (now - this.lastSoundTime > this.soundInterval) {
        this.uiManager.playWipeSound();
        this.lastSoundTime = now;
      }
    }

    // 更新上一帧位置
    this.lastPalmPositions = palmPositions.map((pos, i) => {
      if (isOpenPalm[i]) return { x: pos.x, y: pos.y };
      return null;
    });
  }

  /**
     * Boss 战手部检测回调
     */
  _onHandResultsBoss(data) {
    const { palmPositions, isOpenPalm } = data;

    // 绘制 Boss 战光标
    this.bossFight.drawCursor(palmPositions, isOpenPalm);

    // 绘制摄像头覆盖层
    this._drawCameraOverlay(data);

    // 处理攻击 — 张开手掌才能攻击
    for (let i = 0; i < palmPositions.length; i++) {
      if (!isOpenPalm[i]) continue;

      const pos = palmPositions[i];
      const hit = this.bossFight.checkHit(pos.x, pos.y);

      if (hit) {
        // 播放打击音效
        this.uiManager.playBossHitSound();
      }
    }
  }

  /**
     * 绘制摄像头覆盖层（手部关键点）
     */
  _drawCameraOverlay(data) {
    if (!this.cameraOverlayCtx) return;
    this.handDetector.drawLandmarks(
      this.cameraOverlayCtx,
      this.cameraOverlay.width,
      this.cameraOverlay.height
    );
  }

  /**
     * 关卡完成
     */
  _completeLevel() {
    this.state = 'levelComplete';
    this.normalLevelsCleared++;

    // 停止计时器
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    // 计算分数
    const scoreDetails = this.scoreManager.calculateLevelScore(
      this.glassRenderer.cleanedPercent,
      this.timeRemaining,
      this.totalTime
    );

    // 保存关卡图片到画廊
    const scene = this.sceneManager.getCurrentScene();
    let imageDataUrl = '';
    try {
      imageDataUrl = this.glassRenderer.getImageDataUrl();
    } catch (e) {
      console.warn('[GlassWiper] 无法获取关卡图片:', e.message);
    }
    // 如果 toDataURL 失败或返回空，使用原始图片路径作为备用
    if (!imageDataUrl || imageDataUrl === 'data:,') {
      const config = this._getLevelConfig(this.currentLevel);
      imageDataUrl = config.imageUrl || (scene && scene.image) || '';
    }
    const galleryItem = {
      imageUrl: imageDataUrl,
      sceneName: scene ? scene.name : `${window.i18n.t('hudLevel')} ${this.currentLevel}`,
      level: this.currentLevel,
      progress: this.glassRenderer.cleanedPercent
    };
    this.galleryImages.push(galleryItem);

    // 播放完成音效
    this.uiManager.playCompleteSound();

    // 显示关卡完成界面
    this.uiManager.showLevelComplete(this.glassRenderer.cleanedPercent, scoreDetails);

    // 更新 HUD 分数
    this.uiManager.updateHUD({ score: this.scoreManager.score });

    // 判断下一关是否为 Boss 战（每擦完 2 关普通关卡触发）
    const shouldBoss = this.normalLevelsCleared > 0 && this.normalLevelsCleared % 2 === 0;
    console.log('[GlassWiper] _completeLevel: normalLevelsCleared =', this.normalLevelsCleared, ', shouldBoss =', shouldBoss);

    // 绑定下一关按钮
    const nextBtn = document.getElementById('next-level-btn');
    const handler = async () => {
      try {
        nextBtn.removeEventListener('click', handler);
        this.uiManager.hideLevelComplete();

        if (shouldBoss) {
          // 进入 Boss 战
          await this._startBossFight();
        } else {
          this.currentLevel++;
          await this._startLevel(this.currentLevel);
        }
      } catch (err) {
        console.error('[GlassWiper] 下一关处理出错:', err);
      }
    };
    nextBtn.addEventListener('click', handler);
  }

  // ==================== Boss 战相关方法 ====================

  /**
     * 开始 Boss 战（阶段一：擦玻璃找Boss）
     */
  async _startBossFight() {
    console.log('[GlassWiper] _startBossFight 开始, bossCount:', this.bossCount + 1);
    console.log('[GlassWiper] bossFight 实例:', this.bossFight);
    console.log('[GlassWiper] bossFight 类型:', this.bossFight && this.bossFight.constructor && this.bossFight.constructor.name);
    console.log('[GlassWiper] getSearchLevelConfig 存在?', typeof this.bossFight.getSearchLevelConfig);
    try {
      this.bossCount++;
      this.lastPalmPositions = [];

      // 防御性检查：如果 bossFight 实例异常，重新创建
      if (!this.bossFight || typeof this.bossFight.getSearchLevelConfig !== 'function') {
        console.warn('[GlassWiper] bossFight 实例异常，重新创建');
        this.bossFight = new BossFight();
        // 重新初始化 Canvas 引用
        const imageCanvas = document.getElementById('image-canvas');
        const dirtCanvas = document.getElementById('dirt-canvas');
        const cursorCanvas = document.getElementById('cursor-canvas');
        if (imageCanvas && dirtCanvas && cursorCanvas) {
          this.bossFight.init(imageCanvas, dirtCanvas, cursorCanvas);
        }
      }

      // 根据Boss次数选择不同的Boss场景（boss1=sceneKey 10, boss2=sceneKey 11）
      const bossSceneKey = this.bossCount <= 1 ? 10 : 11;
      const bossScene = await this.sceneManager.loadScene(bossSceneKey);
      console.log('[GlassWiper] Boss场景加载:', bossScene, ', bossSceneKey:', bossSceneKey);
        
      // 调整 Boss 战 Canvas 尺寸
      this.bossFight.resize(this.glassRenderer.width, this.glassRenderer.height);

      // 初始化Boss战（设置难度、隐藏位置等）
      this.bossFight.startFight(this.bossCount);

      // 获取阶段一的擦玻璃配置
      const searchConfig = this.bossFight.getSearchLevelConfig(this.bossCount);
      searchConfig.imageUrl = bossScene.image;
      searchConfig.imageName = bossScene.name;

      // 更新 HUD
      this.uiManager.updateHUD({
        level: `BOSS ${this.bossCount}`,
        score: this.scoreManager.score,
        time: searchConfig.time,
        progress: 0,
        combo: '',
        sceneName: window.i18n.t('bossSearchHint')
      });

      // 直接加载擦玻璃关卡（阶段一），Boss来袭提示延迟到擦出Boss后再显示
      console.log('[GlassWiper] 加载Boss擦玻璃关卡, config:', searchConfig);
      await this.glassRenderer.loadLevel(searchConfig);
      console.log('[GlassWiper] Boss擦玻璃关卡加载完成');

      // 在背景图上绘制隐藏的Boss轮廓
      this.bossFight.drawHiddenBossOnBackground(
        this.glassRenderer.imageCtx,
        this.glassRenderer.width,
        this.glassRenderer.height
      );

      // 进入Boss搜索阶段（复用擦玻璃逻辑）
      this.state = 'bossSearch';
      this.timeRemaining = searchConfig.time;
      this.totalTime = searchConfig.time;
      this.lastProgress = 0;

      // 启动计时器
      this._startTimer();

      // 启动Boss搜索阶段游戏循环
      console.log('[GlassWiper] 启动Boss搜索循环, state:', this.state);
      this._startBossSearchLoop();
    } catch (err) {
      console.error('[GlassWiper] _startBossFight 出错:', err);
    }
  }

  /**
     * Boss 搜索阶段游戏循环（阶段一：擦玻璃找Boss）
     */
  _startBossSearchLoop() {
    const loop = () => {
      if (this.state !== 'bossSearch') return;

      const currentProgress = this.glassRenderer.cleanedPercent;

      // 更新进度
      this.uiManager.updateHUD({
        progress: currentProgress,
        combo: this.scoreManager.getComboText()
      });

      this.lastProgress = currentProgress;

      // 检查是否发现了Boss
      if (this.bossFight.checkBossFound(currentProgress)) {
        this._triggerBossEmerge().catch(err => {
          console.error('[GlassWiper] _triggerBossEmerge 出错:', err);
        });
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
     * 触发Boss跳出（从阶段一切换到阶段二）
     */
  async _triggerBossEmerge() {
    // 停止搜索循环和计时器
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.timerInterval) clearInterval(this.timerInterval);

    // 进入Boss出现阶段
    this.state = 'bossEmerge';

    // 显示 Boss 来袭提示（从擦出Boss后才展示）
    console.log('[GlassWiper] Boss被擦出来了！显示Boss来袭提示...');
    await this.uiManager.showBossIncoming(this.bossCount);
    console.log('[GlassWiper] Boss来袭提示完成');

    // 触发Boss跳出动画
    this.bossFight.triggerBossEmerge();

    // 屏幕震动效果
    const gameScreen = document.getElementById('game-screen');
    gameScreen.classList.add('boss-shake');
    setTimeout(() => gameScreen.classList.remove('boss-shake'), 800);

    // 显示Boss血条
    this.uiManager.showBossHUD(this.bossFight.boss.maxHp);

    // 更新HUD
    this.uiManager.updateHUD({
      sceneName: window.i18n.t('bossFightHint'),
      progress: 0
    });

    // 启动Boss跳出+战斗循环
    this.state = 'bossFight';
    this._startBossGameLoop();
  }

  /**
     * Boss 战游戏循环（阶段二：跳出动画 + 战斗）
     */
  _startBossGameLoop() {
    const loop = () => {
      if (this.state !== 'bossFight') return;

      // 更新 Boss 逻辑
      this.bossFight.update();

      // 渲染 Boss 场景（背景图保留，Boss绘制在污渍层上）
      this.bossFight.render();

      // 更新 Boss 血条 HUD
      if (this.bossFight.getPhase() === 'fighting') {
        this.uiManager.updateBossHUD(this.bossFight.boss.hp, this.bossFight.boss.maxHp);
      }

      // 更新连击显示
      if (this.bossFight.comboHits >= 3) {
        this.uiManager.updateHUD({ combo: window.i18n.t('comboPrefixSuffix')(this.bossFight.comboHits) });
      } else {
        this.uiManager.updateHUD({ combo: '' });
      }

      // 检查 Boss 是否被击败
      if (this.bossFight.isDefeated()) {
        this._completeBossFight();
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
     * Boss 战完成（击败 Boss）
     */
  _completeBossFight() {
    this.state = 'bossComplete';

    // 停止计时器
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    // 停止 Boss 战
    this.bossFight.stop();

    // 计算 Boss 战分数
    const bossScore = this.bossFight.getScoreDetails();
    this.scoreManager.score += bossScore.totalScore;

    // 播放完成音效
    this.uiManager.playCompleteSound();

    // 隐藏 Boss 血条
    this.uiManager.hideBossHUD();

    // 显示 Boss 战完成界面
    this.uiManager.showBossComplete(bossScore, this.timeRemaining);

    // 更新 HUD 分数
    this.uiManager.updateHUD({ score: this.scoreManager.score });

    // 绑定继续按钮
    const nextBtn = document.getElementById('boss-continue-btn');
    const handler = async () => {
      nextBtn.removeEventListener('click', handler);
      this.uiManager.hideBossComplete();
      this.currentLevel++;
      await this._startLevel(this.currentLevel);
    };
    nextBtn.addEventListener('click', handler);
  }

  /**
     * 游戏结束
     */
  _endGame() {
    this.state = 'ended';

    // 停止计时器和游戏循环
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    // 停止 Boss 战（如果在 Boss 战中结束）
    this.bossFight.stop();
    this.uiManager.hideBossHUD();

    // 停止手部检测并释放摄像头流
    this.handDetector.stop();
        
    // 彻底释放摄像头流
    const handVideo = document.getElementById('hand-video');
    if (handVideo && handVideo.srcObject) {
      handVideo.srcObject.getTracks().forEach(track => track.stop());
      handVideo.srcObject = null;
    }
    const cameraVideo = document.getElementById('camera-video');
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }

    // 检查最高分
    this.scoreManager.checkHighScore();

    // 显示结算界面
    this.uiManager.showEndScreen(
      this.scoreManager.score,
      this.currentLevel - 1,
      this.scoreManager.maxCombo,
      this.galleryImages,
      this.sceneManager.getUnlockedScenes()
    );
  }

  /**
     * 重新开始
     */
  async restart() {
    this.uiManager.updateHighScore(this.scoreManager.highScore);
    this.uiManager.showScreen('start');
  }
}
