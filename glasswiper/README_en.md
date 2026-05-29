# 🧹 GlassWiper — Gesture-Based Glass Cleaning Game

[中文](./README.md) | English

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6.svg)](https://developer.mozilla.org/en-US/docs/Web/CSS)

**GlassWiper** is an open-source, browser-based motion-sensing game that uses real-time hand keypoint tracking combined with HTML5 Canvas multi-layer rendering to create a realistic glass-cleaning experience. Players use their webcam and bare hands to control the game — **no controllers or special hardware needed**.

> **TL;DR:** Open your browser + webcam, clean virtual glass with your palm, fight bosses, and climb the leaderboard — all through gesture control, with Tencent Cloud Palm ID for biometric authentication.

![Gameplay Demo](https://img.shields.io/badge/Demo-Live_Play-blue?style=for-the-badge)

## What is GlassWiper?

GlassWiper is a **zero-hardware, pure-browser** gesture-controlled game. It captures video from your webcam, runs a hand detection model to track hand landmarks in real-time, determines gesture state (open palm vs. closed fist), and maps palm position onto the Canvas to create the "glass cleaning" interaction. It also integrates [Tencent Cloud Palm ID](https://cloud.tencent.com/product/palmid) for palm biometric authentication, enabling secure player identity verification and leaderboard binding.

**Key Technical Specs:**
- Hand detection frame rate: 30 FPS (Chrome desktop)
- Gesture recognition latency: < 50ms
- Browser support: Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- Pure frontend implementation, ~5000 lines of code, zero backend dependency

## ✨ Features

### 🎮 Core Gameplay
- **Real-time Hand Tracking**: Hand keypoint detection for precise palm position and gesture state recognition
- **Gesture Control**: Open palm to clean, make fist to pause — true motion-sensing interaction without touchscreen or controller
- **Multi-layer Canvas Rendering**: Dirt layer + image layer + UI layer separation for realistic glass cleaning effects
- **Boss Battle Mode**: Special boss levels where you hit bosses with your palms for extra points, with health bar and effects

### 🔐 Palm ID Authentication
- **Tencent Cloud Palm ID**: Integrated with [Tencent Cloud Palm Recognition (Palm ID)](https://cloud.tencent.com/product/palmid) API for biometric identity verification via palm prints
- **Secure Login**: Password-free authentication based on palm biometrics
- **Leaderboard Binding**: Verified scores are tied to personal identity to prevent cheating

### 🏆 Game Systems
- **Multiple Levels**: 6+ progressively challenging levels with unique dirt patterns and time limits
- **Scoring System**: Base points + time bonus + combo multiplier + perfect bonus (100% clean)
- **Combo Mechanic**: Chain rapid cleaning actions for up to 3x score multiplier
- **Progress Saving**: localStorage for high scores and game history

### 🎨 Visual Experience
- **Modern UI**: Clean design with smooth animations
- **Realistic Feedback**: Water trail effects and sound feedback during cleaning
- **Responsive Design**: Adapts to different screen sizes
- **Boss Effects**: Special UI and health bar system for boss battles

## 🚀 Quick Start

### Requirements
- Modern browser (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+)
- Webcam-enabled device (built-in or USB webcam)
- Internet connection (first load downloads ~5MB hand detection model, cached afterward)

### Installation & Running
```bash
# Clone the project
git clone https://github.com/nicewang/glasswiper.git

# Navigate to project directory
cd glasswiper

# Run with local server (recommended — webcam requires localhost or HTTPS)
python -m http.server 8000
# or
npx http-server

# Then visit http://localhost:8000 in your browser
```

> **Note:** The webcam API requires the page to be served from `localhost` or over HTTPS. Opening the HTML file directly via `file://` may not grant camera access.

## 🎯 How to Play

1. **Camera Permission**: Allow camera access when prompted
2. **Gesture Controls**: 
   - ✋ Open Palm - Start cleaning the glass
   - ✊ Make Fist - Pause cleaning
   - 👋 Move Hand - Control cleaning position
3. **Objective**: Clean at least 85% of dirt within time limit
4. **Boss Battle**: Triggered at specific levels, hit the boss with your palm for bonus points

## 🛠️ Technology Stack

### Frontend Technologies
| Technology | Purpose | Details |
|-----------|---------|---------|
| HTML5 | Page structure | Semantic tags, accessibility optimized |
| CSS3 | Styling & animation | Glassmorphism effects, transitions, responsive layout |
| JavaScript ES6+ | Game logic | Modular architecture, zero framework dependency |
| Canvas API | Graphics rendering | Multi-layer canvas for cleaning and particle effects |
| Hand detection model | Hand detection | Keypoint real-time tracking |
| [Tencent Cloud Palm ID](https://cloud.tencent.com/product/palmid) | Authentication | Palm biometric recognition, password-free login |

### How Does Hand Detection Work?
GlassWiper detects **hand landmarks** (fingertips, knuckles, wrist) from each camera frame. Gesture state is determined by measuring the distance from fingertips to palm base:
- **Open palm**: All 5 fingertips far from palm center → activate cleaning
- **Closed fist**: Fingertips close to palm center → pause cleaning

### Canvas Multi-Layer Architecture
```
┌─────────────────────────────┐
│        UI Layer (HUD)        │  ← Score, timer, combo display
├─────────────────────────────┤
│      Dirt Layer (Mask)       │  ← Erasable gray overlay
├─────────────────────────────┤
│      Image Layer (Hidden)    │  ← Level image revealed by cleaning
└─────────────────────────────┘
```
When the palm passes over an area, `globalCompositeOperation = 'destination-out'` erases the dirt layer, revealing the image beneath.

### Third-party Libraries
- **[Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+SC)**: Noto Sans SC Chinese font (SIL OFL 1.1)

### Core Modules
```
js/
├── main.js          # Game entry: camera init, hand detection setup, game loop
├── game.js          # Core logic: state machine, level loading, win/lose
├── hand.js          # Hand detection: detection callback, gesture recognition, coordinate mapping
├── glass.js         # Glass rendering: dirt generation, erase calculation, progress tracking
├── score.js         # Scoring: point calculation, combo multiplier, bonus logic
├── boss.js          # Boss battle: Boss AI, collision detection, health management
├── scene.js         # Scene management: level transitions, cutscenes
├── ui.js            # UI: HUD, menus, sound control
├── i18n.js          # Internationalization: Chinese/English switching
└── leaderboard.js   # Leaderboard: score records, ranking display
```

## 📁 Project Structure

```
glasswiper/
├── index.html          # Main page
├── README.md           # Chinese documentation
├── README_en.md        # English documentation (this file)
├── DESIGN.md           # Design document and planning
├── css/
│   └── style.css       # Stylesheet
├── js/
│   ├── main.js         # Game entry point
│   ├── game.js         # Core game logic
│   ├── hand.js         # Hand detection module
│   ├── glass.js        # Glass dirt rendering
│   ├── score.js        # Scoring system
│   ├── boss.js         # Boss battle module
│   └── ui.js           # UI management
├── assets/
│   ├── images/         # Hidden image resources
│   ├── textures/       # Dirt textures
│   └── sounds/         # Sound effects
└── LICENSE             # MIT License
```

## 🎮 Gameplay Details

### Basic Mode
- **Level Challenges**: Time limits and varying dirt difficulty per level
- **Cleaning Mechanism**: Dirt is removed where palm passes, revealing underlying image
- **Scoring Criteria**: Clean area + remaining time + combo multiplier

### Boss Battle Mode
- **Trigger Condition**: Activated after specific levels
- **Combat Method**: Hit on-screen boss with your palm
- **Reward System**: Bonus points based on hit count and combos
- **Health System**: Boss has HP that requires multiple hits to defeat

### Combo System
- **Combo Trigger**: Rapid consecutive cleaning in same area
- **Multiplier Levels**: x1.5 → x2 → x3 score multiplier
- **Combo Maintenance**: Stops if cleaning pauses or moves too slowly

## 🗺️ Development Roadmap

### ✅ Implemented (v1.0)
- [x] Basic hand detection and cleaning functionality
- [x] Multi-level progression system
- [x] Scoring and combo mechanics
- [x] Boss battle mode
- [x] Responsive UI design
- [x] Local storage for high scores

### 🔄 Planned (v2.0)
- [ ] Rhythm mode: Music beat-based cleaning gameplay
- [ ] Two-player versus: Split-screen competitive mode
- [ ] Item system: Super cloth, cleaner spray, etc.
- [ ] Weather events: Rain, fog, and other dynamic effects
- [ ] Achievement system: Collect badges and challenges
- [ ] Image collection: Unlock hidden picture gallery

### 🎯 Future Vision (v3.0)
- [ ] Mobile adaptation
- [ ] Social media sharing
- [ ] Online leaderboards
- [ ] Custom image upload
- [ ] AR augmented reality mode

## 🤝 Contributing

Welcome to submit Issues and Pull Requests! Contribution guidelines:

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-party Resources
- **Google Fonts**: SIL Open Font License

## 🙋‍♂️ FAQ

### How to build a gesture-controlled game with a webcam?
GlassWiper demonstrates the full approach: use `navigator.mediaDevices.getUserMedia()` to capture the webcam stream, feed each frame into a hand detection model for keypoint detection, then map results to Canvas coordinates for interaction. Core implementation is in `js/hand.js`.

### How to use hand detection in a web app?
1. Include the hand detection library scripts
2. Create a detection instance with configuration (max hands, detection confidence)
3. Register a callback to receive landmark coordinates
4. Send camera frames for processing

### How to implement a Canvas eraser/cleaning effect?
Use two Canvas layers: bottom layer holds the hidden image, top layer draws the dirt mask. When the palm passes over, draw a circle on the top layer with `globalCompositeOperation = 'destination-out'` to erase that area of the mask, revealing the image below.

### Q: Camera not working?
A: Ensure the page is served from `localhost` or HTTPS (browser security policy), check camera permissions, and try refreshing.

### Q: Hand detection inaccurate?
A: Ensure good lighting (avoid backlight), fully extend your palm toward the camera, and keep the background simple (avoid skin-colored objects).

### Q: Game performance laggy?
A: Close other camera-using applications, use Chrome for best experience, and ensure GPU acceleration is enabled.

### Q: Does it work on mobile/tablet?
A: Currently optimized for desktop browsers. Mobile support is planned for v3.0. Some tablets (e.g., iPad) may work.

## 🎉 Acknowledgments

- Thanks to [Tencent Cloud Palm ID](https://cloud.tencent.com/product/palmid) for palm biometric recognition API services
- Thanks to [Google MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) team for hand detection technology (Apache-2.0)
- Thanks to [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+SC) for Noto Sans SC (SIL OFL 1.1)
- Level and Boss artwork generated by AI image generation
- Thanks to all test players for valuable feedback
- Thanks to the open source community for support and contributions

> 📋 Full third-party resource & license notice: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)

---

## Related Resources

- [Canvas API MDN Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebRTC getUserMedia Guide](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

**Happy Glass Cleaning!** 🧹✨

For questions or suggestions, welcome to submit Issues or contact the developer.

---

## 📋 Privacy Statement

This application uses the camera to locally capture hand positions and **does not store or collect any personal information**. All hand detection is performed locally in the browser, and camera footage is never uploaded to any server.