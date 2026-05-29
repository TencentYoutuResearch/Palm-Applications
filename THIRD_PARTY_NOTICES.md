# Third-Party Notices

This project (Palm Applications) is a collection of open-source palm recognition and gesture interaction applications. Each sub-project uses various third-party open-source software and assets. This file provides a consolidated overview of third-party dependencies across all sub-projects.

For detailed third-party notices specific to each sub-project, please refer to:
- [GlassWiper Third-Party Notices](./glasswiper/THIRD_PARTY_NOTICES.md)
- [Palm Racer Third-Party Notices](./palm-racer/THIRD_PARTY_NOTICES)

---

## 一、Open-Source Software Dependencies

### 1. MediaPipe Hands / Camera Utils / Drawing Utils

- **Used by**: GlassWiper, Palm Racer
- **Purpose**: Real-time hand keypoint detection (21 landmarks) for gesture recognition
- **Project**: https://github.com/google/mediapipe
- **License**: Apache License 2.0
- **Copyright**: Copyright © Google LLC

### 2. Babylon.js

- **Used by**: Palm Racer
- **Purpose**: 3D rendering engine for racing game visuals and vehicle physics
- **Project**: https://github.com/BabylonJS/Babylon.js
- **License**: Apache License 2.0
- **Copyright**: Copyright © Microsoft Corporation

### 3. Vue.js 3

- **Used by**: Palm Racer
- **Purpose**: Frontend framework for web application UI
- **Project**: https://github.com/vuejs/core
- **License**: MIT License
- **Copyright**: Copyright © Evan You

### 4. FastAPI

- **Used by**: PalmDestiny
- **Purpose**: Python web framework for backend API services
- **Project**: https://github.com/tiangolo/fastapi
- **License**: MIT License
- **Copyright**: Copyright © Sebastián Ramírez

### 5. Noto Sans SC

- **Used by**: GlassWiper
- **Purpose**: Chinese font for game interface
- **Project**: https://fonts.google.com/noto/specimen/Noto+Sans+SC
- **License**: SIL Open Font License 1.1
- **Copyright**: Copyright © Google LLC / Adobe Systems Incorporated

---

## 二、3D Models & Assets

### Ferrari LaFerrari (3D Model)

- **Used by**: Palm Racer
- **Author**: wwwvecarzcom
- **Source**: https://sketchfab.com/3d-models/ferrari-laferrari-wwwvecarzcom-979f7085012e4d6399f38de3f9c39012
- **License**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Modifications**: Converted to GLB format for WebGL rendering

---

## 三、AI-Generated Assets

### GlassWiper Level Images

- **Used by**: GlassWiper
- **Generation Tool**: Nano Banana (Google Gemini 2.5 Flash Image)
- **Provider**: Google DeepMind
- **Details**: https://deepmind.google/technologies/gemini/
- **Note**: Generated images contain SynthID invisible digital watermarks identifying AI-generated origin
- **Usage**: Per Google Gemini API Terms of Service, users have usage rights for generated content, including personal and commercial use

---

## 四、License Full Texts

### Apache License 2.0 (MediaPipe, Babylon.js)

Full text: https://www.apache.org/licenses/LICENSE-2.0

### MIT License (Vue.js, FastAPI)

Full text: https://opensource.org/licenses/MIT

### SIL Open Font License 1.1 (Noto Sans SC)

Full text: https://scripts.sil.org/OFL

### CC BY 4.0 (3D Models)

Full text: https://creativecommons.org/licenses/by/4.0/legalcode

---

## 五、Contact

If you believe this project uses unauthorized materials, or have questions about the use of third-party resources, please contact us via Issue or Pull Request and we will address it promptly.
