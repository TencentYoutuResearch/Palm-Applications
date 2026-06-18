"""
Tencent Hunyuan client for interacting with Tencent Cloud Hunyuan multimodal model.
Handles palm image description and traditional Chinese palmistry interpretation via cloud API.
"""

import base64
import hashlib
import hmac
import json
import time
import httpx
from loguru import logger
from pathlib import Path
from urllib.parse import urlencode

from app.core.config import settings


class HunyuanClient:
    """Async client for Tencent Cloud Hunyuan API with multimodal support."""

    def __init__(self):
        self.secret_id = settings.HUNYUAN_SECRET_ID
        self.secret_key = settings.HUNYUAN_SECRET_KEY
        self.host = settings.HUNYUAN_HOST
        self.service = settings.HUNYUAN_SERVICE
        self.region = settings.HUNYUAN_REGION
        self.action = settings.HUNYUAN_ACTION
        self.version = settings.HUNYUAN_VERSION
        self.timeout = httpx.Timeout(25.0, connect=5.0)

    @staticmethod
    def _serialize_payload(payload: dict) -> str:
        """序列化 payload 为 JSON 字符串，确保签名和发送使用完全相同的 body。"""
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

    def _sign_headers(self, payload_body: str) -> dict:
        """Generate Tencent Cloud API signature headers.
        
        Args:
            payload_body: 已序列化的 JSON 字符串（必须与实际发送的 body 完全一致）。
        """
        algorithm = "TC3-HMAC-SHA256"
        timestamp = int(time.time())
        date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
        
        # Canonical request
        canonical_uri = "/"
        canonical_querystring = ""
        ct = "application/json; charset=utf-8"
        canonical_headers = f"content-type:{ct}\nhost:{self.host}\n"
        signed_headers = "content-type;host"
        payload_hash = hashlib.sha256(payload_body.encode("utf-8")).hexdigest()
        
        canonical_request = f"POST\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        
        # String to sign
        credential_scope = f"{date}/{self.service}/tc3_request"
        hashed_canonical_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
        string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}"
        
        # Calculate signature
        def _hmac_sha256(key, msg):
            return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()
        
        secret_date = _hmac_sha256(("TC3" + self.secret_key).encode("utf-8"), date)
        secret_service = _hmac_sha256(secret_date, self.service)
        secret_signing = _hmac_sha256(secret_service, "tc3_request")
        signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
        
        # Authorization header
        authorization = f"{algorithm} Credential={self.secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
        
        return {
            "Authorization": authorization,
            "Content-Type": "application/json; charset=utf-8",
            "Host": self.host,
            "X-TC-Action": self.action,
            "X-TC-Timestamp": str(timestamp),
            "X-TC-Version": self.version,
            "X-TC-Region": self.region,
        }

    async def check_health(self) -> bool:
        """Check if Tencent Cloud API credentials are valid."""
        if not self.secret_id or not self.secret_key:
            logger.error("Hunyuan API 密钥未配置，请设置 HUNYUAN_SECRET_ID 和 HUNYUAN_SECRET_KEY 环境变量")
            return False
        try:
            # 健康检查：用文本模型探活，避免 vision 模型纯文本调用被拒
            # （hunyuan-vision 要求 Messages 中必须包含图片，"Hello" 会触发 InvalidParameter）
            payload = {
                "Model": settings.HUNYUAN_TEXT_MODEL,
                "Messages": [
                    {
                        "Role": "user",
                        "Content": "Hello"
                    }
                ],
                "Stream": False
            }
            
            payload_body = self._serialize_payload(payload)
            headers = self._sign_headers(payload_body)
            
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
                resp = await client.post(
                    f"https://{self.host}",
                    content=payload_body,
                    headers=headers
                )
                
                if resp.status_code == 200:
                    # 腾讯云API即使认证失败也可能返回HTTP 200
                    # 必须检查响应体中是否包含Error字段
                    result = resp.json()
                    if "Response" in result and "Error" in result["Response"]:
                        error_info = result["Response"]["Error"]
                        error_code = error_info.get("Code", "Unknown")
                        error_msg = error_info.get("Message", "Unknown error")
                        logger.error(f"Hunyuan API health check failed: {error_code} - {error_msg}")
                        return False
                    return True
                else:
                    logger.error(f"Hunyuan API health check failed: HTTP {resp.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Hunyuan health check failed: {e}")
            return False

    async def describe_palm_image(self, image_path: str) -> str:
        """
        Send palm image to Hunyuan model for detailed visual description.
        
        Uses a professional palmistry analyst prompt to extract fine-grained
        palm line features following traditional Chinese hand reading conventions.
        """
        if not self.secret_id or not self.secret_key:
            raise RuntimeError("Hunyuan API 密钥未配置，无法调用模型")
        image_data = self._encode_image(image_path)

        # 专业掌纹分析 prompt，引导模型按中国传统手相学体系进行细致描述
        prompt = """你是一位精通中国传统手相学的专业掌纹分析师，同时具备现代图像分析能力。
请仔细观察这张手掌图片，按照以下框架进行详细、客观的描述。请务必基于你实际看到的内容来描述，不要臆测。

一、掌型判断
请判断此掌属于哪种掌型（参考中国传统分类）：
- 金形掌（方掌，掌形方正厚实）
- 木形掌（长掌，掌形修长瘦削）
- 水形掌（圆掌，掌形圆润柔软）
- 火形掌（尖掌，指尖尖细掌形上窄下宽）
- 土形掌（厚掌，掌形敦厚结实）
同时描述掌色（红润/苍白/偏黄/偏暗）、掌肉厚薄、软硬程度的视觉判断。

二、三大主线详细描述
1. 生命线（地纹）：
   - 起点位置（食指与拇指之间的具体位置）
   - 弧度大小（弧度大表示精力充沛，弧度小表示体质偏弱）
   - 长度（是否延伸至手腕横纹附近）
   - 深浅粗细（深而清晰/浅而模糊/粗壮/纤细）
   - 有无断裂、岛纹、链状纹、分支
   - 末端走向（向月丘偏转/向金星丘收束/分叉）

2. 智慧线（人纹）：
   - 起点位置（与生命线同源/分开起始/距离远近）
   - 走向（横直/下垂向月丘/微微上扬）
   - 长度（是否过掌心/延伸至小指下方）
   - 深浅粗细
   - 有无断裂、岛纹、分叉
   - 末端形态（上翘/下垂/分叉为二）

3. 感情线（天纹）：
   - 起点位置（小指下方的具体位置）
   - 走向（向食指方向/向中指方向/在食指中指之间结束）
   - 弧度（弧度大表示感情丰富，平直表示理性）
   - 长度和深浅
   - 有无断裂、岛纹、链状纹、分支
   - 末端形态（分叉/上翘/下弯）

四、辅助线描述（如果可见）
1. 命运线（事业线/玉柱纹）：是否存在？起点在哪里？走向如何？是否清晰连续？
2. 太阳线（成功线/六秀纹）：是否存在？位置和长度？
3. 婚姻线（结合线）：小指下方侧面是否可见？条数和长短？
4. 健康线（考证纹）：是否存在？走向如何？
5. 手腕线（手颈线）：可见几条？是否清晰完整？

五、特殊纹路标记
请描述是否看到以下特殊纹路：
- 岛纹（椭圆形封闭纹路，出现在哪条线上）
- 十字纹（两线交叉，出现在哪个区域）
- 星纹（三线或多线交汇，出现在哪个区域）
- 方纹（四边形保护纹）
- 三角纹
- 井字纹
- 凤眼纹（拇指第一节内侧的眼形纹）
- 佛眼纹（拇指第一节的眼形纹）

六、八大丘位描述
请描述各丘位的丰隆程度（丰满/平坦/凹陷）：
1. 木星丘（食指根部）
2. 土星丘（中指根部）
3. 太阳丘（无名指根部）
4. 水星丘（小指根部）
5. 金星丘（拇指根部大鱼际区域）
6. 月丘（小鱼际区域）
7. 第一火星丘（木星丘与金星丘之间）
8. 第二火星丘（水星丘与月丘之间）

七、指形与指节
简要描述手指的长短比例、指节粗细、指尖形状（方形/圆形/尖形/铲形）。

请用中文回答，描述要客观详实，重点关注你能清晰辨认的特征。"""

        payload = {
            "Messages": [
                {
                    "Role": "user",
                    "Contents": [
                        {
                            "Type": "text",
                            "Text": prompt
                        },
                        {
                            "Type": "image_url",
                            "ImageUrl": {
                                "Url": f"data:image/jpeg;base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            "Stream": False,
            "Model": settings.HUNYUAN_MODEL
        }

        import asyncio as _asyncio
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                payload_body = self._serialize_payload(payload)
                headers = self._sign_headers(payload_body)
                
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(
                        f"https://{self.host}",
                        content=payload_body,
                        headers=headers
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    
                    # 检查API错误响应
                    if "Response" in result and "Error" in result["Response"]:
                        error_info = result["Response"]["Error"]
                        error_code = error_info.get("Code", "Unknown")
                        error_msg = error_info.get("Message", "Unknown error")
                        if "LimitExceeded" in error_code and attempt < max_retries:
                            wait = (attempt + 1) * 2
                            logger.info(f"Hunyuan describe 限频，{wait}s后重试 (第{attempt+1}次)")
                            await _asyncio.sleep(wait)
                            continue
                        logger.error(f"Hunyuan API describe error: Code={error_code}, Message={error_msg}")
                        raise RuntimeError(f"Hunyuan API error: {error_code} - {error_msg}")
                    
                    # Extract response from Hunyuan API
                    if "Response" in result and "Choices" in result["Response"]:
                        choices = result["Response"]["Choices"]
                        if choices and len(choices) > 0:
                            description = choices[0].get("Message", {}).get("Content", "")
                            if not description:
                                raise RuntimeError("Hunyuan API returned empty description content")
                            return description
                    
                    logger.error(f"Unexpected Hunyuan response format: {result}")
                    raise RuntimeError("Failed to parse Hunyuan API response")
                    
            except httpx.TimeoutException as e:
                logger.error(f"Hunyuan describe request timed out: {type(e).__name__}")
                raise RuntimeError("Hunyuan describe_palm_image timed out (25s)")
            except RuntimeError:
                raise
            except Exception as e:
                if attempt < max_retries:
                    wait = (attempt + 1) * 2
                    logger.info(f"Hunyuan describe 异常，{wait}s后重试: {e}")
                    await _asyncio.sleep(wait)
                    continue
                logger.error(f"Hunyuan request failed: {type(e).__name__}: {e}")
                raise RuntimeError(f"Failed to get image description: {type(e).__name__}: {e}")
        raise RuntimeError("Hunyuan describe_palm_image retries exhausted")

    async def generate_reading(
        self, vl_description: str, cv_features: dict
    ) -> str:
        """
        Generate deep palmistry reading based on VL description and CV features.
        
        Combines Hunyuan visual analysis with computer vision measurements,
        referencing classical Chinese palmistry texts for comprehensive interpretation.
        """
        if not self.secret_id or not self.secret_key:
            raise RuntimeError("Hunyuan API 密钥未配置，无法调用模型")
        # 构建特征摘要
        feature_summary = self._format_features(cv_features)

        prompt = f"""你是一位精通中国传统手相学的资深相师，熟读《麻衣神相》《柳庄相法》《神相全编》《水镜集》《相理衡真》等经典著作，同时了解现代掌纹分析技术。

请根据以下掌纹分析数据，给出一份深入、专业的手相解读报告。

====== 多模态视觉描述 ======
{vl_description}

====== 计算机视觉量化数据 ======
{feature_summary}

请严格按照以下结构输出解读报告，每个部分都要有充分的分析和引经据典：

---

## 一、掌型总论

根据掌型（金木水火土五行掌）判断此人的基本性格底色和先天禀赋。
引用《麻衣神相》中"掌如绵软，富贵绑身"或"掌硬如石，劳碌一生"等相关论述。
分析掌色对气血健康的指示意义。

## 二、生命线（地纹）详解

### 健康与体质
- 根据生命线的长度、深浅、弧度，分析此人的先天体质和生命力强弱
- 《麻衣神相》云："生命线深长而红润者，主健康长寿；浅短而色暗者，主体弱多病"
- 分析弧度大小对精力和活力的影响

### 生命阶段运势
- 将生命线按传统流年法划分（起点为0岁，沿线向下推算）
- 指出关键转折点（如有断裂、岛纹、分支等）对应的大致年龄段
- 分析末端走向对晚年运势的影响

### 特殊标记解读
- 如有岛纹：该时期可能有健康波动或精神压力
- 如有链状纹：幼年体质较弱，需注意调养
- 如有分支：分支向上为吉（努力向上），向下需注意

## 三、智慧线（人纹）详解

### 思维与才智
- 根据智慧线的长度和走向，分析此人的思维模式
- 横直者偏理性务实，下垂向月丘者富想象力和创造力
- 《柳庄相法》论："智慧线明润而长者，聪明过人，可成大器"

### 事业适配
- 根据智慧线特征推荐适合的职业方向
- 与生命线起点关系分析（同源者谨慎稳重，分开者独立果断）
- 末端分叉的含义（双重才能/文理兼通）

### 学业与决策力
- 分析智慧线对学习能力和决策风格的影响
- 有无岛纹对注意力和精神状态的影响

## 四、感情线（天纹）详解

### 情感模式
- 根据感情线的弧度和长度，分析此人的情感表达方式
- 弧度大者热情奔放，平直者理性克制
- 《神相全编》论感情线："天纹深秀者，重情重义；浅乱者，情感多变"

### 婚恋运势
- 感情线末端位置的含义：
  - 止于食指下方：理想主义，追求完美爱情
  - 止于中指下方：以自我为中心的感情观
  - 止于食指与中指之间：最为平衡，感情观健康
- 分叉、断裂的感情含义

### 人际关系
- 感情线对社交能力和人际关系的影响
- 链状纹表示感情经历丰富但波折较多

## 五、命运线（玉柱纹）与事业运

### 事业发展轨迹
- 命运线是否存在及其清晰程度
- 起点位置的含义：
  - 起自手腕：白手起家，靠自身努力
  - 起自月丘：得贵人相助或异性助力
  - 起自生命线：受家族影响较大
- 《水镜集》论："玉柱纹直透中指者，事业亨通，一生顺遂"

### 事业转折
- 命运线上的断裂或变化对应的职业转折期
- 有无太阳线配合（太阳线为成功线，有则锦上添花）

## 六、辅助线与特殊纹路

### 婚姻线解读
- 条数、长短、深浅对婚姻状况的指示
- 《麻衣神相》论婚姻线的各种形态

### 特殊纹路吉凶
- 十字纹：出现在不同位置的吉凶含义（如掌心十字纹为"神秘十字"，主直觉敏锐）
- 星纹：出现在各丘位的不同含义
- 方纹：保护纹，化解灾厄
- 凤眼纹/佛眼纹：智慧与灵性的标志

## 七、八丘论断

根据各丘位的丰隆程度进行论断：
- 木星丘丰隆：领导力强，有野心和抱负
- 土星丘丰隆：沉稳内敛，适合研究型工作
- 太阳丘丰隆：艺术天赋，人缘好
- 水星丘丰隆：口才好，商业头脑
- 金星丘丰隆：精力旺盛，重感情
- 月丘丰隆：想象力丰富，直觉敏锐

## 八、五行综合论断

结合掌型五行属性、各线特征、丘位状态，给出五行生克的综合分析：
- 此掌的五行偏向
- 五行平衡状态
- 需要补益的方面

## 九、流年运势概览

根据各线的流年划分法，给出大致的人生阶段运势：
- 青年期（18-30岁）
- 壮年期（30-45岁）
- 中年期（45-60岁）
- 晚年期（60岁以后）

## 十、综合评语与建议

给出一段温暖、积极、有建设性的总结评语，包括：
- 此掌的最大优势和亮点
- 需要注意和改善的方面
- 传统手相学中的开运建议

---

**重要要求：**
1. 全文使用中文
2. 每个部分都要有实质性的分析内容，不要空泛
3. 适当引用经典著作原文增加权威性
4. 保持积极正面的基调，即使有不利特征也要给出化解建议
5. 分析要基于上面提供的实际掌纹数据，不要凭空编造
6. 在报告最末尾附上免责声明："以上解读基于中国传统手相文化，仅供文化参考与娱乐，不构成任何医学、心理学或财务方面的专业建议。手相学属于民俗文化范畴，命运掌握在自己手中。"
"""

        payload = {
            "Messages": [
                {
                    "Role": "user",
                    "Contents": [
                        {
                            "Type": "text",
                            "Text": prompt
                        }
                    ]
                }
            ],
            "Stream": False,
            "Model": settings.HUNYUAN_MODEL
        }

        import asyncio as _asyncio
        max_retries = 2
        reading_timeout = httpx.Timeout(50.0, connect=10.0)
        for attempt in range(max_retries + 1):
            try:
                payload_body = self._serialize_payload(payload)
                headers = self._sign_headers(payload_body)
                
                async with httpx.AsyncClient(timeout=reading_timeout) as client:
                    resp = await client.post(
                        f"https://{self.host}",
                        content=payload_body,
                        headers=headers
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    
                    # 检查API错误响应
                    if "Response" in result and "Error" in result["Response"]:
                        error_info = result["Response"]["Error"]
                        error_code = error_info.get("Code", "Unknown")
                        error_msg = error_info.get("Message", "Unknown error")
                        if "LimitExceeded" in error_code and attempt < max_retries:
                            wait = (attempt + 1) * 2
                            logger.info(f"Hunyuan reading 限频，{wait}s后重试 (第{attempt+1}次)")
                            await _asyncio.sleep(wait)
                            continue
                        logger.error(f"Hunyuan API reading error: Code={error_code}, Message={error_msg}")
                        raise RuntimeError(f"Hunyuan API error: {error_code} - {error_msg}")

                    if "Response" in result and "Choices" in result["Response"]:
                        choices = result["Response"]["Choices"]
                        if choices and len(choices) > 0:
                            reading = choices[0].get("Message", {}).get("Content", "")
                            if not reading:
                                raise RuntimeError("Hunyuan API returned empty reading content")
                            return reading
                    
                    logger.error(f"Unexpected Hunyuan response format: {result}")
                    raise RuntimeError("Failed to parse Hunyuan API response")
                    
            except httpx.TimeoutException as e:
                logger.error(f"Hunyuan reading generation timed out: {type(e).__name__}")
                raise RuntimeError("Hunyuan generate_reading timed out (50s)")
            except RuntimeError:
                raise
            except Exception as e:
                if attempt < max_retries:
                    wait = (attempt + 1) * 2
                    logger.info(f"Hunyuan reading 异常，{wait}s后重试: {e}")
                    await _asyncio.sleep(wait)
                    continue
                logger.error(f"Hunyuan reading generation failed: {type(e).__name__}: {e}")
                raise RuntimeError(f"Failed to generate reading: {type(e).__name__}: {e}")
        raise RuntimeError("Hunyuan generate_reading retries exhausted")

    @staticmethod
    def _encode_image(image_path: str) -> str:
        """Read and base64-encode an image file."""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    @staticmethod
    def _format_features(features: dict) -> str:
        """Format CV features dict into readable Chinese text."""
        lines = []
        key_labels = {
            "heart_line_ratio": "感情线(天纹)长度占比",
            "heart_line_length": "感情线(天纹)像素长度",
            "head_line_ratio": "智慧线(人纹)长度占比",
            "head_line_length": "智慧线(人纹)像素长度",
            "life_line_ratio": "生命线(地纹)长度占比",
            "life_line_length": "生命线(地纹)像素长度",
            "fate_line_detected": "命运线(玉柱纹)是否检测到",
            "fate_line_length": "命运线(玉柱纹)像素长度",
            "total_lines_detected": "检测到的总线条数",
            "horizontal_lines": "水平线条数(感情线/智慧线方向)",
            "vertical_lines": "垂直线条数(命运线方向)",
            "diagonal_lines": "斜向线条数(生命线方向)",
            "major_contours": "主要纹路轮廓组数",
            "total_contours": "总轮廓数",
            "palm_coverage_ratio": "掌纹覆盖率(纹路密集程度)",
            "upper_density": "上部区域(感情线区)纹路密度",
            "middle_density": "中部区域(智慧线区)纹路密度",
            "lower_density": "下部区域(生命线下段)纹路密度",
            "image_width": "分析图像宽度(像素)",
            "image_height": "分析图像高度(像素)",
        }
        for key, label in key_labels.items():
            if key in features:
                lines.append(f"- {label}: {features[key]}")
        return "\n".join(lines) if lines else "未提取到CV特征数据。"


# Singleton
hunyuan_client = HunyuanClient()