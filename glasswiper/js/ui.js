/**
 * ui.js — UI 管理模块
 * 负责界面切换、HUD 更新、音效播放
 */

class UIManager {
  constructor() {
    // 界面元素
    this.screens = {
      start: document.getElementById('start-screen'),
      game: document.getElementById('game-screen'),
      end: document.getElementById('end-screen')
    };

    // HUD 元素
    this.hud = {
      level: document.getElementById('hud-level'),
      score: document.getElementById('hud-score'),
      time: document.getElementById('hud-time'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      comboContainer: document.getElementById('hud-combo'),
      comboText: document.getElementById('combo-text')
    };

    // 覆盖层
    this.overlays = {
      countdown: document.getElementById('countdown-overlay'),
      countdownNumber: document.getElementById('countdown-number'),
      levelComplete: document.getElementById('level-complete-overlay'),
      completePercent: document.getElementById('complete-percent'),
      completeScore: document.getElementById('complete-score'),
      completeBonus: document.getElementById('complete-bonus'),
      bossIncoming: document.getElementById('boss-incoming-overlay'),
      bossComplete: document.getElementById('boss-complete-overlay'),
    };

    // 结算界面
    this.endElements = {
      score: document.getElementById('end-score'),
      levels: document.getElementById('end-levels'),
      combo: document.getElementById('end-combo'),
      gallery: document.getElementById('gallery-container')
    };

    // 音效上下文
    this.audioCtx = null;
    this.sounds = {};
  }

  /**
     * 初始化音效系统
     */
  initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this._createSounds();
    } catch (e) {
      console.warn('音效系统初始化失败:', e);
    }
  }

  /**
     * 创建合成音效
     */
  _createSounds() {
    // 使用 Web Audio API 合成简单音效，无需加载外部文件
  }

  /**
     * 播放擦拭音效
     */
  playWipeSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      ((osc.frequency.setValueAtTime(800 + (Math.random() * 400))), this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.audioCtx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.1);
    } catch (e) {
      // 忽略音效错误
    }
  }

  /**
     * 播放完成音效
     */
  playCompleteSound() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + (i * 0.15));

        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime + (i * 0.15));
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (i * 0.15) + 0.4);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(this.audioCtx.currentTime + (i * 0.15));
        osc.stop(this.audioCtx.currentTime + (i * 0.15) + 0.4);
      });
    } catch (e) {
      // 忽略音效错误
    }
  }

  /**
     * 播放倒计时音效
     */
  playCountdownBeep() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch (e) {
      // 忽略
    }
  }

  /**
     * 播放时间警告音效
     */
  playTickSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.03, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      // 忽略
    }
  }

  /**
     * 播放 Boss 受击音效
     */
  playBossHitSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch (e) {
      // 忽略
    }
  }

  /**
     * 播放解锁音效
     */
  playUnlockSound() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + (i * 0.1));

        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime + (i * 0.1));
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (i * 0.1) + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(this.audioCtx.currentTime + (i * 0.1));
        osc.stop(this.audioCtx.currentTime + (i * 0.1) + 0.3);
      });
    } catch (e) {
      // 忽略
    }
  }

  /**
     * 显示场景元素解锁
     */
  showElementUnlock(element) {
    // 创建解锁提示元素
    const unlockDiv = document.createElement('div');
    unlockDiv.className = 'element-unlock';
    unlockDiv.innerHTML = `
            <div class="unlock-icon">✨</div>
            <div class="unlock-text">${window.i18n.t('discoverPrefix')}${element.name}${window.i18n.t('discoverSuffix')}</div>
        `;
        
    // 添加到游戏区域
    const gameArea = document.getElementById('game-area');
    gameArea.appendChild(unlockDiv);
        
    // 动画效果
    unlockDiv.style.animation = 'unlock-fade-in 2s ease forwards';
        
    // 2秒后移除
    setTimeout(() => {
      if (unlockDiv.parentNode) {
        unlockDiv.parentNode.removeChild(unlockDiv);
      }
    }, 2000);
  }

  /**
     * 显示 Boss 来袭提示
     */
  showBossIncoming(bossNum) {
    return new Promise((resolve) => {
      const overlay = this.overlays.bossIncoming;
      const title = document.getElementById('boss-incoming-title');
      const subtitle = document.getElementById('boss-incoming-subtitle');

      title.textContent = window.i18n.t('bossIncomingTitle');
      subtitle.textContent = window.i18n.t('bossIncomingSubtitle');

      overlay.style.display = 'flex';
      overlay.classList.add('boss-shake');

      // 播放 Boss 来袭音效
      this._playBossIncomingSound();

      setTimeout(() => {
        overlay.classList.remove('boss-shake');
        overlay.style.display = 'none';
        resolve();
      }, 2500);
    });
  }

  /**
     * 播放 Boss 来袭音效
     */
  _playBossIncomingSound() {
    if (!this.audioCtx) return;
    try {
      // 低沉的警告音
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, this.audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(60, this.audioCtx.currentTime + 1);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, this.audioCtx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 2);
    } catch (e) {
      // 忽略
    }
  }

  /**
     * 显示 Boss 血条 HUD
     */
  showBossHUD(maxHp) {
    const hud = document.getElementById('boss-hud');
    hud.style.display = 'flex';
    this.updateBossHUD(maxHp, maxHp);
  }

  /**
     * 更新 Boss 血条 HUD
     */
  updateBossHUD(currentHp, maxHp) {
    const fill = document.getElementById('boss-hp-fill');
    const text = document.getElementById('boss-hp-text');
    const ratio = Math.max(0, currentHp / maxHp);

    fill.style.width = `${ratio * 100}%`;

    // 血条颜色变化
    if (ratio > 0.5) {
      fill.style.background = 'linear-gradient(90deg, #ff4444, #ff6b6b)';
    } else if (ratio > 0.25) {
      fill.style.background = 'linear-gradient(90deg, #ffa500, #ffd700)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
      fill.style.animation = 'pulse 0.5s ease infinite';
    }

    text.textContent = `${Math.ceil(currentHp)} / ${maxHp}`;
  }

  /**
     * 隐藏 Boss 血条 HUD
     */
  hideBossHUD() {
    const hud = document.getElementById('boss-hud');
    if (hud) hud.style.display = 'none';
  }

  /**
     * 显示 Boss 战完成界面
     */
  showBossComplete(scoreDetails, timeRemaining) {
    const overlay = this.overlays.bossComplete;
    document.getElementById('boss-complete-hits').textContent = scoreDetails.hitCount;
    document.getElementById('boss-complete-combo').textContent = scoreDetails.maxCombo;
    document.getElementById('boss-complete-score').textContent = scoreDetails.totalScore;

    let bonusText = `${window.i18n.t('bossHitBonusLabel')} +${scoreDetails.hitBonus}`;
    if (scoreDetails.comboBonus > 0) bonusText += `  ${window.i18n.t('bossComboBonus')} +${scoreDetails.comboBonus}`;
    if (timeRemaining > 0) bonusText += `  ${window.i18n.t('bossTimeRemaining')} ${Math.ceil(timeRemaining)} ${window.i18n.t('bossSeconds')}`;
    document.getElementById('boss-complete-bonus').textContent = bonusText;

    overlay.style.display = 'flex';
  }

  /**
     * 隐藏 Boss 战完成界面
     */
  hideBossComplete() {
    this.overlays.bossComplete.style.display = 'none';
  }

  /**
     * 切换界面
     */
  showScreen(screenName) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (this.screens[screenName]) {
      this.screens[screenName].classList.add('active');
    }

    // 窗框和装饰元素只在游戏界面显示，其他界面隐藏
    const windowFrame = document.querySelector('.window-frame');
    const windowSill = document.querySelector('.window-sill');
    const curtainLeft = document.querySelector('.curtain.left');
    const curtainRight = document.querySelector('.curtain.right');

    const showDecorations = (screenName === 'game');
    [windowFrame, windowSill, curtainLeft, curtainRight].forEach(el => {
      if (el) el.style.display = showDecorations ? '' : 'none';
    });
  }

  /**
     * 更新 HUD
     */
  updateHUD(data) {
    if (data.level !== undefined) {
      this.hud.level.textContent = data.level;
    }
    if (data.score !== undefined) {
      this.hud.score.textContent = data.score;
    }
    if (data.time !== undefined) {
      this.hud.time.textContent = Math.ceil(data.time);
      // 最后10秒警告
      if (data.time <= 10) {
        this.hud.time.classList.add('warning');
      } else {
        this.hud.time.classList.remove('warning');
      }
    }
    if (data.progress !== undefined) {
      this.hud.progressFill.style.width = `${Math.min(100, data.progress)}%`;
      this.hud.progressText.textContent = `${data.progress}%`;
    }
    if (data.combo !== undefined && data.combo !== '') {
      this.hud.comboContainer.style.display = 'block';
      this.hud.comboText.textContent = data.combo;
    } else if (data.combo === '') {
      this.hud.comboContainer.style.display = 'none';
    }
  }

  /**
     * 显示倒计时
     */
  showCountdown() {
    return new Promise((resolve) => {
      this.overlays.countdown.style.display = 'flex';
      let count = 3;

      const tick = () => {
        if (count > 0) {
          this.overlays.countdownNumber.textContent = count;
          this.overlays.countdownNumber.style.animation = 'none';
          // 触发重排以重新播放动画
          void this.overlays.countdownNumber.offsetWidth;
          this.overlays.countdownNumber.style.animation = 'countdown-pop 1s ease';
          this.playCountdownBeep();
          count--;
          setTimeout(tick, 1000);
        } else {
          this.overlays.countdownNumber.textContent = 'GO!';
          this.overlays.countdownNumber.style.animation = 'none';
          void this.overlays.countdownNumber.offsetWidth;
          this.overlays.countdownNumber.style.animation = 'countdown-pop 1s ease';
          setTimeout(() => {
            this.overlays.countdown.style.display = 'none';
            resolve();
          }, 800);
        }
      };

      tick();
    });
  }

  /**
     * 显示关卡完成
     */
  showLevelComplete(percent, scoreDetails) {
    this.overlays.completePercent.textContent = percent;
    this.overlays.completeScore.textContent = scoreDetails.totalLevelScore;

    let bonusText = '';
    if (scoreDetails.timeBonus > 0) bonusText += `${window.i18n.t('timeBonusLabel')} +${scoreDetails.timeBonus}  `;
    if (scoreDetails.perfectBonus > 0) bonusText += `${window.i18n.t('perfectBonusLabel')} +${scoreDetails.perfectBonus}  `;
    if (scoreDetails.comboBonus > 0) bonusText += `${window.i18n.t('comboBonusLabel')} +${scoreDetails.comboBonus}`;
    this.overlays.completeBonus.textContent = bonusText;

    this.overlays.levelComplete.style.display = 'flex';
  }

  /**
     * 隐藏关卡完成
     */
  hideLevelComplete() {
    this.overlays.levelComplete.style.display = 'none';
  }

  /**
     * 显示结算界面
     */
  showEndScreen(totalScore, levelsCleared, maxCombo, galleryImages, unlockedScenes = []) {
    this.endElements.score.textContent = totalScore;
    this.endElements.levels.textContent = levelsCleared;
    this.endElements.combo.textContent = `x${maxCombo}`;

    // 重置排行榜区域
    const rankInfo = document.getElementById('end-leaderboard-info');
    if (rankInfo) rankInfo.style.display = 'none';
    const lbContainer = document.getElementById('end-leaderboard-container');
    if (lbContainer) lbContainer.innerHTML = '';

    // 清空并填充画廊
    this.endElements.gallery.innerHTML = '';
    galleryImages.forEach(galleryItem => {
      // 跳过没有有效图片的项
      if (!galleryItem.imageUrl) return;
            
      const div = document.createElement('div');
      div.className = 'gallery-item';
            
      const img = document.createElement('img');
      img.src = galleryItem.imageUrl;
      img.alt = galleryItem.sceneName || '';
      // 图片加载失败时隐藏该项
      img.onerror = () => { div.style.display = 'none'; };
            
      div.appendChild(img);
      this.endElements.gallery.appendChild(div);
    });

    this.showScreen('end');
  }

  /**
     * 显示关卡统计
     */
  _showSceneStats(unlockedScenes) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'scene-stats';
        
    let statsHTML = `<h3>${window.i18n.t('sceneStatsTitle')}</h3><div class="scene-progress">`;
        
    unlockedScenes.forEach(scene => {
      const progress = scene.completionThreshold;
      statsHTML += `
                <div class="scene-item">
                    <div class="scene-name">${scene.name}</div>
                    <div class="scene-bar">
                        <div class="scene-fill" style="width: ${progress}%"></div>
                        <span class="scene-text">${window.i18n.t('sceneTargetPrefix')}${progress}%</span>
                    </div>
                </div>
            `;
    });
        
    statsHTML += '</div>';
    statsDiv.innerHTML = statsHTML;
        
    // 插入到画廊之前
    const gallery = document.getElementById('end-gallery');
    gallery.parentNode.insertBefore(statsDiv, gallery);
  }

  /**
     * 更新开始界面的最高分
     */
  updateHighScore(score) {
    document.getElementById('high-score').textContent = score;
  }

  /**
     * 显示加载提示
     */
  showLoading(text) {
    if (!text) text = window.i18n.t('loadingDefault');
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'overlay';
      overlay.style.cssText = 'display:flex;z-index:9999;background:rgba(0,0,0,0.7);';
      overlay.innerHTML = `
                <div style="text-align:center;color:#fff;">
                    <div class="loading-spinner" style="
                        width:50px;height:50px;margin:0 auto 20px;
                        border:4px solid rgba(255,255,255,0.3);
                        border-top:4px solid #4ecdc4;
                        border-radius:50%;
                        animation:spin 1s linear infinite;
                    "></div>
                    <p id="loading-text" style="font-size:18px;">${text}</p>
                </div>
            `;
      // 添加旋转动画样式
      if (!document.getElementById('loading-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'loading-spinner-style';
        style.textContent = '@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
        document.head.appendChild(style);
      }
      document.getElementById('game-screen').appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
      const textEl = document.getElementById('loading-text');
      if (textEl) textEl.textContent = text;
    }
  }

  /**
     * 隐藏加载提示
     */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}
