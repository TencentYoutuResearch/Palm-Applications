"""
Qwen Cloud client for interacting with Alibaba DashScope / OpenAI-compatible API.
Handles palm image description and traditional Chinese palmistry interpretation via cloud API.
"""

import base64
import httpx
from loguru import logger
from pathlib import Path

from app.core.config import settings


class QwenCloudClient:
    """Async client for Qwen Cloud API (DashScope OpenAI-compatible endpoint)."""

    def __init__(self):
        self.api_key = settings.QWEN_CLOUD_API_KEY
        self.base_url = settings.QWEN_CLOUD_BASE_URL
        self.model = settings.QWEN_CLOUD_MODEL
        self.timeout = httpx.Timeout(300.0, connect=10.0)

    def _headers(self) -> dict:
        """Build request headers with API key."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def check_health(self) -> bool:
        """Check if Qwen Cloud API is accessible with valid credentials."""
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "user", "content": "Hello"}
                ],
                "max_tokens": 10,
            }
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    return True
                else:
                    logger.error(f"Qwen Cloud API health check failed: {resp.status_code} {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Qwen Cloud health check failed: {e}")
            return False

    async def describe_palm_image(self, image_path: str) -> str:
        """
        Send palm image to Qwen Cloud model for detailed visual description.

        Uses OpenAI-compatible vision API with base64-encoded image.
        """
        image_data = self._encode_image(image_path)

        # 专业掌纹分析 prompt
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
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            },
                        },
                    ],
                }
            ],
            "max_tokens": 4096,
            "temperature": 0.2,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                result = resp.json()

                description = result["choices"][0]["message"]["content"]
                return description

        except httpx.TimeoutException:
            logger.error("Qwen Cloud request timed out")
            raise RuntimeError("Model inference timed out. Please try again.")
        except Exception as e:
            logger.error(f"Qwen Cloud request failed: {e}")
            raise RuntimeError(f"Failed to get image description: {e}")

    async def generate_reading(
        self, vl_description: str, cv_features: dict
    ) -> str:
        """
        Generate deep palmistry reading based on VL description and CV features.

        Uses Qwen Cloud text model for comprehensive interpretation.
        """
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
## 二、生命线（地纹）详解
## 三、智慧线（人纹）详解
## 四、感情线（天纹）详解
## 五、命运线（玉柱纹）与事业运
## 六、辅助线与特殊纹路
## 七、八丘论断
## 八、五行综合论断
## 九、流年运势概览
## 十、综合评语与建议

**重要要求：**
1. 全文使用中文
2. 每个部分都要有实质性的分析内容，不要空泛
3. 适当引用经典著作原文增加权威性
4. 保持积极正面的基调，即使有不利特征也要给出化解建议
5. 分析要基于上面提供的实际掌纹数据，不要凭空编造
6. 在报告最末尾附上免责声明："以上解读基于中国传统手相文化，仅供文化参考与娱乐，不构成任何医学、心理学或财务方面的专业建议。手相学属于民俗文化范畴，命运掌握在自己手中。"
"""

        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 6000,
            "temperature": 0.65,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                result = resp.json()

                reading = result["choices"][0]["message"]["content"]
                return reading

        except Exception as e:
            logger.error(f"Qwen Cloud reading generation failed: {e}")
            raise RuntimeError(f"Failed to generate reading: {e}")

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
qwen_cloud_client = QwenCloudClient()