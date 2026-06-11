// 场景管理系统 - 管理窗户背景场景
class SceneManager {
  constructor() {
    this.currentScene = null;
    this.sceneConfigs = this.initializeScenes();
  }

  // 初始化所有场景配置
  // 图片统一放在 assets/images/ 目录下，命名为 level1.png ~ level6.png, boss1.png, boss2.png
  initializeScenes() {
    return {
      // 第1关：樱花少女
      1: {
        get name() { return window.i18n.t('sceneName1'); },
        image: 'assets/images/level1.png',
        get description() { return window.i18n.t('sceneDesc1'); },
        completionThreshold: 30
      },
            
      // 第2关：星空美少女
      2: {
        get name() { return window.i18n.t('sceneName2'); },
        image: 'assets/images/level2.png',
        get description() { return window.i18n.t('sceneDesc2'); },
        completionThreshold: 50
      },
            
      // 第3关：海边少女
      3: {
        get name() { return window.i18n.t('sceneName3'); },
        image: 'assets/images/level3.png',
        get description() { return window.i18n.t('sceneDesc3'); },
        completionThreshold: 65
      },
            
      // 第4关：月夜美人
      4: {
        get name() { return window.i18n.t('sceneName4'); },
        image: 'assets/images/level4.png',
        get description() { return window.i18n.t('sceneDesc4'); },
        completionThreshold: 75
      },
            
      // 第5关：花园公主
      5: {
        get name() { return window.i18n.t('sceneName5'); },
        image: 'assets/images/level5.png',
        get description() { return window.i18n.t('sceneDesc5'); },
        completionThreshold: 85
      },
            
      // 第6关：魔法少女
      6: {
        get name() { return window.i18n.t('sceneName6'); },
        image: 'assets/images/level6.png',
        get description() { return window.i18n.t('sceneDesc6'); },
        completionThreshold: 90
      },
            
      // BOSS关1：暗黑女王
      10: {
        get name() { return window.i18n.t('sceneBoss1'); },
        image: 'assets/images/boss1.png',
        get description() { return window.i18n.t('sceneDescBoss1'); },
        completionThreshold: 30,
        isBossLevel: true
      },
            
      // BOSS关2：深渊魔女
      11: {
        get name() { return window.i18n.t('sceneBoss2'); },
        image: 'assets/images/boss2.png',
        get description() { return window.i18n.t('sceneDescBoss2'); },
        completionThreshold: 30,
        isBossLevel: true
      }
    };
  }

  // 加载场景（使用本地图片，本地图片不存在时使用渐变色备用）
  async loadScene(level) {
    this.currentScene = this.sceneConfigs[level];
        
    if (this.currentScene) {
      // 使用配置中的本地图片路径
      if (this.currentScene.image) {
        // 检查本地图片是否存在
        const localExists = await this._checkImageExists(this.currentScene.image);
        if (localExists) {
          console.log(`[SceneManager] 使用本地图片: ${this.currentScene.image}`);
          this.preloadImage(this.currentScene.image);
          return this.currentScene;
        }
        console.warn(`[SceneManager] 本地图片不存在: ${this.currentScene.image}，将使用渐变色备用`);
        // 清空图片路径，让 GlassRenderer 使用渐变色备用方案
        this.currentScene.image = null;
      }
    }
        
    return this.currentScene;
  }

  /**
     * 检查图片是否存在（通过 Image 对象加载测试）
     * 注意：Python http.server 的 HEAD 请求可能不可靠，改用 Image 加载
     */
  async _checkImageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        console.warn(`[SceneManager] 图片检测超时: ${url}`);
        resolve(false);
      }, 5000);
      img.onload = () => {
        clearTimeout(timeout);
        console.log(`[SceneManager] ✅ 图片存在: ${url} (${img.width}x${img.height})`);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn(`[SceneManager] ❌ 图片不存在: ${url}`);
        resolve(false);
      };
      img.src = url;
    });
  }

  // 预加载图片
  preloadImage(src) {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  }

  // 检查关卡是否完成
  isLevelComplete(progress) {
    return this.currentScene && progress >= this.currentScene.completionThreshold;
  }

  // 获取当前场景信息
  getCurrentScene() {
    return this.currentScene;
  }

  // 获取所有解锁的场景（用于结算界面）
  getUnlockedScenes() {
    return Object.values(this.sceneConfigs).filter(scene => 
      scene.completionThreshold > 0
    );
  }

  // 重置场景
  reset() {
    this.currentScene = null;
  }
}

// 导出场景管理器
window.SceneManager = SceneManager;
