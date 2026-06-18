"""
刷掌识别服务 1:N 接口客户端
============================

协议（Bearer Token）：

    POST {PALM_API_BASE_URL}{PALM_REGISTER_PATH}
    POST {PALM_API_BASE_URL}{PALM_SEARCH_PATH}
    Host:           你的刷掌算法服务域名
    Content-Type:   application/json
    Authorization:  Bearer <你的刷掌算法Token>
    X-TraceId:      <32位小写hex，每次请求新生成>

注册请求体:
    {
      "RgbImage": { "Data": "<base64>", "ImageType": 1 },
      "UserId":   "u_123",
      "IsForce":  true
    }

1:N 检索请求体（按命名约定，路径与 register 对称为 search_rgb_palm）:
    {
      "RgbImage": { "Data": "<base64>", "ImageType": 1 }
    }

统一响应:
    {"code": 0, "message": "xxx", "data": { ... }}

对外稳定的 2 个函数（签名/返回结构与上一版完全兼容，main.py 无需改动）：
    - search_palm_1n(image_bytes, filename, content_type) -> dict
    - register_palm(user_id, image_bytes, ...) -> dict
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
from typing import Any
from urllib.parse import urlparse

import httpx
from loguru import logger


# ====================== 配置（模块级常量，import 时一次性读取） ======================
PALM_API_BASE_URL = os.getenv(
    "PALM_API_BASE_URL", "https://your-palm-api-host.example.com"
).rstrip("/")
# 新协议唯一鉴权凭据：access key（Bearer Token）。可以是 "ak_xxx" 或 "Bearer ak_xxx"，
# 模块内会自动归一化到 "Bearer ak_xxx" 一种形式。
PALM_API_BEARER_TOKEN = os.getenv("PALM_API_BEARER_TOKEN", "").strip()

# 接口路径可配置（社区/正式路径若再变，仅改 .env 即可，无需改代码）
PALM_REGISTER_PATH = os.getenv(
    "PALM_REGISTER_PATH", "/your-palm-register-api-path"
)
PALM_SEARCH_PATH = os.getenv(
    "PALM_SEARCH_PATH", "/your-palm-search-api-path"
)

PALM_API_TIMEOUT = float(os.getenv("PALM_API_TIMEOUT", "15"))


def _api_host() -> str:
    """从 PALM_API_BASE_URL 中提取 Host。"""
    try:
        h = urlparse(PALM_API_BASE_URL).netloc
        return h or "your-palm-api-host.example.com"
    except Exception:
        return "your-palm-api-host.example.com"


def _gen_trace_id() -> str:
    """32 位小写 hex，符合协议要求。"""
    return secrets.token_hex(16)


def _normalize_bearer(token: str) -> str:
    """容忍用户在 .env 中带或不带 'Bearer ' 前缀。"""
    if not token:
        return ""
    t = token.strip()
    if t.lower().startswith("bearer "):
        return "Bearer " + t[7:].strip()
    return "Bearer " + t


def _build_headers() -> dict:
    """统一构造请求头：Authorization + X-TraceId + Content-Type。"""
    return {
        "Host": _api_host(),
        "Content-Type": "application/json",
        "Authorization": _normalize_bearer(PALM_API_BEARER_TOKEN),
        "X-TraceId": _gen_trace_id(),
    }


# =============================================================================
# 通用 HTTP POST
# =============================================================================
async def _post_json(path: str, payload: dict) -> tuple[int, Any, str, str]:
    """
    新协议下的通用 JSON POST。

    返回 (status_code, parsed_json_or_text, raw_text, trace_id)。
    """
    url = f"{PALM_API_BASE_URL}{path}"
    headers = _build_headers()
    trace_id = headers.get("X-TraceId", "")

    # 入口日志：不打印图片 base64，只打印关键字段
    safe_keys = list(payload.keys()) if isinstance(payload, dict) else []
    user_id_for_log = payload.get("UserId", "") if isinstance(payload, dict) else ""
    logger.info(
        f"[palm-api] >>> POST {path} traceId={trace_id} "
        f"payload_keys={safe_keys} user_id={user_id_for_log}"
    )

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(PALM_API_TIMEOUT, connect=5.0)
    ) as client:
        resp = await client.post(url, headers=headers, json=payload)
        body_text = ""
        try:
            body_text = resp.text or ""
        except Exception:
            body_text = ""

        logger.info(
            f"[palm-api] <<< POST {path} traceId={trace_id} "
            f"status={resp.status_code} body={body_text[:500]}"
        )

        try:
            parsed = resp.json()
        except Exception:
            parsed = body_text
        return resp.status_code, parsed, body_text, trace_id


# =============================================================================
# 响应解析（统一 code/message/data 格式）
# =============================================================================
def _parse_envelope(raw: Any) -> tuple[int | None, str, dict]:
    """
    解析 {"code": 0, "message": "...", "data": {...}} 三段式响应。

    Returns:
        (code, message, data)；code 为 None 表示返回不是合法 JSON 对象。
    """
    if not isinstance(raw, dict):
        return None, str(raw)[:200] if raw else "返回非JSON", {}

    code_raw = raw.get("code")
    if code_raw is None:
        code_raw = raw.get("Code")
    try:
        code = int(code_raw) if code_raw is not None else None
    except (TypeError, ValueError):
        # code 也可能是字符串 "0"/"Success"
        if str(code_raw).lower() in ("0", "success", "ok"):
            code = 0
        else:
            code = -1

    message = str(raw.get("message") or raw.get("Message") or raw.get("msg") or "")
    data = raw.get("data") if isinstance(raw.get("data"), dict) else (
        raw.get("Data") if isinstance(raw.get("Data"), dict) else {}
    )
    return code, message, data or {}


# ====================== SearchRgbPalm（1:N 检索） ======================
def _normalize_search_response(raw: Any) -> dict:
    """
    将平台 SearchRgbPalm 响应归一化为前端友好结构。

    平台成功响应（典型）:
        {"code": 0, "message": "ok",
         "data": {"UserId": "u_123", "Score": 87.3, "AlgorithmVersion": "...",
                  "RequestId": "..."}}
    """
    code, message, data = _parse_envelope(raw)

    if code is None:
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "掌纹识别接口返回数据格式异常",
        }

    if code != 0:
        return {
            "code": code, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": f"[{code}] {message}".strip() if message else f"[{code}]",
        }

    user_id = data.get("UserId") or data.get("userId") or data.get("user_id")
    score_raw = data.get("Score", data.get("score"))
    algorithm_version = (
        data.get("AlgorithmVersion") or data.get("algorithmVersion") or ""
    )
    request_id = data.get("RequestId") or data.get("requestId") or ""

    if not user_id:
        return {
            "code": 0, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0, "score": 0.0,
            "algorithm_version": algorithm_version or "",
            "request_id": request_id,
            "message": "掌纹库中暂未找到匹配的用户",
        }

    try:
        score_num = float(score_raw) if score_raw is not None else 0.0
    except Exception:
        score_num = 0.0
    confidence = (
        round(score_num / 100.0, 4) if score_num > 1.0 else round(score_num, 4)
    )
    identified = confidence >= 0.6

    return {
        "code": 0,
        "identified": identified,
        "user_id": str(user_id),
        "person_name": str(user_id),
        "confidence": confidence,
        "score": round(score_num, 2),
        "algorithm_version": algorithm_version or "",
        "request_id": request_id,
        "message": (
            f"掌纹识别成功（Score={round(score_num, 2)}）"
            if identified
            else f"匹配用户 {user_id} 但相似度不足（Score={round(score_num, 2)}）"
        ),
    }


async def search_palm_1n(
    image_bytes: bytes,
    filename: str = "palm.jpg",
    content_type: str = "image/jpeg",
) -> dict:
    """调用 1:N 检索接口（新协议，Bearer Token 鉴权，明文传输）。"""
    if not image_bytes:
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "图片内容为空",
        }

    if not PALM_API_BEARER_TOKEN:
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "掌纹识别服务未配置鉴权凭据（PALM_API_BEARER_TOKEN）",
        }

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "RgbImage": {
            "Data": image_b64,
            "ImageType": 1,
        },
    }

    try:
        status, raw, body_text, trace_id = await _post_json(
            PALM_SEARCH_PATH, payload
        )

        if status == 401 or status == 403:
            return {
                "code": status, "identified": False, "user_id": None,
                "person_name": None, "confidence": 0.0,
                "message": "掌纹识别服务鉴权失败，请检查 Bearer Token",
            }

        if status != 200:
            code, message, _ = _parse_envelope(raw) if isinstance(raw, dict) else (None, "", {})
            err_text = (
                f"[{code}] {message}".strip()
                if (code is not None and message)
                else (body_text[:300] if body_text else "")
            )
            return {
                "code": status, "identified": False, "user_id": None,
                "person_name": None, "confidence": 0.0,
                "message": f"掌纹识别接口HTTP错误: {status} {err_text}".strip(),
            }

        result = _normalize_search_response(raw)
        # 调试时方便排查，把 trace_id 顺手回填
        if trace_id and "trace_id" not in result:
            result["trace_id"] = trace_id
        return result

    except (httpx.TimeoutException, asyncio.TimeoutError):
        logger.warning("掌纹1:N接口调用超时")
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "掌纹识别服务超时，请稍后重试",
        }
    except httpx.HTTPError as e:
        logger.error(f"掌纹1:N接口网络异常: {e}")
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "掌纹识别服务暂不可用",
        }
    except Exception as e:
        logger.error(f"掌纹1:N接口未知异常: {e}")
        return {
            "code": -1, "identified": False, "user_id": None,
            "person_name": None, "confidence": 0.0,
            "message": "掌纹识别服务异常",
        }


# =============================================================================
# 注册流程：register_rgb_palm（一步完成 = 注册 + 绑定 UserId）
# =============================================================================
async def register_palm(
    user_id: str,
    image_bytes: bytes,
    filename: str = "palm.jpg",
    content_type: str = "image/jpeg",
    is_force: bool = True,
    algorithm_strategy: int | None = None,
) -> dict:
    """
    调用 register_rgb_palm 完成「掌纹注册 + 绑定 UserId」（新协议，Bearer Token）。

    返回结构与旧版兼容：
        {"code": 0, "success": True, "user_id": ..., "palm_id": ..., "message": "..."}
    """
    if not user_id or not str(user_id).strip():
        return {
            "code": -1, "success": False, "user_id": None,
            "message": "用户ID不能为空",
        }
    user_id = str(user_id).strip()

    if not image_bytes:
        return {
            "code": -1, "success": False, "user_id": user_id,
            "message": "图片内容为空",
        }

    if not PALM_API_BEARER_TOKEN:
        return {
            "code": -1, "success": False, "user_id": user_id,
            "message": "掌纹注册服务未配置鉴权凭据（PALM_API_BEARER_TOKEN）",
        }

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload: dict[str, Any] = {
        "UserId": user_id,
        "RgbImage": {
            "Data": image_b64,
            "ImageType": 1,
        },
        "IsForce": bool(is_force),
    }
    if algorithm_strategy in (1, 2, 3, 4):
        payload["AlgorithmStrategy"] = algorithm_strategy

    try:
        status, raw, body_text, trace_id = await _post_json(
            PALM_REGISTER_PATH, payload
        )

        if status == 401 or status == 403:
            return {
                "code": status, "success": False, "user_id": user_id,
                "trace_id": trace_id,
                "message": "掌纹注册服务鉴权失败，请检查 Bearer Token",
            }

        if status != 200:
            code, message, _ = (
                _parse_envelope(raw) if isinstance(raw, dict) else (None, "", {})
            )
            err_text = (
                f"[{code}] {message}".strip()
                if (code is not None and message)
                else (body_text[:300] if body_text else "")
            )
            return {
                "code": status, "success": False, "user_id": user_id,
                "trace_id": trace_id,
                "message": f"掌纹注册失败(HTTP {status}): {err_text}".strip(),
            }

        code, message, data = _parse_envelope(raw)
        if code is None:
            return {
                "code": -1, "success": False, "user_id": user_id,
                "trace_id": trace_id,
                "message": "掌纹注册接口返回数据格式异常",
            }

        if code != 0:
            return {
                "code": code, "success": False, "user_id": user_id,
                "trace_id": trace_id,
                "message": f"掌纹注册失败: [{code}] {message}".strip(),
            }

        palm_id = str(
            data.get("PalmId")
            or data.get("palmId")
            or data.get("palm_id")
            or ""
        )
        request_id = str(data.get("RequestId") or data.get("requestId") or "")

        return {
            "code": 0,
            "success": True,
            "user_id": user_id,
            "palm_id": palm_id,
            "request_id": request_id,
            "trace_id": trace_id,
            "message": message or "掌纹注册成功",
        }

    except (httpx.TimeoutException, asyncio.TimeoutError):
        logger.warning("掌纹注册接口调用超时")
        return {
            "code": -1, "success": False, "user_id": user_id,
            "message": "掌纹注册服务超时，请稍后重试",
        }
    except httpx.HTTPError as e:
        logger.error(f"掌纹注册接口网络异常: {e}")
        return {
            "code": -1, "success": False, "user_id": user_id,
            "message": "掌纹注册服务暂不可用",
        }
    except Exception as e:
        logger.error(f"掌纹注册接口未知异常: {e}")
        return {
            "code": -1, "success": False, "user_id": user_id,
            "message": "掌纹注册服务异常",
        }
