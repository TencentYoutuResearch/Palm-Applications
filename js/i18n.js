/**
 * i18n.js — 国际化模块
 * 管理中英文切换
 */

class I18n {
  constructor() {
    // 从 localStorage 读取用户语言偏好，默认中文
    this.currentLang = this._loadLang();
    this.translations = this._initTranslations();
  }

  /**
     * 初始化所有翻译文本
     */
  _initTranslations() {
    return {
      zh: {
        // 页面标题
        pageTitle: 'GlassWiper 🧹 体感擦玻璃小游戏',

        // 开始界面
        gameSubtitle: '窗户清洁大冒险',
        instructionOpenPalm: '张开手掌对准摄像头',
        instructionWipe: '移动手掌擦除窗户污渍',
        instructionFist: '握拳暂停擦拭',
        instructionDiscover: '发现窗外精彩场景！',
        highScoreLabel: '🏆 历史最高分：',
        startBtn: '开始冒险',
        cameraHint: '* 需要授权摄像头使用权限',

        // HUD
        hudLevel: '关卡',
        hudScore: '分数',
        hudTime: '时间',
        hudProgress: '擦除进度',
        cameraLabel: '📷 摄像头',

        // 关卡完成
        levelCompleteTitle: '✨ 关卡完成！',
        wipedArea: '擦除面积：',
        earnedScore: '获得分数：',
        nextLevelBtn: '下一关',
        timeBonusLabel: '⏱️ 时间奖励',
        perfectBonusLabel: '✨ 完美奖励',
        comboBonusLabel: '🔥 连击奖励',

        // Boss 战
        bossIncomingTitle: '👾 BOSS 来袭！',
        bossIncomingSubtitle: '把它擦出来，用手掌扣它！',
        bossDefeatedTitle: '🎉 Boss 已击败！',
        bossHitCount: '打击次数',
        bossMaxCombo: '最高连击',
        bossEarnedScore: '获得分数：',
        bossContinueBtn: '继续擦玻璃',
        bossHudLabel: '👾 BOSS',
        bossHitBonusLabel: '👊 打击奖励',
        bossComboBonus: '🔥 连击奖励',
        bossTimeRemaining: '⏱️ 剩余',
        bossSeconds: '秒',

        // 结算界面
        gameOverTitle: '🎉 游戏结束',
        totalScore: '总分',
        levelsPassed: '通过关卡',
        maxCombo: '最高连击',
        galleryTitle: '🖼️ 揭示的隐藏图片',
        restartBtn: '再来一局',

        // 加载
        loadingDefault: '加载中...',
        loadingCamera: '正在启动摄像头...',
        loadingLevel: '正在加载关卡...',
        startingText: '正在启动...',

        // 错误
        initFailed: '⚠️ 初始化失败: ',
        initFailedSuffix: '（请检查网络和摄像头权限后刷新页面）',
        reloadBtn: '重新加载',
        startFailedAlert: '启动游戏失败，请确保已授权摄像头权限。\n\n错误信息: ',

        // 关卡名称
        levelPrefix: '第',
        levelSuffix: '关',
        levelFormat: (n) => `第${n}关`,

        // Boss 战特效文本
        bossFound: '发现 BOSS！',
        bossHitIt: '用手掌扣它！',
        comboPrefixSuffix: (n) => `${n} 连击！`,
        dodge: '闪避！',
        bossSearchHint: '🔍 寻找 BOSS',
        bossFightHint: '⚔️ BOSS 战！',
        bossHiddenLevel: 'BOSS 隐藏关',

        // 场景名称
        sceneName1: '樱花少女',
        sceneName2: '星空美少女',
        sceneName3: '海边少女',
        sceneName4: '月夜美人',
        sceneName5: '花园公主',
        sceneName6: '魔法少女',
        sceneBoss1: '暗黑女王',
        sceneBoss2: '深渊魔女',
        sceneDesc1: '擦亮窗户，邂逅樱花树下的少女',
        sceneDesc2: '星空下的动漫美少女在等你',
        sceneDesc3: '海风吹拂，少女的裙摆飘扬',
        sceneDesc4: '月光下的神秘美人若隐若现',
        sceneDesc5: '花园中的公主正在等待你的到来',
        sceneDesc6: '拥有神秘力量的魔法少女现身',
        sceneDescBoss1: '窗外出现了强大的暗黑女王！',
        sceneDescBoss2: '深渊中的魔女降临了！',

        // 场景统计
        sceneStatsTitle: '🏆 关卡完成情况',
        sceneTargetPrefix: '目标 ',

        // 元素解锁
        discoverPrefix: '发现 ',
        discoverSuffix: '！',

        // 语言切换按钮
        langBtnText: 'EN',

        // 掌纹认证
        palmLoginTitle: '🤚 掌纹登录',
        palmLoginDesc: '将手掌对准摄像头，识别身份',
        palmSelectUser: '-- 选择已有用户 --',
        palmSelectUserFirst: '请先选择一个用户',
        palmVerifyBtn: '验证掌纹',
        palmNewUserBtn: '新用户注册',
        palmLoginScanning: '正在验证...',
        palmLoginSuccess: '✅ 欢迎回来，',
        palmLoginScore: '匹配度：',
        palmVerifyFail: '❌ 掌纹验证失败（匹配度：',
        palmRegisterTitle: '📝 新用户注册',
        palmRegisterDesc: '输入昵称，然后扫描掌纹完成注册',
        palmRegisterNickname: '请输入昵称',
        palmRegisterBtn: '注册掌纹',
        palmRegisterRegistering: '正在注册...',
        palmRegisterSuccess: '✅ 注册成功！',
        palmSkipBtn: '跳过登录',
        palmLogoutBtn: '切换用户',
        palmWelcome: '👋 ',
        palmError: '❌ 操作失败：',
        palmCameraNotReady: '摄像头未就绪，请稍后再试',
        palmNicknameEmpty: '请输入昵称',

        // 排行榜
        leaderboardTitle: '🏆 排行榜',
        leaderboardEmpty: '暂无记录，快来创造第一个记录吧！',
        leaderboardLvPrefix: 'Lv.',
        leaderboardYourRank: '你的排名：第',
        leaderboardYourRankSuffix: '名',
        leaderboardNewRecord: '🎉 新纪录！',
        leaderboardBtn: '🏆 排行榜',
      },
      en: {
        // 页面标题
        pageTitle: 'GlassWiper 🧹 Motion-Sensing Glass Cleaning Game',

        // 开始界面
        gameSubtitle: 'Window Cleaning Adventure',
        instructionOpenPalm: 'Open palm facing the camera',
        instructionWipe: 'Move palm to wipe window stains',
        instructionFist: 'Make a fist to pause wiping',
        instructionDiscover: 'Discover amazing scenes outside!',
        highScoreLabel: '🏆 High Score: ',
        startBtn: 'Start Adventure',
        cameraHint: '* Camera permission required',

        // HUD
        hudLevel: 'Level',
        hudScore: 'Score',
        hudTime: 'Time',
        hudProgress: 'Progress',
        cameraLabel: '📷 Camera',

        // 关卡完成
        levelCompleteTitle: '✨ Level Complete!',
        wipedArea: 'Wiped Area: ',
        earnedScore: 'Score Earned: ',
        nextLevelBtn: 'Next Level',
        timeBonusLabel: '⏱️ Time Bonus',
        perfectBonusLabel: '✨ Perfect Bonus',
        comboBonusLabel: '🔥 Combo Bonus',

        // Boss 战
        bossIncomingTitle: '👾 BOSS Incoming!',
        bossIncomingSubtitle: 'Wipe it out and slap it!',
        bossDefeatedTitle: '🎉 Boss Defeated!',
        bossHitCount: 'Hit Count',
        bossMaxCombo: 'Max Combo',
        bossEarnedScore: 'Score Earned: ',
        bossContinueBtn: 'Continue Wiping',
        bossHudLabel: '👾 BOSS',
        bossHitBonusLabel: '👊 Hit Bonus',
        bossComboBonus: '🔥 Combo Bonus',
        bossTimeRemaining: '⏱️ Remaining',
        bossSeconds: 's',

        // 结算界面
        gameOverTitle: '🎉 Game Over',
        totalScore: 'Total',
        levelsPassed: 'Levels',
        maxCombo: 'Max Combo',
        galleryTitle: '🖼️ Revealed Hidden Images',
        restartBtn: 'Play Again',

        // 加载
        loadingDefault: 'Loading...',
        loadingCamera: 'Starting camera...',
        loadingLevel: 'Loading level...',
        startingText: 'Starting...',

        // 错误
        initFailed: '⚠️ Init failed: ',
        initFailedSuffix: ' (Please check network and camera permissions, then refresh)',
        reloadBtn: 'Reload',
        startFailedAlert: 'Failed to start game. Please grant camera permission.\n\nError: ',

        // 关卡名称
        levelPrefix: 'Lv.',
        levelSuffix: '',
        levelFormat: (n) => `Lv.${n}`,

        // Boss 战特效文本
        bossFound: 'BOSS Found!',
        bossHitIt: 'Slap it!',
        comboPrefixSuffix: (n) => `${n} Combo!`,
        dodge: 'Dodge!',
        bossSearchHint: '🔍 Find BOSS',
        bossFightHint: '⚔️ BOSS Fight!',
        bossHiddenLevel: 'BOSS Hidden Level',

        // 场景名称
        sceneName1: 'Cherry Blossom Girl',
        sceneName2: 'Starry Sky Girl',
        sceneName3: 'Seaside Girl',
        sceneName4: 'Moonlight Beauty',
        sceneName5: 'Garden Princess',
        sceneName6: 'Magical Girl',
        sceneBoss1: 'Dark Queen',
        sceneBoss2: 'Abyss Witch',
        sceneDesc1: 'Clean the window to meet the girl under cherry blossoms',
        sceneDesc2: 'An anime girl awaits under the starry sky',
        sceneDesc3: 'Sea breeze blows, her skirt flutters',
        sceneDesc4: 'A mysterious beauty under the moonlight',
        sceneDesc5: 'The princess in the garden awaits your arrival',
        sceneDesc6: 'A magical girl with mysterious powers appears',
        sceneDescBoss1: 'A powerful Dark Queen appears outside!',
        sceneDescBoss2: 'The Abyss Witch has descended!',

        // 场景统计
        sceneStatsTitle: '🏆 Level Progress',
        sceneTargetPrefix: 'Target ',

        // 元素解锁
        discoverPrefix: 'Found ',
        discoverSuffix: '!',

        // 语言切换按钮
        langBtnText: '中文',

        // 掌纹认证
        palmLoginTitle: '🤚 Palm Login',
        palmLoginDesc: 'Place your palm facing the camera to identify',
        palmSelectUser: '-- Select user --',
        palmSelectUserFirst: 'Please select a user first',
        palmVerifyBtn: 'Verify Palm',
        palmNewUserBtn: 'New User',
        palmLoginScanning: 'Verifying...',
        palmLoginSuccess: '✅ Welcome back, ',
        palmLoginScore: 'Match score: ',
        palmVerifyFail: '❌ Palm verification failed (score: ',
        palmRegisterTitle: '📝 New User',
        palmRegisterDesc: 'Enter nickname, then scan your palm to register',
        palmRegisterNickname: 'Enter nickname',
        palmRegisterBtn: 'Register Palm',
        palmRegisterRegistering: 'Registering...',
        palmRegisterSuccess: '✅ Registered!',
        palmSkipBtn: 'Skip Login',
        palmLogoutBtn: 'Switch User',
        palmWelcome: '👋 ',
        palmError: '❌ Failed: ',
        palmCameraNotReady: 'Camera not ready, please try again',
        palmNicknameEmpty: 'Please enter a nickname',

        // 排行榜
        leaderboardTitle: '🏆 Leaderboard',
        leaderboardEmpty: 'No records yet. Be the first!',
        leaderboardLvPrefix: 'Lv.',
        leaderboardYourRank: 'Your rank: #',
        leaderboardYourRankSuffix: '',
        leaderboardNewRecord: '🎉 New Record!',
        leaderboardBtn: '🏆 Leaderboard',
      }
    };
  }

  /**
     * 获取翻译文本
     * @param {string} key - 翻译键
     * @returns {string|Function} 翻译文本
     */
  t(key) {
    const lang = this.translations[this.currentLang];
    if (lang && lang[key] !== undefined) {
      return lang[key];
    }
    // 回退到中文
    const fallback = this.translations['zh'];
    if (fallback && fallback[key] !== undefined) {
      return fallback[key];
    }
    console.warn(`[I18n] 缺少翻译: ${key}`);
    return key;
  }

  /**
     * 切换语言
     */
  toggleLang() {
    this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
    this._saveLang(this.currentLang);
    this.applyToDOM();
    return this.currentLang;
  }

  /**
     * 设置语言
     */
  setLang(lang) {
    if (lang === 'zh' || lang === 'en') {
      this.currentLang = lang;
      this._saveLang(lang);
      this.applyToDOM();
    }
  }

  /**
     * 将翻译应用到 DOM 元素
     * 更新所有带有 data-i18n 属性的元素
     */
  applyToDOM() {
    // 更新页面标题
    document.title = this.t('pageTitle');

    // 更新 HTML lang 属性
    document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';

    // 更新所有带 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (typeof text === 'string') {
        el.textContent = text;
      }
    });

    // 更新语言切换按钮文本
    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      const langText = langBtn.querySelector('.lang-text');
      if (langText) {
        langText.textContent = this.t('langBtnText');
      }
    }
  }

  /**
     * 从 localStorage 加载语言偏好
     */
  _loadLang() {
    try {
      return localStorage.getItem('glasswiper_lang') || 'zh';
    } catch {
      return 'zh';
    }
  }

  /**
     * 保存语言偏好到 localStorage
     */
  _saveLang(lang) {
    try {
      localStorage.setItem('glasswiper_lang', lang);
    } catch {
      // 忽略存储错误
    }
  }
}

// 全局单例
window.i18n = new I18n();
