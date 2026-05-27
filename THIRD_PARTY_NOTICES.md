# Third-Party Notices

本项目（GlassWiper）使用了以下第三方开源软件和素材资源。在此向这些优秀的开源项目和工具致以诚挚的感谢。

---

## 一、开源软件依赖

所有第三方 JavaScript 库均通过 CDN 引入，本仓库中**不包含**其源代码副本。

### 1. MediaPipe Hands

- **用途**：实时手部关键点检测（21 个关键点），实现"体感擦玻璃"手势识别
- **项目主页**：https://github.com/google/mediapipe
- **协议**：Apache License 2.0
- **版权**：Copyright © Google LLC
- **引入方式**：CDN (`cdn.jsdelivr.net/npm/@mediapipe/hands`)

### 2. MediaPipe Camera Utils

- **用途**：将摄像头视频帧输入到 MediaPipe 模型
- **项目主页**：https://github.com/google/mediapipe
- **协议**：Apache License 2.0
- **版权**：Copyright © Google LLC
- **引入方式**：CDN (`cdn.jsdelivr.net/npm/@mediapipe/camera_utils`)

### 3. MediaPipe Drawing Utils

- **用途**：手部骨架和关键点的绘制工具
- **项目主页**：https://github.com/google/mediapipe
- **协议**：Apache License 2.0
- **版权**：Copyright © Google LLC
- **引入方式**：CDN (`cdn.jsdelivr.net/npm/@mediapipe/drawing_utils`)

### 4. Noto Sans SC

- **用途**：游戏界面中文字体
- **项目主页**：https://fonts.google.com/noto/specimen/Noto+Sans+SC
- **协议**：SIL Open Font License 1.1
- **版权**：Copyright © Google LLC / Adobe Systems Incorporated
- **引入方式**：Google Fonts CDN (`fonts.googleapis.com`)

---

## 二、AI 生成素材

本项目 `assets/images/` 目录下的所有图片均由 AI 模型生成。

### 生成工具

- **模型**：Nano Banana（Google Gemini 2.5 Flash Image）
- **提供方**：Google DeepMind
- **官方说明**：https://deepmind.google/technologies/gemini/

### 涉及文件

| 文件路径 | 用途 |
|---|---|
| `assets/images/level1.png` | 第 1 关隐藏图片 |
| `assets/images/level2.png` | 第 2 关隐藏图片 |
| `assets/images/level3.png` | 第 3 关隐藏图片 |
| `assets/images/level4.png` | 第 4 关隐藏图片 |
| `assets/images/level5.png` | 第 5 关隐藏图片 |
| `assets/images/level6.png` | 第 6 关隐藏图片 |
| `assets/images/boss1.png` | Boss 1 关卡图片 |
| `assets/images/boss2.png` | Boss 2 关卡图片 |

### 使用授权

- 依据 Google Gemini API 服务条款，用户对生成内容享有使用权，允许个人及商业用途
- Nano Banana 生成的图片包含 **SynthID 隐形数字水印**，用于标识 AI 生成来源

---

## 三、项目自身代码

本项目的 HTML、CSS、JavaScript 源代码由项目作者原创编写，采用 **MIT License** 开源，详见 [LICENSE](./LICENSE)。

---

## 四、协议全文

### Apache License 2.0（适用于 MediaPipe）

完整协议文本请访问：https://www.apache.org/licenses/LICENSE-2.0

### SIL Open Font License 1.1（适用于 Noto Sans SC）

完整协议文本请访问：https://scripts.sil.org/OFL

---

## 五、问题反馈

如果您认为本项目使用了未经授权的素材，或对第三方资源的使用存在疑问，请通过 Issue 或 Pull Request 联系我们，我们将尽快处理。
