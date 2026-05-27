/**
 * palm-auth.js — 掌纹认证模块
 * 通过本地代理服务器访问掌纹 API，提供掌纹注册、比对功能
 * 本地代理: /api/palm/{Action} -> 网关转发
 * Token 由服务端管理，前端无需关心认证
 */

class PalmAuth {
  constructor() {
    // 自动检测路径前缀（支持部署到子路径，如 /palm-glasswiper）
    const basePath = window.GLASSWIPER_BASE_PATH || '';
    this.apiBase = `${basePath}/api/palm`;

    // 当前用户状态
    this.currentUser = this._loadUser();
    this.isAuthenticated = !!this.currentUser;
  }

  // ==================== 掌纹 API ====================

  /**
     * 调用掌纹 API（通用方法）
     * 占位实现：请替换为你的刷掌识别算法服务调用
     * @param {string} action - API 动作名称（如 RegisterRgbPalm、CompareRgbPalm、SearchRgbPalm）
     * @param {object} body - 请求体
     */
  async _callPalmApi(action, body) {
    console.log(`[PalmAuth] 🖐️ 你的刷掌识别算法 - ${action}（占位实现）`);

    // ============================================================
    // 占位实现：此处应替换为你的刷掌识别算法服务调用
    // 示例：通过本地代理服务器转发到你的掌纹识别后台
    //
    // const url = `${this.apiBase}/${action}`;
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'X-API-Key': '你的API Key' },
    //   body: JSON.stringify(body)
    // });
    // return await response.json();
    // ============================================================

    // 模拟返回结果（不做实际网络请求）
    if (action === 'RegisterRgbPalm') {
      return { PalmId: 'placeholder_palm_id', code: 0, message: '🖐️ 你的刷掌识别算法（占位响应）' };
    } else if (action === 'CompareRgbPalm') {
      return { IsMatch: false, Score: 0, code: 0, message: '🖐️ 你的刷掌识别算法（占位响应）' };
    } else if (action === 'SearchRgbPalm') {
      return { UserId: null, Score: 0, code: 0, message: '🖐️ 你的刷掌识别算法（占位响应）' };
    }
    return { code: 0, message: '🖐️ 你的刷掌识别算法（占位响应）', data: {} };
  }

  /**
     * 注册掌纹 — 将手掌图片绑定到指定用户
     * @param {string} userId - 用户唯一标识
     * @param {string} imageBase64 - RGB 图片的 base64 数据
     * @returns {Promise<{PalmId: string}>}
     */
  async registerPalm(userId, imageBase64) {
    console.log('[PalmAuth] 注册掌纹, userId:', userId);
    console.log('[PalmAuth] 图片数据长度:', imageBase64.length, '字符');
    console.log('[PalmAuth] 图片数据前20字符:', imageBase64.substring(0, 20));
    // 估算图片大小（base64 编码后约为原始大小的 4/3）
    const estimatedSizeKB = Math.round(imageBase64.length * 3 / 4 / 1024);
    console.log('[PalmAuth] 估算图片大小:', estimatedSizeKB, 'KB');
    return await this._callPalmApi('RegisterRgbPalm', {
      UserId: userId,
      RgbImage: {
        Data: imageBase64,
        ImageType: 1
      },
      IsForce: true,
      AlgorithmStrategy: 2
    });
  }

  /**
     * 比对掌纹 — 1:1 验证是否是指定用户
     * @param {string} userId - 待比对的用户 ID
     * @param {string} imageBase64 - RGB 图片的 base64 数据
     * @returns {Promise<{IsMatch: boolean, Score: number}>}
     */
  async comparePalm(userId, imageBase64) {
    console.log('[PalmAuth] 比对掌纹, userId:', userId);
    return await this._callPalmApi('CompareRgbPalm', {
      RgbImage: {
        Data: imageBase64,
        ImageType: 1
      },
      CompareUserId: userId,
      // 必须与注册时使用同一个算法策略，否则特征空间不一致，分数永远为 0
      AlgorithmStrategy: 2
    });
  }

  // ==================== 摄像头截图 ====================

  /**
     * 从摄像头视频流截取一帧图片，返回 base64 数据
     *
     * 重要：CSS 中视频预览使用 `transform: scaleX(-1)` 做了镜像翻转，
     * 这样用户能像照镜子一样自然地把手摆正。但默认 drawImage 抽到的
     * 是原始未翻转的画面 —— 这会导致：
     *   注册时用户依据镜像摆手 → 实际上传左右翻转过的图
     *   登录时若用户姿态略有差异 → 与注册特征对不上 → Score=0
     *
     * 因此必须对抽帧做同样的水平翻转，使"算法收到的画面 = 用户看到的画面"。
     *
     * @param {HTMLVideoElement} videoElement - 摄像头视频元素
     * @param {object} [options]
     * @param {boolean} [options.mirror=true] - 是否水平镜像翻转，默认 true 与 CSS 保持一致
     * @param {number}  [options.maxSize=720] - 最长边压缩到该像素，提升上传速度并保持算法精度
     * @param {number}  [options.quality=0.92] - JPEG 压缩质量
     * @returns {string} base64 编码的图片数据（不含 data:image/jpeg;base64, 前缀）
     */
  captureFrame(videoElement, options = {}) {
    const {
      mirror = true,
      maxSize = 720,
      quality = 0.92
    } = options;

    if (!videoElement || !videoElement.videoWidth) {
      throw new Error('摄像头未就绪');
    }

    const srcW = videoElement.videoWidth;
    const srcH = videoElement.videoHeight;

    // 等比缩放（最长边不超过 maxSize），既保留细节又减少上传体积
    const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d');

    if (mirror) {
      // 与 CSS 的 scaleX(-1) 一致：让算法收到与屏幕相同的镜像画面
      ctx.translate(dstW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoElement, 0, 0, dstW, dstH);

    // 简单的亮度自检：避免上传一张全黑/极暗的图
    try {
      const sample = ctx.getImageData(
        Math.floor(dstW * 0.25), Math.floor(dstH * 0.25),
        Math.max(1, Math.floor(dstW * 0.5)), Math.max(1, Math.floor(dstH * 0.5))
      );
      let sum = 0, n = 0;
      for (let i = 0; i < sample.data.length; i += 16) { // 每 4 个像素采样一次
        sum += sample.data[i] + sample.data[i + 1] + sample.data[i + 2];
        n++;
      }
      const avg = sum / (n * 3);
      console.log(`[PalmAuth] 图像质量检测: 尺寸=${dstW}x${dstH}, 亮度均值=${avg.toFixed(1)}`);
      if (avg < 25) {
        throw new Error('画面过暗，请到光线明亮处再试');
      }
    } catch (e) {
      // 亮度检测异常不阻断流程（仅日志），但若是我们主动抛出的提示则透传
      if (e && e.message && e.message.indexOf('过暗') !== -1) throw e;
      console.warn('[PalmAuth] 亮度检测失败（已忽略）:', e && e.message);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl.split(',')[1];
  }

  // ==================== 用户状态管理 ====================

  /**
     * 掌纹登录流程：通过 1:1 比对验证指定用户身份
     * @param {HTMLVideoElement} videoElement - 摄像头视频元素
     * @param {string} userId - 要验证的用户 ID
     * @returns {Promise<{action: 'login'|'fail', userId?: string, score?: number}>}
     */
  async authenticate(videoElement, userId) {
    const imageBase64 = this.captureFrame(videoElement);

    // 1:1 比对
    const result = await this.comparePalm(userId, imageBase64);

    // 兼容不同返回格式的字段名
    const isMatch = result.IsMatch ?? result.is_match ?? result.isMatch ?? false;
    const score = result.Score ?? result.score ?? 0;

    if (isMatch) {
      // 比对成功，登录
      const nickname = this._loadNickname(userId) || userId;
      this.currentUser = {
        userId: userId,
        nickname: nickname,
        palmScore: score
      };
      this.isAuthenticated = true;
      this._saveUser(this.currentUser);
      console.log('[PalmAuth] 掌纹验证成功:', this.currentUser);
      return { action: 'login', userId: userId, score: score };
    } else {
      console.log('[PalmAuth] 掌纹验证失败, score:', score);
      return { action: 'fail', score: score };
    }
  }

  /**
     * 注册新用户
     * @param {HTMLVideoElement} videoElement - 摄像头视频元素
     * @param {string} nickname - 用户昵称
     * @returns {Promise<{userId: string, palmId: string}>}
     */
  async registerUser(videoElement, nickname) {
    const imageBase64 = this.captureFrame(videoElement);

    // 生成用户 ID（使用昵称 + 时间戳的简短哈希）
    const userId = this._generateUserId(nickname);

    const result = await this.registerPalm(userId, imageBase64);

    // PalmId 可能在不同网关返回格式中位置不同，健壮处理
    const palmId = result.PalmId || result.palm_id || result.palmId || 'registered';

    this.currentUser = {
      userId: userId,
      nickname: nickname,
      palmId: palmId
    };
    this.isAuthenticated = true;
    this._saveUser(this.currentUser);
    this._saveNickname(userId, nickname);

    console.log('[PalmAuth] 注册成功:', this.currentUser);
    return { userId, palmId };
  }

  /**
     * 登出
     */
  logout() {
    this.currentUser = null;
    this.isAuthenticated = false;
    try {
      localStorage.removeItem('glasswiper_current_user');
    } catch {}
  }

  /**
     * 生成用户 ID（直接使用昵称的字母数字部分）
     */
  _generateUserId(nickname) {
    return nickname.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32) || 'user';
  }

  /**
     * 获取所有已注册用户列表（从本地存储）
     * @returns {Array<{userId: string, nickname: string}>}
     */
  getRegisteredUsers() {
    try {
      const map = JSON.parse(localStorage.getItem('glasswiper_nicknames') || '{}');
      return Object.entries(map).map(([userId, nickname]) => ({ userId, nickname }));
    } catch {
      return [];
    }
  }

  // ==================== 本地存储 ====================

  _saveUser(user) {
    try {
      localStorage.setItem('glasswiper_current_user', JSON.stringify(user));
    } catch {}
  }

  _loadUser() {
    try {
      const data = localStorage.getItem('glasswiper_current_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  _saveNickname(userId, nickname) {
    try {
      const map = JSON.parse(localStorage.getItem('glasswiper_nicknames') || '{}');
      map[userId] = nickname;
      localStorage.setItem('glasswiper_nicknames', JSON.stringify(map));
    } catch {}
  }

  _loadNickname(userId) {
    try {
      const map = JSON.parse(localStorage.getItem('glasswiper_nicknames') || '{}');
      return map[userId] || null;
    } catch {
      return null;
    }
  }
}

/**
 * 掌纹 API 错误类
 */
class PalmApiError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.palmMessage = message;
  }
}

// 全局单例
window.palmAuth = new PalmAuth();
