/**
 * 掌纹注册独立页面 (register.html) 交互脚本
 *
 * 流程：
 *   步骤1: 输入 UserId
 *   步骤2: 拍摄/上传掌纹图片
 *   步骤3: 提交 -> 后端 /api/v1/palm-register -> 显示成功页
 */
(function () {
  'use strict';

  // ====== API 基址 ======
  function getApiBase() {
    try {
      if (typeof window.API_BASE === 'string' && window.API_BASE) return window.API_BASE;
    } catch (_) {}
    var basePath = window.PALM_BASE_PATH || '';
    return basePath + '/api/v1';
  }

  // ====== DOM ======
  var stepId, stepCapture, stepDone;
  var inputUserId, btnNext;
  var userIdDisplay, btnEditUserId;
  var video, previewImg, canvas;
  var btnCapture, btnRecapture, btnUpload, fileInput, btnSubmit, btnAgain;
  var statusBox, statusIcon, statusText;
  var stepDots;
  var doneUserIdEl;

  // ====== 状态 ======
  var stream = null;
  var capturedBlob = null;
  var currentUserId = '';
  var submitting = false;

  // ====== 工具：UserId 校验 ======
  function isValidUserId(v) {
    if (!v) return false;
    var s = String(v).trim();
    if (s.length < 1 || s.length > 64) return false;
    return /^[A-Za-z0-9_\-]+$/.test(s);
  }

  // ====== 步骤指示器 ======
  // mode: 'normal' | 'fail'  —— 仅在 stepNum===3 时区分；fail 时第3点显示为红色叉
  function setStep(stepNum, mode) {
    if (!stepDots) return;
    Array.prototype.forEach.call(stepDots, function (dot) {
      var n = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.remove('active', 'done', 'fail');
      if (n < stepNum) {
        dot.classList.add('done');
      } else if (n === stepNum) {
        if (stepNum === 3 && mode === 'fail') {
          dot.classList.add('fail');
        } else {
          dot.classList.add('active');
        }
      }
    });
  }

  // ====== 状态展示 ======
  function showStatus(state, msg) {
    if (!statusBox) return;
    statusBox.style.display = 'flex';
    statusBox.classList.remove('success', 'error');
    if (state === 'success') {
      statusBox.classList.add('success');
      statusIcon.innerHTML = '<i class="fas fa-check"></i>';
    } else if (state === 'error') {
      statusBox.classList.add('error');
      statusIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    } else {
      statusIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    statusText.textContent = msg || '';
  }
  function hideStatus() { if (statusBox) statusBox.style.display = 'none'; }

  // ====== 摄像头 ======
  function stopCamera() {
    if (stream) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      stream = null;
    }
    if (video) {
      try { video.srcObject = null; } catch (_) {}
    }
  }
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前环境不支持摄像头');
    }
    var constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      }
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  }

  // ====== 拍照 -> Blob ======
  function captureFromVideo() {
    if (!video || video.videoWidth === 0) return null;
    var w = video.videoWidth;
    var h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', 0.92);
    });
  }

  function showPreview(blob) {
    if (!blob) return;
    capturedBlob = blob;
    var url = URL.createObjectURL(blob);
    previewImg.src = url;
    previewImg.style.display = 'block';
    video.style.display = 'none';
    btnCapture.style.display = 'none';
    btnRecapture.style.display = '';
    btnSubmit.style.display = '';
    stopCamera();
  }

  async function resetToCaptureMode() {
    capturedBlob = null;
    if (previewImg) {
      previewImg.style.display = 'none';
      if (previewImg.src) {
        try { URL.revokeObjectURL(previewImg.src); } catch (_) {}
        previewImg.src = '';
      }
    }
    if (video) video.style.display = '';
    if (btnCapture) btnCapture.style.display = '';
    if (btnRecapture) btnRecapture.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'none';
    hideStatus();
    try {
      await startCamera();
    } catch (e) {
      console.warn('启动摄像头失败:', e);
      btnCapture.style.display = 'none';
      showStatus('error', '摄像头不可用，请使用下方"从相册选择手掌照片"');
    }
  }

  // ====== 步骤切换 ======
  async function gotoCaptureStep() {
    var v = inputUserId.value.trim();
    if (!isValidUserId(v)) {
      inputUserId.classList.add('invalid');
      inputUserId.focus();
      return;
    }
    inputUserId.classList.remove('invalid');
    currentUserId = v;
    userIdDisplay.textContent = v;

    stepId.style.display = 'none';
    stepDone.style.display = 'none';
    stepCapture.style.display = '';
    setStep(2);
    await resetToCaptureMode();
  }

  function gotoIdStep() {
    stopCamera();
    capturedBlob = null;
    hideStatus();
    stepCapture.style.display = 'none';
    stepDone.style.display = 'none';
    stepId.style.display = '';
    inputUserId.value = currentUserId;
    setStep(1);
    setTimeout(function () { inputUserId.focus(); }, 50);
  }

  // 推断更友好的提示文案（可选）
  function inferFailTip(message, code) {
    var msg = String(message || '').toLowerCase();
    if (msg.indexOf('userid') >= 0 || msg.indexOf('已存在') >= 0 || msg.indexOf('exist') >= 0 || msg.indexOf('bound') >= 0) {
      return '该用户ID可能已被占用。请尝试修改用户ID，或如确属本人，可联系管理员先解绑后再注册。';
    }
    if (msg.indexOf('鉴权') >= 0 || msg.indexOf('auth') >= 0 || msg.indexOf('token') >= 0 || msg.indexOf('signature') >= 0 || code === 401 || code === 403) {
      return '掌纹服务鉴权失败，可能是后台 Token 配置不正确，请稍后重试或联系管理员。';
    }
    if (msg.indexOf('图像') >= 0 || msg.indexOf('image') >= 0 || msg.indexOf('quality') >= 0 || msg.indexOf('detect') >= 0 || msg.indexOf('palm') >= 0) {
      return '图片质量未通过检测。请在光线充足的环境下，将手掌平展、纹路清晰地放入扫描框中重新拍摄。';
    }
    if (msg.indexOf('超时') >= 0 || msg.indexOf('timeout') >= 0 || msg.indexOf('网络') >= 0) {
      return '网络异常或服务超时，请检查网络后稍后重试。';
    }
    return '请尝试重新拍摄一张光线充足、纹路清晰的手掌照片，或换一个用户ID再试。';
  }

  // 跳到步骤3
  // mode = 'success' | 'fail'
  // info: success → { userId, message }
  //       fail    → { userId, message, code, traceId }
  function gotoDoneStep(mode, info) {
    info = info || {};
    stopCamera();
    capturedBlob = null;

    var successBox = document.getElementById('register-done-success');
    var failBox = document.getElementById('register-done-fail');

    if (mode === 'fail') {
      // 失败态
      if (successBox) successBox.style.display = 'none';
      if (failBox) failBox.style.display = '';

      var failUserIdEl = document.getElementById('register-fail-userid');
      if (failUserIdEl) failUserIdEl.textContent = info.userId || currentUserId || '-';

      var msgEl = document.getElementById('register-fail-message');
      if (msgEl) msgEl.textContent = info.message || '后台返回了未知错误';

      var codeRow = document.getElementById('register-fail-code-row');
      var codeEl = document.getElementById('register-fail-code');
      if (info.code !== undefined && info.code !== null && info.code !== '' && String(info.code) !== '0') {
        if (codeRow) codeRow.style.display = '';
        if (codeEl) codeEl.textContent = String(info.code);
      } else {
        if (codeRow) codeRow.style.display = 'none';
      }

      var traceRow = document.getElementById('register-fail-trace-row');
      var traceEl = document.getElementById('register-fail-trace');
      if (info.traceId) {
        if (traceRow) traceRow.style.display = '';
        if (traceEl) traceEl.textContent = info.traceId;
      } else {
        if (traceRow) traceRow.style.display = 'none';
      }

      var tipEl = document.getElementById('register-fail-tip-text');
      if (tipEl) tipEl.textContent = inferFailTip(info.message, info.code);

      stepId.style.display = 'none';
      stepCapture.style.display = 'none';
      stepDone.style.display = '';
      setStep(3, 'fail');
    } else {
      // 成功态
      if (successBox) successBox.style.display = '';
      if (failBox) failBox.style.display = 'none';

      if (doneUserIdEl) doneUserIdEl.textContent = info.userId || currentUserId || '-';

      // 在成功页 desc 区追加平台返回的真实业务消息（若有）
      var doneDesc = successBox ? successBox.querySelector('.register-done-desc') : null;
      var extraEl = document.getElementById('register-done-extra');
      var extraMsg = info.message;
      if (extraMsg && doneDesc) {
        if (!extraEl) {
          extraEl = document.createElement('div');
          extraEl.id = 'register-done-extra';
          extraEl.style.cssText = 'margin-top:10px;font-size:12.5px;color:#2ed573;background:rgba(46,213,115,0.08);border:1px solid rgba(46,213,115,0.25);border-radius:8px;padding:6px 10px;display:inline-block;';
          doneDesc.appendChild(document.createElement('br'));
          doneDesc.appendChild(extraEl);
        }
        extraEl.textContent = '✓ ' + extraMsg;
      } else if (extraEl) {
        extraEl.textContent = '';
      }

      stepId.style.display = 'none';
      stepCapture.style.display = 'none';
      stepDone.style.display = '';
      setStep(3);
    }

    // 滚动到顶部
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  }

  // ====== 提交注册 ======
  async function submitRegister() {
    if (submitting) return;
    if (!capturedBlob) {
      showStatus('error', '请先拍摄或上传手掌照片');
      return;
    }
    if (!isValidUserId(currentUserId)) {
      showStatus('error', '用户ID格式不正确');
      return;
    }

    submitting = true;
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnRecapture) btnRecapture.disabled = true;
    showStatus('loading', '正在上传并注册掌纹，请稍候...');

    try {
      // ============================================================
      // 🖐️ 你的刷掌识别算法（占位实现）
      // 此处应替换为你的掌纹注册服务调用，示例：
      // var fd = new FormData();
      // fd.append('user_id', currentUserId);
      // fd.append('file', capturedBlob, 'palm_register.jpg');
      // fd.append('is_force', 'true');
      // var resp = await fetch(getApiBase() + '/palm-register', {
      //   method: 'POST',
      //   body: fd
      // });
      // var data = await resp.json();
      // ============================================================

      // 占位响应：不做实际网络请求
      console.log('[register] 🖐️ 你的刷掌识别算法（占位实现）');
      hideStatus();
      gotoDoneStep('success', {
        userId: currentUserId,
        message: '🖐️ 你的刷掌识别算法（占位响应）- 请替换为你的掌纹注册服务'
      });
    } catch (err) {
      console.error('palm-register error:', err);
      hideStatus();
      gotoDoneStep('fail', {
        userId: currentUserId,
        message: '网络异常：' + (err && err.message ? err.message : '请求失败'),
        code: '',
        traceId: ''
      });
    } finally {
      submitting = false;
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnRecapture) btnRecapture.disabled = false;
    }
  }

  // ====== 初始化 ======
  function init() {
    stepId = document.getElementById('register-step-id');
    stepCapture = document.getElementById('register-step-capture');
    stepDone = document.getElementById('register-step-done');
    if (!stepId || !stepCapture) return; // 非注册页

    inputUserId = document.getElementById('register-user-id');
    btnNext = document.getElementById('register-btn-next');

    userIdDisplay = document.getElementById('register-userid-value');
    btnEditUserId = document.getElementById('register-userid-edit');

    video = document.getElementById('register-camera-video');
    previewImg = document.getElementById('register-preview-img');
    canvas = document.getElementById('register-canvas');

    btnCapture = document.getElementById('register-btn-capture');
    btnRecapture = document.getElementById('register-btn-recapture');
    btnUpload = document.getElementById('register-btn-upload');
    fileInput = document.getElementById('register-file-input');
    btnSubmit = document.getElementById('register-btn-submit');
    btnAgain = document.getElementById('register-btn-again');

    statusBox = document.getElementById('register-status-box');
    statusIcon = document.getElementById('register-status-icon');
    statusText = document.getElementById('register-status-text');

    stepDots = document.querySelectorAll('.register-step-dot');
    doneUserIdEl = document.getElementById('register-done-userid');

    // 预填上次注册的 UserId（提升体验）
    try {
      var last = localStorage.getItem('palmRegisteredUserId');
      if (last && isValidUserId(last)) {
        inputUserId.value = last;
      }
    } catch (_) {}

    setStep(1);
    setTimeout(function () { inputUserId.focus(); }, 60);

    // ====== 事件绑定 ======
    inputUserId.addEventListener('input', function () {
      if (isValidUserId(inputUserId.value.trim())) {
        inputUserId.classList.remove('invalid');
      }
    });
    inputUserId.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); btnNext.click(); }
    });

    if (btnNext) btnNext.addEventListener('click', gotoCaptureStep);
    if (btnEditUserId) btnEditUserId.addEventListener('click', gotoIdStep);

    if (btnCapture) btnCapture.addEventListener('click', async function () {
      try {
        var blob = await captureFromVideo();
        if (!blob) { showStatus('error', '拍照失败，请重试'); return; }
        showPreview(blob);
      } catch (err) {
        console.error(err);
        showStatus('error', '拍照异常，请重试');
      }
    });
    if (btnRecapture) btnRecapture.addEventListener('click', resetToCaptureMode);

    if (btnUpload) btnUpload.addEventListener('click', function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        showStatus('error', '图片过大，请选择小于10MB的图片');
        return;
      }
      stopCamera();
      showPreview(f);
    });

    if (btnSubmit) btnSubmit.addEventListener('click', submitRegister);

    if (btnAgain) btnAgain.addEventListener('click', function () {
      // 再注册一个用户
      currentUserId = '';
      capturedBlob = null;
      if (inputUserId) inputUserId.value = '';
      gotoIdStep();
    });

    // ====== 失败页按钮 ======
    var btnFailRecapture = document.getElementById('register-btn-fail-recapture');
    var btnFailChangeId = document.getElementById('register-btn-fail-changeid');
    if (btnFailRecapture) btnFailRecapture.addEventListener('click', function () {
      // 保留 UserId，回到步骤2 重新拍摄
      hideStatus();
      gotoCaptureStep();
    });
    if (btnFailChangeId) btnFailChangeId.addEventListener('click', function () {
      // 修改用户ID（保留当前值方便编辑），回到步骤1
      hideStatus();
      gotoIdStep();
    });

    // 离开页面时确保关闭摄像头
    window.addEventListener('pagehide', stopCamera);
    window.addEventListener('beforeunload', stopCamera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
