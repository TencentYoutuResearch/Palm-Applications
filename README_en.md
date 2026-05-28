# 🖐️ Palm Applications — Palm Recognition App Collection

<p align="center">
  <strong>Open-source palm recognition & gesture interaction applications</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0"></a>
  <a href="https://palm.tencent.com"><img src="https://img.shields.io/badge/Tencent%20Palm%20Platform-Recommended-orange" alt="Tencent Palm Platform"></a>
</p>

<p align="center">
  <a href="README.md">中文</a> | English
</p>

---

## 📖 Introduction

**Palm Applications** is a collection of open-source projects built on palm recognition and gesture interaction technologies. All projects are recommended to integrate with the [Tencent Palm Recognition Open Platform](https://palm.tencent.com), demonstrating capabilities such as palm registration, palm login, and liveness-based anti-cheat detection across various scenarios.

---

## 🎮 Included Projects

### 🧹 [GlassWiper — Gesture-controlled Glass Wiping Game](./glasswiper/)

**GlassWiper** is an open-source web-based gesture interaction game that uses real-time hand keypoint detection combined with HTML5 Canvas multi-layer rendering to achieve realistic glass-wiping effects. Players control the game through a webcam using real hand gestures — no peripherals needed, just open your palm to start wiping.

| Feature | Description |
|:---|:---|
| 🖐️ Gesture Control | Hand keypoint detection — open palm to wipe, close fist to stop |
| 🎯 Multiple Levels | Normal levels + Boss battles with increasing difficulty |
| 🏆 Leaderboard | Bind scores after palm verification |
| 🌐 Browser-based | No installation required, play instantly |
| 🔧 Tech Stack | JavaScript + HTML5 Canvas + MediaPipe |

👉 [Full Documentation](./glasswiper/README.md)

---

### 🔮 [PalmDestiny — AI Palm Reading](./celina-PalmDestiny/)

**PalmDestiny** is an open-source AI palm reading web application that captures palm photos via webcam and uses Large Language Models (LLM) to generate entertaining palm analysis reports, including life line, head line, and heart line interpretations, as well as comprehensive fortune analysis.

| Feature | Description |
|:---|:---|
| 🖐️ AI Palm Reading | LLM-based palm image analysis |
| 🎯 Multi-dimensional | Comprehensive fortune analysis from multiple perspectives |
| 📸 Live Capture | Capture palm photos directly from browser webcam |
| 🔐 Palm Login | Optional palm platform integration for identity verification |
| 🔧 Tech Stack | Python + FastAPI + LLM |

👉 [Full Documentation](./celina-PalmDestiny/README.md)

---

### 🏎️ [Palm Racer — Gesture-controlled Racing Game](./palm-racer/)

**Palm Racer** is an open-source 3D gesture-controlled racing game that uses palm posture tracking for pure hand gesture control — no gamepad or keyboard needed. Supports palm registration, palm login, and liveness-based anti-cheat detection.

| Feature | Description |
|:---|:---|
| 🖐️ Gesture Control | Palm posture tracking for steering/acceleration/braking |
| 🏎️ 3D Engine | Babylon.js-powered 3D tracks and vehicle physics |
| 📱 Cross-platform | Web browser + Android |
| 🔐 Anti-cheat | Palm login + liveness detection for fair gameplay |
| 🔧 Tech Stack | Vue 3 + TypeScript + Babylon.js + Go |

👉 [Full Documentation](./palm-racer/README.md)

---

## 🔐 Tencent Palm Recognition Open Platform

All projects are recommended to integrate with the [Tencent Palm Recognition Open Platform](https://palm.tencent.com), which provides the following core capabilities:

- **Palm Registration** — Users capture their palm print via webcam to register palm features
- **Palm Login** — Password-free authentication via palm recognition
- **Liveness Anti-cheat** — Liveness detection to prevent photo/video/model-based attacks

> You can also integrate your own palm recognition service by implementing the same interface protocol.

---

## 📂 Project Structure

```
palm-applications/
├── glasswiper/          # 🧹 Gesture glass-wiping game (JavaScript + Canvas)
├── celina-PalmDestiny/  # 🔮 AI palm reading (Python + FastAPI)
├── palm-racer/          # 🏎️ 3D gesture racing (Vue 3 + Go)
├── LICENSE              # Apache 2.0 License
├── THIRD_PARTY_NOTICES.md  # Third-party notices
├── CONTRIBUTING.md      # Contribution guidelines
└── README.md            # Documentation
```

---

## 🚀 Quick Start

Each sub-project can run independently. Please refer to their respective README files:

1. **GlassWiper**: Pure frontend project, just start a local HTTP server → [Docs](./glasswiper/README.md)
2. **PalmDestiny**: Python backend + Web frontend → [Docs](./celina-PalmDestiny/README.md)
3. **Palm Racer**: Go backend + Vue frontend + optional Android client → [Docs](./palm-racer/README.md)

---

## 🔒 Privacy Statement

We take user privacy and data security very seriously:

- **Local Processing First** — Gesture tracking and hand keypoint detection run locally on the user's device; webcam footage is never uploaded to any server
- **Palm Data Security** — When integrated with the Tencent Palm Recognition Open Platform, palm feature data is encrypted and managed by the platform in compliance with Tencent Cloud data security standards
- **No Personal Data Collection** — Applications do not actively collect, store, or share users' personal identity information
- **Informed Consent** — Operations involving webcam access or palm registration require explicit user authorization
- **Data Minimization** — Only the minimum data necessary for functionality is collected, with no additional retention

> Individual sub-projects may have more detailed privacy statements. Please refer to their respective README files.

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  If you find these projects useful, please give them a ⭐ Star!
</p>
