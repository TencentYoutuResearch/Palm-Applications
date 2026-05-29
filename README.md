# 🖐️ Palm Applications — 刷掌应用合集

<p align="center">
  <strong>使用刷掌api的趣味demo合集 | Fun demos using palm recognition API</strong>
</p>

<p align="center">
  <strong>GitHub Contributors:</strong> xiaoyaopeng, kaydxh, MollySophia, celinachen-AIinsight, pandagoodluck
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0"></a>
  <a href="https://palm.tencent.com"><img src="https://img.shields.io/badge/腾讯刷掌开放平台-推荐集成-orange" alt="Tencent Palm Platform"></a>
</p>

<p align="center">
  中文 | <a href="README_en.md">English</a>
</p>

---

## 📖 简介

**Palm Applications** 是一个刷掌应用合集仓库，汇集了多个基于手掌识别与体感交互技术的开源项目。这些项目均推荐搭配[腾讯刷掌开放平台](https://palm.tencent.com)使用，展示了刷掌注册、刷掌登录、活体防作弊检测等能力在不同场景下的应用。

---

## 🎮 包含项目

### 🧹 [GlassWiper — 体感擦玻璃小游戏](./glasswiper/)

**GlassWiper** 是一个开源的 Web 体感交互游戏，通过实时手部关键点检测，结合 HTML5 Canvas 多层渲染技术实现逼真的玻璃擦除效果。玩家通过摄像头用真实手势操控游戏，无需任何外设，张开手掌即可开始擦玻璃。

| 特性 | 说明 |
|:---|:---|
| 🖐️ 手势控制 | 基于手部关键点检测，张开手掌擦玻璃、握拳停止 |
| 🎯 多关卡 | 普通关卡 + Boss 战，难度递增 |
| 🏆 排行榜 | 支持刷掌验证身份后绑定成绩 |
| 🌐 纯浏览器 | 无需安装，打开即玩 |
| 🔧 技术栈 | JavaScript + HTML5 Canvas + MediaPipe |

👉 [查看完整文档](./glasswiper/README.md)

---

### 🔮 [PalmDestiny — 掌纹天机 · AI 掌纹算命](./celina-PalmDestiny/)

**PalmDestiny（掌纹天机）** 是一个开源的 AI 掌纹算命 Web 应用，通过摄像头拍摄手掌照片，结合大语言模型（LLM）生成趣味性的掌纹分析报告，包括生命线、智慧线、感情线解读，以及八字、星座、生肖运势等综合分析。

| 特性 | 说明 |
|:---|:---|
| 🖐️ AI 看手相 | 基于大语言模型的掌纹图像分析 |
| 🎯 多维运势 | 八字、星座、生肖综合分析 |
| 📸 实时拍摄 | 浏览器摄像头直接拍摄手掌 |
| 🔐 刷掌登录 | 可选接入刷掌平台进行身份验证 |
| 🔧 技术栈 | Python + FastAPI + LLM |

👉 [查看完整文档](./celina-PalmDestiny/README.md)

---

### 🏎️ [Palm Racer — 掌上赛车](./palm-racer/)

**Palm Racer（掌上赛车）** 是一个开源的 3D 体感赛车游戏，通过手掌姿态追踪实现纯手势控制——无需手柄或键盘。支持刷掌注册、刷掌登录和活体防作弊检测。

| 特性 | 说明 |
|:---|:---|
| 🖐️ 体感操控 | 手掌姿态追踪，手势控制转向/加速/刹车 |
| 🏎️ 3D 引擎 | Babylon.js 驱动的 3D 赛道和车辆物理 |
| 📱 跨平台 | Web 浏览器 + Android |
| 🔐 防作弊 | 刷掌登录 + 活体检测，确保游戏公平 |
| 🔧 技术栈 | Vue 3 + TypeScript + Babylon.js + Go |

👉 [查看完整文档](./palm-racer/README.md)

---

## 🔐 腾讯刷掌开放平台

所有项目均推荐搭配[腾讯刷掌开放平台](https://palm.tencent.com)使用，集成以下核心能力：

- **刷掌注册** — 用户通过摄像头采集掌纹，完成掌纹特征注册
- **刷掌登录** — 无需密码，刷掌即可完成身份认证
- **活体防作弊** — 基于活体检测，防止照片/视频/模型等攻击

> 你也可以接入自己的刷掌识别服务，只需实现相同的接口协议即可。

---

## 📂 项目结构

```
palm-applications/
├── glasswiper/              # 🧹 体感擦玻璃小游戏（JavaScript + Canvas）
├── celina-PalmDestiny/      # 🔮 AI 掌纹算命（Python + FastAPI）
├── palm-racer/              # 🏎️ 3D 体感赛车（Vue 3 + Go）
├── LICENSE                  # Apache 2.0 许可证
├── THIRD_PARTY_NOTICES.md   # 第三方依赖声明
├── CONTRIBUTING.md          # 贡献指南
├── README.md                # 中文文档
└── README_en.md             # English documentation
```

---

## 🚀 快速开始

每个子项目都可以独立运行，请参考各自的 README 文档：

1. **GlassWiper**: 纯前端项目，启动本地 HTTP 服务器即可运行 → [文档](./glasswiper/README.md)
2. **PalmDestiny**: Python 后端 + Web 前端 → [文档](./celina-PalmDestiny/README.md)
3. **Palm Racer**: Go 后端 + Vue 前端 + 可选 Android 客户端 → [文档](./palm-racer/README.md)

---

## 🔒 隐私声明

我们高度重视用户隐私和数据安全：

- **本地处理优先** — 手势追踪和手部关键点检测均在用户设备本地运行，摄像头画面不会上传至任何服务器
- **掌纹数据安全** — 如接入腾讯刷掌开放平台，掌纹特征数据由平台加密存储和管理，遵循腾讯云数据安全规范
- **不收集个人信息** — 各应用不会主动收集、存储或分享用户的个人身份信息
- **用户知情同意** — 涉及摄像头调用、掌纹注册等操作时，均需用户明确授权
- **数据最小化** — 仅采集实现功能所必需的最少数据，不做额外留存

> 各子项目可能有更详细的隐私说明，请参考各自的 README 文档。

---

## 📄 License

本项目基于 [Apache License 2.0](LICENSE) 开源。

---

<p align="center">
  如果这些项目对你有帮助，请给一个 ⭐ Star！<br/>
  If you find these projects useful, please give them a ⭐ Star!
</p>