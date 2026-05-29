/**
 * score.js — 计分系统
 * 管理分数、连击、时间奖励等
 */

class ScoreManager {
  constructor() {
    this.score = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.maxCombo = 1;
    this.lastWipeTime = 0;
    this.comboTimeout = 800; // 连击超时时间（毫秒）

    this.highScore = this._loadHighScore();
  }

  /**
     * 重置分数
     */
  reset() {
    this.score = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.maxCombo = 1;
    this.lastWipeTime = 0;
  }

  /**
     * 记录一次擦拭动作（用于连击计算）
     */
  recordWipe() {
    const now = Date.now();

    if (now - this.lastWipeTime < this.comboTimeout) {
      this.comboCount++;
      if (this.comboCount >= 30) {
        this.comboMultiplier = 3;
      } else if (this.comboCount >= 15) {
        this.comboMultiplier = 2;
      } else if (this.comboCount >= 5) {
        this.comboMultiplier = 1.5;
      }
    } else {
      this.comboCount = 0;
      this.comboMultiplier = 1;
    }

    this.lastWipeTime = now;
    this.maxCombo = Math.max(this.maxCombo, this.comboMultiplier);
  }

  /**
     * 计算关卡完成分数
     * @param {number} cleanedPercent - 擦除百分比 (0-100)
     * @param {number} remainingTime - 剩余时间（秒）
     * @param {number} totalTime - 总时间（秒）
     * @returns {object} 分数详情
     */
  calculateLevelScore(cleanedPercent, remainingTime, totalTime) {
    // 基础分
    const baseScore = 100;

    // 时间奖励：剩余时间占比 * 50
    const timeBonus = Math.round((remainingTime / totalTime) * 50);

    // 完美奖励
    const perfectBonus = cleanedPercent >= 95 ? 50 : 0;

    // 连击奖励
    const comboBonus = Math.round((this.maxCombo - 1) * 30);

    const totalLevelScore = Math.round(
      (baseScore + timeBonus + perfectBonus + comboBonus) * this.comboMultiplier
    );

    this.score += totalLevelScore;

    return {
      baseScore,
      timeBonus,
      perfectBonus,
      comboBonus,
      multiplier: this.comboMultiplier,
      totalLevelScore,
      totalScore: this.score
    };
  }

  /**
     * 检查并更新最高分
     */
  checkHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore(this.highScore);
      return true;
    }
    return false;
  }

  /**
     * 获取当前连击倍率文本
     */
  getComboText() {
    if (this.comboMultiplier > 1) {
      return `x${this.comboMultiplier}`;
    }
    return '';
  }

  /**
     * 从 localStorage 加载最高分
     */
  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem('glasswiper_highscore') || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
     * 保存最高分到 localStorage
     */
  _saveHighScore(score) {
    try {
      localStorage.setItem('glasswiper_highscore', score.toString());
    } catch {
      // 忽略存储错误
    }
  }
}
