"""
单元测试：验证 palm_recognize_client.py 在【新协议（Bearer Token）】下的契约。

新协议要点（验证目标）：
  POST {BASE}{PALM_REGISTER_PATH}
  POST {BASE}{PALM_SEARCH_PATH}
  Headers:
    Host:           你的刷掌算法服务域名
    Content-Type:   application/json
    Authorization:  Bearer <你的刷掌算法Token>
    X-TraceId:      <32位小写hex>
  Register Body:
    { "RgbImage": {"Data": "<b64>", "ImageType": 1},
      "UserId": "...", "IsForce": true }
  Search Body:
    { "RgbImage": {"Data": "<b64>", "ImageType": 1} }
  统一响应:
    {"code": 0, "message": "...", "data": {...}}

测试通过 monkey-patch httpx.AsyncClient，捕获实际发出的 URL/headers/body 做断言；
不会触达真实网络。
"""
from __future__ import annotations

import asyncio
import base64
import importlib
import json
import os
import re
import sys
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

# 让 sys.path 找到 backend 包
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# =============================================================================
# 工具：构造一个能记录请求并返回指定响应的 fake AsyncClient
# =============================================================================
class _FakeResponse:
    def __init__(self, status_code: int, body: Any):
        self.status_code = status_code
        if isinstance(body, (dict, list)):
            self._body_text = json.dumps(body, ensure_ascii=False)
            self._json_obj = body
        else:
            self._body_text = str(body)
            self._json_obj = None

    @property
    def text(self) -> str:
        return self._body_text

    def json(self):
        if self._json_obj is None:
            raise ValueError("not json")
        return self._json_obj


class _RequestSpy:
    """记录每次 post 调用的 url / headers / 解析后的 json body。"""
    def __init__(self):
        self.calls: list[dict] = []
        # 每次 post 返回的响应（FIFO 队列），不足时返回最后一个
        self.responses: list[_FakeResponse] = []

    def queue(self, status: int, body: Any):
        self.responses.append(_FakeResponse(status, body))

    def _next_response(self) -> _FakeResponse:
        if not self.responses:
            return _FakeResponse(200, {"code": 0, "message": "ok", "data": {}})
        if len(self.responses) == 1:
            return self.responses[0]
        return self.responses.pop(0)


def _make_fake_client_class(spy: _RequestSpy):
    """生成一个仿 httpx.AsyncClient 的类，向 spy 写入调用记录。"""

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            self._kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, *, headers=None, json=None, content=None, **kwargs):
            body_obj: Any
            if json is not None:
                body_obj = json
            elif content is not None:
                try:
                    body_obj = (
                        content.decode("utf-8")
                        if isinstance(content, (bytes, bytearray))
                        else str(content)
                    )
                    body_obj = __import__("json").loads(body_obj)
                except Exception:
                    body_obj = None
            else:
                body_obj = None

            spy.calls.append(
                {
                    "url": url,
                    "headers": dict(headers or {}),
                    "json_body": body_obj,
                }
            )
            return spy._next_response()

    return _FakeAsyncClient


# =============================================================================
# Test Suite
# =============================================================================
class PalmRecognizeClientNewProtocolTests(unittest.IsolatedAsyncioTestCase):
    """验证新协议（Bearer Token）下客户端契约。"""

    @classmethod
    def setUpClass(cls):
        # 在 import 客户端模块之前，先把环境变量注好（模块级常量在 import 时读取）
        os.environ["PALM_API_BASE_URL"] = "https://test.example.com"
        os.environ["PALM_API_BEARER_TOKEN"] = os.getenv("PALM_API_BEARER_TOKEN", "ak_test_fake_token_for_unit_test")
        os.environ.pop("PALM_REGISTER_PATH", None)
        os.environ.pop("PALM_SEARCH_PATH", None)
        os.environ["PALM_API_TIMEOUT"] = "5"

        # 强制重新加载，确保拿到的是基于上面 env 的最新模块
        if "app.services.palm_recognize_client" in sys.modules:
            del sys.modules["app.services.palm_recognize_client"]
        cls.client_mod = importlib.import_module(
            "app.services.palm_recognize_client"
        )

    def setUp(self):
        self.spy = _RequestSpy()
        self.fake_cls = _make_fake_client_class(self.spy)
        self._patcher = mock.patch.object(
            self.client_mod.httpx, "AsyncClient", self.fake_cls
        )
        self._patcher.start()

    def tearDown(self):
        self._patcher.stop()

    # ---- 内部小工具 ----
    @staticmethod
    def _fake_jpg_bytes() -> bytes:
        # 用一段稳定的字节流即可（不需要真 JPEG，客户端不会解析图片）
        return b"\xff\xd8\xff\xe0FAKE_JPEG_BODY_FOR_UNIT_TEST" * 4

    # =========================================================================
    # Test 1: 注册接口 - URL 路径 / 鉴权头 / X-TraceId / Body 结构 全部验证
    # =========================================================================
    async def test_01_register_palm_request_contract(self):
        self.spy.queue(
            200,
            {
                "code": 0,
                "message": "register success",
                "data": {"PalmId": "p_abc", "RequestId": "req_xyz"},
            },
        )

        result = await self.client_mod.register_palm(
            user_id="u_123",
            image_bytes=self._fake_jpg_bytes(),
            is_force=True,
        )

        # 1) 调用确实发起
        self.assertEqual(len(self.spy.calls), 1, f"应该只发起1次请求，实际: {self.spy.calls}")
        call = self.spy.calls[0]

        # 2) URL 路径正确
        self.assertEqual(
            call["url"],
            "https://test.example.com/your-palm-register-api-path",
        )

        # 3) 鉴权 Header
        headers = call["headers"]
        self.assertEqual(headers.get("Content-Type"), "application/json")
        self.assertEqual(
            headers.get("Authorization"),
            f"Bearer {os.getenv('PALM_API_BEARER_TOKEN', 'ak_test_fake_token_for_unit_test')}",
        )
        self.assertEqual(headers.get("Host"), "test.example.com")

        # 4) X-TraceId 必须存在且为 32 位小写 hex
        trace_id = headers.get("X-TraceId", "")
        self.assertTrue(
            re.fullmatch(r"[0-9a-f]{32}", trace_id),
            f"X-TraceId 必须是 32 位小写 hex，实际: {trace_id!r}",
        )

        # 5) Body 结构完全符合协议
        body = call["json_body"]
        self.assertIsInstance(body, dict)
        self.assertEqual(body.get("UserId"), "u_123")
        self.assertEqual(body.get("IsForce"), True)
        self.assertIn("RgbImage", body)
        rgb = body["RgbImage"]
        self.assertEqual(rgb.get("ImageType"), 1)
        # Data 必须是合法 base64，且解码后等于原始字节
        decoded = base64.b64decode(rgb.get("Data", ""))
        self.assertEqual(decoded, self._fake_jpg_bytes())

        # 6) 返回结构归一化正确
        self.assertEqual(result["code"], 0)
        self.assertTrue(result["success"])
        self.assertEqual(result["user_id"], "u_123")
        self.assertEqual(result["palm_id"], "p_abc")
        self.assertEqual(result["request_id"], "req_xyz")
        self.assertEqual(result["trace_id"], trace_id)

    # =========================================================================
    # Test 2: 1:N 检索接口 - URL 路径 / Body / 命中 score 归一化为 confidence
    # =========================================================================
    async def test_02_search_palm_1n_request_contract(self):
        self.spy.queue(
            200,
            {
                "code": 0,
                "message": "ok",
                "data": {
                    "UserId": "u_123",
                    "Score": 87.4,
                    "AlgorithmVersion": "v2",
                    "RequestId": "req_search_1",
                },
            },
        )

        result = await self.client_mod.search_palm_1n(
            image_bytes=self._fake_jpg_bytes()
        )

        self.assertEqual(len(self.spy.calls), 1)
        call = self.spy.calls[0]

        # URL：1:N 检索路径
        self.assertEqual(
            call["url"],
            "https://test.example.com/your-palm-search-api-path",
        )

        # 鉴权
        headers = call["headers"]
        self.assertTrue(headers["Authorization"].startswith("Bearer "))
        self.assertRegex(headers["X-TraceId"], r"^[0-9a-f]{32}$")

        # Body：只有 RgbImage
        body = call["json_body"]
        self.assertIn("RgbImage", body)
        self.assertEqual(body["RgbImage"]["ImageType"], 1)
        # 检索请求体不应携带 UserId
        self.assertNotIn("UserId", body)

        # 返回归一化
        self.assertEqual(result["code"], 0)
        self.assertTrue(result["identified"])
        self.assertEqual(result["user_id"], "u_123")
        self.assertEqual(result["score"], 87.4)
        # confidence = score / 100
        self.assertAlmostEqual(result["confidence"], 0.874, places=4)
        self.assertEqual(result["algorithm_version"], "v2")
        self.assertEqual(result["request_id"], "req_search_1")

    # =========================================================================
    # Test 3: 每次请求 X-TraceId 必须重新生成（不能复用）
    # =========================================================================
    async def test_03_trace_id_unique_per_request(self):
        self.spy.queue(200, {"code": 0, "message": "ok", "data": {}})

        # 连发 5 次注册请求
        await asyncio.gather(
            *[
                self.client_mod.register_palm(
                    user_id=f"u_{i}", image_bytes=self._fake_jpg_bytes()
                )
                for i in range(5)
            ]
        )
        self.assertEqual(len(self.spy.calls), 5)

        trace_ids = [c["headers"]["X-TraceId"] for c in self.spy.calls]
        self.assertEqual(
            len(set(trace_ids)), 5, f"5 次请求的 X-TraceId 必须互不相同，实际: {trace_ids}"
        )
        for tid in trace_ids:
            self.assertRegex(tid, r"^[0-9a-f]{32}$")

    # =========================================================================
    # Test 4: 业务错误（code != 0）应映射为 success=False / identified=False
    # =========================================================================
    async def test_04_business_error_mapping(self):
        # 注册：业务报错
        self.spy.queue(
            200,
            {"code": 40001, "message": "UserId already bound", "data": {}},
        )
        reg = await self.client_mod.register_palm(
            user_id="u_exists", image_bytes=self._fake_jpg_bytes()
        )
        self.assertEqual(reg["code"], 40001)
        self.assertFalse(reg["success"])
        self.assertIn("UserId already bound", reg["message"])

        # 检索：业务报错
        self.spy.queue(
            200,
            {"code": 50002, "message": "image quality too low", "data": {}},
        )
        sr = await self.client_mod.search_palm_1n(
            image_bytes=self._fake_jpg_bytes()
        )
        self.assertEqual(sr["code"], 50002)
        self.assertFalse(sr["identified"])
        self.assertIn("image quality too low", sr["message"])

    # =========================================================================
    # Test 5: HTTP 401/403 应给出"鉴权失败"友好提示
    # =========================================================================
    async def test_05_auth_failure_http_401(self):
        self.spy.queue(401, {"code": 401, "message": "unauthorized", "data": {}})
        reg = await self.client_mod.register_palm(
            user_id="u_x", image_bytes=self._fake_jpg_bytes()
        )
        self.assertEqual(reg["code"], 401)
        self.assertFalse(reg["success"])
        self.assertIn("鉴权失败", reg["message"])

        self.spy.queue(403, {"code": 403, "message": "forbidden", "data": {}})
        sr = await self.client_mod.search_palm_1n(
            image_bytes=self._fake_jpg_bytes()
        )
        self.assertEqual(sr["code"], 403)
        self.assertFalse(sr["identified"])
        self.assertIn("鉴权失败", sr["message"])

    # =========================================================================
    # Test 6: 输入校验 - 空 user_id / 空 image_bytes
    # =========================================================================
    async def test_06_input_validation(self):
        r = await self.client_mod.register_palm(
            user_id="   ", image_bytes=self._fake_jpg_bytes()
        )
        self.assertFalse(r["success"])
        self.assertIn("用户ID不能为空", r["message"])

        r = await self.client_mod.register_palm(
            user_id="u_1", image_bytes=b""
        )
        self.assertFalse(r["success"])
        self.assertIn("图片内容为空", r["message"])

        s = await self.client_mod.search_palm_1n(image_bytes=b"")
        self.assertFalse(s["identified"])
        self.assertIn("图片内容为空", s["message"])

    # =========================================================================
    # Test 7: Bearer Token 缺失时直接拒绝，不会发起任何 HTTP 请求
    # =========================================================================
    async def test_07_missing_bearer_token_short_circuits(self):
        original = self.client_mod.PALM_API_BEARER_TOKEN
        try:
            self.client_mod.PALM_API_BEARER_TOKEN = ""
            r = await self.client_mod.register_palm(
                user_id="u_x", image_bytes=self._fake_jpg_bytes()
            )
            self.assertFalse(r["success"])
            self.assertIn("PALM_API_BEARER_TOKEN", r["message"])

            s = await self.client_mod.search_palm_1n(
                image_bytes=self._fake_jpg_bytes()
            )
            self.assertFalse(s["identified"])
            self.assertIn("PALM_API_BEARER_TOKEN", s["message"])

            # 关键：完全没发起 HTTP 调用
            self.assertEqual(len(self.spy.calls), 0)
        finally:
            self.client_mod.PALM_API_BEARER_TOKEN = original

    # =========================================================================
    # Test 8: Bearer 前缀容忍（用户在 .env 里写 "Bearer ak_xxx" 也能正确处理）
    # =========================================================================
    async def test_08_bearer_prefix_tolerance(self):
        original = self.client_mod.PALM_API_BEARER_TOKEN
        try:
            self.client_mod.PALM_API_BEARER_TOKEN = "Bearer ak_already_prefixed"
            self.spy.queue(200, {"code": 0, "message": "ok", "data": {}})
            await self.client_mod.register_palm(
                user_id="u_p", image_bytes=self._fake_jpg_bytes()
            )
            auth = self.spy.calls[-1]["headers"]["Authorization"]
            # 不应出现两次 "Bearer "
            self.assertEqual(auth, "Bearer ak_already_prefixed")
        finally:
            self.client_mod.PALM_API_BEARER_TOKEN = original

    # =========================================================================
    # Test 9: 1:N 检索 - 库内未命中（data 为空 / 无 UserId）
    # =========================================================================
    async def test_09_search_no_match(self):
        self.spy.queue(200, {"code": 0, "message": "no match", "data": {}})
        r = await self.client_mod.search_palm_1n(
            image_bytes=self._fake_jpg_bytes()
        )
        self.assertEqual(r["code"], 0)
        self.assertFalse(r["identified"])
        self.assertIsNone(r["user_id"])
        self.assertIn("暂未找到", r["message"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
