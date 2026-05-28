# Contributing to Palm Applications

感谢你对 Palm Applications 项目的关注！本指南将帮助你快速上手参与贡献。

Thank you for your interest in contributing to Palm Applications! This guide will help you get started.

---

## 目录 / Table of Contents

- [行为准则 / Code of Conduct](#行为准则--code-of-conduct)
- [开发环境 / Development Environment](#开发环境--development-environment)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [如何贡献 / How to Contribute](#如何贡献--how-to-contribute)
- [代码风格 / Code Style](#代码风格--code-style)
- [提交规范 / Commit Convention](#提交规范--commit-convention)
- [分支策略 / Branch Strategy](#分支策略--branch-strategy)
- [Pull Request 指南](#pull-request-指南)
- [报告问题 / Reporting Issues](#报告问题--reporting-issues)
- [许可证 / License](#许可证--license)

---

## 行为准则 / Code of Conduct

请在参与本项目时保持友善和尊重。我们致力于为每个人提供一个开放、包容的社区环境。

Please be kind and respectful when participating in this project. We are committed to providing an open and inclusive community for everyone.

---

## 开发环境 / Development Environment

由于本仓库包含多个子项目，不同项目有不同的技术栈要求：

### GlassWiper（体感擦玻璃）

| 工具 | 版本 | 用途 |
|------|------|------|
| 任意 HTTP 服务器 | - | 本地开发服务 |
| 现代浏览器 | Chrome/Edge/Firefox 最新版 | 运行和调试 |

```bash
cd glasswiper
# 使用任意 HTTP 服务器，例如：
python3 -m http.server 8080
# 或
npx serve .
```

### PalmDestiny（AI 掌纹算命）

| 工具 | 版本 | 用途 |
|------|------|------|
| Python | >= 3.9 | 后端运行 |
| pip | 最新版 | 包管理 |

```bash
cd celina-PalmDestiny
pip install -r requirements.txt
python main.py
```

### Palm Racer（体感赛车）

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 18 | 前端构建 |
| npm | >= 9 | 前端包管理 |
| Go | >= 1.25 | 后端编译 |
| Docker | >= 20.10 | 容器化部署（可选） |

```bash
# 前端
cd palm-racer/web
npm install
npm run dev

# 后端
cd palm-racer/server
make
go run ./cmd/palm-racer/
```

---

## 项目结构 / Project Structure

```
palm-applications/
├── glasswiper/              # 🧹 体感擦玻璃（JavaScript + Canvas + MediaPipe）
├── celina-PalmDestiny/      # 🔮 AI 掌纹算命（Python + FastAPI + LLM）
├── palm-racer/              # 🏎️ 3D 体感赛车（Vue 3 + TypeScript + Babylon.js + Go）
├── LICENSE                  # Apache 2.0 许可证
├── THIRD_PARTY_NOTICES.md   # 第三方依赖声明
├── CONTRIBUTING.md          # 贡献指南（本文件）
├── README.md                # 中文文档
└── README_en.md             # English documentation
```

---

## 如何贡献 / How to Contribute

### 贡献方式

1. **报告 Bug** — 发现问题？请提交 Issue
2. **功能建议** — 有好的想法？欢迎提出 Feature Request
3. **代码贡献** — 修复 Bug 或实现新功能，提交 Pull Request
4. **文档改进** — 修正错别字、补充说明、翻译文档
5. **新项目** — 如果你有基于刷掌技术的新应用，欢迎提议加入合集

### 贡献流程

1. **Fork** 本仓库
2. **Clone** 你的 Fork 到本地
3. 创建新分支：`git checkout -b feat/your-feature`
4. 进行修改并测试
5. 提交代码（遵循提交规范）
6. 推送到你的 Fork：`git push origin feat/your-feature`
7. 创建 **Pull Request**

---

## 代码风格 / Code Style

### JavaScript（GlassWiper）

- 使用 ES6+ 语法
- 缩进：2 空格
- 使用 `const` / `let`，避免 `var`
- 函数和变量使用 camelCase 命名

### Python（PalmDestiny）

- 遵循 PEP 8 规范
- 缩进：4 空格
- 使用 type hints
- 函数和变量使用 snake_case 命名

### TypeScript / Vue（Palm Racer 前端）

- 遵循项目 ESLint + Prettier 配置
- 使用 Composition API（`<script setup>`）
- 组件文件使用 PascalCase 命名

### Go（Palm Racer 后端）

- 遵循 `gofmt` + `go vet` 标准
- 使用 `golangci-lint` 进行静态分析
- 导出函数必须有注释

---

## 提交规范 / Commit Convention

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 格式

```
<type>(<scope>): <subject>
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响逻辑） |
| `refactor` | 重构（非新功能、非修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |

### Scope 范围

常用范围：`glasswiper`、`palmdestiny`、`palm-racer`、`docs`

### 示例

```bash
feat(glasswiper): add new boss level with time challenge
fix(palm-racer): correct hand detection on mobile browsers
docs: update installation guide for PalmDestiny
chore: update THIRD_PARTY_NOTICES
```

---

## 分支策略 / Branch Strategy

| 分支 | 用途 |
|------|------|
| `main` | 稳定版本，保持可用状态 |
| `feat/xxx` | 新功能开发 |
| `fix/xxx` | Bug 修复 |
| `docs/xxx` | 文档更新 |

1. 从 `main` 创建功能分支
2. 开发完成后提交 Pull Request
3. 通过 CI 检查和代码审查后合并

---

## Pull Request 指南

### PR 要求

- **标题简洁**（< 70 字符），描述变更意图
- **正文说明**：改了什么、为什么改、如何测试
- **关联 Issue**（如有）：`Fixes #123` 或 `Closes #456`
- **保持小而专注**：每个 PR 只做一件事
- **确保测试通过**：提交前在本地验证

### PR 模板

```markdown
## 变更说明
简要描述本次变更的内容和目的。

## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 重构
- [ ] 其他

## 影响的子项目
- [ ] GlassWiper
- [ ] PalmDestiny
- [ ] Palm Racer
- [ ] 根目录文件

## 测试方式
描述如何验证本次变更。

## 截图（如适用）
```

---

## 报告问题 / Reporting Issues

提交 Issue 时，请包含以下信息：

1. **问题描述** — 清晰描述遇到的问题
2. **复现步骤** — 如何重现该问题
3. **期望行为** — 你期望发生什么
4. **实际行为** — 实际发生了什么
5. **环境信息** — 浏览器 / 操作系统 / 设备 / 摄像头型号
6. **截图或日志** — 如有，请附上

### Issue 标签

| 标签 | 说明 |
|------|------|
| `bug` | 确认的 Bug |
| `enhancement` | 功能增强 |
| `question` | 使用疑问 |
| `glasswiper` | GlassWiper 相关 |
| `palmdestiny` | PalmDestiny 相关 |
| `palm-racer` | Palm Racer 相关 |

---

## 许可证 / License

本项目基于 [Apache License 2.0](LICENSE) 开源。你提交的贡献将自动适用相同的许可证。

This project is licensed under the [Apache License 2.0](LICENSE). Your contributions will be under the same license.

---

<p align="center">
  感谢所有贡献者的付出 ❤️<br/>
  Thanks to all contributors ❤️
</p>
