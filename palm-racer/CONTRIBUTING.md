# Contributing to Palm Racer

Thank you for your interest in contributing to Palm Racer! This guide will help you get started.

---

## Table of Contents

- [Development Environment](#development-environment)
- [Code Formatting Tools](#code-formatting-tools)
- [Code Style](#code-style)
- [Testing Guide](#testing-guide)
- [Commit Message Convention](#commit-message-convention)
- [Branch Strategy](#branch-strategy)
- [Pull Request Guide](#pull-request-guide)
- [Project Structure](#project-structure)
- [Reporting Issues](#reporting-issues)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Development Environment

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | Frontend build |
| npm | >= 9 | Frontend package management |
| Go | >= 1.25 | Backend compilation |
| Make | any | Build automation |
| protoc | >= 3.21 | Protocol Buffers compilation (only when modifying proto files) |
| Docker | >= 20.10 | Containerized deployment (optional) |

### Installing Prerequisites

<details>
<summary><b>macOS</b></summary>

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 go make protobuf
```

</details>

<details>
<summary><b>Ubuntu / Debian</b></summary>

```bash
# Node.js 18 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Go (download latest)
wget https://go.dev/dl/go1.25.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc

# protoc
sudo apt-get install -y protobuf-compiler make
```

</details>

<details>
<summary><b>Windows</b></summary>

```powershell
# Using winget or scoop
winget install OpenJS.NodeJS.LTS
winget install GoLang.Go

# protoc: download from https://github.com/protocolbuffers/protobuf/releases
# Make: install Git Bash or choco install make
```

</details>

### Quick Start (Makefile)

The root `Makefile` provides unified commands for all common tasks:

```bash
make help          # Show all available commands
make dev-web       # Start Web dev server
make dev-server    # Start backend service
make build         # Build everything (Web + Server)
make test          # Run all tests
make docker-up     # Start with docker compose
```

### Frontend Development

```bash
cd web
npm install
npm run dev          # Start dev server at http://localhost:5173
npm run test:run     # Run tests
npm run build        # Production build
```

### Backend Development

```bash
cd server
cp .env.example .env         # Copy env template and fill in values (never commit real credentials)
set -a && . ./.env && set +a # Load into current shell
make                         # Build
make test                    # Run tests
make vet                     # Static analysis
go run ./cmd/palm-racer/
```

> **Config priority**: Environment variables > `conf/palm-racer.yaml`. Secret fields in the yaml are placeholders only — inject real values via environment variables.
> The local `.env` file is git-ignored. **Do not** commit it.

### Docker Deployment

```bash
# At project root
docker compose up -d                    # Full environment (server + mysql)

# Or standalone
docker build -t palm-racer .
docker run -d -p 9090:9090 \
  -e PALM_SECRET_ID=xxx \
  -e PALM_SECRET_KEY=yyy \
  palm-racer
```

---

## Code Formatting Tools

Maintaining consistent code style is the foundation of collaborative development. Please run the following formatters before committing.

### Go Backend

```bash
cd server

# Auto-format code
gofmt -w .
goimports -w .

# Static analysis
golangci-lint run ./...

# Shortcuts via Makefile
make fmt           # gofmt + goimports
make vet           # go vet
make lint          # golangci-lint (must be installed)
make test          # Run all tests
```

**Installing golangci-lint**:

```bash
# macOS / Linux
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin

# Or via Go
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

### Frontend (TypeScript / Vue)

```bash
cd web

# ESLint check
npm run lint              # Check code style
npm run lint -- --fix     # Auto-fix

# Prettier format
npm run format            # Format all files
npm run format:check      # Check only (no modifications)
```

### Editor Integration

The project root includes `.editorconfig`, which is automatically applied by most editors (VS Code, WebStorm, Vim, etc.) for consistent indentation, line endings, and encoding.

**Recommended VS Code Extensions**:
- [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Go](https://marketplace.visualstudio.com/items?itemName=golang.Go) (integrates gofmt/goimports)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (Vue 3 support)

---

## Code Style

- **Go**: Follow `gofmt` + `go vet` + `golangci-lint` (see `server/.golangci.yml`)
- **TypeScript/Vue**: Use project ESLint + Prettier config
- **Protobuf**: snake_case naming, fields numbered sequentially from 1
- **CSS**: Use BEM naming convention or scoped styles

---

## Testing Guide

### Go Backend Tests

We recommend **table-driven tests** for Go:

```go
func TestCalculateScore(t *testing.T) {
    tests := []struct {
        name     string
        input    int
        expected int
    }{
        {"zero input", 0, 0},
        {"normal input", 100, 150},
        {"max input", 9999, 14998},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CalculateScore(tt.input)
            if got != tt.expected {
                t.Errorf("CalculateScore(%d) = %d, want %d", tt.input, got, tt.expected)
            }
        })
    }
}
```

**Running tests**:

```bash
cd server
make test                    # Run all tests
go test ./pkg/... -v         # Run specific package tests (verbose)
go test ./pkg/game/... -run TestCalculateScore  # Run a single test
go test ./... -cover         # Check test coverage
```

### Frontend Tests

Frontend uses [Vitest](https://vitest.dev/) as the test framework:

```typescript
import { describe, it, expect } from 'vitest'
import { formatTime } from '@/utils/format'

describe('formatTime', () => {
  it('should format seconds to mm:ss', () => {
    expect(formatTime(90)).toBe('01:30')
  })

  it('should handle zero', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('should handle large values', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})
```

**Running tests**:

```bash
cd web
npm run test:run              # Run all tests (single run)
npm run test                  # Watch mode (for development)
npm run test:run -- --coverage  # Check coverage
```

### Testing Principles

1. **Every new feature should have corresponding tests**
2. **Write a failing test first** when fixing a bug, then fix the code
3. **Clear test naming**: Describe the input conditions and expected results
4. **Keep tests independent**: Tests should not depend on each other

---

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code formatting (no logic changes) |
| `refactor` | Refactoring (neither new feature nor bug fix) |
| `perf` | Performance improvement |
| `test` | Test related |
| `chore` | Build/tools/dependency changes |
| `ci` | CI/CD configuration changes |

### Scope (optional)

Common scopes: `web`, `server`, `android`, `deploy`, `docs`, `proto`

### Examples

```bash
# New feature
feat(web): add leaderboard pagination
feat(server): implement leaderboard pagination endpoint

# Bug fix
fix(web): correct hand detection sensitivity on mobile
fix(server): handle nil pointer in score submission

# Documentation
docs: update deployment guide for Docker Compose v2

# Refactoring
refactor(web): extract game engine input handling into composable

# Breaking change (mark in footer)
feat(server)!: change score API response format

BREAKING CHANGE: score field renamed from `total_score` to `score`.
```

---

## Branch Strategy

1. Create feature branches from `main`: `feat/xxx` or `fix/xxx`
2. Submit a Pull Request when development is complete
3. Ensure CI checks pass (build, test, lint)
4. Merge after at least one reviewer approves

---

## Pull Request Guide

- PR title should be concise (< 70 characters), describing the intent
- Body should explain: what changed, why it changed, how to test
- Link related Issues (if any): `Fixes #123` or `Closes #456`
- Keep PRs small and single-purpose
- Ensure all tests pass before requesting review

---

## Project Structure

```
palm-racer/
├── web/                # Vue 3 + Babylon.js frontend
├── server/             # Go backend (gRPC + gRPC-Gateway)
├── android/            # Android WebView shell
├── scripts/            # Build and deployment scripts
├── Makefile            # Root entry point (run `make help` for all commands)
├── Dockerfile          # Docker multi-stage build (single container)
└── docker-compose.yml  # One-click local setup (server + mysql)
```

---

## Reporting Issues

When submitting an Issue, please use the corresponding template and include:

1. Problem description
2. Steps to reproduce
3. Expected behavior vs. actual behavior
4. Environment info (browser / OS / device / camera model)
5. Screenshots or logs (if available)

---

## Acknowledgments

Palm Racer would not be possible without these excellent open-source projects:

- [Babylon.js](https://www.babylonjs.com/) — Powerful 3D game engine
- [MediaPipe](https://mediapipe.dev/) — Google's gesture recognition framework
- [Vue.js](https://vuejs.org/) — Progressive frontend framework
- [gRPC](https://grpc.io/) — High-performance RPC framework

Thanks to all contributors who have submitted Issues, PRs, and suggestions ❤️

---

## License

This project is licensed under the MIT License. Your contributions will be under the same license.
