/**
 * leaderboard.js — 排行榜模块
 * 管理排行榜数据存储和 UI 展示
 */

class Leaderboard {
  constructor() {
    this.storageKey = 'glasswiper_leaderboard';
    this.maxEntries = 20; // 最多保存 20 条记录
    this.entries = this._load();
  }

  /**
     * 提交分数到排行榜
     * @param {string} userId - 用户 ID
     * @param {string} nickname - 用户昵称
     * @param {number} score - 分数
     * @param {number} levels - 通过关卡数
     * @param {number} maxCombo - 最高连击
     * @returns {number} 排名（从 1 开始）
     */
  submitScore(userId, nickname, score, levels, maxCombo) {
    const entry = {
      userId,
      nickname,
      score,
      levels,
      maxCombo,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };

    // 检查是否已有该用户的记录，只保留最高分
    const existingIdx = this.entries.findIndex(e => e.userId === userId);
    if (existingIdx >= 0) {
      if (this.entries[existingIdx].score >= score) {
        // 已有更高分，不更新，返回当前排名
        return this._getRank(userId);
      }
      // 移除旧记录
      this.entries.splice(existingIdx, 1);
    }

    // 插入新记录
    this.entries.push(entry);

    // 按分数降序排序
    this.entries.sort((a, b) => b.score - a.score);

    // 限制条目数
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this._save();

    return this._getRank(userId);
  }

  /**
     * 获取排行榜数据
     * @param {number} limit - 返回条目数
     * @returns {Array} 排行榜条目
     */
  getEntries(limit = 10) {
    return this.entries.slice(0, limit);
  }

  /**
     * 获取用户排名
     * @param {string} userId
     * @returns {number} 排名（从 1 开始），未上榜返回 -1
     */
  _getRank(userId) {
    const idx = this.entries.findIndex(e => e.userId === userId);
    return idx >= 0 ? idx + 1 : -1;
  }

  /**
     * 获取用户的最高分记录
     * @param {string} userId
     * @returns {object|null}
     */
  getUserBest(userId) {
    return this.entries.find(e => e.userId === userId) || null;
  }

  /**
     * 渲染排行榜 HTML
     * @param {string} currentUserId - 当前用户 ID（高亮显示）
     * @returns {string} HTML 字符串
     */
  renderHTML(currentUserId = null) {
    const entries = this.getEntries(10);
    const t = window.i18n.t.bind(window.i18n);

    if (entries.length === 0) {
      return `<div class="leaderboard-empty">${t('leaderboardEmpty')}</div>`;
    }

    let html = '<div class="leaderboard-list">';

    entries.forEach((entry, idx) => {
      const rank = idx + 1;
      const isCurrentUser = entry.userId === currentUserId;
      const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const dateStr = this._formatDate(entry.date);

      html += `
                <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
                    <span class="lb-rank">${rankEmoji}</span>
                    <span class="lb-name">${this._escapeHtml(entry.nickname)}</span>
                    <span class="lb-score">${entry.score}</span>
                    <span class="lb-levels">${t('leaderboardLvPrefix')}${entry.levels}</span>
                    <span class="lb-date">${dateStr}</span>
                </div>
            `;
    });

    html += '</div>';
    return html;
  }

  /**
     * 格式化日期
     */
  _formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return '';
    }
  }

  /**
     * HTML 转义
     */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
     * 从 localStorage 加载排行榜
     */
  _load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
     * 保存排行榜到 localStorage
     */
  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {}
  }
}

// 全局单例
window.leaderboard = new Leaderboard();
