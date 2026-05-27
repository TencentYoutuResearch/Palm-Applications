"""
PalmDestiny - 统一入口（完整版）
真正集成混元云端模型，支持完整的掌纹分析 Pipeline。
"""
# ====== 版本标记：确认代码是否更新 ======
_BUILD_VERSION = "2026-05-20-v4"
print(f"[PalmDestiny] 启动版本: {_BUILD_VERSION}")

import sys
import os
import uuid
import json
import time
import random
import re
import shutil
from pathlib import Path
from contextlib import asynccontextmanager

# 将 PalmDestiny/backend 加入 Python 模块搜索路径
BACKEND_DIR = Path(__file__).parent / "PalmDestiny" / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# 从 .env 配置文件加载环境变量（密钥等敏感信息统一在 .env 中管理，不要硬编码在源码里）
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

# 设置工作目录相关路径
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = STATIC_DIR / "uploads"
FRONTEND_SRC = BASE_DIR / "PalmDestiny" / "frontend" / "public"

# 子路径部署支持（如 /palm-destiny）
BASE_PATH = os.environ.get("BASE_PATH", "").strip().rstrip("/")
PORT = int(os.environ.get("PORT", "8000"))
print(f"[PalmDestiny] BASE_PATH='{BASE_PATH}', PORT={PORT}")

# 确保上传目录存在（在导入 config 之前设置，避免路径问题）
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 覆盖上传目录和数据库路径的环境变量
os.environ.setdefault("UPLOAD_DIR", str(UPLOAD_DIR))
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/palmistry.db")
os.environ.setdefault("CORS_ORIGINS", '["*"]')

import asyncio
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from loguru import logger

# ============== 日志文件落盘配置（双输出：stderr + 文件） ==============
# 业务日志写入 ./logs/app.log，按天切分、保留 7 天，方便排查鉴权/接口调用问题。
# 启动后可以用：tail -f logs/app.log | grep palm-api
try:
    _LOG_DIR = os.getenv("APP_LOG_DIR", "./logs")
    os.makedirs(_LOG_DIR, exist_ok=True)
    logger.add(
        os.path.join(_LOG_DIR, "app.log"),
        rotation="00:00",        # 每天 0 点切一份
        retention="7 days",      # 保留 7 天
        encoding="utf-8",
        enqueue=True,            # 多进程/多 worker 安全
        backtrace=True,
        diagnose=False,          # 生产关闭，避免泄露变量值
        level="INFO",
    )
    logger.info(f"[boot] 日志文件已启用: {os.path.abspath(_LOG_DIR)}/app.log")
except Exception as _e:
    # 文件 sink 失败不影响启动，stderr 仍可用
    print(f"[boot] WARN: 文件日志初始化失败: {_e}")

# 导入后端核心模块
from app.core.config import settings
from app.core.database import init_db, get_db, engine
from app.models.reading import Base, PalmReading
from app.services.model_factory import model_factory
from app.services.reading_service import palm_reading_service
from app.utils.image_processing import preprocess_palm_image, extract_palm_features
from app.api.schemas import ReadingResponse, HealthResponse, ReadingListResponse

from sqlalchemy.ext.asyncio import AsyncSession


# ===== 通用混元API调用（含LimitExceeded限频重试） =====
async def _call_hunyuan_with_retry(
    payload: dict,
    timeout_seconds: float = 25.0,
    max_retries: int = 2,
    label: str = "混元API",
) -> dict:
    """
    统一的混元API调用入口，自动处理LimitExceeded限频重试。
    遇到限频错误时，指数退避重试（1s, 3s）。
    返回解析后的API响应JSON。
    """
    import httpx as _httpx

    client = model_factory.get_client()
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            payload_body = client._serialize_payload(payload)
            headers = client._sign_headers(payload_body)
            async with _httpx.AsyncClient(timeout=_httpx.Timeout(timeout_seconds, connect=5.0)) as http_client:
                resp = await http_client.post(
                    f"https://{client.host}",
                    content=payload_body,
                    headers=headers,
                )
                resp.raise_for_status()
                result = resp.json()

                # 检查API错误响应
                if "Response" in result and "Error" in result["Response"]:
                    error_info = result["Response"]["Error"]
                    error_code = error_info.get("Code", "Unknown")
                    error_msg = error_info.get("Message", "Unknown error")

                    # LimitExceeded 限频：等待后重试
                    if "LimitExceeded" in error_code and attempt < max_retries:
                        wait = (attempt + 1) * 2  # 2s, 4s
                        logger.info(f"{label} 限频，{wait}s后重试 (第{attempt+1}次)")
                        await asyncio.sleep(wait)
                        continue

                    raise RuntimeError(f"混元API错误: {error_code} - {error_msg}")

                return result

        except RuntimeError:
            raise
        except _httpx.TimeoutException:
            logger.error(f"{label} 请求超时({timeout_seconds}s)")
            raise RuntimeError(f"{label} 请求超时")
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait = (attempt + 1) * 2
                logger.info(f"{label} 请求异常，{wait}s后重试: {e}")
                await asyncio.sleep(wait)
                continue
            raise RuntimeError(f"{label} 请求失败: {e}")

    raise RuntimeError(f"{label} 重试耗尽: {last_error}")


def _extract_hunyuan_content(result: dict) -> str:
    """从混元API响应中提取文本内容。"""
    if "Response" in result and "Choices" in result["Response"]:
        choices = result["Response"]["Choices"]
        if choices and len(choices) > 0:
            return choices[0].get("Message", {}).get("Content", "")
    raise RuntimeError("无法解析混元API响应格式")


# ===== 正态分布随机分数生成（均值85，满分100，不低于65） =====
def _normal_score(mean: float = 85.0, std: float = 5.0, low: int = 65, high: int = 100) -> int:
    """生成正态分布随机分数。默认均值85，标准差5，范围[65, 100]。"""
    score = random.gauss(mean, std)
    return max(low, min(high, round(score)))


# ===== 并发限制中间件：支持最多256个并发请求 =====
class ConcurrencyLimitMiddleware(BaseHTTPMiddleware):
    """限制同时处理的请求数量，防止服务器过载"""

    def __init__(self, app, max_concurrent: int = 256):
        super().__init__(app)
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max = max_concurrent
        self._current = 0

    async def dispatch(self, request: Request, call_next):
        # 静态文件请求不计入并发限制
        if request.url.path.startswith("/static"):
            return await call_next(request)

        if self._semaphore.locked():
            return JSONResponse(
                status_code=503,
                content={"detail": "服务器繁忙，请稍后重试", "error_code": "TOO_MANY_REQUESTS"}
            )

        async with self._semaphore:
            self._current += 1
            try:
                response = await call_next(request)
                return response
            finally:
                self._current -= 1


# ===== 子路径前缀剥离中间件 =====
class StripBasePrefixMiddleware(BaseHTTPMiddleware):
    """当网关把 /palm-destiny/xxx 原样转发到容器时，剥离 BASE_PATH 前缀让路由匹配"""

    async def dispatch(self, request: Request, call_next):
        if BASE_PATH and request.url.path.startswith(BASE_PATH):
            # 剥离前缀，如 /palm-destiny/api/v1/health -> /api/v1/health
            new_path = request.url.path[len(BASE_PATH):] or "/"
            request.scope["path"] = new_path
        return await call_next(request)


def setup_static_files():
    """将前端文件复制到 static 目录（仅复制不存在的文件，不覆盖已有文件）"""
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    if FRONTEND_SRC.exists():
        for f in FRONTEND_SRC.iterdir():
            if f.is_file():
                dest = STATIC_DIR / f.name
                # 只复制不存在的文件，已有文件以 /static/ 目录为准（避免旧版覆盖新版）
                if not dest.exists():
                    shutil.copy2(f, dest)

    # 子路径部署时，为所有 HTML 注入 <base> 标签和 PALM_BASE_PATH 变量
    if BASE_PATH:
        for html_file in STATIC_DIR.glob("*.html"):
            content = html_file.read_text(encoding="utf-8")
            if "<base href=" not in content:
                inject = f'<base href="{BASE_PATH}/static/">\n<script>window.PALM_BASE_PATH="{BASE_PATH}";</script>'
                content = content.replace("<head>", f"<head>\n{inject}", 1)
                html_file.write_text(content, encoding="utf-8")


# 启动时复制前端文件
setup_static_files()

# ===== 全局AI可用标志 =====
# 启动时检测API是否可用，不可用时后续请求直接走降级方案，避免每次都等待超时
_ai_available = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动和关闭事件"""
    global _ai_available

    logger.info(f"PalmDestiny 启动: model={settings.MODEL_TYPE}, deployment={settings.DEPLOYMENT_TYPE}")

    # 初始化模型客户端
    client = model_factory.get_client()

    # 启动时检查模型连通性
    health_ok = await model_factory.check_health()
    if health_ok:
        _ai_available = True
    else:
        _ai_available = False
        logger.error("模型连通性检查失败，请检查 API 密钥和网络连接")

    # 初始化数据库
    await init_db()

    yield


app = FastAPI(
    title="PalmDestiny",
    description="AI 掌纹分析 - 传统手相解读（混元云端模型）",
    version="1.0.0",
    lifespan=lifespan,
    root_path=BASE_PATH,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# CORS 中间件（限制允许的来源域名）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # 本地开发
        "http://localhost:8000",  # 本地开发
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 并发限制中间件（支持 256 个并发 API 请求）
app.add_middleware(ConcurrencyLimitMiddleware, max_concurrent=256)

# ===== API Key 认证 + IP 速率限制中间件 =====
API_KEY = os.getenv("API_KEY", "")
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))

# 不需要认证的路径（健康检查、静态文件等）
AUTH_EXEMPT_PATHS = {"/api/v1/health", "/api/v1/frontend-config.js", "/health"}

_rate_limit_store: dict = defaultdict(list)


class ApiKeyAndRateLimitMiddleware(BaseHTTPMiddleware):
    """API Key 认证 + IP 速率限制"""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 静态文件和豁免路径跳过
        if path.startswith("/static") or path in AUTH_EXEMPT_PATHS:
            return await call_next(request)

        # 非 API 路径跳过（前端页面等）
        if not path.startswith("/api/"):
            return await call_next(request)

        # API Key 验证
        if API_KEY:
            request_key = request.headers.get("X-API-Key", "")
            if request_key != API_KEY:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Invalid or missing API Key"},
                )

        # IP 速率限制
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # 清理 60 秒前的记录
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if now - t < 60
        ]
        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
            )
        _rate_limit_store[client_ip].append(now)

        return await call_next(request)


app.add_middleware(ApiKeyAndRateLimitMiddleware)

# 子路径前缀剥离（最后添加 = 最先执行，确保后续中间件和路由看到的是剥离后的路径）
if BASE_PATH:
    app.add_middleware(StripBasePrefixMiddleware)
    print(f"[PalmDestiny] StripBasePrefixMiddleware 已启用，剥离前缀: '{BASE_PATH}'")
else:
    print("[PalmDestiny] WARNING: BASE_PATH 为空，StripBasePrefixMiddleware 未启用！")

# ===== 允许上传的文件扩展名 =====
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# ===== 前端配置注入（将 API Key 安全传递给前端） =====
@app.get("/api/v1/frontend-config.js")
async def frontend_config():
    """返回前端配置 JS，注入 API Key（浏览器通过 <script> 标签加载）"""
    js_content = f"window.__PALM_CONFIG__ = {{ apiKey: '{API_KEY}' }};"
    return JSONResponse(
        content=js_content,
        media_type="application/javascript",
    )


# ===== 根路径重定向到前端页面 =====
@app.get("/")
async def root():
    return RedirectResponse(url=f"{BASE_PATH}/static/index.html")


@app.head("/")
async def root_head():
    """网关健康检查用 HEAD /palm-destiny/，strip 后变为 HEAD /，返回 200"""
    return JSONResponse(content={"status": "ok"})


# ===== 注册页快捷路径 =====
@app.get("/register")
async def register_page():
    """掌纹注册页快捷路径，重定向到独立的注册前端页面。"""
    return RedirectResponse(url=f"{BASE_PATH}/static/register.html")


# ===== 健康检查 =====
@app.get("/api/v1/health")
async def health_check():
    """健康检查 - 检测模型是否可用"""
    try:
        model_ok = await model_factory.check_health()
    except Exception:
        model_ok = False

    return {
        "status": "healthy" if model_ok else "degraded",
        "model_available": model_ok,
        "model_type": settings.MODEL_TYPE,
        "deployment_type": settings.DEPLOYMENT_TYPE,
        "model_name": settings.model_display_name,
        "version": "1.0.0",
        "build": _BUILD_VERSION,
    }


# ===== 手掌检测API：检测图片中是否包含手掌 =====
@app.post("/api/v1/palm-detect")
async def palm_detect(
    file: UploadFile = File(...),
):
    """
    轻量级手掌检测接口。
    使用肤色检测 + 轮廓分析判断图片中是否包含手掌。
    不做完整的掌纹分析，仅做快速检测。
    """
    import cv2
    import numpy as np

    if not file.filename:
        raise HTTPException(status_code=400, detail="未提供文件名")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件过大")

    # 将字节流解码为OpenCV图像
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return JSONResponse(content={
            "code": -1,
            "detected": False,
            "message": "无法解析图片，请重新拍摄"
        })

    detected, confidence, message = _detect_palm_in_image(img)
    return JSONResponse(content={
        "code": 0 if detected else -1,
        "detected": detected,
        "confidence": round(confidence, 2),
        "message": message
    })


def _detect_palm_in_image(img) -> tuple:
    """
    检测图片中是否包含手掌。
    使用多种方法综合判断：
    1. 肤色检测（YCrCb色彩空间）
    2. 大面积肤色区域轮廓分析
    3. 凸包缺陷检测（手指间的凹陷）

    返回: (detected: bool, confidence: float, message: str)
    """
    import cv2
    import numpy as np

    h, w = img.shape[:2]
    total_pixels = h * w

    # 调整到统一尺寸加速处理
    max_dim = 640
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
        total_pixels = h * w

    # === 方法1：肤色检测 ===
    # 转换到YCrCb色彩空间，肤色在此空间有较好的聚类特性
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    # 肤色范围（宽松阈值，适应不同肤色）
    lower_skin = np.array([0, 133, 77], dtype=np.uint8)
    upper_skin = np.array([255, 173, 127], dtype=np.uint8)
    skin_mask = cv2.inRange(ycrcb, lower_skin, upper_skin)

    # 同时用HSV空间做辅助检测
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_hsv = np.array([0, 20, 70], dtype=np.uint8)
    upper_hsv = np.array([20, 255, 255], dtype=np.uint8)
    skin_mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)

    # 合并两种肤色检测结果
    skin_mask = cv2.bitwise_or(skin_mask, skin_mask_hsv)

    # 形态学操作去噪
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # 高斯模糊平滑
    skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 0)
    _, skin_mask = cv2.threshold(skin_mask, 127, 255, cv2.THRESH_BINARY)

    # 计算肤色像素占比
    skin_pixels = cv2.countNonZero(skin_mask)
    skin_ratio = skin_pixels / total_pixels

    # === 方法2：轮廓分析 ===
    contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return (False, 0.0, "未检测到掌纹，请将手掌放入扫描区域后重新拍摄")

    # 找最大轮廓
    largest_contour = max(contours, key=cv2.contourArea)
    contour_area = cv2.contourArea(largest_contour)
    contour_ratio = contour_area / total_pixels

    # === 方法3：凸包缺陷检测（检测手指间的凹陷） ===
    defect_count = 0
    if len(largest_contour) >= 5:
        hull = cv2.convexHull(largest_contour, returnPoints=False)
        try:
            defects = cv2.convexityDefects(largest_contour, hull)
            if defects is not None:
                for i in range(defects.shape[0]):
                    s, e, f, d = defects[i, 0]
                    # 深度阈值：缺陷深度需要足够大才算手指间的凹陷
                    if d > 8000:  # 深度阈值
                        defect_count += 1
        except Exception:
            pass

    # === 综合判断 ===
    confidence = 0.0

    # 肤色占比贡献（手掌通常占画面15%-70%）
    if 0.10 <= skin_ratio <= 0.80:
        confidence += min(skin_ratio * 1.5, 0.4)
    elif skin_ratio < 0.10:
        confidence += skin_ratio * 2  # 肤色太少

    # 最大轮廓面积贡献（手掌应该是一个大的连通区域）
    if contour_ratio >= 0.08:
        confidence += min(contour_ratio * 1.2, 0.35)

    # 凸包缺陷贡献（手指间通常有2-5个凹陷）
    if 1 <= defect_count <= 8:
        confidence += min(defect_count * 0.06, 0.25)

    # 判定阈值
    if confidence >= 0.25:
        return (True, min(confidence, 1.0), "已检测到手掌")
    elif skin_ratio >= 0.15 and contour_ratio >= 0.10:
        # 即使综合分数不够，如果肤色和轮廓都足够大，也认为检测到了
        return (True, max(confidence, 0.3), "已检测到手掌")
    else:
        return (False, confidence, "未检测到掌纹，请将手掌放入扫描区域后重新拍摄")


# ===== 掌纹认证API：在掌纹库中查找匹配用户（对接腾讯开源社区印尼掌纹开放平台 1:N） =====
@app.post("/api/v1/palm-identify")
async def palm_identify(
    file: UploadFile = File(...),
):
    """
    掌纹 1:N 认证接口。
    调用腾讯开源社区印尼掌纹开放平台 (open.intl.palm.tencent.com) 进行真实识别。
    返回匹配结果（用户ID、置信度等）。
    注意：即使未找到匹配或服务异常，也不阻塞后续的算命流程。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="未提供文件名")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件过大")

    if not content:
        return JSONResponse(content={
            "code": -1,
            "identified": False,
            "user_id": None,
            "person_name": None,
            "confidence": 0.0,
            "message": "图片内容为空，请重新拍摄"
        })

    # 推断 Content-Type
    content_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp",
    }
    content_type = content_type_map.get(ext, "image/jpeg")

    try:
        from app.services.palm_recognize_client import search_palm_1n

        result = await search_palm_1n(
            image_bytes=content,
            filename=file.filename,
            content_type=content_type,
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"掌纹认证异常: {e}")
        return JSONResponse(content={
            "code": -1,
            "identified": False,
            "user_id": None,
            "person_name": None,
            "confidence": 0.0,
            "message": "掌纹认证服务异常"
        })


# ===== 掌纹注册API：将用户的 RGB 掌纹录入掌纹库 =====
@app.post("/api/v1/palm-register")
async def palm_register(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    is_force: bool = Form(True),
):
    """
    掌纹注册接口（对接腾讯开源社区印尼掌纹开放平台 RegisterRgbPalm）。
    将上传的 RGB 掌图绑定到指定 user_id，后续 1:N 检索可识别到该用户。
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="用户ID不能为空")
    user_id = user_id.strip()
    if len(user_id) > 64:
        raise HTTPException(status_code=400, detail="用户ID过长（最多64字符）")

    if not file.filename:
        raise HTTPException(status_code=400, detail="未提供文件名")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件过大")
    if not content:
        return JSONResponse(content={
            "code": -1,
            "success": False,
            "user_id": user_id,
            "message": "图片内容为空，请重新拍摄"
        })

    content_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp",
    }
    content_type = content_type_map.get(ext, "image/jpeg")

    try:
        from app.services.palm_recognize_client import register_palm

        result = await register_palm(
            user_id=user_id,
            image_bytes=content,
            filename=file.filename,
            content_type=content_type,
            is_force=is_force,
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"掌纹注册异常: {e}")
        return JSONResponse(content={
            "code": -1,
            "success": False,
            "user_id": user_id,
            "message": "掌纹注册服务异常"
        })


# ===== 八字简评API：AI生成分门别类的八字评语 =====
from pydantic import BaseModel as PydanticBaseModel

class BaziCommentRequest(PydanticBaseModel):
    bazi_str: str
    year: int
    month: int
    day: int
    shichen_idx: int
    day_master: str
    day_master_wuxing: str

@app.post("/api/v1/bazi-comment")
async def bazi_comment(req: BaziCommentRequest):
    """
    根据八字信息，调用大模型生成分门别类的八字简评。
    包含：爱情、事业、婚姻、身体健康、喜用神、忌神、适合职业、发展方位、推荐城市。
    """
    # 当AI不可用时，使用本地正态分布随机策略生成八字简评
    if not _ai_available:
        return JSONResponse(content={"code": 0, "data": {"comment_html": _generate_fallback_bazi_comment(req)}})

    prompt = f"""你是一位精通中国传统命理学的资深命理师，熟读《子平真诠》《滴天髓》《穷通宝鉴》《三命通会》等经典著作。

请根据以下八字信息，生成一份详细的八字简评。

八字四柱：{req.bazi_str}
出生年月日：{req.year}年{req.month}月{req.day}日
日主：{req.day_master}（{req.day_master_wuxing}）

请严格按照以下JSON格式返回结果（不要包含任何其他文字，只返回纯JSON）：

{{
  "love": "<爱情运势分析，60-80字，积极正面，如有不利因素用'需要留意'或'宜多注意'等委婉表达>",
  "career": "<事业运势分析，60-80字，突出优势和发展方向，不利之处委婉提醒>",
  "marriage": "<婚姻运势分析，60-80字，积极为主，注意事项委婉表达>",
  "health": "<身体健康分析，60-80字，指出需要注意保养的方面，用'宜注意调养'等温和表达>",
  "xi_yong_shen": "<喜用神分析，40-60字，说明喜用神是什么五行以及为什么>",
  "ji_shen": "<忌神分析，40-60字，说明忌神是什么五行，用'宜适当化解'等委婉表达>",
  "suitable_career": "<适合的职业方向，列举3-5个具体职业领域，40-60字>",
  "direction": "<发展和定居方位推荐，根据喜用神五行推荐方位，30-50字>",
  "recommended_cities": "<推荐城市，根据方位和五行推荐3-5个具体城市名，30-50字>"
}}

**重要要求：**
1. 全文使用中文
2. 总字数必须在300字以上
3. 好的方面多说、详细说，展现积极面
4. 不好的方面少说，且必须委婉表达，用"需要留意"、"宜多注意"、"适当关注"等措辞，绝不能直接说"不好"、"差"、"凶"等负面词
5. 分析要基于八字五行生克制化的实际情况，不要凭空编造
6. 只返回纯JSON，不要有任何额外文字或markdown标记
"""

    try:
        payload = {
            "Messages": [{"Role": "user", "Content": prompt}],
            "Stream": False,
            "Model": settings.HUNYUAN_TEXT_MODEL
        }
        result = await _call_hunyuan_with_retry(payload, timeout_seconds=25.0, label="八字简评")
        content = _extract_hunyuan_content(result)
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
        comment_data = json.loads(content)

        # 构建分门别类的HTML
        sections = [
            ("💕 爱情运势", comment_data.get("love", "")),
            ("💼 事业运势", comment_data.get("career", "")),
            ("💍 婚姻运势", comment_data.get("marriage", "")),
            ("🏥 身体健康", comment_data.get("health", "")),
            ("✨ 喜用神", comment_data.get("xi_yong_shen", "")),
            ("⚠️ 忌神", comment_data.get("ji_shen", "")),
            ("🎯 适合职业", comment_data.get("suitable_career", "")),
            ("🧭 发展方位", comment_data.get("direction", "")),
            ("🏙️ 推荐城市", comment_data.get("recommended_cities", "")),
        ]

        html_parts = []
        for title, text in sections:
            if text:
                html_parts.append(
                    f'<div class="bazi-comment-section">'
                    f'<div class="bazi-comment-title">{title}</div>'
                    f'<div class="bazi-comment-text">{text}</div>'
                    f'</div>'
                )

        comment_html = ''.join(html_parts)
        return JSONResponse(content={"code": 0, "data": {"comment_html": comment_html}})

    except json.JSONDecodeError as e:
        logger.error(f"AI八字简评JSON解析失败: {e}")
        return JSONResponse(content={"code": -1, "message": "AI返回格式异常"}, status_code=500)
    except Exception as e:
        logger.error(f"AI八字简评请求失败: {e}")
        return JSONResponse(content={"code": -1, "message": str(e)}, status_code=500)


# ===== AI星座分析API =====
class ConstellationAnalysisRequest(PydanticBaseModel):
    constellation_name: str
    constellation_index: int
    date_str: str  # 当前日期字符串，如 "2026年04月16日"

@app.post("/api/v1/constellation-analysis")
async def constellation_analysis(req: ConstellationAnalysisRequest):
    """
    调用大模型生成星座运势分析。
    包含：今日运势概述、爱情运势、事业运势、财运、健康、幸运色、幸运数字、速配星座、守护星解读。
    """
    # 当AI不可用时，使用本地正态分布随机策略生成星座分析
    if not _ai_available:
        return JSONResponse(content={"code": 0, "data": _generate_fallback_constellation(req)})

    prompt = f"""你是一位精通西方占星学的资深占星师，熟读各类占星经典，精通星盘解读、行星运行规律和星座特质分析。

请根据以下信息，生成一份详细的今日星座运势分析报告。

星座：{req.constellation_name}
日期：{req.date_str}

请严格按照以下JSON格式返回结果（不要包含任何其他文字，只返回纯JSON）：

{{
  "overview": "<今日运势总体概述，80-120字，描述今日星象对该星座的整体影响，提及具体的行星相位>",
  "love": "<爱情运势详细分析，80-120字，单身者和有伴侣者分别给出建议>",
  "career": "<事业运势详细分析，80-120字，包含职场人际、项目推进、领导关系等>",
  "wealth": "<财运详细分析，60-100字，包含正财偏财、投资理财建议>",
  "health": "<健康运势分析，60-100字，包含身体和心理健康建议，注意事项>",
  "love_score": <65-98之间的整数>,
  "career_score": <65-98之间的整数>,
  "wealth_score": <65-98之间的整数>,
  "health_score": <65-98之间的整数>,
  "overall_score": <65-98之间的整数>,
  "lucky_color": "<今日幸运颜色，如'薰衣草紫'>",
  "lucky_number": <1-99之间的整数>,
  "lucky_constellation": "<今日速配星座名称>",
  "guardian_reading": "<守护星今日解读，60-100字，描述守护星当前运行状态对该星座的影响>",
  "special_reminder": "<今日特别提醒，40-60字，给出一条具体可执行的建议>"
}}

**重要要求：**
1. 全文使用中文
2. 分析要基于占星学原理，提及具体的行星相位和星象变化
3. 保持积极正面的基调，不利因素用委婉方式表达

4. 每个维度的分析都要有实质性内容，不要空泛
5. 只返回纯JSON，不要有任何额外文字或markdown标记
"""

    try:
        payload = {
            "Messages": [{"Role": "user", "Content": prompt}],
            "Stream": False,
            "Model": settings.HUNYUAN_TEXT_MODEL
        }
        result = await _call_hunyuan_with_retry(payload, timeout_seconds=25.0, label="星座分析")
        content = _extract_hunyuan_content(result)
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
        analysis_data = json.loads(content)
        # 确保分数在合理范围
        for key in ['love_score', 'career_score', 'wealth_score', 'health_score', 'overall_score']:
            if key in analysis_data:
                analysis_data[key] = max(65, min(98, int(analysis_data[key])))
        return JSONResponse(content={"code": 0, "data": analysis_data})

    except json.JSONDecodeError as e:
        logger.error(f"AI星座分析JSON解析失败: {e}")
        return JSONResponse(content={"code": -1, "message": "AI返回格式异常"}, status_code=500)
    except Exception as e:
        logger.error(f"AI星座分析请求失败: {e}")
        return JSONResponse(content={"code": -1, "message": str(e)}, status_code=500)


# ===== AI今日宜忌（老黄历）分析API =====
class YiJiAnalysisRequest(PydanticBaseModel):
    date_str: str        # 阳历日期，如 "2026年04月16日"
    lunar_str: str       # 农历日期，如 "丙午年二月廿九"
    ganzhi_day: str      # 今日天干地支，如 "庚申"
    zodiac_name: str = ""  # 用户生肖（可选）

@app.post("/api/v1/yiji-analysis")
async def yiji_analysis(req: YiJiAnalysisRequest):
    """
    调用大模型基于老黄历和传统历法生成今日宜忌分析。
    包含：宜做事项、忌做事项、时辰吉凶、每日一卦、黄历解读等。
    """
    # 当AI不可用时，使用本地策略生成宜忌分析
    if not _ai_available:
        return JSONResponse(content={"code": 0, "data": _generate_fallback_yiji(req)})

    prompt = f"""你是一位精通中国传统历法和老黄历的资深命理师，熟读《协纪辨方书》《象吉通书》《玉匣记》《万年历》等经典著作，精通择日择吉、黄道吉日判断。

请根据以下日期信息，生成一份详细的今日宜忌分析报告（基于老黄历传统）。

阳历日期：{req.date_str}
农历日期：{req.lunar_str}
今日干支：{req.ganzhi_day}日
{"用户生肖：属" + req.zodiac_name if req.zodiac_name else ""}

请严格按照以下JSON格式返回结果（不要包含任何其他文字，只返回纯JSON）：

{{
  "yi_items": ["<宜做事项1>", "<宜做事项2>", "<宜做事项3>", "<宜做事项4>", "<宜做事项5>", "<宜做事项6>"],
  "ji_items": ["<忌做事项1>", "<忌做事项2>", "<忌做事项3>", "<忌做事项4>", "<忌做事项5>"],
  "yi_details": "<宜做事项的详细解读，100-150字，解释为什么今天适合做这些事，引用老黄历原理>",
  "ji_details": "<忌做事项的详细解读，80-120字，解释为什么今天不宜做这些事，引用老黄历原理>",
  "day_summary": "<今日黄历总评，80-120字，综合分析今日吉凶，包含建除十二神、二十八宿等传统历法要素>",
  "jianchu": "<今日建除十二神，如'建'、'除'、'满'、'平'、'定'、'执'、'破'、'危'、'成'、'收'、'开'、'闭'之一>",
  "jianchu_meaning": "<建除十二神的含义解读，40-60字>",
  "star28": "<今日值日二十八宿星名，如'角木蛟'、'亢金龙'等>",
  "star28_meaning": "<二十八宿的吉凶含义，40-60字>",
  "wuxing_day": "<今日五行属性，如'金'、'木'、'水'、'火'、'土'>",
  "chong_sha": "<今日冲煞，如'冲虎煞南'>",
  "lucky_god_direction": "<今日财神方位，如'正东'>",
  "xi_god_direction": "<今日喜神方位，如'东南'>",
  "fu_god_direction": "<今日福神方位，如'正北'>",
  "auspicious_hours": ["<吉时1，如'子时(23-1点)'>", "<吉时2>", "<吉时3>"],
  "inauspicious_hours": ["<凶时1>", "<凶时2>"],
  "daily_hexagram": "<今日一卦，如'天火同人'>",
  "hexagram_meaning": "<卦象解读，60-80字，解释此卦对今日的指导意义>",
  "special_note": "<特别提醒，40-60字，基于今日黄历给出的特别注意事项>"
}}

**重要要求：**
1. 全文使用中文
2. 宜忌事项必须基于传统老黄历的择日原则，不能随意编造
3. 建除十二神、二十八宿等必须基于实际的历法推算规则
4. 保持传统文化的严谨性，同时用现代人能理解的语言表达
5. 冲煞、财神方位等要基于今日天干地支推算
6. 只返回纯JSON，不要有任何额外文字或markdown标记
"""

    try:
        payload = {
            "Messages": [{"Role": "user", "Content": prompt}],
            "Stream": False,
            "Model": settings.HUNYUAN_TEXT_MODEL
        }
        result = await _call_hunyuan_with_retry(payload, timeout_seconds=25.0, label="宜忌分析")
        content = _extract_hunyuan_content(result)
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
        yiji_data = json.loads(content)
        return JSONResponse(content={"code": 0, "data": yiji_data})

    except json.JSONDecodeError as e:
        logger.error(f"AI宜忌分析JSON解析失败: {e}")
        return JSONResponse(content={"code": -1, "message": "AI返回格式异常"}, status_code=500)
    except Exception as e:
        logger.error(f"AI宜忌分析请求失败: {e}")
        return JSONResponse(content={"code": -1, "message": str(e)}, status_code=500)


# ===== 核心API：上传掌纹并获取分析 =====
@app.post("/api/v1/readings")
async def create_reading(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    上传掌纹图片并获取完整分析结果。
    使用混元云端模型进行真正的 AI 掌纹解读。

    Pipeline:
    1. 图像预处理（CLAHE + 二值化）
    2. CV 特征提取（Hough 线检测 + 轮廓分析）
    3. 多模态模型图像描述（混元 Vision）
    4. 手相解读生成（混元文本生成）
    """
    # 验证文件类型
    if not file.filename:
        raise HTTPException(status_code=400, detail="未提供文件名")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {ext}。支持: {ALLOWED_EXTENSIONS}",
        )

    # 读取文件内容
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大，最大 {settings.MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # 保存文件
    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{file_id}{ext}"
    save_path.parent.mkdir(parents=True, exist_ok=True)

    with open(save_path, "wb") as f:
        f.write(content)

    # 执行完整的掌纹分析 Pipeline
    # 总超时 55 秒，防止网关 504（预览环境网关超时通常 60s）
    PIPELINE_TIMEOUT = 55

    try:
        record = await asyncio.wait_for(
            palm_reading_service.create_reading(str(save_path), db),
            timeout=PIPELINE_TIMEOUT,
        )

        # 构建响应
        response_data = {
            "code": 0,
            "data": {
                "source": "llm",
                "id": record.id,
                "status": record.status,
                "image_path": record.image_path,
                "preprocessed_path": record.preprocessed_path,
                "image_features": {
                    "brightness": record.life_line_score or 0,
                    "texture_complexity": record.head_line_score or 0,
                    "contrast": record.heart_line_score or 0,
                    "warm_ratio": 0.45,
                    "high_freq_ratio": 0.25,
                },
                "cv_features": json.loads(record.cv_features_json) if record.cv_features_json else None,
                "vl_description": record.vl_description,
                "identity": None,
                "fortune": None,
                "report": None,
                "processing_time_ms": record.processing_time_ms,
                "error_message": record.error_message,
            },
        }

        # 如果有完整的解读结果，构建报告
        if record.reading_result:
            report = _parse_reading_to_report(record.reading_result)
            response_data["data"]["report"] = report
            response_data["data"]["source"] = "llm"

        # ===== 请求大模型生成运势分数（限时 15 秒，超时走降级） =====
        try:
            fortune_data = await asyncio.wait_for(
                _request_fortune_from_llm(
                    record.vl_description or "",
                    record.cv_features_json or ""
                ),
                timeout=30,
            )
            fortune_data["source"] = "llm"
            response_data["data"]["fortune"] = fortune_data
        except (asyncio.TimeoutError, Exception) as fortune_err:
            logger.error(f"运势分数获取失败（超时或异常）: {fortune_err}")
            fallback = _generate_fallback_fortune()
            response_data["data"]["fortune"] = fallback

        return JSONResponse(content=response_data)

    except asyncio.TimeoutError:
        logger.error(f"掌纹分析 pipeline 总超时（{PIPELINE_TIMEOUT}s）")
        # 超时降级：返回本地生成的数据
        fallback_fortune = _generate_fallback_fortune()
        fallback_report = _generate_fallback_report()
        fallback_response = {
            "code": 0,
            "data": {
                "source": "fallback",
                "id": str(uuid.uuid4()),
                "status": "done",
                "image_path": str(save_path),
                "preprocessed_path": None,
                "image_features": {
                    "brightness": _normal_score(mean=130, std=20, low=80, high=200),
                    "texture_complexity": _normal_score(mean=35, std=8, low=15, high=60),
                    "contrast": _normal_score(mean=55, std=10, low=30, high=80),
                    "warm_ratio": round(random.gauss(0.45, 0.08), 2),
                    "high_freq_ratio": round(random.gauss(0.25, 0.05), 2),
                },
                "cv_features": None,
                "vl_description": None,
                "identity": None,
                "fortune": fallback_fortune,
                "report": fallback_report,
                "processing_time_ms": 0,
                "error_message": None,
            },
        }
        return JSONResponse(content=fallback_response)
    except Exception as e:
        logger.error(f"掌纹分析失败: {e}")
        # 降级：返回基本数据 + 正态分布运势分数，保证用户体验
        fallback_fortune = _generate_fallback_fortune()
        fallback_report = _generate_fallback_report()
        fallback_response = {
            "code": 0,
            "data": {
                "source": "fallback",
                "id": str(uuid.uuid4()),
                "status": "done",
                "image_path": str(save_path),
                "preprocessed_path": None,
                "image_features": {
                    "brightness": _normal_score(mean=130, std=20, low=80, high=200),
                    "texture_complexity": _normal_score(mean=35, std=8, low=15, high=60),
                    "contrast": _normal_score(mean=55, std=10, low=30, high=80),
                    "warm_ratio": round(random.gauss(0.45, 0.08), 2),
                    "high_freq_ratio": round(random.gauss(0.25, 0.05), 2),
                },
                "cv_features": None,
                "vl_description": None,
                "identity": None,
                "fortune": fallback_fortune,
                "report": fallback_report,
                "processing_time_ms": 0,
                "error_message": None,
            },
        }
        return JSONResponse(content=fallback_response)


@app.get("/api/v1/readings/{reading_id}")
async def get_reading(reading_id: str, db: AsyncSession = Depends(get_db)):
    """获取指定ID的分析结果"""
    record = await palm_reading_service.get_reading(reading_id, db)
    if not record:
        raise HTTPException(status_code=404, detail="记录未找到")
    return ReadingResponse.model_validate(record)


@app.get("/api/v1/readings")
async def list_readings(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """列出最近的分析记录"""
    items = await palm_reading_service.list_readings(db, skip=skip, limit=limit)
    return ReadingListResponse(
        total=len(items),
        items=[ReadingResponse.model_validate(r) for r in items],
    )


async def _request_fortune_from_llm(vl_description: str, cv_features_json: str) -> dict:
    """
    调用大模型生成运势分数和运势文本。
    返回格式: { total_score, love_score, career_score, wealth_score, health_score, palm_line_readings: [...] }
    """
    # 当AI不可用时，直接抛出异常让调用方走降级方案
    if not _ai_available:
        raise RuntimeError("AI服务暂不可用")

    prompt = f"""你是一位精通中国传统手相学和命理学的大师。
请根据以下掌纹分析数据，为用户生成今日运势评分和掌纹解读。

====== 掌纹视觉描述 ======
{vl_description or '暂无视觉描述'}

====== 计算机视觉特征 ======
{cv_features_json or '暂无CV特征'}

请严格按照以下JSON格式返回结果（不要包含任何其他文字，只返回纯JSON）：

{{
  "total_score": <65-98之间的整数，综合运势分>,
  "love_score": <65-98之间的整数，爱情运势分>,
  "career_score": <65-98之间的整数，事业运势分>,
  "wealth_score": <65-98之间的整数，财运分>,
  "health_score": <65-98之间的整数，健康运势分>,
  "love_text": "<一段50-100字的爱情运势解读>",
  "career_text": "<一段50-100字的事业运势解读>",
  "wealth_text": "<一段50-100字的财运解读>",
  "health_text": "<一段50-100字的健康运势解读>",
  "palm_line_readings": [
    {{"name": "生命线", "icon": "💚", "text": "<基于掌纹分析的生命线解读，50-80字>"}},
    {{"name": "智慧线", "icon": "💜", "text": "<基于掌纹分析的智慧线解读，50-80字>"}},
    {{"name": "感情线", "icon": "❤️", "text": "<基于掌纹分析的感情线解读，50-80字>"}},
    {{"name": "事业线", "icon": "⭐", "text": "<基于掌纹分析的事业线解读，50-80字>"}},
    {{"name": "太阳线", "icon": "🌟", "text": "<基于掌纹分析的太阳线解读，50-80字>"}},
    {{"name": "婚姻线", "icon": "💍", "text": "<基于掌纹分析的婚姻线解读，50-80字>"}}
  ]
}}

要求：
1. 所有分数必须在65-98之间，体现积极正面的运势
2. 解读文字要温暖、积极、有建设性
3. 掌纹解读要基于提供的掌纹数据
4. 只返回纯JSON，不要有任何额外文字或markdown标记"""

    try:
        payload = {
            "Messages": [{"Role": "user", "Content": prompt}],
            "Stream": False,
            "Model": settings.HUNYUAN_TEXT_MODEL
        }
        result = await _call_hunyuan_with_retry(payload, timeout_seconds=25.0, label="运势分数")
        content = _extract_hunyuan_content(result)
        # 清理可能的markdown代码块标记
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
        fortune_data = json.loads(content)
        # 确保所有分数不低于65，兼容大模型返回文本而非数字的情况
        for key in ['total_score', 'love_score', 'career_score', 'wealth_score', 'health_score']:
            if key in fortune_data:
                val = fortune_data[key]
                if isinstance(val, (int, float)):
                    fortune_data[key] = max(65, min(98, int(val)))
                elif isinstance(val, str):
                    # 尝试从文本中提取数字
                    nums = re.findall(r'\d+', val)
                    if nums:
                        fortune_data[key] = max(65, min(98, int(nums[0])))
                    else:
                        fortune_data[key] = _normal_score()
                else:
                    fortune_data[key] = _normal_score()
        return fortune_data

    except json.JSONDecodeError as e:
        logger.error(f"大模型运势JSON解析失败: {e}")
        raise
    except Exception as e:
        logger.error(f"大模型运势请求失败: {type(e).__name__}: {e}")
        raise


def _generate_fallback_fortune() -> dict:
    """
    降级方案：当大模型不可用时，使用正态分布随机数生成运势分数。
    均值85，满分100，不低于65。
    """
    # 多组掌纹解读文案，随机选取
    life_line_texts = [
        "生命线深长且清晰，弧度优美环绕金星丘，显示体魄强健、精力充沛，一生少有大病大灾。",
        "生命线宽阔有力，色泽红润，显示出极强的生命能量。起始处与智慧线分开，性格独立果敢。",
        "生命线平稳延伸至手腕，纹路均匀无断裂，预示稳定的健康状态，晚年安逸。",
    ]
    wisdom_line_texts = [
        "智慧线笔直有力横贯掌心，末端微微上扬，主思维敏捷、逻辑清晰，具有出色的分析能力。",
        "智慧线深且长，延伸至掌缘，显示出出众的分析能力和决策力，适合从事管理或研究工作。",
        "智慧线微微下弯至月丘方向，创造力与想象力旺盛，适合文学艺术领域。",
    ]
    emotion_line_texts = [
        "感情线温润饱满，从小指下方延伸至食指根部，情感丰富细腻，婚恋运势佳。",
        "感情线深长且呈优美弧线，色泽红润，情感表达能力强，善于经营感情关系。",
        "感情线延伸至食指与中指之间，对爱情充满理想主义，追求完美的感情生活。",
    ]
    career_line_texts = [
        "事业线清晰可见，走势平稳上升，职业发展稳步向好，有望获得上级赏识。",
        "事业线从掌底直达中指根部，深长有力一气呵成，事业心极强，目标明确。",
        "事业线中段出现上升分支，预示着新的发展机遇即将到来。",
    ]
    sun_line_texts = [
        "太阳线清晰可见，预示在艺术、创作或公众领域有出色表现，才华将得到认可。",
        "太阳线深长有力，预示凭借智慧和才学获得成功与名望。",
        "太阳线与事业线并行延伸，事业发展伴随声望提升，前途光明。",
    ]
    marriage_line_texts = [
        "婚姻线清晰且只有一条主线，深长有力，预示婚姻美满、感情专一。",
        "婚姻线位置适中，长度恰好，显示婚姻时机把握得当，感情和谐。",
        "婚姻线末端微微上扬，显示对婚姻充满积极期待，家庭幸福美满。",
    ]
    love_texts = [
        "今日桃花运不错，适合与心仪之人增进感情，已有伴侣者感情稳定升温。",
        "浪漫的金星能量笼罩着你，无论是表白还是约会，今天都是绝佳时机。",
        "感情方面春风得意，你的魅力指数飙升，异性缘特别好。",
    ]
    career_texts = [
        "事业运势良好，工作中有贵人相助，适合推进重要项目和展示才华。",
        "职场上灵感不断，效率极高，适合推进重要项目和展示才华。",
        "事业运势大吉，你的才华将得到充分展现，有望获得上级赏识。",
    ]
    wealth_texts = [
        "财运平稳向好，正财运佳，适合稳健理财，可能有意外收获。",
        "财运亨通，今日适合进行投资理财，有意外收获的可能。",
        "金钱能量充沛，可能收到好消息或意外之财，偏财运旺盛。",
    ]
    health_texts = [
        "身体状态不错，精力充沛，适当运动有助于保持良好状态。",
        "身体状态极佳，精力旺盛，适合进行户外运动，免疫力处于高峰。",
        "健康状况总体良好，注意作息规律，适度运动有助于保持良好状态。",
    ]

    return {
        "total_score": _normal_score(),
        "love_score": _normal_score(),
        "career_score": _normal_score(),
        "wealth_score": _normal_score(),
        "health_score": _normal_score(),
        "love_text": random.choice(love_texts),
        "career_text": random.choice(career_texts),
        "wealth_text": random.choice(wealth_texts),
        "health_text": random.choice(health_texts),
        "palm_line_readings": [
            {"name": "生命线", "icon": "💚", "text": random.choice(life_line_texts)},
            {"name": "智慧线", "icon": "💜", "text": random.choice(wisdom_line_texts)},
            {"name": "感情线", "icon": "❤️", "text": random.choice(emotion_line_texts)},
            {"name": "事业线", "icon": "⭐", "text": random.choice(career_line_texts)},
            {"name": "太阳线", "icon": "🌟", "text": random.choice(sun_line_texts)},
            {"name": "婚姻线", "icon": "💍", "text": random.choice(marriage_line_texts)},
        ],
        "source": "fallback"
    }


def _generate_fallback_report() -> dict:
    """AI不可用时，生成本地手相解读报告。分数使用正态分布。"""
    sections_data = [
        {
            "title": "一、掌型总论",
            "icon": "🖐️",
            "subtitle": "金木水火土五行掌 + 掌色气血分析",
            "contents": [
                "掌形方正厚实，骨骼坚实有力，属金形掌。金形掌主人性格刚毅果断，做事有条理，适合从事管理、法律等需要严谨思维的行业。掌色红润有光泽，气血充盈，精力旺盛。《麻衣神相》云：「掌如绵软，富贵绑身」，此掌虽非绵软之相，但骨肉匀称、气色红润，亦为上佳之相。",
                "掌形修长纤细，关节分明，属木形掌。木形掌主人聪慧好学，富有创造力和艺术天赋，适合文学、艺术、教育等领域。掌色白皙透粉，气血调和，思维敏捷。《柳庄相法》论：「木形掌长而秀，主聪明过人」。",
                "掌形圆润柔软，手指短而丰满，属水形掌。水形掌主人性格温和圆融，善于交际，适应力强。掌色偏白，气血平稳，适合商业、外交等需要人际沟通的工作。",
            ],
        },
        {
            "title": "二、生命线（地纹）详解",
            "icon": "💚",
            "subtitle": "健康体质 + 生命阶段运势",
            "contents": [
                "生命线深长且清晰，弧度优美，从食指与拇指之间起始，环绕金星丘延伸至手腕附近。此线象征体魄强健、精力充沛，一生少有大病大灾。\n\n《麻衣神相》云：「生命线深长而红润者，主健康长寿」。弧度大而饱满，显示精力旺盛，金星丘丰隆，代表生命能量充沛。\n\n流年推算：青年期（18-30岁）健康状况极佳，壮年期（30-45岁）精力充沛，中年期（45-60岁）需注意劳逸结合，晚年期安泰。",
                "生命线长度适中，走势平稳，纹路清晰无断裂。线条中段略有细纹交叉，提示中年期需注意劳逸结合。\n\n起始处与智慧线同源，说明性格谨慎稳重。弧度适中，环绕金星丘，显示生活圈子稳定。\n\n流年推算：青年期平稳发展，壮年期稳中有升，中年期注意保养，晚年安逸。",
            ],
        },
        {
            "title": "三、智慧线（人纹）详解",
            "icon": "💜",
            "subtitle": "思维才智 + 事业适配",
            "contents": [
                "智慧线深长有力，横贯掌心，末端微微上扬。此线主人思维敏捷、逻辑清晰，具有出色的分析能力和决策力。\n\n《柳庄相法》论：「智慧线明润而长者，聪明过人，可成大器」。与生命线起始处分开，显示思维独立、判断力强。\n\n适合从事需要逻辑思维和分析能力的职业，如科技、金融、法律等领域。",
                "智慧线微微下弯至月丘方向，创造力与想象力旺盛。纹路清晰且无岛纹干扰，记忆力与专注力处于高峰。\n\n末端出现分叉，显示兴趣广泛、多才多艺，文理兼通。适合从事文学、艺术、设计等创意领域。",
            ],
        },
        {
            "title": "四、感情线（天纹）详解",
            "icon": "❤️",
            "subtitle": "情感模式 + 婚恋运势",
            "contents": [
                "感情线深长饱满，从小指下方延伸至食指与中指之间。此线主人感情丰富、重情重义，婚恋运势极佳。\n\n《神相全编》论感情线：「天纹深秀者，重情重义；浅乱者，情感多变」。弧度优美，色泽红润，情感表达能力强，善于经营感情关系。\n\n感情线末端止于食指与中指之间，为最平衡之相，感情观健康，既有理想主义的追求，又不失现实的考量。",
                "感情线清晰且呈优美弧线，弧度大者热情奔放。从小指下方延伸至食指根部，情感丰富细腻。\n\n无明显断裂或岛纹，感情经历较为顺畅。末端微微上扬，显示对感情积极主动，婚恋运势佳。",
            ],
        },
        {
            "title": "五、命运线（玉柱纹）与事业运",
            "icon": "⭐",
            "subtitle": "发展轨迹 + 事业转折",
            "contents": [
                "命运线从掌底直达中指根部，深长有力，一气呵成。此线主人事业心极强，目标明确，执行力出众。\n\n《水镜集》论：「玉柱纹直透中指者，事业亨通，一生顺遂」。起自手腕处，显示白手起家，靠自身努力成就事业。\n\n35岁前后可能迎来重要的事业转折期，把握机会可更上一层楼。",
                "命运线清晰可见，走势平稳上升。中段出现分支，预示事业发展中会有方向调整，但总体向好。\n\n起始于掌心中部，显示事业起步较晚但后劲十足，属大器晚成型。",
            ],
        },
        {
            "title": "六、辅助线与特殊纹路",
            "icon": "✨",
            "subtitle": "婚姻线 + 吉凶纹路",
            "contents": [
                "婚姻线清晰且只有一条主线，深长有力，预示婚姻美满、感情专一。太阳线明显，暗示在艺术、创作或公众领域有出色表现。\n\n掌心可见神秘十字纹，主直觉敏锐、灵性强。金星丘上可见方纹，为保护纹，化解灾厄之相。",
            ],
        },
        {
            "title": "七、八丘论断",
            "icon": "🌍",
            "subtitle": "木星/土星/太阳/水星/金星/月丘",
            "contents": [
                "木星丘饱满隆起，显示领导力强，有野心和抱负。太阳丘丰隆有光泽，预示艺术天赋出众，人缘好。水星丘丰满，口才出众、商业头脑敏锐。金星丘饱满红润，代表精力旺盛、重感情。月丘适度丰隆，想象力丰富、直觉敏锐。\n\n各丘位发育较为均衡，无明显凹陷，显示性格平衡，各方面能力均衡发展。",
            ],
        },
        {
            "title": "八、五行综合论断",
            "icon": "☯️",
            "subtitle": "金木水火土综合分析",
            "contents": [
                "综合掌型、掌色、纹路走势分析，五行属性较为均衡，略偏木火。木主仁，火主礼，为人仁慈有礼、热情大方。五行相生相克之中，木生火旺，事业运和人际运极佳。\n\n建议在日常生活中适当补充金水元素，以达到五行平衡，可佩戴金属饰品或多接触水元素。",
            ],
        },
        {
            "title": "九、流年运势概览",
            "icon": "📅",
            "subtitle": "青年/壮年/中年/晚年四阶段",
            "contents": [
                "【青年期（18-30岁）】学业顺遂，事业起步顺利，贵人运佳。\n【壮年期（30-45岁）】事业进入快速上升期，财运亨通，35岁前后有重要机遇。\n【中年期（45-60岁）】事业稳定，收获丰厚，注意劳逸结合。\n【晚年期（60岁以后）】福寿双全，晚年安逸，子女孝顺。",
            ],
        },
        {
            "title": "十、综合评语与建议",
            "icon": "📜",
            "subtitle": "全面总结与人生指引",
            "contents": [
                "综合你的掌纹特征分析，你是一个天赋出众、运势良好的人。掌纹线条清晰有力，各主线发育良好，显示出健康的体魄、敏捷的思维和丰富的情感。\n\n建议：珍惜自身的天赋和好运，保持谦逊和感恩的心态。在事业上勇于开拓，在感情上真诚以待，在健康上注意保养。命运掌握在自己手中，愿你活出最精彩的人生。\n\n以上解读基于中国传统手相文化，仅供文化参考与娱乐，不构成任何医学、心理学或财务方面的专业建议。手相学属于民俗文化范畴，命运掌握在自己手中。",
            ],
        },
    ]

    sections = []
    for i, s in enumerate(sections_data):
        content = random.choice(s["contents"])
        sections.append({
            "id": f"section-{i}",
            "title": s["title"],
            "subtitle": s["subtitle"],
            "icon": s["icon"],
            "content": content,
        })

    return {"sections": sections}


def _parse_reading_to_report(reading_text: str) -> dict | None:
    """
    将混元模型返回的手相解读文本解析为结构化报告。
    按照 '## 一、' '## 二、' 等标题分割成 sections。
    """
    sections = []
    icon_map = {
        "掌型总论": "🖐️",
        "生命线": "💚",
        "智慧线": "💜",
        "感情线": "❤️",
        "命运线": "⭐",
        "辅助线": "✨",
        "八丘论断": "🌍",
        "五行综合": "☯️",
        "流年运势": "📅",
        "综合评语": "📜",
    }

    # 按 ## 标题分割
    import re
    parts = re.split(r'\n##\s+', reading_text)

    for i, part in enumerate(parts):
        if not part.strip():
            continue

        lines = part.strip().split('\n')
        title_line = lines[0].strip().lstrip('#').strip()
        content_lines = lines[1:]
        content = '\n'.join(content_lines).strip()

        if not title_line or not content:
            if i == 0 and content:
                # 第一段可能没有标题
                title_line = "掌型总论"

        # 匹配图标
        icon = "📖"
        for key, val in icon_map.items():
            if key in title_line:
                icon = val
                break

        # 提取副标题
        subtitle = ""
        if "健康" in title_line or "体质" in title_line:
            subtitle = "健康体质 + 生命阶段运势"
        elif "思维" in title_line or "才智" in title_line:
            subtitle = "思维才智 + 事业适配"
        elif "情感" in title_line or "婚恋" in title_line:
            subtitle = "情感模式 + 婚恋运势"

        section_id = f"section-{i}"
        sections.append({
            "id": section_id,
            "title": title_line,
            "subtitle": subtitle,
            "icon": icon,
            "content": content,
        })

    return {"sections": sections} if sections else None


# ===== 本地降级：八字简评 =====
def _generate_fallback_bazi_comment(req: BaziCommentRequest) -> str:
    """AI不可用时，使用本地正态分布策略生成八字简评HTML。"""
    wuxing = req.day_master_wuxing
    wuxing_traits = {
        "木": ("仁慈宽厚", "文教、艺术、园林", "东方", "杭州、南京、成都"),
        "火": ("热情奔放", "科技、传媒、餐饮", "南方", "深圳、广州、长沙"),
        "土": ("厚重诚信", "房产、农业、金融", "中部", "武汉、郑州、西安"),
        "金": ("刚毅果断", "法律、军警、制造", "西方", "重庆、兰州、昆明"),
        "水": ("智慧灵动", "贸易、物流、IT", "北方", "北京、天津、大连"),
    }
    trait, career, direction, cities = wuxing_traits.get(wuxing, ("稳重踏实", "综合管理", "中部", "北京、上海、广州"))

    health_focus = {"木": "肝胆", "火": "心脏", "土": "脾胃", "金": "肺部", "水": "肾脏"}.get(wuxing, "脾胃")
    xi_yong = {"木": "水木", "火": "木火", "土": "火土", "金": "土金", "水": "金水"}.get(wuxing, "土金")
    ji_shen = {"木": "金", "火": "水", "土": "木", "金": "火", "水": "土"}.get(wuxing, "火")

    sections = [
        ("💕 爱情运势", f"日主{req.day_master}属{wuxing}，{trait}之人感情真挚深沉。今年桃花运势不错，单身者有望遇到志同道合之人，已有伴侣者感情稳定升温，宜多花时间陪伴家人。"),
        ("💼 事业运势", f"日主{wuxing}行之人做事有条理、执行力强。今年事业运势稳中有升，贵人运佳，适合在现有岗位上深耕发展，下半年可能迎来晋升或加薪的机会。"),
        ("💍 婚姻运势", f"{wuxing}行日主{trait}，对待婚姻认真负责。今年婚姻宫较为平稳，夫妻之间宜多沟通理解，遇到分歧时以柔克刚，家庭和睦幸福。"),
        ("🏥 身体健康", f"日主属{wuxing}，宜注意{health_focus}方面的调养。保持规律作息和适度运动，饮食宜清淡均衡。"),
        ("✨ 喜用神", f"根据八字「{req.bazi_str}」分析，日主{req.day_master}属{wuxing}，喜用神为{xi_yong}，可在日常生活中多接触相关五行元素以增强运势。"),
        ("⚠️ 忌神", f"忌神为{ji_shen}行过旺，宜适当化解，避免在忌神方位长期停留，可佩戴喜用神五行饰品调和。"),
        ("🎯 适合职业", f"根据日主五行属性，适合从事{career}等领域的工作，能充分发挥{trait}的性格优势。"),
        ("🧭 发展方位", f"喜用神方位为{direction}，在此方位发展事业或定居有助于提升整体运势。"),
        ("🏙️ 推荐城市", f"综合五行喜忌和方位分析，推荐{cities}等城市，这些城市的五行气场与你的命格较为契合。"),
    ]

    html_parts = []
    for title, text in sections:
        html_parts.append(
            f'<div class="bazi-comment-section">'
            f'<div class="bazi-comment-title">{title}</div>'
            f'<div class="bazi-comment-text">{text}</div>'
            f'</div>'
        )
    return ''.join(html_parts)


# ===== 本地降级：星座分析 =====
def _generate_fallback_constellation(req: ConstellationAnalysisRequest) -> dict:
    """AI不可用时，使用本地正态分布策略生成星座运势分析。"""
    name = req.constellation_name
    idx = req.constellation_index

    guardians = ["火星", "金星", "水星", "月亮", "太阳", "水星", "金星", "冥王星", "木星", "土星", "天王星", "海王星"]
    elements = ["火象", "土象", "风象", "水象", "火象", "土象", "风象", "水象", "火象", "土象", "风象", "水象"]
    lucky_colors = ["正红色", "翡翠绿", "柠檬黄", "月光银", "金色", "薄荷绿", "粉红色", "深紫色", "橙色", "深蓝色", "天蓝色", "薰衣草紫"]
    match_constellations = ["狮子座", "巨蟹座", "水瓶座", "天蝎座", "射手座", "金牛座", "双子座", "双鱼座", "白羊座", "处女座", "天秤座", "摩羯座"]

    guardian = guardians[idx % 12]
    element = elements[idx % 12]

    overview_texts = [
        f"今日{guardian}能量活跃，{name}的行动力和决断力显著提升。星象显示木星与{guardian}形成和谐相位，为你带来积极的能量场，适合推进重要事务。",
        f"{guardian}与金星形成三分相，{name}今日魅力指数飙升。宇宙能量支持你在社交和创意方面大展身手，把握机会展现自我。",
        f"今日{guardian}运行平稳，{name}整体运势向好。太阳与{guardian}的互动为你注入温暖能量，适合与人合作、拓展人脉。",
    ]
    love_texts = [
        f"单身的{name}今日桃花运旺盛，可能在社交场合遇到心动之人；有伴侣者感情甜蜜升温，适合安排一次浪漫约会。",
        f"{guardian}与金星的和谐相位为{name}带来甜蜜的感情能量。单身者魅力四射，有伴侣者宜多表达爱意。",
    ]
    career_texts = [
        f"{name}今日职场运势极佳，{guardian}赋予你强大的执行力。适合推进重要项目、与上级沟通想法，可能获得意想不到的支持。",
        f"事业方面{guardian}能量助力，{name}今日思路清晰、效率极高。团队协作顺畅，适合处理复杂事务。",
    ]
    wealth_texts = [
        f"财运方面{guardian}带来正财运，{name}今日适合稳健理财。可能有额外收入或投资回报，但不宜冒险投机。",
        f"{name}今日偏财运不错，可能收到意外之财或好消息。正财运稳定，适合制定长期理财计划。",
    ]
    health_texts = [
        f"{name}今日精力充沛，{element}能量平衡。适合进行户外运动或瑜伽，注意补充水分，保持良好的作息习惯。",
        f"身体状态良好，{guardian}能量为你注入活力。建议适度运动，注意颈椎和眼睛的保护。",
    ]

    return {
        "overview": random.choice(overview_texts),
        "love": random.choice(love_texts),
        "career": random.choice(career_texts),
        "wealth": random.choice(wealth_texts),
        "health": random.choice(health_texts),
        "love_score": _normal_score(),
        "career_score": _normal_score(),
        "wealth_score": _normal_score(),
        "health_score": _normal_score(),
        "overall_score": _normal_score(),
        "lucky_color": lucky_colors[idx % 12],
        "lucky_number": random.randint(1, 99),
        "lucky_constellation": match_constellations[idx % 12],
        "guardian_reading": f"守护星{guardian}今日运行于有利位置，与木星形成吉相，为{name}带来积极的宇宙能量。{guardian}的力量增强了你的核心特质，适合在今日发挥{element}星座的天然优势。",
        "special_reminder": f"今日{guardian}能量高峰在午后，建议把重要事务安排在下午处理，效率更高。晚间适合放松身心。",
    }


# ===== 本地降级：今日宜忌 =====
def _generate_fallback_yiji(req: YiJiAnalysisRequest) -> dict:
    """AI不可用时，使用本地策略生成今日宜忌分析。"""
    import datetime

    # 基于日期的宜忌数据池
    yi_pool = ["祈福", "出行", "约会", "签约", "开业", "搬家", "求职", "学习", "运动", "聚会",
                "购物", "表白", "面试", "旅行", "创作", "社交", "读书", "冥想", "种植", "装修"]
    ji_pool = ["争吵", "熬夜", "赌博", "冒险", "借贷", "暴饮暴食", "冲动消费", "过度劳累",
               "与人争执", "做重大决定", "独处太久", "忽视健康", "远行", "动土", "诉讼"]

    # 建除十二神
    jianchu_list = ["建", "除", "满", "平", "定", "执", "破", "危", "成", "收", "开", "闭"]
    jianchu_meanings = {
        "建": "建日为月建之始，万物初生，宜出行、上任、开业，忌诉讼、安葬。",
        "除": "除日为除旧布新之日，宜扫除、治病、祈福，忌嫁娶、远行。",
        "满": "满日为丰满圆满之日，宜祈福、嫁娶、开业，忌动土、造葬。",
        "平": "平日为平常之日，万事平稳，宜修造、动土，忌祈福、嫁娶。",
        "定": "定日为安定之日，宜嫁娶、开业、造屋，忌诉讼、出行。",
        "执": "执日为执持之日，宜祭祀、捕捉、修造，忌搬家、远行。",
        "破": "破日为冲破之日，宜破土、拆卸、求医，忌嫁娶、开业。",
        "危": "危日为危险之日，宜祭祀、祈福，忌登高、远行、动土。",
        "成": "成日为万事成就之日，宜嫁娶、开业、搬家、签约，百事皆宜。",
        "收": "收日为收获之日，宜收账、纳财、嫁娶，忌开业、动土。",
        "开": "开日为开放通达之日，宜开业、出行、嫁娶，忌安葬、动土。",
        "闭": "闭日为关闭之日，宜安葬、收藏，忌开业、出行、嫁娶。",
    }

    # 二十八宿
    star28_list = ["角木蛟", "亢金龙", "氐土貉", "房日兔", "心月狐", "尾火虎", "箕水豹",
                   "斗木獬", "牛金牛", "女土蝠", "虚日鼠", "危月燕", "室火猪", "壁水貐",
                   "奎木狼", "娄金狗", "胃土雉", "昴日鸡", "毕月乌", "觜火猴", "参水猿",
                   "井木犴", "鬼金羊", "柳土獐", "星日马", "张月鹿", "翼火蛇", "轸水蚓"]

    # 六十四卦
    hexagrams = ["乾为天", "坤为地", "水雷屯", "山水蒙", "水天需", "天水讼", "地水师",
                 "水地比", "风天小畜", "天泽履", "地天泰", "天地否", "天火同人", "火天大有",
                 "地山谦", "雷地豫", "泽雷随", "山风蛊", "地泽临", "风地观"]

    directions = ["正东", "东南", "正南", "西南", "正西", "西北", "正北", "东北"]
    wuxing_list = ["金", "木", "水", "火", "土"]

    today = datetime.date.today()
    day_offset = today.toordinal()

    # 基于日期选取
    jianchu = jianchu_list[day_offset % 12]
    star28 = star28_list[day_offset % 28]
    hexagram = hexagrams[day_offset % len(hexagrams)]
    wuxing_day = wuxing_list[day_offset % 5]

    # 随机选取宜忌
    random.shuffle(yi_pool)
    random.shuffle(ji_pool)
    yi_items = yi_pool[:6]
    ji_items = ji_pool[:5]

    chong_animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"]
    chong_dirs = ["南", "西", "北", "东", "南", "西", "北", "东", "南", "西", "北", "东"]
    chong_idx = day_offset % 12

    return {
        "yi_items": yi_items,
        "ji_items": ji_items,
        "yi_details": f"今日为{jianchu}日，{star28}值日，五行属{wuxing_day}。{jianchu_meanings.get(jianchu, '')} 整体气场平和，适合{yi_items[0]}、{yi_items[1]}等活动。",
        "ji_details": f"今日冲{chong_animals[chong_idx]}煞{chong_dirs[chong_idx]}，不宜{ji_items[0]}、{ji_items[1]}。凡事三思而后行，避免冲动决策。",
        "day_summary": f"今日{req.ganzhi_day}日，建除十二神为「{jianchu}」，二十八宿值日为「{star28}」，五行属{wuxing_day}。整体运势平稳向好，宜顺势而为，不宜逆势强求。",
        "jianchu": jianchu,
        "jianchu_meaning": jianchu_meanings.get(jianchu, ""),
        "star28": star28,
        "star28_meaning": f"今日{star28}值日，{'吉星高照，诸事顺遂' if day_offset % 3 != 2 else '宜谨慎行事，避免冒险'}。",
        "wuxing_day": wuxing_day,
        "chong_sha": f"冲{chong_animals[chong_idx]}煞{chong_dirs[chong_idx]}",
        "lucky_god_direction": directions[day_offset % 8],
        "xi_god_direction": directions[(day_offset + 2) % 8],
        "fu_god_direction": directions[(day_offset + 5) % 8],
        "auspicious_hours": [
            f"{'子丑寅卯辰巳午未申酉戌亥'[day_offset % 12]}时",
            f"{'子丑寅卯辰巳午未申酉戌亥'[(day_offset + 4) % 12]}时",
            f"{'子丑寅卯辰巳午未申酉戌亥'[(day_offset + 8) % 12]}时",
        ],
        "inauspicious_hours": [
            f"{'子丑寅卯辰巳午未申酉戌亥'[(day_offset + 2) % 12]}时",
            f"{'子丑寅卯辰巳午未申酉戌亥'[(day_offset + 6) % 12]}时",
        ],
        "daily_hexagram": hexagram,
        "hexagram_meaning": f"今日得「{hexagram}」卦，卦象显示当前形势利于稳健发展。顺应自然规律，把握时机，可获吉祥。凡事以和为贵，不宜急躁冒进。",
        "special_note": _build_yiji_special_note(wuxing_day, req.zodiac_name),
    }


def _build_yiji_special_note(wuxing_day: str, zodiac_name: str) -> str:
    health_map = {"金": "肺部呼吸", "木": "肝胆疏泄", "水": "肾脏泌尿", "火": "心脏血压", "土": "脾胃消化"}
    focus = health_map.get(wuxing_day, "身体健康")
    zodiac_part = f"属{zodiac_name}之人" if zodiac_name else ""
    return f"今日{wuxing_day}行当令，{zodiac_part}宜多关注{focus}方面的调养。"


# ===== 前端静态文件路由（替代 app.mount，避免 BaseHTTPMiddleware 与 mount 的兼容性问题） =====
from starlette.responses import FileResponse as StarletteFileResponse


@app.get("/static/{file_path:path}")
async def serve_static(file_path: str):
    """手动提供静态文件服务，解决 BaseHTTPMiddleware 导致 mount 子应用 404 的问题"""
    if not file_path:
        file_path = "index.html"
    full_path = STATIC_DIR / file_path
    # 安全检查：防止路径穿越
    try:
        full_path.resolve().relative_to(STATIC_DIR.resolve())
    except ValueError:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    if full_path.is_file():
        return StarletteFileResponse(str(full_path))
    return JSONResponse(status_code=404, content={"detail": "Not Found"})