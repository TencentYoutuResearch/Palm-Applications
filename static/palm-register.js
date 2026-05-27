/**
 * 掌纹注册（绑定 UserId）独立模块
 * - 不显眼的入口：欢迎页底部 "录入我的掌纹" 链接
 * - 弹窗内：输入 UserId -> 拍摄/上传掌纹 -> 提交 /api/v1/palm-register
 * 后端接口：POST /api/v1/palm-register  (FormData: user_id, file, is_force)
 */
(function () {
  'use strict';

  // ====== API 基址：与 script.js 中的 getApiBase 保持一致 ======
  function getApiBase() {
    try {
      // 与 script.js 同源访问；若主脚本已暴露则复用
      if (typeof window.API_BASE === 'string' && window.API_BASE) return window.API_BASE;
    } catch (_) {}
    var basePath = window.PALM_BASE_PATH || '';
    return basePath + '/api/v1';
  }

  // ====== DOM ======
  var overlay, modalCloseBtn, openLink;
  var stepId, stepCapture;
  var inputUserId, btnNext;
  var userIdDisplay, btnEditUserId;
  var video, previewImg, canvas;
  var btnCapture, btnRecapture, btnUpload, fileInput, btnSubmit;
  var statusBox, statusIcon, statusText;

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

  // ====== 工具：状态展示 ======
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
    previewImg.style.display = 'none';
    if (previewImg.src) { try { URL.revokeObjectURL(previewImg.src); } catch (_) {} previewImg.src = ''; }
    video.style.display = '';
    btnCapture.style.display = '';
    btnRecapture.style.display = 'none';
    btnSubmit.style.display = 'none';
    hideStatus();
    try { await startCamera(); }
    catch (e) {
      // 摄像头不可用：自动进入"上传"提示
      console.warn('启动摄像头失败:', e);
      btnCapture.style.display = 'none';
      showStatus('error', '摄像头不可用，请使用下方"从相册选择手掌照片"');
    }
  }

  // ====== 显示/隐藏弹窗 ======
  async function openModal() {
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    // 重置到步骤1
    stepCapture.style.display = 'none';
    stepId.style.display = '';
    inputUserId.value = currentUserId || '';
    inputUserId.classList.remove('invalid');
    setTimeout(function () { inputUserId.focus(); }, 50);
    capturedBlob = null;
    hideStatus();
  }
  function closeModal() {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    stopCamera();
    capturedBlob = null;
    if (previewImg && previewImg.src) {
      try { URL.revokeObjectURL(previewImg.src); } catch (_) {}
      previewImg.src = '';
    }
    submitting = false;
  }

  // ====== 进入步骤2 ======
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
    stepCapture.style.display = '';
    await resetToCaptureMode();
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
    btnSubmit.disabled = true;
    btnRecapture.disabled = true;
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
      console.log('[palm-register] 🖐️ 你的刷掌识别算法（占位实现）');
      showStatus('success', '🖐️ 你的刷掌识别算法（占位响应）- 请替换为你的掌纹注册服务');
      setTimeout(function () { closeModal(); }, 2200);
    } catch (err) {
      console.error('palm-register error:', err);
      showStatus('error', '网络异常，请稍后重试');
    } finally {
      submitting = false;
      btnSubmit.disabled = false;
      btnRecapture.disabled = false;
    }
  }

  // ====== 初始化绑定 ======
  function init() {
    overlay = document.getElementById('register-overlay');
    if (!overlay) return; // 页面没有弹窗结构，跳过
    modalCloseBtn = document.getElementById('register-modal-close');
    openLink = document.getElementById('open-register-link');

    stepId = document.getElementById('register-step-id');
    stepCapture = document.getElementById('register-step-capture');

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

    statusBox = document.getElementById('register-status-box');
    statusIcon = document.getElementById('register-status-icon');
    statusText = document.getElementById('register-status-text');

    // 入口
    if (openLink) openLink.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });

    // 关闭
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal();
    });

    // 输入校验
    inputUserId.addEventListener('input', function () {
      if (isValidUserId(inputUserId.value.trim())) inputUserId.classList.remove('invalid');
    });
    inputUserId.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); btnNext.click(); }
    });

    // 步骤切换
    if (btnNext) btnNext.addEventListener('click', gotoCaptureStep);
    if (btnEditUserId) btnEditUserId.addEventListener('click', function () {
      stopCamera();
      stepCapture.style.display = 'none';
      stepId.style.display = '';
      inputUserId.value = currentUserId;
      inputUserId.focus();
      capturedBlob = null;
      hideStatus();
    });

    // 拍照 / 重拍
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

    // 上传备选
    if (btnUpload) btnUpload.addEventListener('click', function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      // 校验大小（10MB）
      if (f.size > 10 * 1024 * 1024) {
        showStatus('error', '图片过大，请选择小于10MB的图片');
        return;
      }
      showPreview(f);
    });

    // 提交
    if (btnSubmit) btnSubmit.addEventListener('click', submitRegister);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
