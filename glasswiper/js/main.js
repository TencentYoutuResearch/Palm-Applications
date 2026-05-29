/**
 * main.js — 游戏主入口
 * 初始化游戏并绑定事件
 */

(async function () {
  'use strict';

  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  console.log('🧹 GlassWiper 正在初始化...');

  // 初始化国际化（应用保存的语言偏好到 DOM）
  window.i18n.applyToDOM();

  // 绑定语言切换按钮
  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      window.i18n.toggleLang();
      // 刷新掌纹认证区域的显示状态
      updatePalmAuthUI();
      // 刷新排行榜弹窗（如果打开的话）
      const lbModal = document.getElementById('leaderboard-modal');
      if (lbModal && lbModal.style.display !== 'none') {
        refreshLeaderboardModal();
      }
    });
  }

  // 创建游戏实例
  const game = new Game();

  // 初始化游戏
  let initSuccess = false;
  try {
    await game.init();
    initSuccess = true;
    console.log('✅ 游戏初始化完成');
  } catch (error) {
    console.error('❌ 游戏初始化失败:', error);
    const startBtn = document.getElementById('start-btn');
    const hint = document.querySelector('.camera-hint');
    if (hint) {
      hint.textContent = window.i18n.t('initFailed') + error.message + window.i18n.t('initFailedSuffix');
      hint.style.color = '#ff6b6b';
    }
    startBtn.textContent = window.i18n.t('reloadBtn');
    startBtn.addEventListener('click', () => location.reload());
    return;
  }

  // ==================== 掌纹认证 ====================

  const palmAuth = window.palmAuth;
  const palmLoggedIn = document.getElementById('palm-logged-in');
  const palmLoggedOut = document.getElementById('palm-logged-out');
  const palmWelcomeText = document.getElementById('palm-welcome-text');
  const palmMessage = document.getElementById('palm-message');
  const palmLoginBtn = document.getElementById('palm-login-btn');
  const palmSkipBtn = document.getElementById('palm-skip-btn');
  const palmLogoutBtn = document.getElementById('palm-logout-btn');
  const palmNewUserBtn = document.getElementById('palm-new-user-btn');
  const palmUserSelect = document.getElementById('palm-user-select');

  // 注册弹窗元素
  const registerModal = document.getElementById('palm-register-modal');
  const registerNicknameInput = document.getElementById('palm-nickname-input');
  const registerConfirmBtn = document.getElementById('palm-register-confirm-btn');
  const registerCancelBtn = document.getElementById('palm-register-cancel-btn');
  const registerMessage = document.getElementById('palm-register-message');

  /**
     * 更新掌纹认证区域的 UI 状态
     */
  function updatePalmAuthUI() {
    if (palmAuth.isAuthenticated && palmAuth.currentUser) {
      palmLoggedIn.style.display = 'flex';
      palmLoggedOut.style.display = 'none';
      palmWelcomeText.textContent = window.i18n.t('palmWelcome') + palmAuth.currentUser.nickname;
    } else {
      palmLoggedIn.style.display = 'none';
      palmLoggedOut.style.display = 'flex';
      // 刷新用户下拉列表
      refreshUserSelect();
    }
    palmMessage.style.display = 'none';
  }

  /**
     * 刷新用户下拉列表
     */
  function refreshUserSelect() {
    const users = palmAuth.getRegisteredUsers();
    // 清空已有选项（保留第一个默认选项）
    while (palmUserSelect.options.length > 1) {
      palmUserSelect.remove(1);
    }
    // 填充已注册用户
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.userId;
      opt.textContent = u.nickname;
      palmUserSelect.appendChild(opt);
    });
  }

  /**
     * 显示掌纹消息
     */
  function showPalmMessage(el, text, type = 'info') {
    el.textContent = text;
    el.className = `palm-message ${type}`;
    el.style.display = 'block';
  }

  /**
     * 获取摄像头视频元素
     */
  function getVideoElement() {
    // 优先使用掌纹预览视频（验证/注册时启动的）
    const palmPreviewVideo = document.getElementById('palm-preview-video');
    if (palmPreviewVideo && palmPreviewVideo.srcObject) return palmPreviewVideo;
    const palmRegisterVideo = document.getElementById('palm-register-video');
    if (palmRegisterVideo && palmRegisterVideo.srcObject) return palmRegisterVideo;
    // 其次使用手部检测的视频元素（已经有摄像头流）
    const handVideo = document.getElementById('hand-video');
    if (handVideo && handVideo.srcObject) return handVideo;
    // 备用：摄像头预览
    const cameraVideo = document.getElementById('camera-video');
    if (cameraVideo && cameraVideo.srcObject) return cameraVideo;
    return null;
  }

  /**
     * 启动掌纹摄像头预览
     * @param {string} previewId - 预览容器的 ID
     * @param {string} videoId - video 元素的 ID
     * @returns {Promise<HTMLVideoElement>} 就绪的 video 元素
     */
  async function startPalmCameraPreview(previewId, videoId) {
    const previewContainer = document.getElementById(previewId);
    const videoEl = document.getElementById(videoId);
        
    // 显示预览容器
    previewContainer.style.display = 'block';
        
    // 如果已经有流在运行，直接返回
    if (videoEl.srcObject && videoEl.readyState >= 2) {
      return videoEl;
    }
        
    // 申请摄像头
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    videoEl.srcObject = stream;
    await new Promise(r => videoEl.addEventListener('loadeddata', r, { once: true }));
    await new Promise(r => setTimeout(r, 500)); // 等待画面稳定
    return videoEl;
  }

  /**
     * 停止掌纹摄像头预览
     * @param {string} previewId - 预览容器的 ID
     * @param {string} videoId - video 元素的 ID
     */
  function stopPalmCameraPreview(previewId, videoId) {
    const previewContainer = document.getElementById(previewId);
    const videoEl = document.getElementById(videoId);
        
    previewContainer.style.display = 'none';
        
    if (videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(track => track.stop());
      videoEl.srcObject = null;
    }
  }

  // 初始化掌纹认证 UI
  updatePalmAuthUI();

  // 当用户选择了一个已有用户时，自动启动摄像头预览
  palmUserSelect.addEventListener('change', async () => {
    if (palmUserSelect.value) {
      try {
        await startPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
      } catch (err) {
        console.warn('[PalmAuth] 预览摄像头启动失败:', err.message);
      }
    } else {
      stopPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
    }
  });

  // 掌纹验证按钮（选择已有用户后点击验证）
  palmLoginBtn.addEventListener('click', async () => {
    const selectedUserId = palmUserSelect.value;
    if (!selectedUserId) {
      showPalmMessage(palmMessage, window.i18n.t('palmSelectUserFirst'), 'error');
      return;
    }

    palmLoginBtn.disabled = true;
    palmLoginBtn.textContent = window.i18n.t('palmLoginScanning');

    try {
      // 确保摄像头预览已启动
      const video = await startPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
      await doPalmLogin(video, selectedUserId);
    } catch (err) {
      showPalmMessage(palmMessage, window.i18n.t('palmError') + err.message, 'error');
    } finally {
      palmLoginBtn.disabled = false;
      palmLoginBtn.textContent = window.i18n.t('palmVerifyBtn');
    }
  });

  /**
     * 执行掌纹登录（1:1 比对）
     */
  async function doPalmLogin(video, userId) {
    const result = await palmAuth.authenticate(video, userId);

    if (result.action === 'login') {
      showPalmMessage(palmMessage, `${window.i18n.t('palmLoginSuccess')}${palmAuth.currentUser.nickname} (${window.i18n.t('palmLoginScore')}${result.score})`, 'success');
      // 验证成功后关闭预览
      stopPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
      setTimeout(() => updatePalmAuthUI(), 1500);
    } else if (result.action === 'fail') {
      const score = result.score || 0;
      // score=0 通常意味着算法没在画面里识别到合规手掌，而不是"非本人"
      // 给用户一个更准确、更可行的提示
      if (score === 0) {
        showPalmMessage(palmMessage,
          '⚠️ 未识别到清晰的手掌：请将手心正对摄像头，五指自然张开置于绿色圆圈内，并确保光线充足后重试',
          'error');
      } else {
        showPalmMessage(palmMessage,
          `${window.i18n.t('palmVerifyFail')}${score})`,
          'error');
      }
    }
  }

  // 新用户注册按钮
  palmNewUserBtn.addEventListener('click', async () => {
    registerModal.style.display = 'flex';
    registerNicknameInput.value = '';
    registerNicknameInput.focus();
    registerMessage.style.display = 'none';
    // 关闭验证预览（如果有的话）
    stopPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
    // 启动注册预览摄像头
    try {
      await startPalmCameraPreview('palm-register-preview', 'palm-register-video');
    } catch (err) {
      console.warn('[PalmAuth] 注册预览摄像头启动失败:', err.message);
    }
  });

  // 跳过登录
  palmSkipBtn.addEventListener('click', () => {
    palmMessage.style.display = 'none';
    stopPalmCameraPreview('palm-camera-preview', 'palm-preview-video');
  });

  // 登出
  palmLogoutBtn.addEventListener('click', () => {
    palmAuth.logout();
    updatePalmAuthUI();
  });

  // 注册确认（倒计时3秒后截帧）
  registerConfirmBtn.addEventListener('click', async () => {
    const nickname = registerNicknameInput.value.trim();
    if (!nickname) {
      showPalmMessage(registerMessage, window.i18n.t('palmNicknameEmpty'), 'error');
      return;
    }

    registerConfirmBtn.disabled = true;
    registerCancelBtn.disabled = true;

    try {
      // 确保注册预览摄像头已启动
      const video = await startPalmCameraPreview('palm-register-preview', 'palm-register-video');

      // 3秒倒计时，给用户时间准备好手掌姿势
      for (let i = 3; i > 0; i--) {
        registerConfirmBtn.textContent = `📸 ${i}s 后拍照...`;
        showPalmMessage(registerMessage, `请将手掌对准摄像头，${i} 秒后自动拍照注册`, 'info');
        await new Promise(r => setTimeout(r, 1000));
      }

      registerConfirmBtn.textContent = window.i18n.t('palmRegisterRegistering');
      await palmAuth.registerUser(video, nickname);
      showPalmMessage(registerMessage, window.i18n.t('palmRegisterSuccess'), 'success');
      setTimeout(() => {
        stopPalmCameraPreview('palm-register-preview', 'palm-register-video');
        registerModal.style.display = 'none';
        updatePalmAuthUI();
      }, 1200);
    } catch (err) {
      showPalmMessage(registerMessage, window.i18n.t('palmError') + err.message, 'error');
    } finally {
      registerConfirmBtn.disabled = false;
      registerCancelBtn.disabled = false;
      registerConfirmBtn.textContent = window.i18n.t('palmRegisterBtn');
    }
  });

  // 注册取消
  registerCancelBtn.addEventListener('click', () => {
    stopPalmCameraPreview('palm-register-preview', 'palm-register-video');
    registerModal.style.display = 'none';
  });

  // Enter 键提交注册
  registerNicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registerConfirmBtn.click();
  });

  // ==================== 排行榜 ====================

  const leaderboardBtn = document.getElementById('leaderboard-btn');
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');

  function refreshLeaderboardModal() {
    const content = document.getElementById('leaderboard-content');
    const currentUserId = palmAuth.currentUser ? palmAuth.currentUser.userId : null;
    content.innerHTML = window.leaderboard.renderHTML(currentUserId);
  }

  leaderboardBtn.addEventListener('click', () => {
    refreshLeaderboardModal();
    leaderboardModal.style.display = 'flex';
  });

  leaderboardCloseBtn.addEventListener('click', () => {
    leaderboardModal.style.display = 'none';
  });

  // 点击弹窗背景关闭
  leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) leaderboardModal.style.display = 'none';
  });
  registerModal.addEventListener('click', (e) => {
    if (e.target === registerModal) {
      stopPalmCameraPreview('palm-register-preview', 'palm-register-video');
      registerModal.style.display = 'none';
    }
  });

  // ==================== 游戏启动与结束 ====================

  // 绑定开始按钮
  const startBtn = document.getElementById('start-btn');
  startBtn.addEventListener('click', async () => {
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    startBtn.textContent = window.i18n.t('startingText');

    try {
      if (game.uiManager.audioCtx && game.uiManager.audioCtx.state === 'suspended') {
        await game.uiManager.audioCtx.resume();
      }
      await game.startGame();
    } catch (error) {
      console.error('❌ 启动游戏失败:', error);
      alert(window.i18n.t('startFailedAlert') + error.message);
      game.uiManager.showScreen('start');
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = window.i18n.t('startBtn');
    }
  });

  // 绑定重新开始按钮
  document.getElementById('restart-btn').addEventListener('click', async () => {
    // 确保旧的摄像头流被彻底释放
    const handVideo = document.getElementById('hand-video');
    if (handVideo && handVideo.srcObject) {
      handVideo.srcObject.getTracks().forEach(track => track.stop());
      handVideo.srcObject = null;
    }
    await game.restart();
    updatePalmAuthUI();
  });

  // 监听游戏结束事件，提交分数到排行榜
  // 通过覆盖 game._endGame 来注入排行榜逻辑
  const originalEndGame = game._endGame.bind(game);
  game._endGame = function() {
    originalEndGame();

    // 提交分数到排行榜
    const userId = palmAuth.currentUser ? palmAuth.currentUser.userId : null;
    const nickname = palmAuth.currentUser ? palmAuth.currentUser.nickname : (window.i18n.t('palmSkipBtn'));
    const score = game.scoreManager.score;
    const levels = game.currentLevel - 1;
    const maxCombo = game.scoreManager.maxCombo;

    if (userId) {
      const rank = window.leaderboard.submitScore(userId, nickname, score, levels, maxCombo);

      // 显示排名信息
      const rankInfo = document.getElementById('end-leaderboard-info');
      const rankText = document.getElementById('end-rank-text');
      if (rank > 0) {
        const isNewRecord = (window.leaderboard.getUserBest(userId) && window.leaderboard.getUserBest(userId).score === score);
        let text = `${window.i18n.t('leaderboardYourRank')}${rank}${window.i18n.t('leaderboardYourRankSuffix')}`;
        if (isNewRecord) text += ` ${window.i18n.t('leaderboardNewRecord')}`;
        rankText.textContent = text;
        rankInfo.style.display = 'block';
      }
    }

    // 显示排行榜
    const lbContainer = document.getElementById('end-leaderboard-container');
    lbContainer.innerHTML = window.leaderboard.renderHTML(userId);
  };

  // 阻止右键菜单
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // 关闭弹窗
      if (leaderboardModal.style.display !== 'none') {
        leaderboardModal.style.display = 'none';
        return;
      }
      if (registerModal.style.display !== 'none') {
        registerModal.style.display = 'none';
        return;
      }
      if (game.state === 'playing') {
        game._endGame();
      }
    }
  });

  console.log('🎮 GlassWiper 就绪！点击"开始游戏"按钮开始。');
})();
