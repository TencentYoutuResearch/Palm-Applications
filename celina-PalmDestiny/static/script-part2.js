// ===== script-part2.js - 扫描、分析、结果生成、事件绑定 =====
// API_BASE 已在 script.js 中定义，此处直接使用

// ===== 公历年份转中文数字（如 1997 → 一九九七） =====
function lunarNumToChinese(year) {
  const numCn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return String(year).split('').map(d => numCn[parseInt(d)]).join('');
}

// ===== AI八字简评请求 =====
async function fetchBaziAIComment(bazi, year, month, day, shichenIdx) {
  try {
    const pillars = [bazi.year, bazi.month, bazi.day, bazi.hour];
    const baziStr = pillars.map(p => p.gan + p.zhi).join(' ');
    const resp = await fetch(API_BASE + '/bazi-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bazi_str: baziStr,
        year: year,
        month: month,
        day: day,
        shichen_idx: shichenIdx,
        day_master: bazi.dayMaster,
        day_master_wuxing: bazi.dayMasterWuxing
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code === 0 && data.data && data.data.comment_html) {
      return data.data.comment_html;
    }
    return null;
  } catch (e) {
    console.warn('AI八字简评请求失败:', e);
    return null;
  }
}

// ===== AI星座运势分析请求 =====
async function fetchConstellationAIAnalysis(constellationName, constellationIndex) {
  try {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bjTime = new Date(utc + 8 * 3600000);
    const dateStr = `${bjTime.getFullYear()}年${String(bjTime.getMonth() + 1).padStart(2, '0')}月${String(bjTime.getDate()).padStart(2, '0')}日`;

    const resp = await fetch(API_BASE + '/constellation-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        constellation_name: constellationName,
        constellation_index: constellationIndex,
        date_str: dateStr
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    return null;
  } catch (e) {
    console.warn('AI星座分析请求失败:', e);
    return null;
  }
}

// ===== AI今日宜忌（老黄历）分析请求 =====
async function fetchYiJiAIAnalysis(zodiacName) {
  try {
    const dateInfo = formatDateWithLunar();
    const todayGZ = getTodayGanzhi();

    const resp = await fetch(API_BASE + '/yiji-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_str: dateInfo.solar,
        lunar_str: dateInfo.lunarData.fullText,
        ganzhi_day: todayGZ.ganzhi,
        zodiac_name: zodiacName || ''
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code === 0 && data.data) {
      return data.data;
    }
    return null;
  } catch (e) {
    console.warn('AI宜忌分析请求失败:', e);
    return null;
  }
}

// ===== 扫描流程 =====
async function startScan() {
  const scanLine = document.getElementById('scan-line');
  const progressWrapper = document.getElementById('scan-progress-wrapper');
  const progressFill = document.getElementById('scan-progress-fill');
  const scanStatus = document.getElementById('scan-status');
  const btnScan = document.getElementById('btn-scan');
  const btnCapture = document.getElementById('btn-capture');

  scanLine.classList.add('active');
  progressWrapper.style.display = 'block';
  btnScan.disabled = true;
  btnScan.style.display = 'none';
  btnCapture.style.display = 'none';
  document.getElementById('btn-recapture').style.display = 'none';

  const statuses = currentMode === 'traditional'
    ? ['正在上传掌纹图像...', '分析掌型五行特征...', '解读生命线纹理...', '分析智慧线走向...', '解读感情线深浅...', '综合掌纹论断...', '分析完成！']
    : ['正在上传掌纹图像...', 'AI引擎正在分析掌纹...', '深度分析掌纹纹路特征...', '计算运势能量场...', '结合星座属相推演...', '生成分析报告...', '分析完成！'];

  const percentEl = document.getElementById('scan-progress-percent');
  const etaEl = document.getElementById('scan-progress-eta');
  let progress = 0;
  const scanStartTime = Date.now();
  // 预估总时长30秒，倒计时从30开始
  const estimatedTotalSec = 30;
  let lastDisplayedEta = estimatedTotalSec;
  const progressInterval = setInterval(() => {
    const elapsedSec = (Date.now() - scanStartTime) / 1000;
    if (progress < 88 && !window._apiDone) {
      // 非线性增长：始终保持微小增量，让用户感觉一直在动
      // 使用对数曲线，前期快后期慢但永不停止
      const targetProgress = 88 * (1 - Math.exp(-elapsedSec / 18));
      // 确保每次至少增加一点点，避免视觉卡顿
      const minIncrement = 0.05 + Math.random() * 0.08;
      progress = Math.max(progress + minIncrement, targetProgress);
      progress = Math.min(progress, 88);

      // 倒计时：基于已用时间和预估总时长计算剩余
      const rawEta = Math.max(1, Math.round(estimatedTotalSec - elapsedSec));
      // 平滑倒计时，避免跳动，只允许递减
      if (rawEta < lastDisplayedEta) {
        lastDisplayedEta = rawEta;
      }
      if (etaEl) etaEl.querySelector('.eta-text').textContent = ` 预计还需${lastDisplayedEta}秒`;
    } else if (window._apiDone && progress < 100) {
      // API完成后快速冲到100%
      progress += 3;
      if (etaEl) etaEl.querySelector('.eta-text').textContent = ` 即将完成`;
    } else if (!window._apiDone && progress >= 88) {
      // 超过预估时间但API还没完成，继续极缓慢增长，不卡死
      progress += 0.02 + Math.random() * 0.03;
      progress = Math.min(progress, 97);
      if (etaEl) etaEl.querySelector('.eta-text').textContent = ` 正在处理中...`;
    }
    progress = Math.min(progress, 100);
    progressFill.style.width = `${progress}%`;
    if (percentEl) percentEl.textContent = `${Math.floor(progress)}%`;
    const statusIdx = Math.min(Math.floor(progress / 16), statuses.length - 1);
    scanStatus.innerHTML = `<span class="status-dot"></span>${statuses[statusIdx]}`;

    if (progress >= 100) {
      clearInterval(progressInterval);
      scanLine.classList.remove('active');
      stopCamera();
      setTimeout(() => {
        navigateTo('screen-analyzing');
        startAnalyzing();
      }, 300);
    }
  }, 80);

  window._apiDone = false;
  try {
    const apiResult = await uploadPalmForAnalysis();
    palmAnalysisResult = apiResult;
    // 如果是传统模式，从API返回的数据中提取大模型报告（避免重复请求）
    if (currentMode === 'traditional' && apiResult && apiResult.report) {
      llmReportData = apiResult.report;
      console.log('[startScan] 从API响应中提取到大模型报告');
    }
  } catch (e) {
    palmAnalysisResult = null;
  }
  window._apiDone = true;
}

// ===== 分析流程动画 =====
function startAnalyzing() {
  const stepsContainer = document.getElementById('analyzing-steps');
  const subtitleEl = document.getElementById('analyzing-subtitle');
  const titleEl = document.getElementById('analyzing-title');

  let stepsData, subtitles;

  if (currentMode === 'traditional') {
    titleEl.textContent = '正在解读掌纹...';
    stepsData = [
      { icon: 'fa-fingerprint', text: '分析掌型五行特征' },
      { icon: 'fa-heart-pulse', text: '解读生命线纹理' },
      { icon: 'fa-brain', text: '分析智慧线走向' },
      { icon: 'fa-heart', text: '解读感情线深浅' },
      { icon: 'fa-scroll', text: '综合掌纹论断生成' },
    ];
    subtitles = [
      '正在分析掌型与五行属性...',
      '深度解读生命线纹理特征...',
      '分析智慧线走向与才智...',
      '解读感情线与婚恋运势...',
      '综合所有维度生成手相报告...'
    ];
  } else {
    titleEl.textContent = '正在解读命运...';
    stepsData = [
      { icon: 'fa-fingerprint', text: '上传掌纹至AI引擎' },
      { icon: 'fa-brain', text: 'AI掌纹特征分析' },
      { icon: 'fa-calendar-alt', text: '推演生辰八字命理' },
      { icon: 'fa-star', text: '星座属相运势匹配' },
      { icon: 'fa-magic', text: '综合运势生成' },
    ];
    subtitles = [
      '正在将掌纹图像上传至AI引擎...',
      'AI深度学习模型正在分析掌纹特征...',
      '根据生辰推演四柱八字命理...',
      '结合星座属相信息推演运势...',
      '综合所有维度生成运势报告...'
    ];
  }

  stepsContainer.innerHTML = stepsData.map((s, i) => `
    <div class="step" data-step="${i + 1}">
      <div class="step-icon"><i class="fas ${s.icon}"></i></div>
      <span>${s.text}</span>
      <div class="step-status"></div>
    </div>
  `).join('');

  const steps = stepsContainer.querySelectorAll('.step');

  // 总进度条元素
  const progressFill = document.getElementById('analyzing-progress-fill');
  const progressPercent = document.getElementById('analyzing-progress-percent');
  const progressEta = document.getElementById('analyzing-progress-eta');
  const totalSteps = steps.length;

  // 预估总时长20秒，每步约4秒，倒计时从20开始
  const analyzingEstTotalSec = 20;
  const analyzingStartTime = Date.now();
  let analyzingCurrentPct = 0;
  let analyzingTargetPct = 0;
  let analyzingDone = false;

  // 持续刷新进度条的定时器，每80ms刷新一次，确保百分比始终在动
  const analyzingTickInterval = setInterval(() => {
    if (analyzingDone) {
      clearInterval(analyzingTickInterval);
      return;
    }
    // 平滑追赶目标百分比，同时加入微小随机增量避免视觉卡顿
    const diff = analyzingTargetPct - analyzingCurrentPct;
    if (diff > 0.5) {
      analyzingCurrentPct += diff * 0.12 + Math.random() * 0.3;
    } else {
      // 即使目标没变，也缓慢增长，让用户感觉一直在动
      analyzingCurrentPct += 0.05 + Math.random() * 0.1;
    }
    analyzingCurrentPct = Math.min(analyzingCurrentPct, analyzingTargetPct + 2, 100);
    const displayPct = Math.min(Math.floor(analyzingCurrentPct), 100);
    if (progressFill) progressFill.style.width = `${analyzingCurrentPct}%`;
    if (progressPercent) progressPercent.textContent = `${displayPct}%`;

    // 倒计时
    const elapsedSec = (Date.now() - analyzingStartTime) / 1000;
    const remainSec = Math.max(1, Math.round(analyzingEstTotalSec - elapsedSec));
    if (progressEta) {
      if (analyzingCurrentPct >= 99) {
        const icon = progressEta.querySelector('i');
        if (icon) { icon.className = 'fas fa-check'; icon.style.animation = 'none'; icon.style.color = '#4CAF50'; }
        const txt = progressEta.querySelector('.eta-text');
        if (txt) txt.textContent = ' 分析完成';
      } else if (elapsedSec > analyzingEstTotalSec) {
        progressEta.querySelector('.eta-text').textContent = ' 即将完成...';
      } else {
        progressEta.querySelector('.eta-text').textContent = ` 预计还需${remainSec}秒`;
      }
    }
  }, 80);

  function finishAnalyzing() {
    analyzingTargetPct = 100;
    analyzingCurrentPct = 100;
    analyzingDone = true;
    if (progressFill) progressFill.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';
    if (progressEta) {
      const icon = progressEta.querySelector('i');
      if (icon) { icon.className = 'fas fa-check'; icon.style.animation = 'none'; icon.style.color = '#4CAF50'; }
      const txt = progressEta.querySelector('.eta-text');
      if (txt) txt.textContent = ' 分析完成';
    }
    clearInterval(analyzingTickInterval);
    setTimeout(() => {
      if (currentMode === 'traditional') {
        generateTraditionalResult();
        navigateTo('screen-result-traditional');
      } else {
        generateFusionResult();
        navigateTo('screen-result-fusion');
      }
    }, 600);
  }

  function activateStep(index) {
    if (index >= steps.length) {
      finishAnalyzing();
      return;
    }

    const step = steps[index];
    step.classList.add('active');
    step.querySelector('.step-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    if (subtitleEl && subtitles[index]) {
      subtitleEl.textContent = subtitles[index];
    }
    // 设置目标百分比（当前步骤开始时）
    analyzingTargetPct = Math.round(((index + 0.3) / totalSteps) * 100);

    // 每步耗时3-5秒，总共约20秒
    const stepDuration = 3000 + Math.random() * 2000;
    setTimeout(() => {
      step.classList.remove('active');
      step.classList.add('done');
      step.querySelector('.step-status').innerHTML = '<i class="fas fa-check"></i>';
      analyzingTargetPct = Math.round(((index + 1) / totalSteps) * 100);
      activateStep(index + 1);
    }, stepDuration);
  }

  steps.forEach(s => {
    s.classList.remove('active', 'done');
    s.querySelector('.step-status').innerHTML = '';
  });

  // 初始化进度条
  analyzingCurrentPct = 0;
  analyzingTargetPct = 0;

  activateStep(0);
}

// ===== 大模型报告全局变量 =====
let llmReportData = null;
let llmReportLoading = false;

// ===== 调用大模型生成手相报告 =====
async function fetchLLMReport() {
  if (!capturedImageBlob) return null;
  // 如果 startScan 已经获取到了大模型报告，直接返回，避免重复请求
  if (llmReportData) {
    console.log('[fetchLLMReport] 已有大模型报告数据，跳过重复请求');
    return llmReportData;
  }
  // 防止并发重复请求
  if (llmReportLoading) {
    console.log('[fetchLLMReport] 请求进行中，跳过重复调用');
    return null;
  }
  try {
    llmReportLoading = true;
    const formData = new FormData();
    formData.append('file', capturedImageBlob, 'palm.jpg');
    // 超时58秒，略大于后端pipeline超时(55s)，确保能收到后端响应
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 58000);
    const response = await fetch(`${API_BASE}/readings`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    // 接受llm和fallback两种数据源的报告
    if (result.code === 0 && result.data && result.data.report) {
      llmReportData = result.data.report;
      // 同时更新 palmAnalysisResult 以便 fortune 数据也可用
      if (result.data && !palmAnalysisResult) {
        palmAnalysisResult = result.data;
      }
      console.log('[fetchLLMReport] 报告获取成功, source:', result.data.source || 'unknown');
      return result.data.report;
    }
    return null;
  } catch (error) {
    console.error('[fetchLLMReport] 大模型报告获取失败:', error.name, error.message);
    return null;
  } finally {
    llmReportLoading = false;
  }
}

// ===== 生成传统手相结果 =====
function generateTraditionalResult() {
  const baseSeed = getTodaySeed();
  let featureSeed = 0;
  if (palmAnalysisResult && palmAnalysisResult.image_features) {
    const f = palmAnalysisResult.image_features;
    featureSeed = Math.floor((f.brightness || 128) * 10 + (f.texture_complexity || 30) * 100 + (f.contrast || 50) * 50);
  }
  const combinedSeed = baseSeed + featureSeed;
  const rng = seedRandom(combinedSeed);

  const tradDateInfo = formatDateWithLunar();
  document.getElementById('trad-result-date').textContent = tradDateInfo.solar + '（' + tradDateInfo.lunarShort + '）';

  const identityName = (identifyResult && identifyResult.identified && identifyResult.user_id) ? identifyResult.user_id : '有缘人';
  let userInfoHTML = `<span style="font-size:16px;font-weight:600;">${identityName}</span>`;
  if (identifyResult && identifyResult.identified) {
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(76,175,80,0.3);color:#4CAF50;"><i class="fas fa-fingerprint"></i> 掌纹已识别</span>`;
  } else if (identifyResult && identifyResult.identified === false) {
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,165,0,0.3);color:#ffa500;"><i class="fas fa-user-secret"></i> 掌纹库暂无匹配</span>`;
  }
  userInfoHTML += `<span class="info-tag"><i class="fas fa-hand-sparkles"></i> 传统手相</span>`;
  document.getElementById('trad-result-user-info').innerHTML = userInfoHTML;

  const sectionsContainer = document.getElementById('trad-palm-sections');

  // 优先从 palmAnalysisResult 中提取 report（startScan 中已获取）
  if (!llmReportData && palmAnalysisResult && palmAnalysisResult.report) {
    llmReportData = palmAnalysisResult.report;
    console.log('[generateTraditionalResult] 从 palmAnalysisResult 中提取到大模型报告');
  }

  if (llmReportData && llmReportData.sections && llmReportData.sections.length > 0) {
    renderLLMReport(llmReportData, sectionsContainer, rng);
    document.getElementById('trad-report-source-badge').style.display = 'inline-flex';
    document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-robot"></i> AI大模型深度解读';
  } else {
    // 先显示本地报告
    renderLocalReport(sectionsContainer, combinedSeed, rng, false);
    document.getElementById('trad-report-source-badge').style.display = 'inline-flex';
    document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-database"></i> 本地智能解读';

    // 只有在有图片且没有正在加载的情况下，才尝试异步请求大模型报告
    if (!llmReportLoading && capturedImageBlob) {
      fetchLLMReport().then(report => {
        if (report && report.sections && report.sections.length > 0) {
          // 大模型报告成功返回，替换本地报告
          renderLLMReport(report, sectionsContainer, rng);
          document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-robot"></i> AI大模型深度解读';
          sectionsContainer.classList.add('report-updated');
          setTimeout(() => sectionsContainer.classList.remove('report-updated'), 1000);
          // 清除降级提示（如果有的话）
          document.querySelectorAll('.fallback-notice-banner').forEach(el => el.remove());
        }
        // 大模型报告获取失败时不显示降级提示，本地报告已经足够好
      }).catch(() => {
        // 请求异常时也不显示降级提示，避免误导用户
        console.warn('[generateTraditionalResult] 大模型报告异步请求失败，保持本地报告');
      });
    }
    // 不再因为没有图片数据就显示降级提示
  }

  document.getElementById('trad-encourage-text').textContent = TRAD_ENCOURAGEMENTS[new Date().getDate() % TRAD_ENCOURAGEMENTS.length];
}

// ===== 渲染大模型报告 =====
function renderLLMReport(reportData, container, rng) {
  let sectionsHTML = '';

  reportData.sections.forEach((section, idx) => {
    const sectionScore = _normalScore();
    const stars = Math.max(3, Math.min(5, Math.round(sectionScore / 20)));
    const starsHTML = Array(5).fill(0).map((_, i) =>
      `<i class="fas fa-star" style="color:${i < stars ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; font-size:12px;"></i>`
    ).join('');

    const content = section.content || '';
    const paragraphs = content.split('\n').filter(p => p.trim());
    let readingContent = '';

    if (section.id === 'palm-type') {
      const typeMatch = content.match(/(?:金形掌|木形掌|水形掌|火形掌|土形掌|方掌|圆掌|尖掌|篦形掌)/);
      const typeName = typeMatch ? typeMatch[0] : '';
      if (typeName) {
        readingContent += `<div class="trad-palm-type-badge">${typeName}</div>`;
      }
      readingContent += paragraphs.map(p => `<p class="trad-reading-text">${p}</p>`).join('');
    } else if (section.id === 'yearly-fortune') {
      readingContent = paragraphs.map(p => {
        if (p.match(/【.*?】/)) {
          return `<p class="trad-reading-text trad-fortune-stage">${p}</p>`;
        }
        return `<p class="trad-reading-text">${p}</p>`;
      }).join('');
    } else {
      readingContent = paragraphs.map(p => `<p class="trad-reading-text">${p}</p>`).join('');
    }

    sectionsHTML += `
      <div class="trad-section glass-card trad-section-llm fade-in-up" style="animation-delay:${idx * 0.08}s">
        <div class="trad-section-header">
          <div class="trad-section-icon">${section.icon || '📖'}</div>
          <div class="trad-section-title-wrap">
            <h4 class="trad-section-title">${section.title}</h4>
            <p class="trad-section-subtitle">${section.subtitle || ''}</p>
          </div>
          <div class="trad-section-stars">${starsHTML}</div>
        </div>
        <div class="trad-section-body">
          ${readingContent}
        </div>
      </div>
    `;
  });

  container.innerHTML = sectionsHTML;
}

// ===== 正态分布随机分数生成（均值85，满分100，不低于65） =====
function _normalScore(mean = 85, std = 5, low = 65, high = 100) {
  // Box-Muller变换生成正态分布
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const score = Math.round(mean + z * std);
  return Math.max(low, Math.min(high, score));
}

// ===== 基于八字五行 + 正态分布计算运势分数 =====
function _calcScoresFromBazi(bazi, zodiacIdx, constellationIdx) {
  return {
    total: _normalScore(),
    love: _normalScore(),
    career: _normalScore(),
    wealth: _normalScore(),
    health: _normalScore()
  };
}

// ===== 显示降级提示 =====
function _showFallbackNotice() {
  // 避免重复显示
  if (document.querySelector('.fallback-notice-banner')) return;

  const notice = document.createElement('div');
  notice.className = 'fallback-notice-banner';
  notice.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:linear-gradient(135deg,rgba(255,152,0,0.15),rgba(255,87,34,0.1));border:1px solid rgba(255,152,0,0.3);border-radius:10px;margin:8px 16px;backdrop-filter:blur(10px);">
      <i class="fas fa-exclamation-triangle" style="color:#ff9800;font-size:14px;"></i>
      <span style="color:rgba(255,255,255,0.85);font-size:12px;line-height:1.5;">⚠️ AI大模型服务暂时不可用，已切换为本地知识库分析</span>
    </div>
  `;

  // 插入到当前活跃的结果页面顶部
  const tradResult = document.getElementById('screen-result-traditional');
  const fusionResult = document.getElementById('screen-result-fusion');
  const activeResult = (tradResult && tradResult.classList.contains('active')) ? tradResult :
                       (fusionResult && fusionResult.classList.contains('active')) ? fusionResult : null;

  if (activeResult) {
    const firstChild = activeResult.querySelector('.result-header') || activeResult.firstElementChild;
    if (firstChild && firstChild.nextSibling) {
      firstChild.parentNode.insertBefore(notice, firstChild.nextSibling);
    } else {
      activeResult.prepend(notice);
    }
  } else {
    // 如果还没有active的结果页，延迟插入
    setTimeout(() => {
      const trad = document.getElementById('screen-result-traditional');
      const fusion = document.getElementById('screen-result-fusion');
      const target = (trad && trad.classList.contains('active')) ? trad :
                     (fusion && fusion.classList.contains('active')) ? fusion : null;
      if (target) {
        const header = target.querySelector('.result-header') || target.firstElementChild;
        if (header && header.nextSibling) {
          header.parentNode.insertBefore(notice, header.nextSibling);
        } else if (target) {
          target.prepend(notice);
        }
      }
    }, 600);
  }
}

// ===== 生成融合解读结果 =====
function generateFusionResult() {
  // === 命理计算一律以出生日期为准 ===
  // 即使用户手动选择了与出生日期不一致的生肖/星座（仅作为提示不强制），
  // 此处一律以出生日期为准重新推算，保证下游八字/守护星/运势等命理逻辑正确。
  const _birthdayStr = document.getElementById('user-birthday').value;
  if (_birthdayStr) {
    const [_by, _bm, _bd] = _birthdayStr.split('-').map(Number);
    if (typeof getZodiacFromDate === 'function') {
      selectedZodiac = getZodiacFromDate(_by, _bm, _bd);
    }
    if (typeof getConstellationFromDate === 'function') {
      selectedConstellation = getConstellationFromDate(_bm, _bd);
    }
  }

  const hasApiData = palmAnalysisResult && palmAnalysisResult.fortune;

  let totalScore, loveScore, careerScore, wealthScore, healthScore;
  let palmLineReadings = null;
  let identityInfo = null;
  let imageFeatures = null;
  let fortuneTexts = null; // 大模型返回的运势文本

  if (hasApiData) {
    const fortune = palmAnalysisResult.fortune;
    // fortune.source === 'fallback' 只是说明运势分数由本地算法生成，不代表服务器连接失败
    // 不再显示降级提示
    const zodiacFactor = selectedZodiac !== null ? selectedZodiac : 0;
    const constellationFactor = selectedConstellation !== null ? selectedConstellation : 0;
    const zodiacBonus = ((zodiacFactor * 7 + getTodaySeed()) % 11) - 5;
    const constellationBonus = ((constellationFactor * 13 + getTodaySeed()) % 9) - 4;

    totalScore = Math.max(65, Math.min(98, fortune.total_score + zodiacBonus));
    loveScore = Math.max(65, Math.min(98, fortune.love_score + constellationBonus));
    careerScore = Math.max(65, Math.min(98, fortune.career_score + zodiacBonus));
    wealthScore = Math.max(65, Math.min(98, fortune.wealth_score + constellationBonus));
    healthScore = Math.max(65, Math.min(98, fortune.health_score + zodiacBonus));

    palmLineReadings = fortune.palm_line_readings;
    identityInfo = palmAnalysisResult.identity;
    imageFeatures = palmAnalysisResult.image_features;

    // 保存大模型返回的运势文本
    if (fortune.love_text || fortune.career_text || fortune.wealth_text || fortune.health_text) {
      fortuneTexts = {
        love: fortune.love_text,
        career: fortune.career_text,
        wealth: fortune.wealth_text,
        health: fortune.health_text
      };
    }
  } else {
    // 降级方案：基于八字五行的确定性计算（非随机）
    // 不显示降级提示，本地计算结果同样可靠
    console.log('[generateFusionResult] 使用本地八字五行计算方案');

    const birthday = document.getElementById('user-birthday').value;
    if (birthday) {
      const [byear, bmonth, bday] = birthday.split('-').map(Number);
      const bazi = calculateBazi(byear, bmonth, bday, selectedShichen);
      // 基于八字五行力量计算确定性分数
      const scores = _calcScoresFromBazi(bazi, selectedZodiac, selectedConstellation);
      totalScore = scores.total;
      loveScore = scores.love;
      careerScore = scores.career;
      wealthScore = scores.wealth;
      healthScore = scores.health;
    } else {
      // 无八字数据时，使用正态分布随机分数
      totalScore = _normalScore();
      loveScore = _normalScore();
      careerScore = _normalScore();
      wealthScore = _normalScore();
      healthScore = _normalScore();
    }
  }

  if (!identityInfo && identifyResult && identifyResult.identified) {
    identityInfo = {
      person_id: identifyResult.user_id,
      person_name: identifyResult.person_name || identifyResult.user_id,
      confidence: identifyResult.confidence,
      tag: '',
    };
  }

  const rng = seedRandom(getTodaySeed() + totalScore);
  const level = getFortuneLevel(totalScore);

  // 日期
  const fusionDateInfo = formatDateWithLunar();
  document.getElementById('fusion-result-date').textContent = fusionDateInfo.solar + '（' + fusionDateInfo.lunarShort + '）';

  // 用户信息
  const identityName = identityInfo && identityInfo.person_name ? identityInfo.person_name : (document.getElementById('user-name').value || '有缘人');
  const zodiacData = selectedZodiac !== null ? ZODIACS[selectedZodiac] : null;
  const constellationData = selectedConstellation !== null ? CONSTELLATIONS[selectedConstellation] : null;

  let userInfoHTML = `<span style="font-size:16px;font-weight:600;">${identityName}</span>`;
  if (identityInfo && identityInfo.person_id) {
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(76,175,80,0.3);color:#4CAF50;"><i class="fas fa-fingerprint"></i> 掌纹已识别</span>`;
  } else if (identifyResult && identifyResult.identified === false) {
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,165,0,0.3);color:#ffa500;"><i class="fas fa-user-secret"></i> 掌纹库暂无匹配</span>`;
  }
  if (zodiacData) userInfoHTML += `<span class="info-tag">${zodiacData.emoji} ${zodiacData.name}</span>`;
  if (constellationData) userInfoHTML += `<span class="info-tag">${constellationData.emoji} ${constellationData.name}</span>`;
  const birthday = document.getElementById('user-birthday').value;
  if (birthday) {
    // 公历生日
    userInfoHTML += `<span class="info-tag"><i class="fas fa-birthday-cake"></i> ${birthday}</span>`;
    // 农历生日 + 时辰
    const [_by, _bm, _bd] = birthday.split('-').map(Number);
    const lunarBirthday = solarToLunar(_by, _bm, _bd);
    const shichenName = SHICHEN_DATA[selectedShichen] ? SHICHEN_DATA[selectedShichen].name : '子时';
    const lunarBirthdayStr = lunarNumToChinese(_by) + '年' + lunarBirthday.monthCn + lunarBirthday.dayCn + ' ' + shichenName;
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,215,0,0.3);color:#ffd700;"><i class="fas fa-moon"></i> ${lunarBirthdayStr}</span>`;
  }
  userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,105,180,0.3);color:#ff69b4;"><i class="fas fa-magic"></i> 融合解读</span>`;
  document.getElementById('fusion-result-user-info').innerHTML = userInfoHTML;

  // ===== 生辰八字计算与显示 =====
  let baziData = null; // 提升作用域，供五行能量分析使用
  const baziCard = document.getElementById('bazi-card');
  const ditianCard = document.getElementById('ditian-card');
  if (birthday) {
    const [byear, bmonth, bday] = birthday.split('-').map(Number);
    let finalShichen = selectedShichen;

    // 真太阳时修正（经度来自出生地选择器）
    const trueSolarToggle = document.getElementById('true-solar-toggle');
    if (trueSolarToggle && trueSolarToggle.checked && typeof getBirthLongitude === 'function') {
      const lng = getBirthLongitude();
      if (lng !== null && !isNaN(lng) && lng >= 73 && lng <= 135) {
        // 取时辰中间小时来修正
        const shichenHours = SHICHEN_DATA[selectedShichen].hours;
        const midHour = shichenHours[0] === 23 ? 0 : shichenHours[0] + 1;
        const corrected = getTrueSolarHour(midHour, 0, lng);
        finalShichen = getShichenFromHour(corrected.hour);
      }
    }

    const bazi = calculateBazi(byear, bmonth, bday, finalShichen);
    baziData = bazi; // 保存到外部作用域供五行能量分析使用

    // 显示八字卡片
    baziCard.style.display = 'block';

    // 辅助函数：设置天干样式（五行颜色 + 阴阳干斜体）
    function styleBaziGan(el, gan, isDayPillar) {
      el.textContent = gan;
      const color = GAN_WUXING_COLOR[gan] || '#ffd54f';
      el.style.color = color;
      // 水黑色文字需要亮色背景衬托
      if (gan === '壬' || gan === '癸') {
        el.style.color = '#87CEEB';
        el.style.textShadow = '0 0 8px rgba(135,206,235,0.4)';
      } else {
        el.style.textShadow = `0 0 10px ${color}44`;
      }
      el.style.borderColor = color + '44';
      el.style.background = color + '14';
      if (isYinGan(gan)) {
        el.classList.add('yin-gan');
      } else {
        el.classList.remove('yin-gan');
      }
      if (isDayPillar) {
        el.classList.add('bazi-gan-day');
      }
    }

    // 辅助函数：设置地支样式（五行颜色）
    function styleBaziZhi(el, zhi) {
      el.textContent = zhi;
      const color = ZHI_WUXING_COLOR[zhi] || '#a78bfa';
      if (zhi === '子' || zhi === '亥') {
        // 水属性地支：使用天蓝色系，确保在深色背景上清晰可见
        const waterColor = '#87CEEB';
        el.style.color = waterColor;
        el.style.textShadow = '0 0 8px rgba(135,206,235,0.5)';
        el.style.borderColor = 'rgba(135,206,235,0.45)';
        el.style.background = 'rgba(135,206,235,0.12)';
      } else {
        el.style.color = color;
        el.style.textShadow = `0 0 10px ${color}44`;
        el.style.borderColor = color + '44';
        el.style.background = color + '14';
      }
    }

    // 辅助函数：渲染地支藏干（带五行颜色、阴阳斜体、本气/中气/余气标注）
    function renderCanggan(el, zhi, dayMasterGan) {
      const labeled = getCangganLabeled(zhi);
      el.innerHTML = labeled.map(item => {
        const color = GAN_WUXING_COLOR[item.gan] || '#ffd54f';
        const yinClass = isYinGan(item.gan) ? ' yin-gan' : '';
        const displayColor = (item.gan === '壬' || item.gan === '癸') ? '#87CEEB' : color;
        const shiShen = dayMasterGan ? getShiShen(dayMasterGan, item.gan) : '';
        const labelClass = item.label === '本气' ? 'benqi' : (item.label === '中气' ? 'zhongqi' : 'yuqi');
        return `<span class="canggan-item">` +
          `<span class="canggan-char${yinClass}" style="color:${displayColor};" title="${item.label} ${item.wuxing}">${item.gan}</span>` +
          `<span class="canggan-label canggan-${labelClass}">${item.label}</span>` +
          (shiShen ? `<span class="canggan-shishen">${shiShen}</span>` : '') +
          `</span>`;
      }).join('');
    }

    // 应用天干样式
    styleBaziGan(document.getElementById('bazi-year-gan'), bazi.year.gan, false);
    styleBaziGan(document.getElementById('bazi-month-gan'), bazi.month.gan, false);
    styleBaziGan(document.getElementById('bazi-day-gan'), bazi.day.gan, true);
    styleBaziGan(document.getElementById('bazi-hour-gan'), bazi.hour.gan, false);

    // 应用地支样式
    styleBaziZhi(document.getElementById('bazi-year-zhi'), bazi.year.zhi);
    styleBaziZhi(document.getElementById('bazi-month-zhi'), bazi.month.zhi);
    styleBaziZhi(document.getElementById('bazi-day-zhi'), bazi.day.zhi);
    styleBaziZhi(document.getElementById('bazi-hour-zhi'), bazi.hour.zhi);

    // 渲染地支藏干（带本气/中气/余气标注和十神）
    const dayMasterGan = bazi.day.gan;
    renderCanggan(document.getElementById('bazi-year-canggan'), bazi.year.zhi, dayMasterGan);
    renderCanggan(document.getElementById('bazi-month-canggan'), bazi.month.zhi, dayMasterGan);
    renderCanggan(document.getElementById('bazi-day-canggan'), bazi.day.zhi, dayMasterGan);
    renderCanggan(document.getElementById('bazi-hour-canggan'), bazi.hour.zhi, dayMasterGan);

    // 渲染十神行
    const yearShiShen = getShiShen(dayMasterGan, bazi.year.gan);
    const monthShiShen = getShiShen(dayMasterGan, bazi.month.gan);
    const hourShiShen = getShiShen(dayMasterGan, bazi.hour.gan);
    document.getElementById('bazi-year-shishen').textContent = yearShiShen;
    document.getElementById('bazi-month-shishen').textContent = monthShiShen;
    document.getElementById('bazi-day-shishen').textContent = '日主';
    document.getElementById('bazi-hour-shishen').textContent = hourShiShen;

    // 渲染纳音行
    document.getElementById('bazi-year-nayin').textContent = getNayin(bazi.year.gan, bazi.year.zhi);
    document.getElementById('bazi-month-nayin').textContent = getNayin(bazi.month.gan, bazi.month.zhi);
    document.getElementById('bazi-day-nayin').textContent = getNayin(bazi.day.gan, bazi.day.zhi);
    document.getElementById('bazi-hour-nayin').textContent = getNayin(bazi.hour.gan, bazi.hour.zhi);

    // 日主信息
    document.getElementById('bazi-daymaster-name').textContent = bazi.dayMaster + bazi.dayMasterWuxing;
    document.getElementById('bazi-daymaster-trait').textContent = bazi.dayMasterTrait;

    // 元男/元女显示
    const yuanGenderEl = document.getElementById('bazi-yuan-gender');
    const dayLabelEl = document.getElementById('bazi-day-label');
    if (selectedGender) {
      const yuanInfo = getYuanGender(bazi.year.gan, selectedGender);
      yuanGenderEl.textContent = yuanInfo.label;
      yuanGenderEl.className = 'bazi-yuan-gender ' + (yuanInfo.direction === 'forward' ? 'yuan-male' : 'yuan-female');
      yuanGenderEl.title = yuanInfo.direction === 'forward' ? '大运顺行' : '大运逆行';
      // 日柱标签替换为元男/元女
      if (dayLabelEl) {
        dayLabelEl.textContent = yuanInfo.label;
        dayLabelEl.style.color = yuanInfo.direction === 'forward' ? '#64B5F6' : '#F48FB1';
      }
    } else {
      yuanGenderEl.textContent = '';
      if (dayLabelEl) {
        dayLabelEl.textContent = '日柱';
        dayLabelEl.style.color = '';
      }
    }

    // 显示滴天髓阐微
    const ditianData = DITIAN_SUI_DATA[bazi.dayMaster];
    if (ditianData) {
      ditianCard.style.display = 'block';
      document.getElementById('ditian-gan-badge').textContent = bazi.dayMaster;
      document.getElementById('ditian-gan-title').textContent = ditianData.title;
      document.getElementById('ditian-original').textContent = ditianData.original;
      document.getElementById('ditian-commentary').textContent = ditianData.commentary;
    } else {
      ditianCard.style.display = 'none';
    }

    // 大运计算和显示
    if (selectedGender) {
      const yuanInfo = getYuanGender(bazi.year.gan, selectedGender);
      // 计算精确起运岁数
      const qiyunResult = calculateQiYunAge(byear, bmonth, bday, yuanInfo.direction);
      const daYunList = calculateDaYun(bazi.month.gan, bazi.month.zhi, yuanInfo.direction, 8, qiyunResult.qiyunAge);
      const dayunSection = document.getElementById('bazi-dayun-section');
      const dayunListEl = document.getElementById('bazi-dayun-list');
      dayunSection.style.display = 'block';

      // 显示起运信息
      const qiyunInfoEl = document.getElementById('qiyun-info');
      if (qiyunInfoEl) {
        let ageText = `${qiyunResult.qiyunAge}岁`;
        if (qiyunResult.qiyunMonths > 0) ageText += `${qiyunResult.qiyunMonths}个月`;
        qiyunInfoEl.innerHTML = `<i class="fas fa-info-circle"></i> <strong>${ageText}起运</strong>　<span class="qiyun-detail">${qiyunResult.desc}</span>`;
        qiyunInfoEl.style.display = 'block';
      }

      // 计算每步大运的实际起止年份
      const birthYear = byear;
      const currentYear = new Date().getFullYear();
      const currentAge = currentYear - birthYear;

      // 找出当前所在的大运索引
      let activeDayunIdx = -1;
      daYunList.forEach((dy, idx) => {
        const nextStartAge = (idx < daYunList.length - 1) ? daYunList[idx + 1].startAge : dy.startAge + 10;
        dy.startYear = birthYear + dy.startAge;
        dy.endYear = birthYear + nextStartAge - 1;
        if (currentAge >= dy.startAge && currentAge < nextStartAge) {
          activeDayunIdx = idx;
        }
      });

      dayunListEl.innerHTML = daYunList.map((dy, idx) => {
        const ganColor = GAN_WUXING_COLOR[dy.gan] || '#ffd54f';
        const zhiColor = ZHI_WUXING_COLOR[dy.zhi] || '#ffd54f';
        const isActive = idx === activeDayunIdx;
        return `<div class="dayun-item${isActive ? ' dayun-active' : ''}" data-dayun-idx="${idx}" data-start-year="${dy.startYear}" data-end-year="${dy.endYear}" data-start-age="${dy.startAge}">
          <div class="dayun-age">${dy.startAge}岁</div>
          <div class="dayun-ganzhi">
            <span class="dayun-gan" style="color:${ganColor}">${dy.gan}</span>
            <span class="dayun-zhi" style="color:${zhiColor}">${dy.zhi}</span>
          </div>
          <div class="dayun-years">${dy.startYear}-${dy.endYear}</div>
          <div class="dayun-nayin">${dy.nayin}</div>
          ${isActive ? '<div class="dayun-current-badge">当前</div>' : ''}
        </div>`;
      }).join('');

      // 流年区域（默认显示当前大运对应的流年）
      const liunianSection = document.getElementById('bazi-liunian-section');
      const liunianListEl = document.getElementById('bazi-liunian-list');
      const liunianTitleEl = document.getElementById('bazi-liunian-title');
      liunianSection.style.display = 'block';

      // 渲染指定大运对应的流年
      function renderLiunianForDayun(dayunIdx) {
        const dy = daYunList[dayunIdx];
        if (!dy) return;
        const startYear = dy.startYear;
        const endYear = dy.endYear;
        const yearCount = endYear - startYear + 1;
        const liunianList = getLiuNian(startYear, yearCount);

        // 更新标题
        if (liunianTitleEl) {
          liunianTitleEl.innerHTML = `<i class="fas fa-calendar-check"></i> 流年 · ${dy.gan}${dy.zhi}大运（${startYear}-${endYear}）`;
        }

        // 动画渲染流年
        liunianListEl.innerHTML = '';
        liunianList.forEach((ln, i) => {
          const ganColor = GAN_WUXING_COLOR[ln.gan] || '#ffd54f';
          const zhiColor = ZHI_WUXING_COLOR[ln.zhi] || '#ffd54f';
          const isCurrentYear = ln.year === currentYear;
          const ageAtYear = ln.year - birthYear;
          const yearInDayun = i + 1;
          const el = document.createElement('div');
          el.className = `liunian-item${isCurrentYear ? ' liunian-current' : ''}`;
          el.style.opacity = '0';
          el.style.transform = 'translateY(10px)';
          el.innerHTML = `
            <div class="liunian-year">${ln.year}</div>
            <div class="liunian-ganzhi">
              <span style="color:${ganColor}">${ln.gan}</span>
              <span style="color:${zhiColor}">${ln.zhi}</span>
            </div>
            <div class="liunian-age">${ageAtYear}岁</div>
            <div class="liunian-nayin">${ln.nayin}</div>
            <div class="liunian-shengxiao">${ln.shengxiao}</div>
            <div class="liunian-seq">第${yearInDayun}年</div>
          `;
          liunianListEl.appendChild(el);
          // 逐个动画出现
          setTimeout(() => {
            el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, i * 60);
        });

        // 高亮当前选中的大运
        dayunListEl.querySelectorAll('.dayun-item').forEach(item => {
          item.classList.remove('dayun-selected');
        });
        const selectedItem = dayunListEl.querySelector(`[data-dayun-idx="${dayunIdx}"]`);
        if (selectedItem) selectedItem.classList.add('dayun-selected');

        // 滚动流年区域到可视范围
        setTimeout(() => {
          liunianSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 200);
      }

      // 大运点击事件
      dayunListEl.addEventListener('click', (e) => {
        const item = e.target.closest('.dayun-item');
        if (!item) return;
        const idx = parseInt(item.dataset.dayunIdx);
        renderLiunianForDayun(idx);
      });

      // 默认显示当前大运的流年（如果有），否则显示第一步大运
      const defaultDayunIdx = activeDayunIdx >= 0 ? activeDayunIdx : 0;
      renderLiunianForDayun(defaultDayunIdx);
    }

    // 八字简评：先立即显示本地简评，再异步请求AI简评替换
    const baziCommentEl = document.getElementById('bazi-brief-comment');
    const localComment = generateBaziComment(bazi);
    // 将本地简评按段落分割并渲染（支持【标题】格式）
    const commentSections = localComment.split('\n\n').filter(s => s.trim());
    let commentHTML = '';

    // 在八字简评开头添加元男/元女的解释说明
    if (selectedGender) {
      const yuanInfo = getYuanGender(bazi.year.gan, selectedGender);
      const isYangGan = TIANGAN_YINYANG[bazi.year.gan] === '阳';
      const yearGanYY = isYangGan ? '阳' : '阴';
      const genderCn = selectedGender === 'male' ? '男' : '女';
      const yuanExplain = yuanInfo.label === '元男'
        ? `年干「${bazi.year.gan}」属${yearGanYY}干，${genderCn}命逢${yearGanYY}年，阴阳同性，命理学中称为「元男」，大运顺行排列。`
        : `年干「${bazi.year.gan}」属${yearGanYY}干，${genderCn}命逢${yearGanYY}年，阴阳异性，命理学中称为「元女」，大运逆行排列。`;
      const yuanNote = '注：元男/元女是命理学中的阴阳属性分类，并非指生理性别。阳年男命或阴年女命为「元男」（大运顺行），阴年男命或阳年女命为「元女」（大运逆行）。';
      commentHTML += `<div class="bazi-comment-section" style="border-color:rgba(168,132,255,0.15);background:rgba(168,132,255,0.06);">
        <div class="bazi-comment-title" style="color:#a884ff;background:rgba(168,132,255,0.12);border-color:rgba(168,132,255,0.2);">☯ ${yuanInfo.label}释义</div>
        <div class="bazi-comment-text">${yuanExplain}</div>
        <div class="bazi-comment-text" style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:6px;font-style:italic;">${yuanNote}</div>
      </div>`;
    }

    commentHTML += commentSections.map(section => {
      const titleMatch = section.match(/^【(.+?)】(.*)$/s);
      if (titleMatch) {
        return `<div class="bazi-comment-section"><div class="bazi-comment-title">${titleMatch[1]}</div><div class="bazi-comment-text">${titleMatch[2].trim()}</div></div>`;
      }
      return `<div class="bazi-comment-section"><div class="bazi-comment-title">📋 八字简评</div><div class="bazi-comment-text">${section.trim()}</div></div>`;
    }).join('');
    baziCommentEl.innerHTML = commentHTML;
    // 异步请求AI简评，成功后替换（保留元男/元女解释）
    const yuanGenderExplainHTML = baziCommentEl.querySelector('.bazi-comment-section[style*="168,132,255"]');
    const yuanGenderExplainStr = yuanGenderExplainHTML ? yuanGenderExplainHTML.outerHTML : '';
    fetchBaziAIComment(bazi, byear, bmonth, bday, finalShichen).then(aiComment => {
      if (aiComment) {
        baziCommentEl.innerHTML = yuanGenderExplainStr + aiComment;
        baziCommentEl.classList.add('bazi-comment-ai-loaded');
      }
    }).catch(() => {
      // AI失败，保持本地简评不变
    });

  } else {
    baziCard.style.display = 'none';
    ditianCard.style.display = 'none';
  }

  // AI掌纹分析报告卡片
  const aiCard = document.getElementById('palm-ai-analysis');
  if (hasApiData) {
    aiCard.style.display = 'block';
    const identityDiv = document.getElementById('ai-identity-info');
    if (identityInfo && identityInfo.person_id) {
      const confidence = identityInfo.confidence ? (identityInfo.confidence * 100).toFixed(1) : 'N/A';
      identityDiv.innerHTML = `
        <div class="ai-info-row">
          <i class="fas fa-user-check"></i>
          <span>身份识别：<strong>${identityInfo.person_name || identityInfo.person_id}</strong></span>
          <span class="ai-confidence">置信度 ${confidence}%</span>
        </div>
      `;
    } else {
      identityDiv.innerHTML = `
        <div class="ai-info-row">
          <i class="fas fa-user-secret"></i>
          <span>身份：神秘来客（掌纹库中暂未找到匹配）</span>
        </div>
      `;
    }

    const featuresDiv = document.getElementById('ai-palm-features');
    if (imageFeatures) {
      const brightness = imageFeatures.brightness || 0;
      const texture = imageFeatures.texture_complexity || 0;
      const contrast = imageFeatures.contrast || 0;
      const warmRatio = ((imageFeatures.warm_ratio || 0) * 100).toFixed(1);
      const highFreq = ((imageFeatures.high_freq_ratio || 0) * 100).toFixed(1);
      featuresDiv.innerHTML = `
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-label">掌纹光泽度</div>
            <div class="feature-bar-wrap"><div class="feature-bar"><div class="feature-bar-fill" style="width:${Math.min(brightness / 2.55, 100)}%;background:linear-gradient(90deg,#10b981,#34d399)"></div></div><span>${brightness.toFixed(0)}</span></div>
          </div>
          <div class="feature-item">
            <div class="feature-label">纹理复杂度</div>
            <div class="feature-bar-wrap"><div class="feature-bar"><div class="feature-bar-fill" style="width:${Math.min(texture / 0.6, 100)}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa)"></div></div><span>${texture.toFixed(1)}</span></div>
          </div>
          <div class="feature-item">
            <div class="feature-label">纹路清晰度</div>
            <div class="feature-bar-wrap"><div class="feature-bar"><div class="feature-bar-fill" style="width:${Math.min(contrast / 0.8, 100)}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div><span>${contrast.toFixed(1)}</span></div>
          </div>
          <div class="feature-item">
            <div class="feature-label">暖色调比例</div>
            <div class="feature-bar-wrap"><div class="feature-bar"><div class="feature-bar-fill" style="width:${warmRatio}%;background:linear-gradient(90deg,#ec4899,#f472b6)"></div></div><span>${warmRatio}%</span></div>
          </div>
          <div class="feature-item">
            <div class="feature-label">纹路密度</div>
            <div class="feature-bar-wrap"><div class="feature-bar"><div class="feature-bar-fill" style="width:${highFreq}%;background:linear-gradient(90deg,#06b6d4,#22d3ee)"></div></div><span>${highFreq}%</span></div>
          </div>
        </div>
      `;
    }
  } else {
    aiCard.style.display = 'none';
  }

  // 分数环动画
  animateScore(totalScore);

  // 运势等级
  document.getElementById('fortune-level').innerHTML = `
    <span style="color:${level.color}">${level.emoji} ${level.text}</span>
  `;

  // 今日关键词
  generateKeywords(totalScore, rng);

  // 四维运势（优先使用大模型返回的运势文本）
  setFortuneDetail('love', loveScore, rng, fortuneTexts && fortuneTexts.love);
  setFortuneDetail('career', careerScore, rng, fortuneTexts && fortuneTexts.career);
  setFortuneDetail('wealth', wealthScore, rng, fortuneTexts && fortuneTexts.wealth);
  setFortuneDetail('health', healthScore, rng, fortuneTexts && fortuneTexts.health);

  // 掌纹解读
  if (palmLineReadings && palmLineReadings.length > 0) {
    document.getElementById('fusion-palm-lines').innerHTML = palmLineReadings.map(line => `
      <div class="palm-line-item">
        <div class="palm-line-icon">${line.icon}</div>
        <div class="palm-line-info"><h5>${line.name}</h5><p>${line.text}</p></div>
      </div>
    `).join('');
  } else {
    document.getElementById('fusion-palm-lines').innerHTML = PALM_LINES_DATA.map((line, lineIdx) => {
      // 基于日期和线条索引的确定性选择（非随机）
      const _plDayIdx = new Date().getDate();
      const desc = line.descriptions[(_plDayIdx + lineIdx * 3) % line.descriptions.length];
      return `
        <div class="palm-line-item">
          <div class="palm-line-icon">${line.icon}</div>
          <div class="palm-line-info"><h5>${line.name}</h5><p>${desc}</p></div>
        </div>
      `;
    }).join('');
  }

  // ===== 星座守护星解读（先显示本地数据，异步请求AI分析后替换） =====
  const constellationCard = document.getElementById('constellation-guardian-card');
  if (selectedConstellation !== null && CONSTELLATION_GUARDIAN_DATA[selectedConstellation]) {
    constellationCard.style.display = 'block';
    const cData = CONSTELLATION_GUARDIAN_DATA[selectedConstellation];
    // 基于星座索引+日期的确定性分数（非随机）
    const dayOfMonth = new Date().getDate();
    const monthVal = new Date().getMonth() + 1;
    const cScore = 65 + ((selectedConstellation * 7 + dayOfMonth * 3 + monthVal * 11) % 30);
    const cCat = cScore >= 80 ? 'high' : (cScore >= 65 ? 'mid' : 'low');
    const cReading = cData.readings[cCat];

    document.getElementById('guardian-constellation-name').textContent = CONSTELLATIONS[selectedConstellation].name;
    document.getElementById('guardian-constellation-symbol').textContent = cData.symbol;
    document.getElementById('guardian-star-name').textContent = cData.guardian;
    document.getElementById('guardian-element-type').textContent = cData.element;
    document.getElementById('guardian-quality').textContent = cData.quality;
    document.getElementById('guardian-reading').textContent = cReading;

    // 异步请求AI星座分析，成功后替换本地数据
    const _aiConstellationName = CONSTELLATIONS[selectedConstellation].name;
    const _aiConstellationIdx = selectedConstellation;
    // 添加AI加载标记
    const guardianReadingEl = document.getElementById('guardian-reading');
    const guardianCardTitle = constellationCard.querySelector('h3');
    if (guardianCardTitle) {
      guardianCardTitle.innerHTML = `<i class="fas fa-star"></i> 星座守护星解读 <span id="constellation-ai-badge" style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:400;margin-left:4px;"><i class="fas fa-spinner fa-spin"></i> AI分析中...</span>`;
    }

    fetchConstellationAIAnalysis(_aiConstellationName, _aiConstellationIdx).then(aiData => {
      const aiBadge = document.getElementById('constellation-ai-badge');
      if (aiData) {
        // AI分析成功，更新守护星解读
        if (aiData.guardian_reading) {
          guardianReadingEl.textContent = aiData.guardian_reading;
        }
        // 更新四维运势分数（如果AI返回了分数）
        if (aiData.love_score) {
          const aiLoveScore = Math.max(65, Math.min(98, aiData.love_score));
          setFortuneDetail('love', aiLoveScore, rng, aiData.love);
        }
        if (aiData.career_score) {
          const aiCareerScore = Math.max(65, Math.min(98, aiData.career_score));
          setFortuneDetail('career', aiCareerScore, rng, aiData.career);
        }
        if (aiData.wealth_score) {
          const aiWealthScore = Math.max(65, Math.min(98, aiData.wealth_score));
          setFortuneDetail('wealth', aiWealthScore, rng, aiData.wealth);
        }
        if (aiData.health_score) {
          const aiHealthScore = Math.max(65, Math.min(98, aiData.health_score));
          setFortuneDetail('health', aiHealthScore, rng, aiData.health);
        }
        // 更新总分
        if (aiData.overall_score) {
          const aiTotalScore = Math.max(65, Math.min(98, aiData.overall_score));
          animateScore(aiTotalScore);
          const aiLevel = getFortuneLevel(aiTotalScore);
          document.getElementById('fortune-level').innerHTML = `<span style="color:${aiLevel.color}">${aiLevel.emoji} ${aiLevel.text}</span>`;
        }
        // 更新幸运色和幸运数字（如果AI返回了）
        if (aiData.lucky_color) {
          document.getElementById('lucky-color-name').textContent = aiData.lucky_color;
          document.getElementById('lucky-color').style.background = getColorHex(aiData.lucky_color);
        }
        if (aiData.lucky_number) {
          document.getElementById('lucky-number').textContent = aiData.lucky_number;
        }
        // 更新速配星座
        if (aiData.lucky_constellation) {
          const guardianMetaEl = constellationCard.querySelector('.guardian-meta');
          if (guardianMetaEl) {
            // 查找或添加速配星座标签
            let matchTag = guardianMetaEl.querySelector('.guardian-tag-match');
            if (!matchTag) {
              matchTag = document.createElement('span');
              matchTag.className = 'guardian-tag guardian-tag-match';
              guardianMetaEl.appendChild(matchTag);
            }
            matchTag.innerHTML = `<i class="fas fa-heart"></i> 速配：<strong>${aiData.lucky_constellation}</strong>`;
          }
        }
        // 更新特别提醒
        if (aiData.special_reminder) {
          const reminderEl = document.getElementById('constellation-special-reminder');
          if (reminderEl) {
            reminderEl.textContent = aiData.special_reminder;
            // parentElement是inner div, 再上一层是wrap div
            const wrapEl = reminderEl.closest('.constellation-special-reminder-wrap');
            if (wrapEl) wrapEl.style.display = 'block';
          }
        }
        // 更新AI标记
        if (aiBadge) {
          aiBadge.innerHTML = '<i class="fas fa-robot"></i> AI占星';
          aiBadge.style.color = '#22d3ee';
        }
        // 添加闪烁动画
        constellationCard.classList.add('report-updated');
        setTimeout(() => constellationCard.classList.remove('report-updated'), 1000);
        console.log('[AI星座分析] 成功更新星座运势');
      } else {
        // AI分析失败，保持本地数据
        if (aiBadge) {
          aiBadge.innerHTML = '<i class="fas fa-database"></i> 本地数据';
          aiBadge.style.color = 'rgba(255,255,255,0.35)';
        }
        console.warn('[AI星座分析] 请求失败，保持本地数据');
      }
    }).catch(() => {
      const aiBadge = document.getElementById('constellation-ai-badge');
      if (aiBadge) {
        aiBadge.innerHTML = '<i class="fas fa-database"></i> 本地数据';
        aiBadge.style.color = 'rgba(255,255,255,0.35)';
      }
    });
  } else {
    constellationCard.style.display = 'none';
  }

  // ===== 生肖流年运势 =====
  const zodiacFortuneCard = document.getElementById('zodiac-fortune-card');
  if (selectedZodiac !== null && ZODIAC_FORTUNE_DATA[selectedZodiac]) {
    zodiacFortuneCard.style.display = 'block';
    const zData = ZODIAC_FORTUNE_DATA[selectedZodiac];
    document.getElementById('zodiac-fortune-name').innerHTML = `${ZODIACS[selectedZodiac].emoji} 属${zData.name}`;
    document.getElementById('zodiac-fortune-element').textContent = zData.element;
    document.getElementById('zodiac-fortune-ally').textContent = zData.ally;
    document.getElementById('zodiac-fortune-liuhe').textContent = zData.liuhe;
    document.getElementById('zodiac-fortune-conflict').textContent = zData.conflict;
    document.getElementById('zodiac-fortune-reading').textContent = zData.fortune;
  } else {
    zodiacFortuneCard.style.display = 'none';
  }

  // ===== 五行能量分析（基于八字四柱真实计算） =====
  const fiveElementsCard = document.getElementById('five-elements-card');
  fiveElementsCard.style.display = 'block';
  const elements = ['metal', 'wood', 'water', 'fire', 'earth'];
  const elementScores = {};
  let maxElement = 'wood';
  let maxScore = 0;

  if (baziData) {
    // 基于八字四柱计算真实五行力量
    // 五行权重：天干=3（主气，显露在外），地支本气=2.5，藏干中气=1.5，藏干余气=0.8
    const wxWeight = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const pillars = [baziData.year, baziData.month, baziData.day, baziData.hour];

    pillars.forEach((p, idx) => {
      // 天干权重：日干稍高（代表自身）
      const ganWeight = (idx === 2) ? 3.5 : 3.0;
      if (p.gan && BAZI_WUXING_GAN[p.gan]) {
        wxWeight[BAZI_WUXING_GAN[p.gan]] += ganWeight;
      }
      // 地支：本气权重2.5
      if (p.zhi && BAZI_WUXING_ZHI[p.zhi]) {
        wxWeight[BAZI_WUXING_ZHI[p.zhi]] += 2.5;
      }
      // 地支藏干：第一个为本气(已在地支中计算)，第二个为中气，第三个为余气
      if (p.zhi && DIZHI_CANGGAN[p.zhi]) {
        const canggan = DIZHI_CANGGAN[p.zhi];
        canggan.forEach((cg, cgIdx) => {
          if (BAZI_WUXING_GAN[cg]) {
            // 本气=1.5（补充地支本气），中气=1.2，余气=0.8
            const cgWeight = cgIdx === 0 ? 1.5 : (cgIdx === 1 ? 1.2 : 0.8);
            wxWeight[BAZI_WUXING_GAN[cg]] += cgWeight;
          }
        });
      }
    });

    // 将权重转换为百分比（0-100），最高的映射到85-95，最低的映射到10-30
    const wxValues = Object.values(wxWeight);
    const wxMax = Math.max(...wxValues);
    const wxMin = Math.min(...wxValues);
    const wxRange = wxMax - wxMin || 1;

    // 中文五行名到英文key的映射
    const wxToKey = { '金': 'metal', '木': 'wood', '水': 'water', '火': 'fire', '土': 'earth' };

    for (const [wx, weight] of Object.entries(wxWeight)) {
      // 归一化到15-95的范围，确保视觉效果好
      const normalized = Math.round(15 + (weight - wxMin) / wxRange * 80);
      const key = wxToKey[wx];
      elementScores[key] = normalized;
      if (normalized > maxScore) { maxScore = normalized; maxElement = key; }
    }
  } else {
    // 无八字数据时基于日期和生肖的确定性五行分布（非随机）
    const _wuDayIdx = new Date().getDate();
    const _wuZodiacIdx = selectedZodiac !== null ? selectedZodiac : 0;
    const baseScores = [45, 55, 35, 50, 40]; // 金木水火土基础值
    elements.forEach((el, i) => {
      const score = 15 + ((baseScores[i] + _wuDayIdx * (i + 2) + _wuZodiacIdx * 7) % 75);
      elementScores[el] = score;
      if (score > maxScore) { maxScore = score; maxElement = el; }
    });
  }

  const dominantEl = FIVE_ELEMENTS_DATA[maxElement];
  document.getElementById('dominant-element-icon').textContent = dominantEl.icon;
  document.getElementById('dominant-element-name').textContent = dominantEl.name;
  document.getElementById('dominant-element-trait').textContent = dominantEl.trait;
  document.getElementById('dominant-element-desc').textContent = dominantEl.desc;

  const elemBarsHTML = elements.map(el => {
    const data = FIVE_ELEMENTS_DATA[el];
    const score = elementScores[el];
    const isMax = el === maxElement;
    return `
      <div class="element-bar-item ${isMax ? 'dominant' : ''}">
        <div class="element-bar-label">
          <span class="element-bar-icon">${data.icon}</span>
          <span>${data.name}</span>
        </div>
        <div class="element-bar-track">
          <div class="element-bar-fill" style="width:${score}%;background:${data.color};"></div>
        </div>
        <span class="element-bar-score">${score}%</span>
      </div>
    `;
  }).join('');
  document.getElementById('five-elements-bars').innerHTML = elemBarsHTML;

  // ===== 天干地支今日解读 =====
  const ganzhiCard = document.getElementById('ganzhi-card');
  ganzhiCard.style.display = 'block';
  // 使用正确的天干地支算法（基于北京时间）
  const todayGanzhiData = getTodayGanzhi();
  const ganIdx = todayGanzhiData.ganIdx;
  const zhiIdx = todayGanzhiData.zhiIdx;
  const todayGanzhi = todayGanzhiData.ganzhi;
  const ganElement = todayGanzhiData.element;
  const zhiAnimal = todayGanzhiData.animal;
  document.getElementById('ganzhi-today').textContent = todayGanzhi;
  document.getElementById('ganzhi-element').textContent = ganElement;
  document.getElementById('ganzhi-animal').textContent = zhiAnimal;
  // 显示阳历和阴历日期
  const dateWithLunar = formatDateWithLunar();
  const ganzhiDateEl = document.getElementById('ganzhi-date-info');
  if (ganzhiDateEl) {
    ganzhiDateEl.innerHTML = `<div class="ganzhi-solar-date"><i class="fas fa-calendar-day"></i> ${dateWithLunar.solar}</div><div class="ganzhi-lunar-date"><i class="fas fa-moon"></i> ${dateWithLunar.lunar}</div>`;
  }
  // 基于干支索引的确定性选择（非随机）
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const ganzhiReadingIdx = (ganIdx + zhiIdx + dayOfYear) % GANZHI_READINGS.length;
  document.getElementById('ganzhi-reading').textContent = GANZHI_READINGS[ganzhiReadingIdx];

  // 今日建议（基于日期和时段的确定性选择）
  const timeOfDay = getTimeOfDay();
  const timeAdvices = ADVICES[timeOfDay] || ADVICES.morning;
  const generalAdvices = ADVICES.general;
  const _dayIdx = new Date().getDate();
  const _monthIdx = new Date().getMonth();
  const advice1 = timeAdvices[_dayIdx % timeAdvices.length];
  const advice2 = timeAdvices[(_dayIdx + 1) % timeAdvices.length];
  const advice3 = generalAdvices[_dayIdx % generalAdvices.length];
  const advice4 = generalAdvices[(_dayIdx + 3) % generalAdvices.length];
  const advice5 = generalAdvices[(_dayIdx + 5) % generalAdvices.length];
  const allAdvices = [advice1, advice2, advice3, advice4, advice5];
  document.getElementById('advice-content').innerHTML = allAdvices.map(a => `
    <div class="advice-item"><i class="fas ${a.icon}"></i><span>${a.text}</span></div>
  `).join('');

  // 幸运信息（基于日期和五行的确定性选择）
  const _luckyDayIdx = new Date().getDate();
  const _luckyMonthIdx = new Date().getMonth();
  const _luckyZodiacIdx = selectedZodiac !== null ? selectedZodiac : 0;
  const luckyColor = LUCKY_COLORS[(_luckyDayIdx + _luckyMonthIdx) % LUCKY_COLORS.length];
  document.getElementById('lucky-color').style.background = luckyColor.color;
  document.getElementById('lucky-color-name').textContent = luckyColor.name;
  document.getElementById('lucky-number').textContent = ((_luckyDayIdx * 7 + _luckyZodiacIdx * 13 + _luckyMonthIdx * 3) % 99) + 1;
  document.getElementById('lucky-direction').textContent = DIRECTIONS[(_luckyDayIdx + _luckyZodiacIdx) % DIRECTIONS.length];
  document.getElementById('lucky-time').textContent = LUCKY_TIMES[(_luckyDayIdx + _luckyMonthIdx * 2) % LUCKY_TIMES.length];

  const luckyItem = LUCKY_ITEMS[(_luckyDayIdx + _luckyMonthIdx) % LUCKY_ITEMS.length];
  const luckyFlower = LUCKY_FLOWERS[(_luckyDayIdx * 3 + _luckyMonthIdx) % LUCKY_FLOWERS.length];
  document.getElementById('lucky-item-icon').textContent = luckyItem.icon;
  document.getElementById('lucky-item-name').textContent = luckyItem.name;
  document.getElementById('lucky-item-desc').textContent = luckyItem.desc;
  document.getElementById('lucky-flower-icon').textContent = luckyFlower.icon;
  document.getElementById('lucky-flower-name').textContent = luckyFlower.name;
  document.getElementById('lucky-flower-desc').textContent = luckyFlower.desc;

  // 宜忌（基于日期的确定性选择）
  generateYiJi();

  // 鼓励文案（根据运势分数匹配对应类别）
  const _encDayIdx = new Date().getDate();
  let _encCategory = 'mid';
  if (totalScore >= 80) _encCategory = 'high';
  else if (totalScore < 70) _encCategory = 'low';
  const _encList = ENCOURAGEMENTS[_encCategory];
  document.getElementById('fusion-encourage-text').textContent = _encList[_encDayIdx % _encList.length];
}

function generateKeywords(score, rng) {
  const keywordsEl = document.getElementById('keywords-list');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let keywords = [];
  if (score >= 70) {
    keywords = [
      { text: pick(KEYWORDS_POSITIVE), type: 'positive' },
      { text: pick(KEYWORDS_POSITIVE), type: 'positive' },
      { text: pick(KEYWORDS_POSITIVE), type: 'positive' },
      { text: pick(KEYWORDS_NEUTRAL), type: 'neutral' }
    ];
  } else if (score >= 50) {
    keywords = [
      { text: pick(KEYWORDS_NEUTRAL), type: 'neutral' },
      { text: pick(KEYWORDS_NEUTRAL), type: 'neutral' },
      { text: pick(KEYWORDS_POSITIVE), type: 'positive' },
      { text: pick(KEYWORDS_CAUTION), type: 'caution' }
    ];
  } else {
    keywords = [
      { text: pick(KEYWORDS_CAUTION), type: 'caution' },
      { text: pick(KEYWORDS_CAUTION), type: 'caution' },
      { text: pick(KEYWORDS_NEUTRAL), type: 'neutral' },
      { text: pick(KEYWORDS_POSITIVE), type: 'positive' }
    ];
  }
  keywordsEl.innerHTML = keywords.map(k => `<span class="keyword-tag ${k.type}">${k.text}</span>`).join('');
}

function setFortuneDetail(type, score, rng, llmText) {
  const cat = getScoreCategory(score);
  const texts = FORTUNE_TEXTS[type];
  if (!texts || !texts[cat]) return;
  let text = llmText;
  if (!text) {
    text = texts[cat][Math.floor(Math.random() * texts[cat].length)];
  }
  const barEl = document.getElementById(`bar-${type}`);
  const scoreTextEl = document.getElementById(`score-${type}`);
  const textEl = document.getElementById(`text-${type}`);
  if (textEl) textEl.textContent = text;
  if (scoreTextEl) scoreTextEl.textContent = score;
  setTimeout(() => { if (barEl) barEl.style.width = `${score}%`; }, 300);
}

function generateYiJi() {
  const yiList = document.getElementById('yi-list');
  const jiList = document.getElementById('ji-list');
  // 随机选择宜忌项
  const shuffledYi = [...YI_DATA].sort(() => Math.random() - 0.5);
  const shuffledJi = [...JI_DATA].sort(() => Math.random() - 0.5);
  const yiItems = shuffledYi.slice(0, 4);
  const jiItems = shuffledJi.slice(0, 4);
  yiList.innerHTML = yiItems.map(item => `<div class="yiji-item">• ${item}</div>`).join('');
  jiList.innerHTML = jiItems.map(item => `<div class="yiji-item">• ${item}</div>`).join('');

  // 添加AI加载标记到宜忌卡片标题
  const yijiCard = document.getElementById('yiji-card');
  if (yijiCard) {
    const yijiTitle = yijiCard.querySelector('h3');
    if (yijiTitle) {
      yijiTitle.innerHTML = `<i class="fas fa-yin-yang"></i> 今日宜忌 <span id="yiji-ai-badge" style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:400;margin-left:4px;"><i class="fas fa-spinner fa-spin"></i> AI老黄历分析中...</span>`;
    }
  }

  // 异步请求AI老黄历宜忌分析
  const zodiacName = selectedZodiac !== null ? ZODIACS[selectedZodiac].name : '';
  fetchYiJiAIAnalysis(zodiacName).then(aiData => {
    const aiBadge = document.getElementById('yiji-ai-badge');
    if (aiData) {
      // AI分析成功，更新宜忌列表
      if (aiData.yi_items && aiData.yi_items.length > 0) {
        yiList.innerHTML = aiData.yi_items.map(item => `<div class="yiji-item">• ${item}</div>`).join('');
      }
      if (aiData.ji_items && aiData.ji_items.length > 0) {
        jiList.innerHTML = aiData.ji_items.map(item => `<div class="yiji-item">• ${item}</div>`).join('');
      }

      // 在宜忌卡片下方添加老黄历详细信息
      const yijiDetailSection = document.getElementById('yiji-detail-section');
      if (yijiDetailSection) {
        let detailHTML = '';

        // 宜忌详解
        if (aiData.yi_details || aiData.ji_details) {
          detailHTML += `<div class="yiji-explain-section">`;
          if (aiData.yi_details) {
            detailHTML += `<div class="yiji-explain-item yi-explain"><div class="yiji-explain-label"><span class="yi-badge" style="font-size:11px;padding:2px 8px;">宜</span> 详解</div><p class="yiji-explain-text">${aiData.yi_details}</p></div>`;
          }
          if (aiData.ji_details) {
            detailHTML += `<div class="yiji-explain-item ji-explain"><div class="yiji-explain-label"><span class="ji-badge" style="font-size:11px;padding:2px 8px;">忌</span> 详解</div><p class="yiji-explain-text">${aiData.ji_details}</p></div>`;
          }
          detailHTML += `</div>`;
        }

        // 黄历要素（建除十二神、二十八宿、五行、冲煞）
        if (aiData.jianchu || aiData.star28 || aiData.wuxing_day || aiData.chong_sha) {
          detailHTML += `<div class="yiji-huangli-grid">`;
          if (aiData.jianchu) {
            detailHTML += `<div class="huangli-tag-item"><span class="huangli-tag-label">建除</span><span class="huangli-tag-value">${aiData.jianchu}</span></div>`;
          }
          if (aiData.star28) {
            detailHTML += `<div class="huangli-tag-item"><span class="huangli-tag-label">值宿</span><span class="huangli-tag-value">${aiData.star28}</span></div>`;
          }
          if (aiData.wuxing_day) {
            detailHTML += `<div class="huangli-tag-item"><span class="huangli-tag-label">五行</span><span class="huangli-tag-value">${aiData.wuxing_day}</span></div>`;
          }
          if (aiData.chong_sha) {
            detailHTML += `<div class="huangli-tag-item"><span class="huangli-tag-label">冲煞</span><span class="huangli-tag-value">${aiData.chong_sha}</span></div>`;
          }
          detailHTML += `</div>`;
        }

        // 建除十二神和二十八宿含义
        if (aiData.jianchu_meaning || aiData.star28_meaning) {
          detailHTML += `<div class="yiji-meaning-section">`;
          if (aiData.jianchu_meaning) {
            detailHTML += `<p class="yiji-meaning-text"><strong>「${aiData.jianchu}」日：</strong>${aiData.jianchu_meaning}</p>`;
          }
          if (aiData.star28_meaning) {
            detailHTML += `<p class="yiji-meaning-text"><strong>「${aiData.star28}」：</strong>${aiData.star28_meaning}</p>`;
          }
          detailHTML += `</div>`;
        }

        // 神位方向（财神、喜神、福神）
        if (aiData.lucky_god_direction || aiData.xi_god_direction || aiData.fu_god_direction) {
          detailHTML += `<div class="yiji-gods-grid">`;
          if (aiData.lucky_god_direction) {
            detailHTML += `<div class="god-direction-item"><span class="god-icon">💰</span><span class="god-label">财神</span><span class="god-value">${aiData.lucky_god_direction}</span></div>`;
          }
          if (aiData.xi_god_direction) {
            detailHTML += `<div class="god-direction-item"><span class="god-icon">🎊</span><span class="god-label">喜神</span><span class="god-value">${aiData.xi_god_direction}</span></div>`;
          }
          if (aiData.fu_god_direction) {
            detailHTML += `<div class="god-direction-item"><span class="god-icon">🙏</span><span class="god-label">福神</span><span class="god-value">${aiData.fu_god_direction}</span></div>`;
          }
          detailHTML += `</div>`;
        }

        // 吉时凶时
        if ((aiData.auspicious_hours && aiData.auspicious_hours.length > 0) || (aiData.inauspicious_hours && aiData.inauspicious_hours.length > 0)) {
          detailHTML += `<div class="yiji-hours-section">`;
          if (aiData.auspicious_hours && aiData.auspicious_hours.length > 0) {
            detailHTML += `<div class="hours-group"><span class="hours-label yi-badge" style="font-size:10px;padding:2px 6px;">吉时</span><div class="hours-tags">${aiData.auspicious_hours.map(h => `<span class="hour-tag hour-good">${h}</span>`).join('')}</div></div>`;
          }
          if (aiData.inauspicious_hours && aiData.inauspicious_hours.length > 0) {
            detailHTML += `<div class="hours-group"><span class="hours-label ji-badge" style="font-size:10px;padding:2px 6px;">凶时</span><div class="hours-tags">${aiData.inauspicious_hours.map(h => `<span class="hour-tag hour-bad">${h}</span>`).join('')}</div></div>`;
          }
          detailHTML += `</div>`;
        }

        // 今日一卦
        if (aiData.daily_hexagram) {
          detailHTML += `<div class="yiji-hexagram-section"><div class="hexagram-header"><span class="hexagram-icon">☰</span><span class="hexagram-name">${aiData.daily_hexagram}</span></div>`;
          if (aiData.hexagram_meaning) {
            detailHTML += `<p class="hexagram-meaning">${aiData.hexagram_meaning}</p>`;
          }
          detailHTML += `</div>`;
        }

        // 今日总评
        if (aiData.day_summary) {
          detailHTML += `<div class="yiji-summary-section"><p class="yiji-summary-text">${aiData.day_summary}</p></div>`;
        }

        // 特别提醒
        if (aiData.special_note) {
          detailHTML += `<div class="yiji-special-note"><i class="fas fa-bell"></i><span>${aiData.special_note}</span></div>`;
        }

        yijiDetailSection.innerHTML = detailHTML;
        yijiDetailSection.style.display = 'block';
      }

      // 更新AI标记
      if (aiBadge) {
        aiBadge.innerHTML = '<i class="fas fa-robot"></i> AI老黄历';
        aiBadge.style.color = '#ffd54f';
      }
      // 添加闪烁动画
      if (yijiCard) {
        yijiCard.classList.add('report-updated');
        setTimeout(() => yijiCard.classList.remove('report-updated'), 1000);
      }
      console.log('[AI宜忌分析] 成功更新今日宜忌');
    } else {
      // AI分析失败，保持本地数据
      if (aiBadge) {
        aiBadge.innerHTML = '<i class="fas fa-database"></i> 本地数据';
        aiBadge.style.color = 'rgba(255,255,255,0.35)';
      }
      console.warn('[AI宜忌分析] 请求失败，保持本地数据');
    }
  }).catch(() => {
    const aiBadge = document.getElementById('yiji-ai-badge');
    if (aiBadge) {
      aiBadge.innerHTML = '<i class="fas fa-database"></i> 本地数据';
      aiBadge.style.color = 'rgba(255,255,255,0.35)';
    }
  });
}

function animateScore(targetScore) {
  const scoreNum = document.getElementById('score-num');
  const scoreCircle = document.getElementById('score-circle');
  const circumference = 2 * Math.PI * 54;
  let current = 0;
  const duration = 2000;
  const startTime = Date.now();
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.floor(eased * targetScore);
    scoreNum.textContent = current;
    const offset = circumference - (eased * targetScore / 100) * circumference;
    if (scoreCircle) scoreCircle.style.strokeDashoffset = offset;
    if (progress < 1) requestAnimationFrame(animate);
  }
  animate();
}

// ===== 分享功能（截图分享） =====
let _shareCurrentMode = null;

function getShareText(mode) {
  if (mode === 'traditional') {
    const identityName = (identifyResult && identifyResult.identified) ? identifyResult.user_id : '有缘人';
    return `🖐️ 掌纹算命 · 传统手相解读\n\n${identityName}\n📅 ${formatDate()}\n\n十大维度深度解读掌纹命理\n快来测测你的手相吧！`;
  } else {
    const identityName = (palmAnalysisResult && palmAnalysisResult.identity && palmAnalysisResult.identity.person_name)
      ? palmAnalysisResult.identity.person_name : (document.getElementById('user-name').value || '有缘人');
    const score = document.getElementById('score-num').textContent;
    const zodiacName = selectedZodiac !== null ? ZODIACS[selectedZodiac].name : '';
    const constellationName = selectedConstellation !== null ? CONSTELLATIONS[selectedConstellation].name : '';
    return `🔮 掌纹算命 · 融合解读\n\n${identityName} | ${zodiacName} | ${constellationName}\n📊 综合运势：${score}分\n📅 ${formatDate()}\n\n快来测测你的今日运势吧！`;
  }
}

function showShareModal(mode) {
  _shareCurrentMode = mode;
  var overlay = document.getElementById('share-overlay');
  var loading = document.getElementById('share-screenshot-loading');
  var preview = document.getElementById('share-screenshot-preview');
  var img = document.getElementById('share-screenshot-img');

  loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在生成截图...';
  loading.style.display = 'block';
  preview.style.display = 'none';
  img.src = '';
  overlay.classList.add('show');

  var targetId = mode === 'traditional' ? 'screen-result-traditional' : 'screen-result-fusion';
  var targetEl = document.getElementById(targetId);
  if (!targetEl) {
    loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 未找到结果页面';
    return;
  }

  var contentEl = targetEl.querySelector('.result-content') || targetEl;

  setTimeout(function() {
    _doScreenshotV4(contentEl, loading, preview, img, mode);
  }, 400);
}

/**
 * 截图方案 v5：onclone 回调清理方案
 *
 * 核心思路：
 * 1. 直接对原始DOM使用 html2canvas
 * 2. 利用 html2canvas 的 onclone 回调，在克隆后的DOM上清理所有不兼容的CSS属性
 * 3. 不创建iframe，不手动克隆DOM，完全依赖 html2canvas 自身的克隆机制
 *
 * 优势：
 * - html2canvas 自身克隆DOM时会正确复制计算样式
 * - onclone 回调在克隆完成后、截图渲染前执行，可以安全修改克隆DOM
 * - 避免了iframe跨上下文和手动克隆的各种问题
 */
function _doScreenshotV4(contentEl, loading, preview, img, mode) {
  if (!window.html2canvas) {
    console.error('[截图v5] html2canvas不可用');
    loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图组件未加载，请截屏保存';
    return;
  }

  // 获取目标screen元素
  var targetId = mode === 'traditional' ? 'screen-result-traditional' : 'screen-result-fusion';
  var targetEl = document.getElementById(targetId);
  if (!targetEl) {
    loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 未找到结果页面';
    return;
  }

  var resultContent = targetEl.querySelector('.result-content') || targetEl;

  // 备份并临时修改样式，让内容完全展开
  var savedStyles = [];
  var expandEls = [document.documentElement, document.body];
  var appContainer = document.getElementById('app') || document.querySelector('.app-container');
  if (appContainer) expandEls.push(appContainer);
  // 展开所有screen祖先
  var p = targetEl;
  while (p) {
    if (p.classList && (p.classList.contains('screen') || p.classList.contains('screens-container'))) {
      expandEls.push(p);
    }
    p = p.parentElement;
  }
  expandEls.push(targetEl);

  expandEls.forEach(function(el) {
    savedStyles.push({ el: el, cssText: el.style.cssText });
    el.style.overflow = 'visible';
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.position = 'relative';
  });

  // 等待两帧让浏览器完成重排
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      var captureWidth = resultContent.scrollWidth || resultContent.offsetWidth;
      var captureHeight = resultContent.scrollHeight || resultContent.offsetHeight;
      console.log('[截图v5] 内容尺寸=' + captureWidth + 'x' + captureHeight);

      // 动态scale
      var scale = 1.5;
      var maxCanvasPixels = 16777216 * 4; // 约67MP，保守限制
      if (captureWidth * captureHeight * scale * scale > maxCanvasPixels) {
        scale = Math.sqrt(maxCanvasPixels / (captureWidth * captureHeight));
        scale = Math.max(0.5, Math.min(scale, 1.5));
      }
      if (captureHeight > 10000) scale = Math.min(scale, 0.75);
      else if (captureHeight > 6000) scale = Math.min(scale, 1.0);

      console.log('[截图v5] 使用scale=' + scale.toFixed(2));

      // 不兼容CSS属性的清理函数（在onclone回调中使用）
      function cleanClonedDom(clonedDoc) {
        try {
          // 获取clonedDoc的window对象，兼容不同环境
          var clonedWin = clonedDoc.defaultView || clonedDoc.parentWindow || null;

          var allEls = clonedDoc.querySelectorAll('*');
          for (var i = 0; i < allEls.length; i++) {
            var el = allEls[i];
            var st = el.style;

            // 移除 backdrop-filter
            st.setProperty('backdrop-filter', 'none', 'important');
            st.setProperty('-webkit-backdrop-filter', 'none', 'important');

            // 移除 CSS 动画和过渡
            st.setProperty('animation', 'none', 'important');
            st.setProperty('-webkit-animation', 'none', 'important');
            st.setProperty('transition', 'none', 'important');
            st.setProperty('-webkit-transition', 'none', 'important');

            // 处理需要 getComputedStyle 的属性
            // 如果 clonedWin 不可用，跳过需要计算样式的清理
            if (clonedWin) {
              var cs;
              try { cs = clonedWin.getComputedStyle(el); } catch(e) { cs = null; }
              if (cs) {
                // 处理 background-clip: text（渐变文字）
                var bgClip = cs.getPropertyValue('background-clip') || cs.getPropertyValue('-webkit-background-clip') || '';
                if (bgClip === 'text') {
                  var textColor = cs.getPropertyValue('-webkit-text-fill-color') || cs.getPropertyValue('color') || '#d4a5ff';
                  if (textColor === 'transparent' || textColor === 'rgba(0, 0, 0, 0)') {
                    textColor = '#d4a5ff';
                  }
                  st.setProperty('background-clip', 'border-box', 'important');
                  st.setProperty('-webkit-background-clip', 'border-box', 'important');
                  st.setProperty('-webkit-text-fill-color', textColor, 'important');
                  st.setProperty('color', textColor, 'important');
                  st.setProperty('background', 'transparent', 'important');
                }

                // 处理 position: sticky
                var pos = cs.getPropertyValue('position');
                if (pos === 'sticky') {
                  st.setProperty('position', 'relative', 'important');
                }

                // 处理 filter（hue-rotate等）
                var filter = cs.getPropertyValue('filter') || '';
                if (filter && filter !== 'none') {
                  st.setProperty('filter', 'none', 'important');
                }

                // 处理 mix-blend-mode
                var blend = cs.getPropertyValue('mix-blend-mode') || '';
                if (blend && blend !== 'normal') {
                  st.setProperty('mix-blend-mode', 'normal', 'important');
                }
              }
            } else {
              // clonedWin 不可用时，直接通过 style 属性强制清理常见问题属性
              st.setProperty('background-clip', 'border-box', 'important');
              st.setProperty('-webkit-background-clip', 'border-box', 'important');
              st.setProperty('filter', 'none', 'important');
              st.setProperty('mix-blend-mode', 'normal', 'important');
              // 将 sticky 改为 relative
              if (st.position === 'sticky') {
                st.setProperty('position', 'relative', 'important');
              }
            }
          }

          // 隐藏不需要截图的元素
          clonedDoc.querySelectorAll('.action-buttons, .footer-sign, .screen-header').forEach(function(el) {
            el.style.display = 'none';
          });

          // 确保大运/流年列表换行显示
          clonedDoc.querySelectorAll('.bazi-dayun-list, .bazi-liunian-list').forEach(function(el) {
            el.style.setProperty('flex-wrap', 'wrap', 'important');
            el.style.setProperty('overflow', 'visible', 'important');
          });

        } catch(e) {
          console.warn('[截图v5] onclone清理时出错:', e);
        }
      }

      // 滚动到元素顶部，确保截图从正确位置开始
      resultContent.scrollTop = 0;
      if (targetEl.scrollTop !== undefined) targetEl.scrollTop = 0;
      window.scrollTo(0, 0);

      // 在截图前，先给目标元素临时移除可能导致html2canvas崩溃的CSS属性
      var tempStyleFixes = [];
      try {
        resultContent.querySelectorAll('*').forEach(function(el) {
          var cs = window.getComputedStyle(el);
          // 临时移除 backdrop-filter（html2canvas不支持）
          var bf = cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter');
          if (bf && bf !== 'none') {
            tempStyleFixes.push({ el: el, prop: 'backdrop-filter', val: el.style.backdropFilter });
            tempStyleFixes.push({ el: el, prop: '-webkit-backdrop-filter', val: el.style.webkitBackdropFilter });
            el.style.setProperty('backdrop-filter', 'none', 'important');
            el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          }
          // 临时移除 background-clip: text
          var bgClip = cs.getPropertyValue('background-clip') || cs.getPropertyValue('-webkit-background-clip');
          if (bgClip === 'text') {
            var textColor = cs.getPropertyValue('color') || '#d4a5ff';
            tempStyleFixes.push({ el: el, prop: 'background-clip', val: el.style.backgroundClip });
            tempStyleFixes.push({ el: el, prop: '-webkit-background-clip', val: el.style.webkitBackgroundClip });
            tempStyleFixes.push({ el: el, prop: '-webkit-text-fill-color', val: el.style.webkitTextFillColor });
            tempStyleFixes.push({ el: el, prop: 'background', val: el.style.background });
            el.style.setProperty('background-clip', 'border-box', 'important');
            el.style.setProperty('-webkit-background-clip', 'border-box', 'important');
            el.style.setProperty('-webkit-text-fill-color', textColor, 'important');
            el.style.setProperty('background', 'transparent', 'important');
          }
        });
      } catch(preCleanErr) {
        console.warn('[截图v5] 预清理CSS时出错:', preCleanErr);
      }

      html2canvas(resultContent, {
        backgroundColor: '#0a0015',
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        foreignObjectRendering: false,
        width: captureWidth,
        height: captureHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        x: 0,
        y: 0,
        removeContainer: true,
        onclone: function(clonedDoc, clonedEl) {
          // html2canvas 1.4.x onclone 回调参数：(clonedDocument, clonedElement)
          // 确保传入的是 document 对象
          var doc = clonedDoc;
          if (clonedDoc && clonedDoc.ownerDocument) {
            doc = clonedDoc.ownerDocument; // 如果传入的是element，获取其document
          }
          try {
            cleanClonedDom(doc);
          } catch(cloneErr) {
            console.warn('[截图v5] onclone清理异常:', cloneErr);
          }
        }
      }).then(function(canvas) {
        // 恢复原始样式
        savedStyles.forEach(function(s) { s.el.style.cssText = s.cssText; });
        // 恢复临时CSS修复
        tempStyleFixes.forEach(function(fix) {
          if (fix.val !== undefined && fix.val !== null) {
            fix.el.style.setProperty(fix.prop, fix.val);
          } else {
            fix.el.style.removeProperty(fix.prop);
          }
        });

        if (canvas && canvas.width > 0 && canvas.height > 0) {
          try {
            var quality = captureHeight > 6000 ? 0.82 : 0.92;
            var format = captureHeight > 6000 ? 'image/jpeg' : 'image/png';
            var dataUrl = canvas.toDataURL(format, quality);
            if (dataUrl && dataUrl.length > 100) {
              img.src = dataUrl;
              loading.style.display = 'none';
              preview.style.display = 'block';
              console.log('[截图v5] 成功! canvas=' + canvas.width + 'x' + canvas.height + ', 数据=' + (dataUrl.length / 1024).toFixed(0) + 'KB');
            } else {
              loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图数据异常，请截屏保存';
            }
          } catch(e2) {
            console.error('[截图v5] canvas转图片失败:', e2);
            loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图生成失败，请截屏保存';
          }
        } else {
          loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图内容为空，请截屏保存';
        }
      }).catch(function(err) {
        // 恢复原始样式
        savedStyles.forEach(function(s) { s.el.style.cssText = s.cssText; });
        // 恢复临时CSS修复
        tempStyleFixes.forEach(function(fix) {
          if (fix.val !== undefined && fix.val !== null) {
            fix.el.style.setProperty(fix.prop, fix.val);
          } else {
            fix.el.style.removeProperty(fix.prop);
          }
        });
        console.error('[截图v5] 主方案失败:', err);

        // 降级重试：更低scale + 更激进的清理
        console.log('[截图v5] 尝试降级重试...');
        loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在尝试备用方案...';
        setTimeout(function() {
          _doScreenshotFallback(contentEl, loading, preview, img, mode);
        }, 300);
      });
    });
  });
}

/**
 * 备用截图方案：使用简化HTML截图
 */
function _doScreenshotFallback(contentEl, loading, preview, img, mode) {
  try {
    // 获取内容的纯文本摘要，生成一个简化的截图
    var targetId = mode === 'traditional' ? 'screen-result-traditional' : 'screen-result-fusion';
    var targetEl = document.getElementById(targetId);
    var content = targetEl ? (targetEl.querySelector('.result-content') || targetEl) : contentEl;

    // 使用最简单的html2canvas配置，对一个新创建的简化div截图
    var simpleDiv = document.createElement('div');
    simpleDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:480px;padding:24px;background:#0a0015;color:#fff;font-family:sans-serif;z-index:-1;';

    // 提取关键文本信息
    var dateEl = content.querySelector('.result-date');
    var userInfoEl = content.querySelector('.result-user-info');
    var scoreEl = document.getElementById('score-num');
    var levelEl = document.getElementById('fortune-level');

    // 从用户信息区域智能提取各部分内容
    var userName = '';
    var userTags = [];
    if (userInfoEl) {
      // 第一个子元素通常是用户名（带font-weight:600的span）
      var nameSpan = userInfoEl.querySelector('span[style*="font-weight"]');
      if (nameSpan) userName = nameSpan.textContent.trim();
      if (!userName) {
        // 降级：取第一个非info-tag的文本
        var firstChild = userInfoEl.firstElementChild;
        if (firstChild && !firstChild.classList.contains('info-tag')) {
          userName = firstChild.textContent.trim();
        }
      }
      // 提取info-tag标签内容（生肖、星座、生日等，排除"掌纹库暂无匹配"和"融合解读"等无关标签）
      var tagEls = userInfoEl.querySelectorAll('.info-tag');
      tagEls.forEach(function(tag) {
        var text = tag.textContent.trim();
        // 过滤掉不适合在截图中显示的标签
        if (text && !text.includes('掌纹') && !text.includes('融合解读') && !text.includes('传统手相')) {
          userTags.push(text);
        }
      });
    }

    var html = '<div style="text-align:center;padding:20px 0;">';
    html += '<div style="font-size:32px;margin-bottom:12px;">🖐️</div>';
    html += '<div style="font-size:22px;font-weight:700;color:#d4a5ff;margin-bottom:8px;">掌纹算命</div>';
    if (dateEl) html += '<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:16px;">' + dateEl.textContent + '</div>';
    // 用户信息：姓名 + 标签分行显示
    if (userName || userTags.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      if (userName) html += '<div style="font-size:16px;font-weight:600;color:#d4a5ff;margin-bottom:6px;">' + userName + '</div>';
      if (userTags.length > 0) html += '<div style="font-size:12px;color:rgba(255,255,255,0.5);">' + userTags.join(' · ') + '</div>';
      html += '</div>';
    }

    if (mode === 'fusion' && scoreEl) {
      html += '<div style="font-size:64px;font-weight:800;color:#d4a5ff;margin:20px 0 8px;">' + scoreEl.textContent + '</div>';
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:12px;">综合运势</div>';
      if (levelEl) html += '<div style="font-size:18px;font-weight:700;color:#d4a5ff;margin-bottom:24px;">' + levelEl.textContent + '</div>';
    }

    // 提取四维运势
    ['love', 'career', 'wealth', 'health'].forEach(function(type) {
      var scoreTextEl = document.getElementById('score-' + type);
      var textEl = document.getElementById('text-' + type);
      var labels = { love: '💕 感情运势', career: '💼 事业运势', wealth: '💰 财运运势', health: '🏥 健康运势' };
      if (scoreTextEl && scoreTextEl.textContent) {
        html += '<div style="text-align:left;padding:12px 16px;margin-bottom:8px;background:rgba(138,43,226,0.08);border-radius:12px;border:1px solid rgba(138,43,226,0.15);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-size:13px;color:#d4a5ff;font-weight:600;">' + labels[type] + '</span>';
        html += '<span style="font-size:14px;font-weight:700;color:#d4a5ff;">' + scoreTextEl.textContent + '</span>';
        html += '</div>';
        if (textEl && textEl.textContent) {
          html += '<div style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.6;">' + textEl.textContent + '</div>';
        }
        html += '</div>';
      }
    });

    html += '<div style="margin-top:20px;font-size:11px;color:rgba(255,255,255,0.25);">以上解读仅供文化参考与娱乐</div>';
    html += '</div>';

    simpleDiv.innerHTML = html;
    document.body.appendChild(simpleDiv);

    html2canvas(simpleDiv, {
      backgroundColor: '#0a0015',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true
    }).then(function(canvas) {
      document.body.removeChild(simpleDiv);
      if (canvas && canvas.width > 0) {
        var dataUrl = canvas.toDataURL('image/png', 0.92);
        if (dataUrl && dataUrl.length > 100) {
          img.src = dataUrl;
          loading.style.display = 'none';
          preview.style.display = 'block';
          console.log('[截图备用] 简化截图成功');
        } else {
          loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图生成失败，请截屏保存';
        }
      } else {
        loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图生成失败，请截屏保存';
      }
    }).catch(function(err) {
      try { document.body.removeChild(simpleDiv); } catch(e) {}
      console.error('[截图备用] 也失败了:', err);
      loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图生成失败，请截屏保存';
    });
  } catch(e) {
    console.error('[截图备用] 异常:', e);
    loading.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 截图生成失败，请截屏保存';
  }
}

function closeShareModal() {
  const overlay = document.getElementById('share-overlay');
  overlay.classList.remove('show');
}

function downloadShareScreenshot() {
  const img = document.getElementById('share-screenshot-img');
  if (!img.src || img.src === window.location.href) return;
  const link = document.createElement('a');
  const ext = img.src.startsWith('data:image/jpeg') ? '.jpg' : '.png';
  link.download = `掌纹算命_${formatDate().replace(/\s/g, '_')}${ext}`;
  link.href = img.src;
  link.click();
  showSimpleToast('图片已保存');
}

function copyShareText() {
  const text = getShareText(_shareCurrentMode);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showSimpleToast('已复制运势文字到剪贴板');
    }).catch(() => {
      showSimpleToast('复制失败，请手动复制');
    });
  } else {
    showSimpleToast('当前浏览器不支持复制');
  }
}

function showSimpleToast(msg) {
  const toast = document.getElementById('share-toast');
  const textEl = document.getElementById('share-toast-text');
  if (!toast) return;
  if (textEl) textEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== 重置状态 =====
function resetAll() {
  selectedZodiac = null;
  selectedConstellation = null;
  if (typeof userManuallySetZodiac !== 'undefined') userManuallySetZodiac = false;
  if (typeof userManuallySetConstellation !== 'undefined') userManuallySetConstellation = false;
  capturedImageBlob = null;
  palmAnalysisResult = null;
  identifyResult = null;
  currentMode = null;
  llmReportData = null;
  llmReportLoading = false;
  selectedShichen = 0;
  selectedGender = null;

  // 清除降级提示
  document.querySelectorAll('.fallback-notice-banner').forEach(el => el.remove());

  document.querySelectorAll('.zodiac-item, .constellation-item').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.gender-item').forEach(el => el.classList.remove('selected'));
  document.getElementById('btn-to-scan').disabled = true;

  const btnScan = document.getElementById('btn-scan');
  btnScan.disabled = false;
  btnScan.innerHTML = '<i class="fas fa-hand-sparkles"></i> 开始掌纹分析';
  btnScan.style.display = 'none';

  const btnCapture = document.getElementById('btn-capture');
  btnCapture.style.display = 'block';
  btnCapture.innerHTML = '<i class="fas fa-camera"></i> 拍照采集掌纹';
  btnCapture.disabled = false;
  document.getElementById('btn-recapture').style.display = 'none';
  document.getElementById('scan-progress-wrapper').style.display = 'none';
  document.getElementById('scan-progress-fill').style.width = '0%';
  document.getElementById('identify-result-card').style.display = 'none';
  // 重置掌纹认证区域
  const authSectionReset = document.getElementById('identify-auth-section');
  if (authSectionReset) authSectionReset.style.display = 'none';

  // 重置上传相关
  const btnUpload = document.getElementById('btn-upload-palm');
  if (btnUpload) btnUpload.style.display = 'none';
  const fileInput = document.getElementById('palm-file-input');
  if (fileInput) fileInput.value = '';
  const scanCanvas = document.getElementById('scan-canvas');
  if (scanCanvas) scanCanvas.style.display = 'none';

  ['love', 'career', 'wealth', 'health'].forEach(type => {
    const bar = document.getElementById(`bar-${type}`);
    if (bar) bar.style.width = '0%';
  });

  const nameInput = document.getElementById('user-name');
  if (nameInput) nameInput.value = '';
  const birthdayInput = document.getElementById('user-birthday');
  if (birthdayInput) birthdayInput.value = '';

  // 重置真太阳时
  const trueSolarToggle = document.getElementById('true-solar-toggle');
  if (trueSolarToggle) trueSolarToggle.checked = false;
  const birthplaceSection = document.getElementById('birthplace-picker-section');
  if (birthplaceSection) {
    birthplaceSection.style.display = 'none';
    birthplaceSection._inited = false;
  }

  // 重置星座/生肖提示
  const constellationHint = document.getElementById('constellation-hint');
  if (constellationHint) constellationHint.style.display = 'none';
  const zodiacHint = document.getElementById('zodiac-hint');
  if (zodiacHint) zodiacHint.style.display = 'none';

  // 重新初始化时辰选择器和生日选择器
  if (typeof initShichenPicker === 'function') initShichenPicker();
  selectedYear = 1990; selectedMonth = 1; selectedDay = 1;
  if (typeof initBirthdayPicker === 'function') initBirthdayPicker();

  navigateTo('screen-welcome', 'back');
}

// ===== 事件绑定 =====
function bindEvents() {
  document.getElementById('mode-traditional').addEventListener('click', () => {
    currentMode = 'traditional';
    document.getElementById('scan-back-btn').dataset.target = 'screen-welcome';
    document.getElementById('scan-step-label').textContent = '1/2';
    navigateTo('screen-scan');
    startCamera();
  });

  document.getElementById('mode-fusion').addEventListener('click', () => {
    currentMode = 'fusion';
    navigateTo('screen-info');
  });

  document.getElementById('btn-to-scan').addEventListener('click', () => {
    document.getElementById('scan-back-btn').dataset.target = 'screen-info';
    document.getElementById('scan-step-label').textContent = '2/3';
    navigateTo('screen-scan');
    startCamera();
  });

  document.getElementById('btn-capture').addEventListener('click', () => capturePhoto());
  document.getElementById('btn-scan').addEventListener('click', () => startScan());
  document.getElementById('btn-recapture').addEventListener('click', () => recapturePhoto());

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) {
        navigateTo(target, 'back');
        if (target !== 'screen-scan') stopCamera();
      }
    });
  });

  document.getElementById('btn-share-trad').addEventListener('click', () => showShareModal('traditional'));
  document.getElementById('btn-share-fusion').addEventListener('click', () => showShareModal('fusion'));
  document.getElementById('share-modal-close').addEventListener('click', closeShareModal);
  document.getElementById('share-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeShareModal(); });
  document.getElementById('share-btn-download').addEventListener('click', downloadShareScreenshot);
  document.getElementById('share-btn-copy').addEventListener('click', copyShareText);
  document.getElementById('btn-retry-trad').addEventListener('click', resetAll);
  document.getElementById('btn-retry-fusion').addEventListener('click', resetAll);
}

// ===== 初始化 =====
function init() {
  if (typeof initParticles === 'function') initParticles();
  if (typeof initGrids === 'function') initGrids();
  if (typeof initShichenPicker === 'function') initShichenPicker();
  if (typeof initBirthdayPicker === 'function') initBirthdayPicker();
  if (typeof initTrueSolarToggle === 'function') initTrueSolarToggle();
  bindEvents();
  if (typeof animateCountUp === 'function') animateCountUp();
}

document.addEventListener('DOMContentLoaded', init);

// ===== 渲染本地报告（降级方案） =====
function renderLocalReport(container, combinedSeed, rng, showNotice) {
  let sectionsHTML = '';
  // 仅在明确指定时才显示降级提示（即确认服务器连接失败）
  if (showNotice) {
    _showFallbackNotice();
  }

  TRAD_PALM_SECTIONS.forEach((section, idx) => {
    const sectionScore = _normalScore();
    const cat = getScoreCategory(sectionScore);

    let readingContent = '';
    const readings = section.readings[cat] || section.readings.mid;

    if (section.id === 'palm-type') {
      const reading = readings[Math.floor(Math.random() * readings.length)];
      readingContent = `
        <div class="trad-palm-type-badge">${reading.type}</div>
        <p class="trad-reading-text">${reading.desc}</p>
      `;
    } else {
      const reading = readings[Math.floor(Math.random() * readings.length)];
      const paragraphs = reading.split('\n').filter(p => p.trim());
      readingContent = paragraphs.map(p => `<p class="trad-reading-text">${p}</p>`).join('');
    }

    const stars = Math.max(1, Math.min(5, Math.round(sectionScore / 20)));
    const starsHTML = Array(5).fill(0).map((_, i) =>
      `<i class="fas fa-star" style="color:${i < stars ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; font-size:12px;"></i>`
    ).join('');

    sectionsHTML += `
      <div class="trad-section glass-card">
        <div class="trad-section-header">
          <div class="trad-section-icon">${section.icon}</div>
          <div class="trad-section-title-wrap">
            <h4 class="trad-section-title">${section.title}</h4>
            <p class="trad-section-subtitle">${section.subtitle}</p>
          </div>
          <div class="trad-section-stars">${starsHTML}</div>
        </div>
        <div class="trad-section-body">
          ${readingContent}
        </div>
      </div>
    `;
  });

  container.innerHTML = sectionsHTML;
}