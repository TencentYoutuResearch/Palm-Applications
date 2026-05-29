"""
临时测试运行器：在沙盒预览中执行 PalmDestiny 后端的签名兼容性单元测试，
并通过 HTTP 页面/JSON 返回测试结果。

预览入口：
    -  /            HTML 报告页（带颜色，方便用户在浏览器里直接看）
    -  /json        机器可读的 JSON 结果

不修改任何业务代码，跑完即可丢弃。
"""
from __future__ import annotations

import io
import sys
import time
import traceback
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

# ---- 把 backend 加入 sys.path，让测试可以 import app.services.palm_recognize_client ----
_HERE = Path(__file__).resolve().parent
_BACKEND_ROOT = _HERE / "PalmDestiny" / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _run_tests() -> dict:
    """在子环境内跑 unittest，捕获输出 + 详细结果。"""
    # 动态 import 测试模块
    started = time.time()
    sys.path.insert(0, str(_BACKEND_ROOT / "tests"))
    test_module_path = _BACKEND_ROOT / "tests" / "test_palm_signature_vs_skill.py"
    if not test_module_path.exists():
        return {
            "ok": False,
            "error": f"测试文件不存在: {test_module_path}",
            "summary": {},
            "cases": [],
            "stdout": "",
            "elapsed_ms": 0,
        }

    # 用 spec 方式独立加载，避免污染 sys.modules
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "test_palm_signature_vs_skill", str(test_module_path)
    )
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except Exception as e:
        return {
            "ok": False,
            "error": f"加载测试模块失败: {e}",
            "traceback": traceback.format_exc(),
            "summary": {},
            "cases": [],
            "stdout": "",
            "elapsed_ms": int((time.time() - started) * 1000),
        }

    # 收集测试用例
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(module)

    # 跑测试，捕获 stdout/stderr
    buf = io.StringIO()
    runner = unittest.TextTestRunner(stream=buf, verbosity=2)
    result = runner.run(suite)

    # 整理每个用例
    cases: list[dict] = []
    seen_ids = set()

    def _add(test, status: str, detail: str = ""):
        tid = test.id()
        if tid in seen_ids:
            return
        seen_ids.add(tid)
        cases.append(
            {
                "id": tid,
                "name": tid.split(".")[-1],
                "status": status,
                "detail": detail,
            }
        )

    for test, err in result.errors:
        _add(test, "ERROR", err)
    for test, err in result.failures:
        _add(test, "FAIL", err)
    for test, _reason in result.skipped:
        _add(test, "SKIP", str(_reason))

    # 把成功的也加上（unittest result 对成功的不直接给出引用，需要从 suite 反推）
    def _iter_tests(s):
        for t in s:
            if isinstance(t, unittest.TestSuite):
                yield from _iter_tests(t)
            else:
                yield t

    for t in _iter_tests(suite):
        tid = t.id()
        if tid not in seen_ids:
            cases.append(
                {
                    "id": tid,
                    "name": tid.split(".")[-1],
                    "status": "PASS",
                    "detail": "",
                }
            )
            seen_ids.add(tid)

    cases.sort(key=lambda c: c["id"])

    summary = {
        "total": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "passed": result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped),
        "wasSuccessful": result.wasSuccessful(),
    }
    return {
        "ok": result.wasSuccessful(),
        "summary": summary,
        "cases": cases,
        "stdout": buf.getvalue(),
        "elapsed_ms": int((time.time() - started) * 1000),
    }


# 启动时立即跑一遍，缓存结果
_RESULT: dict = {}


def _ensure_run():
    global _RESULT
    if not _RESULT:
        _RESULT = _run_tests()


app = FastAPI(title="Palm Signature Test Runner")


@app.get("/json")
async def json_result():
    _ensure_run()
    return JSONResponse(_RESULT)


@app.get("/", response_class=HTMLResponse)
async def html_report():
    _ensure_run()
    r = _RESULT

    summary = r.get("summary", {})
    cases = r.get("cases", [])
    stdout = r.get("stdout", "")
    elapsed = r.get("elapsed_ms", 0)
    overall_ok = bool(r.get("ok"))

    def _badge(status: str) -> str:
        color = {
            "PASS": "#16a34a",
            "FAIL": "#dc2626",
            "ERROR": "#dc2626",
            "SKIP": "#6b7280",
        }.get(status, "#6b7280")
        return f'<span style="background:{color};color:#fff;padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px;">{status}</span>'

    case_rows = []
    for c in cases:
        detail_html = ""
        if c["detail"]:
            esc = (
                c["detail"]
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            detail_html = f'<pre style="background:#0f172a;color:#fca5a5;padding:12px;border-radius:8px;margin:8px 0 0;white-space:pre-wrap;font-size:12px;line-height:1.55;overflow-x:auto;">{esc}</pre>'
        case_rows.append(
            f"""
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#fff;">
              <div style="display:flex;align-items:center;gap:12px;">
                {_badge(c['status'])}
                <code style="font-size:14px;color:#1f2937;font-weight:600;">{c['name']}</code>
                <span style="color:#6b7280;font-size:12px;margin-left:auto;">{c['id']}</span>
              </div>
              {detail_html}
            </div>
            """
        )

    overall_color = "#16a34a" if overall_ok else "#dc2626"
    overall_text = "✅ 全部通过" if overall_ok else "❌ 有失败用例"

    stdout_esc = (
        stdout.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )

    html = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Palm 签名兼容性测试报告</title>
      <style>
        body {{ margin:0; padding:0; background:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; color:#111827; }}
        .container {{ max-width:980px; margin:0 auto; padding:32px 24px 60px; }}
        h1 {{ margin:0 0 8px; font-size:26px; }}
        .subtitle {{ color:#6b7280; margin-bottom:20px; font-size:14px; }}
        .overall {{ display:inline-flex;align-items:center;gap:10px;background:{overall_color};color:#fff;padding:10px 18px;border-radius:999px;font-weight:700;font-size:16px;margin-bottom:14px; }}
        .stats {{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:24px; }}
        .stat {{ background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 18px;min-width:90px; }}
        .stat .num {{ font-size:22px;font-weight:700; }}
        .stat .lbl {{ font-size:12px;color:#6b7280;margin-top:2px; }}
        details summary {{ cursor:pointer; padding:10px 14px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; font-weight:600;}}
        pre.stdout {{ background:#0f172a;color:#a7f3d0;padding:16px;border-radius:10px;font-size:12px;line-height:1.55;overflow-x:auto;margin-top:10px; }}
        code {{ font-family: "SF Mono", Menlo, Consolas, monospace; }}
        .footer {{ text-align:center;margin-top:30px;color:#9ca3af;font-size:12px; }}
        a {{ color:#8a2be2; }}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Palm 签名兼容性测试</h1>
        <div class="subtitle">
          对比 <code>palm_recognize_client.py</code> 与 skill <code>palm-openapi-community</code> CLI 的官方协议参考实现，逐字段验证签名/Headers 的字节级一致性。
        </div>
        <div class="overall">{overall_text}</div>
        <div class="stats">
          <div class="stat"><div class="num">{summary.get('total', 0)}</div><div class="lbl">用例数</div></div>
          <div class="stat" style="color:#16a34a"><div class="num">{summary.get('passed', 0)}</div><div class="lbl">通过</div></div>
          <div class="stat" style="color:#dc2626"><div class="num">{summary.get('failures', 0)}</div><div class="lbl">失败</div></div>
          <div class="stat" style="color:#dc2626"><div class="num">{summary.get('errors', 0)}</div><div class="lbl">错误</div></div>
          <div class="stat" style="color:#6b7280"><div class="num">{summary.get('skipped', 0)}</div><div class="lbl">跳过</div></div>
          <div class="stat"><div class="num">{elapsed}</div><div class="lbl">耗时(ms)</div></div>
        </div>

        <h2 style="margin-top:30px;font-size:18px;">用例详情</h2>
        {''.join(case_rows) if case_rows else '<div style="color:#6b7280;">没有测试用例</div>'}

        <details style="margin-top:24px;">
          <summary>📋 unittest 原始输出</summary>
          <pre class="stdout">{stdout_esc}</pre>
        </details>

        <details style="margin-top:12px;">
          <summary>🔗 也可访问 <a href="/json">/json</a> 获取机器可读结果</summary>
        </details>

        <div class="footer">
          PalmDestiny · Signature Compatibility Test ·
          由 <a href="https://with.woa.com/" style="color:#8A2BE2;" target="_blank">With</a> 通过自然语言生成
        </div>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(html)


@app.get("/health")
async def health():
    return {"ok": True}
