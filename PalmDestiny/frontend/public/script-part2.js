// ===== script-part2.js - 扫描、分析、结果生成、事件绑定 =====
// API_BASE 已在 script.js 中定义，此处直接使用

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
      const targetProgress = 88 * (1 - Math.exp(-elapsedSec / 18));
      const minIncrement = 0.05 + Math.random() * 0.08;
      progress = Math.max(progress + minIncrement, targetProgress);
      progress = Math.min(progress, 88);

      // 倒计时：基于已用时间和预估总时长计算剩余
      const rawEta = Math.max(1, Math.round(estimatedTotalSec - elapsedSec));
      if (rawEta < lastDisplayedEta) {
        lastDisplayedEta = rawEta;
      }
      if (etaEl) etaEl.querySelector('.eta-text').textContent = ` 预计还需${lastDisplayedEta}秒`;
    } else if (window._apiDone && progress < 100) {
      progress += 3;
      if (etaEl) etaEl.querySelector('.eta-text').textContent = ` 即将完成`;
    } else if (!window._apiDone && progress >= 88) {
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
    // 同时发起掌纹分析和大模型报告请求
    const apiPromise = uploadPalmForAnalysis();
    let llmPromise = null;
    if (currentMode === 'traditional' && capturedImageBlob) {
      llmPromise = fetchLLMReport();
    }
    const apiResult = await apiPromise;
    palmAnalysisResult = apiResult;
    // 不等待大模型报告完成，让它在后台继续
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
      { icon: 'fa-user-check', text: '1:N身份识别匹配' },
      { icon: 'fa-star', text: '星座属相运势匹配' },
      { icon: 'fa-magic', text: '综合运势生成' },
    ];
    subtitles = [
      '正在将掌纹图像上传至AI引擎...',
      'AI深度学习模型正在分析掌纹特征...',
      '1:N掌纹库匹配，识别用户身份...',
      '结合星座属相信息推演运势...',
      '综合所有维度生成运势报告...'
    ];
  }

  // 渲染步骤
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
    const diff = analyzingTargetPct - analyzingCurrentPct;
    if (diff > 0.5) {
      analyzingCurrentPct += diff * 0.12 + Math.random() * 0.3;
    } else {
      analyzingCurrentPct += 0.05 + Math.random() * 0.1;
    }
    analyzingCurrentPct = Math.min(analyzingCurrentPct, analyzingTargetPct + 2, 100);
    const displayPct = Math.min(Math.floor(analyzingCurrentPct), 100);
    if (progressFill) progressFill.style.width = `${analyzingCurrentPct}%`;
    if (progressPercent) progressPercent.textContent = `${displayPct}%`;

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
    analyzingTargetPct = Math.round(((index + 0.3) / totalSteps) * 100);

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

  analyzingCurrentPct = 0;
  analyzingTargetPct = 0;

  activateStep(0);
}

// ===== 公历年份转中文数字（如 1997 → 一九九七） =====
function lunarNumToChinese(year) {
  const numCn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return String(year).split('').map(d => numCn[parseInt(d)]).join('');
}

// ===== 大模型报告全局变量 =====
let llmReportData = null;
let llmReportLoading = false;

// ===== 调用大模型生成手相报告 =====
async function fetchLLMReport() {
  if (!capturedImageBlob) return null;
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
    // 超时58秒，略大于后端pipeline超时(55s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 58000);
    const response = await authFetch(`${API_BASE}/readings`, { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    // 接受llm和fallback两种数据源的报告
    if (result.code === 0 && result.data && result.data.report) {
      llmReportData = result.data.report;
      if (result.data && !palmAnalysisResult) {
        palmAnalysisResult = result.data;
      }
      console.log('[fetchLLMReport] 报告获取成功, source:', result.data.source || 'unknown');
      return result.data.report;
    }
    return null;
  } catch (error) {
    console.error('[fetchLLMReport] 大模型报告获取失败:', error);
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

  // 日期
  document.getElementById('trad-result-date').textContent = formatDate();

  // 用户信息
  const identityName = (identifyResult && identifyResult.identified && identifyResult.user_id) ? identifyResult.user_id : '有缘人';
  let userInfoHTML = `<span style="font-size:16px;font-weight:600;">${identityName}</span>`;
  if (identifyResult && identifyResult.identified) {
    userInfoHTML += `<span class="info-tag"><i class="fas fa-fingerprint"></i> 掌纹已识别</span>`;
  }
  userInfoHTML += `<span class="info-tag"><i class="fas fa-hand-sparkles"></i> 传统手相</span>`;
  document.getElementById('trad-result-user-info').innerHTML = userInfoHTML;

  const sectionsContainer = document.getElementById('trad-palm-sections');

  // 如果大模型报告已就绪，使用大模型报告
  if (llmReportData && llmReportData.sections && llmReportData.sections.length > 0) {
    renderLLMReport(llmReportData, sectionsContainer, rng);
    document.getElementById('trad-report-source-badge').style.display = 'inline-flex';
    document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-robot"></i> AI大模型深度解读';
  } else {
    // 降级：使用本地数据
    renderLocalReport(sectionsContainer, combinedSeed, rng);
    document.getElementById('trad-report-source-badge').style.display = 'inline-flex';
    document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-database"></i> 本地智能解读';

    // 异步尝试获取大模型报告，获取成功后自动替换
    if (!llmReportLoading && capturedImageBlob) {
      fetchLLMReport().then(report => {
        if (report && report.sections && report.sections.length > 0) {
          renderLLMReport(report, sectionsContainer, rng);
          document.getElementById('trad-report-source-badge').innerHTML = '<i class="fas fa-robot"></i> AI大模型深度解读';
          // 添加更新动画
          sectionsContainer.classList.add('report-updated');
          setTimeout(() => sectionsContainer.classList.remove('report-updated'), 1000);
        }
      });
    }
  }

  // 鼓励文案
  document.getElementById('trad-encourage-text').textContent = pickRandom(TRAD_ENCOURAGEMENTS, rng);
}

// ===== 渲染大模型报告 =====
function renderLLMReport(reportData, container, rng) {
  let sectionsHTML = '';

  reportData.sections.forEach((section, idx) => {
    // 为每个section生成星级评分
    const sectionRng = seedRandom(getTodaySeed() + idx * 137);
    const sectionScore = Math.floor(sectionRng() * 30) + 60; // 60-90分
    const stars = Math.max(3, Math.min(5, Math.round(sectionScore / 20)));
    const starsHTML = Array(5).fill(0).map((_, i) =>
      `<i class="fas fa-star" style="color:${i < stars ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; font-size:12px;"></i>`
    ).join('');

    // 处理content中的换行
    const content = section.content || '';
    const paragraphs = content.split('\n').filter(p => p.trim());
    let readingContent = '';

    if (section.id === 'palm-type') {
      // 掌型总论 - 尝试提取掌型名称
      const typeMatch = content.match(/(?:金形掌|木形掌|水形掌|火形掌|土形掌|方掌|圆掌|尖掌|篦形掌)/);
      const typeName = typeMatch ? typeMatch[0] : '';
      if (typeName) {
        readingContent += `<div class="trad-palm-type-badge">${typeName}</div>`;
      }
      readingContent += paragraphs.map(p => `<p class="trad-reading-text">${p}</p>`).join('');
    } else if (section.id === 'yearly-fortune') {
      // 流年运势 - 特殊排版
      readingContent = paragraphs.map(p => {
        // 检测是否是阶段标题
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

// ===== 渲染本地报告（降级方案） =====
function renderLocalReport(container, combinedSeed, rng) {
  let sectionsHTML = '';
  const totalScore = Math.floor(rng() * 54) + 45;

  TRAD_PALM_SECTIONS.forEach((section, idx) => {
    const sectionRng = seedRandom(combinedSeed + idx * 137);
    const sectionScore = Math.floor(sectionRng() * 60) + 40;
    const cat = getScoreCategory(sectionScore);

    let readingContent = '';
    const readings = section.readings[cat] || section.readings.mid;

    if (section.id === 'palm-type') {
      const reading = pickRandom(readings, rng);
      readingContent = `
        <div class="trad-palm-type-badge">${reading.type}</div>
        <p class="trad-reading-text">${reading.desc}</p>
      `;
    } else {
      const reading = pickRandom(readings, rng);
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

// ===== 生成融合解读结果 =====
function generateFusionResult() {
  const hasApiData = palmAnalysisResult && palmAnalysisResult.fortune;

  let totalScore, loveScore, careerScore, wealthScore, healthScore;
  let palmLineReadings = null;
  let identityInfo = null;
  let imageFeatures = null;

  if (hasApiData) {
    const fortune = palmAnalysisResult.fortune;
    const zodiacFactor = selectedZodiac !== null ? selectedZodiac : 0;
    const constellationFactor = selectedConstellation !== null ? selectedConstellation : 0;
    const zodiacBonus = ((zodiacFactor * 7 + getTodaySeed()) % 11) - 5;
    const constellationBonus = ((constellationFactor * 13 + getTodaySeed()) % 9) - 4;

    totalScore = Math.max(45, Math.min(98, fortune.total_score + zodiacBonus));
    loveScore = Math.max(40, Math.min(99, fortune.love_score + constellationBonus));
    careerScore = Math.max(40, Math.min(99, fortune.career_score + zodiacBonus));
    wealthScore = Math.max(40, Math.min(99, fortune.wealth_score + constellationBonus));
    healthScore = Math.max(40, Math.min(99, fortune.health_score + zodiacBonus));

    palmLineReadings = fortune.palm_line_readings;
    identityInfo = palmAnalysisResult.identity;
    imageFeatures = palmAnalysisResult.image_features;
  } else {
    const baseSeed = getTodaySeed();
    const zodiacFactor = selectedZodiac !== null ? selectedZodiac : 0;
    const constellationFactor = selectedConstellation !== null ? selectedConstellation : 0;
    const combinedSeed = baseSeed + zodiacFactor * 37 + constellationFactor * 73;
    const rng2 = seedRandom(combinedSeed);

    totalScore = Math.floor(rng2() * 54) + 45;
    loveScore = Math.floor(rng2() * 60) + 40;
    careerScore = Math.floor(rng2() * 60) + 40;
    wealthScore = Math.floor(rng2() * 60) + 40;
    healthScore = Math.floor(rng2() * 60) + 40;
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
  document.getElementById('fusion-result-date').textContent = formatDate();

  // 用户信息
  const identityName = identityInfo && identityInfo.person_name ? identityInfo.person_name : (document.getElementById('user-name').value || '有缘人');
  const zodiacData = selectedZodiac !== null ? ZODIACS[selectedZodiac] : null;
  const constellationData = selectedConstellation !== null ? CONSTELLATIONS[selectedConstellation] : null;

  let userInfoHTML = `<span style="font-size:16px;font-weight:600;">${identityName}</span>`;
  if (identityInfo && identityInfo.person_id) {
    userInfoHTML += `<span class="info-tag"><i class="fas fa-fingerprint"></i> 掌纹已识别</span>`;
  }
  if (zodiacData) userInfoHTML += `<span class="info-tag">${zodiacData.emoji} ${zodiacData.name}</span>`;
  if (constellationData) userInfoHTML += `<span class="info-tag">${constellationData.emoji} ${constellationData.name}</span>`;
  const birthday = document.getElementById('user-birthday').value;
  if (birthday) {
    userInfoHTML += `<span class="info-tag"><i class="fas fa-birthday-cake"></i> ${birthday}</span>`;
    const [_by, _bm, _bd] = birthday.split('-').map(Number);
    const lunarBirthday = solarToLunar(_by, _bm, _bd);
    const shichenName = SHICHEN_DATA[selectedShichen] ? SHICHEN_DATA[selectedShichen].name : '子时';
    const lunarBirthdayStr = lunarNumToChinese(_by) + '年' + lunarBirthday.monthCn + lunarBirthday.dayCn + ' ' + shichenName;
    userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,215,0,0.3);color:#ffd700;"><i class="fas fa-moon"></i> ${lunarBirthdayStr}</span>`;
  }
  userInfoHTML += `<span class="info-tag" style="border-color:rgba(255,105,180,0.3);color:#ff69b4;"><i class="fas fa-magic"></i> 融合解读</span>`;
  document.getElementById('fusion-result-user-info').innerHTML = userInfoHTML;

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

  // 四维运势
  setFortuneDetail('love', loveScore, rng);
  setFortuneDetail('career', careerScore, rng);
  setFortuneDetail('wealth', wealthScore, rng);
  setFortuneDetail('health', healthScore, rng);

  // 掌纹解读
  if (palmLineReadings && palmLineReadings.length > 0) {
    document.getElementById('fusion-palm-lines').innerHTML = palmLineReadings.map(line => `
      <div class="palm-line-item">
        <div class="palm-line-icon">${line.icon}</div>
        <div class="palm-line-info"><h5>${line.name}</h5><p>${line.text}</p></div>
      </div>
    `).join('');
  } else {
    document.getElementById('fusion-palm-lines').innerHTML = PALM_LINES_DATA.map(line => {
      const desc = pickRandom(line.descriptions, rng);
      return `
        <div class="palm-line-item">
          <div class="palm-line-icon">${line.icon}</div>
          <div class="palm-line-info"><h5>${line.name}</h5><p>${desc}</p></div>
        </div>
      `;
    }).join('');
  }

  // ===== 星座守护星解读 =====
  const constellationCard = document.getElementById('constellation-guardian-card');
  if (selectedConstellation !== null && CONSTELLATION_GUARDIAN_DATA[selectedConstellation]) {
    constellationCard.style.display = 'block';
    const cData = CONSTELLATION_GUARDIAN_DATA[selectedConstellation];
    const cScore = Math.floor(rng() * 60) + 40;
    const cCat = cScore >= 70 ? 'high' : (cScore >= 40 ? 'mid' : 'low');
    const cReading = cData.readings[cCat];

    document.getElementById('guardian-constellation-name').textContent = CONSTELLATIONS[selectedConstellation].name;
    document.getElementById('guardian-constellation-symbol').textContent = cData.symbol;
    document.getElementById('guardian-star-name').textContent = cData.guardian;
    document.getElementById('guardian-element-type').textContent = cData.element;
    document.getElementById('guardian-quality').textContent = cData.quality;
    document.getElementById('guardian-reading').textContent = cReading;
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
    document.getElementById('zodiac-fortune-conflict').textContent = zData.conflict;
    document.getElementById('zodiac-fortune-reading').textContent = zData.fortune;
  } else {
    zodiacFortuneCard.style.display = 'none';
  }

  // ===== 五行能量分析 =====
  const fiveElementsCard = document.getElementById('five-elements-card');
  fiveElementsCard.style.display = 'block';
  const elements = ['metal', 'wood', 'water', 'fire', 'earth'];
  const elementScores = {};
  let maxElement = 'wood';
  let maxScore = 0;
  elements.forEach(el => {
    const score = Math.floor(rng() * 60) + 20;
    elementScores[el] = score;
    if (score > maxScore) { maxScore = score; maxElement = el; }
  });
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
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const ganIdx = (dayOfYear + 6) % 10;
  const zhiIdx = (dayOfYear + 2) % 12;
  const todayGanzhi = TIANGAN[ganIdx] + DIZHI[zhiIdx];
  const ganElement = TIANGAN_ELEMENTS[ganIdx];
  const zhiAnimal = DIZHI_ANIMALS[zhiIdx];
  document.getElementById('ganzhi-today').textContent = todayGanzhi;
  document.getElementById('ganzhi-element').textContent = ganElement;
  document.getElementById('ganzhi-animal').textContent = zhiAnimal;
  document.getElementById('ganzhi-reading').textContent = pickRandom(GANZHI_READINGS, rng);

  // 今日建议
  const timeOfDay = getTimeOfDay();
  const timeAdvices = ADVICES[timeOfDay] || ADVICES.morning;
  const generalAdvices = ADVICES.general;
  const advice1 = pickRandom(timeAdvices, rng);
  const timeAdvices2 = timeAdvices.filter(a => a.text !== advice1.text);
  const advice2 = timeAdvices2.length > 0 ? pickRandom(timeAdvices2, rng) : pickRandom(generalAdvices, rng);
  const advice3 = pickRandom(generalAdvices, rng);
  const filteredGeneral = generalAdvices.filter(a => a.text !== advice3.text);
  const advice4 = filteredGeneral.length > 0 ? pickRandom(filteredGeneral, rng) : generalAdvices[0];
  const filteredGeneral2 = filteredGeneral.filter(a => a.text !== advice4.text);
  const advice5 = filteredGeneral2.length > 0 ? pickRandom(filteredGeneral2, rng) : null;
  const allAdvices = [advice1, advice2, advice3, advice4];
  if (advice5) allAdvices.push(advice5);
  document.getElementById('advice-content').innerHTML = allAdvices.map(a => `
    <div class="advice-item"><i class="fas ${a.icon}"></i><span>${a.text}</span></div>
  `).join('');

  // 幸运信息
  const luckyColor = pickRandom(LUCKY_COLORS, rng);
  document.getElementById('lucky-color').style.background = luckyColor.color;
  document.getElementById('lucky-color-name').textContent = luckyColor.name;
  document.getElementById('lucky-number').textContent = Math.floor(rng() * 99) + 1;
  document.getElementById('lucky-direction').textContent = pickRandom(DIRECTIONS, rng);
  document.getElementById('lucky-time').textContent = pickRandom(LUCKY_TIMES, rng);

  const luckyItem = pickRandom(LUCKY_ITEMS, rng);
  const luckyFlower = pickRandom(LUCKY_FLOWERS, rng);
  document.getElementById('lucky-item-icon').textContent = luckyItem.icon;
  document.getElementById('lucky-item-name').textContent = luckyItem.name;
  document.getElementById('lucky-item-desc').textContent = luckyItem.desc;
  document.getElementById('lucky-flower-icon').textContent = luckyFlower.icon;
  document.getElementById('lucky-flower-name').textContent = luckyFlower.name;
  document.getElementById('lucky-flower-desc').textContent = luckyFlower.desc;

  // 宜忌
  generateYiJi(rng);

  // 鼓励文案
  document.getElementById('fusion-encourage-text').textContent = pickRandom(ENCOURAGEMENTS, rng);
}

function generateKeywords(score, rng) {
  const keywordsEl = document.getElementById('keywords-list');
  let keywords = [];
  if (score >= 70) {
    keywords = pickMultipleRandom(KEYWORDS_POSITIVE, 3, rng).map(k => ({ text: k, type: 'positive' }));
    keywords.push({ text: pickRandom(KEYWORDS_NEUTRAL, rng), type: 'neutral' });
  } else if (score >= 50) {
    keywords = pickMultipleRandom(KEYWORDS_NEUTRAL, 2, rng).map(k => ({ text: k, type: 'neutral' }));
    keywords.push({ text: pickRandom(KEYWORDS_POSITIVE, rng), type: 'positive' });
    keywords.push({ text: pickRandom(KEYWORDS_CAUTION, rng), type: 'caution' });
  } else {
    keywords = pickMultipleRandom(KEYWORDS_CAUTION, 2, rng).map(k => ({ text: k, type: 'caution' }));
    keywords.push({ text: pickRandom(KEYWORDS_NEUTRAL, rng), type: 'neutral' });
    keywords.push({ text: pickRandom(KEYWORDS_POSITIVE, rng), type: 'positive' });
  }
  keywordsEl.innerHTML = keywords.map(k => `<span class="keyword-tag ${k.type}">${k.text}</span>`).join('');
}

function setFortuneDetail(type, score, rng) {
  const cat = getScoreCategory(score);
  const texts = FORTUNE_TEXTS[type];
  if (!texts || !texts[cat]) return;
  const text = pickRandom(texts[cat], rng);
  const barEl = document.getElementById(`bar-${type}`);
  const scoreTextEl = document.getElementById(`score-${type}`);
  const textEl = document.getElementById(`text-${type}`);
  if (textEl) textEl.textContent = text;
  if (scoreTextEl) scoreTextEl.textContent = score;
  setTimeout(() => { if (barEl) barEl.style.width = `${score}%`; }, 300);
}

function generateYiJi(rng) {
  const yiList = document.getElementById('yi-list');
  const jiList = document.getElementById('ji-list');
  const yiItems = pickMultipleRandom(YI_DATA, 4, rng);
  const jiItems = pickMultipleRandom(JI_DATA, 4, rng);
  yiList.innerHTML = yiItems.map(item => `<div class="yiji-item">• ${item}</div>`).join('');
  jiList.innerHTML = jiItems.map(item => `<div class="yiji-item">• ${item}</div>`).join('');
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

// ===== 分享功能 =====
function showShareToast(mode) {
  const toast = document.getElementById('share-toast');
  if (!toast) return;
  let shareText;
  if (mode === 'traditional') {
    const identityName = (identifyResult && identifyResult.identified) ? identifyResult.user_id : '有缘人';
    shareText = `🖐️ 掌纹算命 · 传统手相解读\n\n${identityName}\n📅 ${formatDate()}\n\n十大维度深度解读掌纹命理\n快来测测你的手相吧！`;
  } else {
    const identityName = (palmAnalysisResult && palmAnalysisResult.identity && palmAnalysisResult.identity.person_name)
      ? palmAnalysisResult.identity.person_name : (document.getElementById('user-name').value || '有缘人');
    const score = document.getElementById('score-num').textContent;
    const zodiacName = selectedZodiac !== null ? ZODIACS[selectedZodiac].name : '';
    const constellationName = selectedConstellation !== null ? CONSTELLATIONS[selectedConstellation].name : '';
    shareText = `🔮 掌纹算命 · 融合解读\n\n${identityName} | ${zodiacName} | ${constellationName}\n📊 综合运势：${score}分\n📅 ${formatDate()}\n\n快来测测你的今日运势吧！`;
  }
  if (navigator.clipboard) navigator.clipboard.writeText(shareText).catch(() => { });
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===== 重置状态 =====
function resetAll() {
  selectedZodiac = null;
  selectedConstellation = null;
  capturedImageBlob = null;
  palmAnalysisResult = null;
  identifyResult = null;
  currentMode = null;
  llmReportData = null;
  llmReportLoading = false;

  document.querySelectorAll('.zodiac-item, .constellation-item').forEach(el => el.classList.remove('selected'));
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

  // 重置星座提示
  const constellationHint = document.getElementById('constellation-hint');
  if (constellationHint) constellationHint.style.display = 'none';

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

  document.getElementById('btn-share-trad').addEventListener('click', () => showShareToast('traditional'));
  document.getElementById('btn-share-fusion').addEventListener('click', () => showShareToast('fusion'));
  document.getElementById('btn-retry-trad').addEventListener('click', resetAll);
  document.getElementById('btn-retry-fusion').addEventListener('click', resetAll);
}

// ===== 初始化 =====
function init() {
  initParticles();
  initGrids();
  bindEvents();
  animateCountUp();
}

document.addEventListener('DOMContentLoaded', init);