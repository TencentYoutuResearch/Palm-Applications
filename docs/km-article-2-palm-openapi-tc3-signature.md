# 对接 Palm OpenAPI 社区版 1:N 检索：4 次返工、若干个深夜、与 TC3-HMAC-SHA256 的恩怨情仇

> 关键词：腾讯云 API、TC3-HMAC-SHA256、Palm OpenAPI、1:N 检索、SearchRgbPalm、RegisterRgbPalm、签名兼容性测试
>
> 读者画像：正在 / 即将集成腾讯云风格 OpenAPI 的后端同学。这篇不写情怀，只写"**为什么我连签名都签了 4 次才签对**"。

---

## TL;DR（如果你正在踩同样的坑，先看这个）

1. `CredentialScope` 中的日期段 ≠ 当天 UTC 日期，**而是等于 `X-TC-Version`**（社区版 Palm 平台特殊约定）。
2. `SignedHeaders` 必须显式包含 `x-tc-action`，仅签 `content-type;host` 会鉴权失败。
3. JSON Body 必须用 `json.dumps(..., separators=(",", ":"))` 紧凑序列化，**逗号后多一个空格就让签名作废**。
4. `RegisterRgbPalm` Body 必须带 `IrImage` 占位（`Data:""`）和 `PalmDirection`，`ImageType` 是**整型枚举 1**，不是字符串 `"JPG"`。
5. 必传 5 个非 TC3 协议头：`X-TC-Timestamp`、`X-TC-Nonce`、`X-Palm-AppId`、`X-Palm-Openapi-Token`、`Content-Type`。

---

## 一、背景：把"模拟版"换成"真平台"

我们这个 AI 掌纹算命应用最初的 1:N 识别是**靠 pHash 模拟**的——上传一张图，算 64 位感知哈希，去本地 SQLite 里找 hamming distance 最近的记录。这玩意儿在 demo 里能用，但有两个致命问题：

- pHash 对**手掌的旋转 / 光照 / 远近**几乎没有不变性
- 注册库一旦超过 50 张，就开始出现"小张和小王是一个人"

恰好接到一个内部资源——**Palm OpenAPI 社区版**（`https://open.intl.palm.tencent.com`），自带专业掌纹 1:N 检索。开干。

平台给的资料：

```text
App ID:     30008
Secret ID:  2a61de25-e04a-4bdc-a43b-adce912c1551
Secret Key: 77040d8d-4309-4703-b9e5-64f194cb3132
归属:        kanzhou
版本:        社区版
```

听起来是"5 行代码搞定"的事，结果——**走完一共改了 4 版**。

---

## 二、第 1 版：完全猜的 RESTful 风格（卒）

第一反应是"OpenAPI 嘛，肯定是 RESTful"。于是写出了：

```python
# 错误的第 1 版（凭直觉写的）
POST {BASE}/v1/palm/search
Headers:
  X-App-Id: 30008
  X-Secret-Id: ...
  X-Timestamp: ...
  X-Nonce: ...
  X-Signature: HMAC-SHA256(secret_key, app_id+secret_id+timestamp+nonce)
  Authorization: Bearer ...    # 双重保险？
Body:
  multipart/form-data
    file: <掌纹图>
```

结果： `404 Not Found`。

平台压根不是 RESTful，是**腾讯云 TC3 风格**：

- `Action` 不走 URL，走 `X-TC-Action` 请求头
- 路径永远是 `POST /`（根路径）
- 鉴权是 `Authorization: TC3-HMAC-SHA256 Credential=..., SignedHeaders=..., Signature=...`

---

## 三、第 2 版：照搬 hunyuan_client 的签名（半成品）

我们项目里已经有一份 `hunyuan_client.py` 跑通了腾讯云混元的 TC3 签名，我直接复用：

```python
def _tc3_sign_headers(action, payload_body):
    algorithm = "TC3-HMAC-SHA256"
    timestamp = str(int(time.time()))
    date = datetime.utcfromtimestamp(int(timestamp)).strftime("%Y-%m-%d")

    # CanonicalRequest
    canonical_uri = "/"
    canonical_querystring = ""
    canonical_headers = (
        f"content-type:application/json\n"
        f"host:{host}\n"
    )
    signed_headers = "content-type;host"
    hashed_request_payload = sha256(payload_body)
    canonical_request = (
        f"POST\n{canonical_uri}\n{canonical_querystring}\n"
        f"{canonical_headers}\n{signed_headers}\n{hashed_request_payload}"
    )

    # CredentialScope：service=palm, region=ap-guangzhou
    credential_scope = f"{date}/palm/tc3_request"

    # ... 后续 HMAC 链路省略
```

调用 `CreateAccessToken`：

- ✅ HTTP 200
- ❌ Body 里依然 `[AuthFailure.SignatureFailure] Invalid Palm signature`

签名格式没问题，但 Palm 平台不认。

---

## 四、第 3 版：把签名"按平台规范"改对

调研了平台真实的官方协议参考实现（`palm-openapi-community` skill 里的 CLI 脚本），逐字段对了一遍签名输入，发现 **4 个细节和腾讯云通用 TC3 不一样**：

| 维度 | 通用腾讯云 TC3 | Palm 社区版 |
|---|---|---|
| **CredentialScope 日期段** | 当天 UTC `YYYY-MM-DD` | **`X-TC-Version` 的值**，例如 `2025-07-15` |
| **secret_date HMAC 入参** | `date.encode()` | **`X-TC-Version`.encode()** |
| **SignedHeaders 列表** | `content-type;host` | **`content-type;host;x-tc-action`** |
| **canonical_headers 内容** | 含 ct + host | **额外加 `x-tc-action:{action.lower()}`** |
| **Body 字段 AppId** | 字符串 | **整型** |

修完之后画一张对比图：

```mermaid
sequenceDiagram
    participant C as 客户端
    participant P as Palm 平台
    Note over C: 构造 CanonicalRequest
    Note over C: signed_headers = content-type;host;x-tc-action ✅
    Note over C: canonical_headers = ct + host + x-tc-action:createaccesstoken ✅
    Note over C: CredentialScope = 2025-07-15/palm/tc3_request ✅
    Note over C: secret_date = HMAC(SecretKey, 2025-07-15) ✅
    C->>P: POST / + Authorization=TC3-HMAC-SHA256 ...
    P-->>C: 200 OK { AccessToken: "..." }
```

`CreateAccessToken` 终于过了。

但是——

## 五、第 4 版：业务接口又踩了一遍

`CreateAccessToken` 拿到 Token 后，下一步是 `RegisterRgbPalm`（注册掌纹）和 `SearchRgbPalm`（1:N 检索）。这两个接口**不要 TC3 签名了**，但是有自己的一套"非 TC3 协议头"：

```python
# 必传 5 个 Header（少一个就 401）
"X-Palm-Openapi-Token": access_token       # 上一步拿到的
"X-TC-Timestamp": str(int(time.time()))    # 必须和签名一起带
"X-TC-Nonce": os.urandom(16).hex()         # 32 位 hex
"X-Palm-AppId": str(PALM_API_APP_ID)       # AppId 字符串
"Content-Type": "application/json"
```

5 个 Header 是逐个失败逐个补出来的——
401 `Missing X-TC-Timestamp` → 补
401 `Missing X-TC-Nonce` → 补
401 `Missing X-Palm-AppId` → 补
…

到这步以为终于通了，结果 `RegisterRgbPalm` 返回：

```json
{ "Code": "InvalidParameter.RgbImage", "Message": "RgbImage 参数错误" }
```

仔细看官方协议参考，发现请求体结构和我以为的差**4 个字段**：

| 字段 | 我写的 | 平台要的 |
|---|---|---|
| `RgbImage.ImageType` | `"JPG"` / `"PNG"` 字符串 | **整型枚举 `1`**（1=RGB，2=IR） |
| `RgbImage.ThreePointList` | 不传 | **必带空数组 `[]`** |
| `IrImage` | 不传 | **必带占位对象** `{Data:"", ThreePointList:[], ImageType:2}` |
| `PalmDirection` | 不传 | **必带 `1`**（1=正向手掌） |

修完最终的 Body 长这样：

```json
{
  "AppId": 30008,
  "UserId": "kanzhou",
  "PalmDirection": 1,
  "IsForce": true,
  "RgbImage": {
    "Data": "<base64>",
    "ImageType": 1,
    "ThreePointList": []
  },
  "IrImage": {
    "Data": "",
    "ImageType": 2,
    "ThreePointList": []
  },
  "AlgorithmStrategy": "default"
}
```

这次终于：

```json
{ "Code": "Success", "PalmId": "...", "Message": "register success" }
```

---

## 六、最终架构：一份能走通所有平台分歧的客户端

最终代码核心结构（`palm_recognize_client.py`）：

```python
class PalmRecognizeClient:
    """
    封装 Palm 社区版 OpenAPI 调用：
      - CreateAccessToken：TC3-HMAC-SHA256 签名（含上述 4 处 Palm 特殊约定）
      - SearchRgbPalm / RegisterRgbPalm：仅需 X-Palm-Openapi-Token + 5 个非 TC3 协议头
      - AccessToken 7200s 内存缓存 + asyncio.Lock 并发锁
      - 401/403 自动刷新 Token 重试一次
      - 网络异常 / 平台报错 全部 graceful degrade，前端流程不阻塞
    """

    async def _create_access_token(self) -> str:
        """Step 1: 用 TC3 签名换 Token"""
        ...

    async def _do_search_rgb_palm(self, image_b64) -> dict:
        """Step 2: 1:N 检索"""
        ...

    async def _do_register_rgb_palm(self, user_id, image_b64) -> dict:
        """Step 2': 掌纹注册"""
        ...

    async def search_palm_1n(self, image_bytes, filename, content_type):
        """对外业务入口：上层完全感知不到 TC3 签名 / Token 缓存细节"""
        ...
```

对外只暴露 `search_palm_1n` 和 `register_palm` 两个函数，签名 100% 稳定。前端代码、`main.py` 路由代码全程没改过。

---

## 七、签名兼容性单元测试：保命的最后一道关

调对了不代表以后不会再坏——平台一升级 / 我们一改文件就可能再炸。所以最后我加了一份**签名兼容性单测**（`test_palm_signature_vs_skill.py`），逻辑是：

> 把 `palm_recognize_client.py` 的签名结果 vs. skill 中"官方协议参考实现"（`palm_openapi_community_cli.py`）的签名结果，**逐字段做字节级 diff**。

测试覆盖：

- `Authorization` Header 完整字符串
- `SignedHeaders` 列表逐项
- `CredentialScope` 日期段 = `X-TC-Version`
- `CanonicalRequest` 整体 hash
- `secret_date` / `secret_service` / `secret_signing` 三层 HMAC 链
- `X-TC-Nonce` / `X-TC-Timestamp` / `X-Palm-AppId` 5 个非 TC3 头一个不少

只要平台或我们这边任何一方的签名约定漂了，CI 立刻飘红。

```python
def test_authorization_byte_equal_to_official_cli(self):
    ours = palm_recognize_client._tc3_sign_headers(
        action="CreateAccessToken",
        payload_body=FIXED_BODY,
        timestamp=FIXED_TS,
        nonce=FIXED_NONCE,
    )
    theirs = official_cli._build_signature(
        action="CreateAccessToken",
        body=FIXED_BODY,
        timestamp=FIXED_TS,
        nonce=FIXED_NONCE,
    )
    self.assertEqual(ours["Authorization"], theirs["Authorization"])
```

---

## 八、9 条压箱底经验

1. **Header 名永远小写比对**。`x-tc-action` 和 `X-TC-Action` 的 hash 是不一样的，签名时一律 `.lower()`。
2. **JSON 序列化用紧凑模式**：`json.dumps(..., separators=(",", ":"))`。空格会让你怀疑人生。
3. **签名 body 必须 = 实际发送 body**。不要先签再 prettify。
4. **HMAC 链路 4 层都打 log**。一旦签错，逐层对比 hex 才能定位是哪一层错。
5. **Token 缓存别用 dict，用 `asyncio.Lock` 保护**。否则并发请求会同时去刷 Token，浪费配额还可能撞上限流。
6. **401/403 自动刷新一次就够**。无限重试 = DDoS 自家平台。
7. **Pydantic Settings v2 一定加 `"extra": "ignore"`**。`.env` 加新字段不会再让应用启动失败。
8. **业务接口失败要"返回友好结构"，不要 raise**。我们的兜底是 `{ identified: false, message: "..." }`，前端用同一套 UI 渲染，用户感知不到。
9. **永远写一份"签名一致性"单测**。它会在你最需要的时候救你。

---

## 九、结语

> 一次对接，4 次返工，本质上不是平台坑，**是规范文档与"官方参考实现"之间的微小漂移**。

这种漂移在腾讯云生态里非常常见：通用 SDK 文档说"签名标准是 TC3-HMAC-SHA256"，但具体到 Palm、Hunyuan、TKE、CKafka 各家都有细微方言。**把"官方协议参考实现"当作 ground truth、用单测把字节级一致性钉死**，比读 10 遍文档管用。

如果你下一周也要对接一个"长得像但又不完全一样"的腾讯云风格 API，希望这篇能让你少跨几个深夜。

---

> 由 [With](https://with.woa.com/) 通过自然语言生成
