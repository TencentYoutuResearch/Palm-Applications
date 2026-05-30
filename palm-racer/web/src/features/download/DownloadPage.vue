<template>
  <div class="page download-page">
    <div class="download-logo">
      <h1 class="title">🏎️ PalmRacer <span class="badge-3d">3D</span></h1>
      <p class="subtitle">{{ t('download.subtitle') }}</p>
      <div class="racing-stripe"></div>
    </div>

    <div class="download-content">
      <div class="qr-section">
        <h2 class="section-title">{{ t('download.scanTitle') }}</h2>
        <div class="qr-wrapper">
          <QrcodeVue :value="downloadUrl" :size="150" level="H" render-as="svg" />
        </div>
        <p class="qr-hint">{{ t('download.scanHint') }}</p>
      </div>

      <div class="divider"></div>

      <div class="btn-section">
        <a :href="downloadUrl" class="btn-download" download>
          {{ t('download.directDownload') }}
        </a>
        <p class="version-info">{{ t('download.versionInfo', { version: appVersion, size: appSize }) }}</p>
      </div>

      <div class="install-tips">
        <h3>{{ t('download.installTitle') }}</h3>
        <ol>
          <li>{{ t('download.installStep1') }}</li>
          <li>{{ t('download.installStep2') }}</li>
          <li>{{ t('download.installStep3') }}</li>
        </ol>
      </div>
    </div>

    <div class="back-link">
      <router-link to="/login">{{ t('download.backToGame') }}</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import QrcodeVue from 'qrcode.vue';

const { t } = useI18n();
const appVersion = ref('1.0.0');
const appSize = ref('--');

// 下载链接：使用当前域名 + 路径前缀
const getBaseUrl = () => {
  const { protocol, host } = window.location;
  return `${protocol}//${host}/palm-racer`;
};

const downloadUrl = ref(`${getBaseUrl()}/download/palm-racer.apk`);

onMounted(async () => {
  // 尝试获取 APK 文件大小
  try {
    const resp = await fetch(downloadUrl.value, { method: 'HEAD' });
    if (resp.ok) {
      const size = resp.headers.get('content-length');
      if (size) {
        const mb = (parseInt(size) / 1024 / 1024).toFixed(1);
        appSize.value = `${mb} MB`;
      }
    }
  } catch {
    // 忽略
  }
});
</script>

<style scoped>
.download-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 100vh;
  padding: 20px 16px;
  background: linear-gradient(135deg, #0a0e27 0%, #1a1e3a 50%, #0a0e27 100%);
  overflow-y: auto;
  box-sizing: border-box;
}

.download-logo {
  text-align: center;
  margin-bottom: 24px;
}

.download-logo .title {
  font-size: 2rem;
  margin: 0;
  background: linear-gradient(135deg, #ff6b35, #ff8c42, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.badge-3d {
  font-size: 0.6em;
  padding: 2px 8px;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  -webkit-text-fill-color: white;
  vertical-align: super;
}

.download-logo .subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin-top: 4px;
}

.racing-stripe {
  width: 120px;
  height: 3px;
  margin: 12px auto 0;
  background: linear-gradient(90deg, transparent, #ff6b35, #ffd700, #ff6b35, transparent);
  border-radius: 2px;
}

.download-content {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px 20px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  backdrop-filter: blur(10px);
  box-sizing: border-box;
}

.section-title {
  font-size: 1.1rem;
  color: #ffd700;
  margin: 0 0 16px;
}

.qr-wrapper {
  display: inline-block;
  padding: 12px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.2);
}

.qr-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  margin-top: 12px;
}

.divider {
  width: 80%;
  height: 1px;
  margin: 24px auto;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.btn-download {
  display: inline-block;
  padding: 14px 40px;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  border: none;
  border-radius: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
}

.btn-download:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(255, 107, 53, 0.6);
}

.version-info {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
  margin-top: 12px;
}

.install-tips {
  margin-top: 24px;
  text-align: left;
  padding: 16px;
  background: rgba(255, 215, 0, 0.05);
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 10px;
}

.install-tips h3 {
  font-size: 0.9rem;
  color: #ffd700;
  margin: 0 0 8px;
}

.install-tips ol {
  margin: 0;
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  line-height: 1.8;
}

.back-link {
  margin-top: 20px;
}

.back-link a {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.3s;
}

.back-link a:hover {
  color: #ffd700;
}
</style>
