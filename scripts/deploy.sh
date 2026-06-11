#!/bin/bash
# Palm Racer — One-click build & deploy
# Usage:
#   ./scripts/deploy.sh              # Build all (web + server + android)
#   ./scripts/deploy.sh web          # Web only (production build)
#   ./scripts/deploy.sh dev          # Dev mode: Vite dev server + Go server
#   ./scripts/deploy.sh dev-web      # Vite dev server only (port 5173)
#   ./scripts/deploy.sh server       # Server only
#   ./scripts/deploy.sh android      # Android APK only
#   ./scripts/deploy.sh docker       # Docker deploy (web + nginx)
#   ./scripts/deploy.sh run          # Build all + start server locally
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$PROJECT_DIR/web"
SERVER_DIR="$PROJECT_DIR/server"
ANDROID_DIR="$PROJECT_DIR/android"
DEPLOY_DIR="$PROJECT_DIR/deploy"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[deploy] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy] ⚠${NC} $*"; }
err()  { echo -e "${RED}[deploy] ✗${NC} $*" >&2; }

# ─── Dependency checks & auto-install ─────────────────────────────
has_brew() { command -v brew &>/dev/null; }

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "Required command not found: $1"
    return 1
  fi
}

# Auto-install a dependency via Homebrew if missing
ensure_cmd() {
  local cmd="$1"
  local brew_pkg="${2:-$1}"  # brew package name (may differ from command)
  if command -v "$cmd" &>/dev/null; then
    return 0
  fi
  if has_brew; then
    warn "$cmd not found, installing via: brew install $brew_pkg"
    brew install "$brew_pkg"
    if command -v "$cmd" &>/dev/null; then
      ok "$cmd installed successfully"
      return 0
    fi
    # For cask/keg-only packages, try sourcing shell again
    eval "$(brew shellenv 2>/dev/null)" || true
    if command -v "$cmd" &>/dev/null; then
      ok "$cmd installed successfully"
      return 0
    fi
  fi
  err "$cmd not found and auto-install failed. Please install manually."
  return 1
}

# Ensure JDK 17 is available (required by Android Gradle)
ensure_jdk() {
  if java -version 2>&1 | grep -q 'version "17'; then
    return 0
  fi
  if [ -n "${JAVA_HOME:-}" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "17'; then
    return 0
  fi
  # Try common JDK paths (Homebrew, system, Android Studio bundled JBR)
  for jdk_home in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "$(brew --prefix 2>/dev/null)/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/openjdk-17.jdk/Contents/Home"; do
    if [ -x "$jdk_home/bin/java" ]; then
      export JAVA_HOME="$jdk_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      ok "Using JDK 17: $JAVA_HOME"
      return 0
    fi
  done
  # Auto-install
  if has_brew; then
    warn "JDK 17 not found, installing via: brew install openjdk@17"
    brew install openjdk@17
    local brew_jdk="$(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    if [ -x "$brew_jdk/bin/java" ]; then
      export JAVA_HOME="$brew_jdk"
      export PATH="$JAVA_HOME/bin:$PATH"
      ok "JDK 17 installed: $JAVA_HOME"
      return 0
    fi
  fi
  err "JDK 17 not found and auto-install failed. Install with: brew install openjdk@17"
  return 1
}

# ─── Web frontend ─────────────────────────────────────────────────
build_web() {
  log "Building web frontend..."
  ensure_cmd node
  ensure_cmd npm

  cd "$WEB_DIR"
  if [ ! -d "node_modules" ]; then
    log "Installing npm dependencies..."
    npm install
  fi
  npm run build
  ok "Web build complete: $WEB_DIR/dist"
}

# ─── Web dev server (Cloud Studio / 开发环境) ─────────────────────
dev_web() {
  log "Starting Vite dev server on port 5173..."
  ensure_cmd node
  ensure_cmd npm

  cd "$WEB_DIR"
  if [ ! -d "node_modules" ]; then
    log "Installing npm dependencies..."
    npm install
  fi

  # 先停掉已有的 vite 进程
  pkill -f "vite.*5173" || true
  sleep 1

  nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 &
  local vite_pid=$!
  sleep 2

  # 检查是否启动成功
  if kill -0 "$vite_pid" 2>/dev/null; then
    ok "Vite dev server running (PID: $vite_pid) on http://localhost:5173"
    ok "Log file: /tmp/vite-dev.log"
  else
    err "Vite dev server failed to start. Check /tmp/vite-dev.log"
    return 1
  fi
}

# ─── Sync web dist to native app assets ───────────────────────────
sync_native_assets() {
  local dist_dir="$WEB_DIR/dist"
  if [ ! -d "$dist_dir" ]; then
    err "Web dist not found. Run 'build_web' first."
    return 1
  fi

  # Android
  if [ -d "$ANDROID_DIR" ]; then
    local android_assets="$ANDROID_DIR/app/src/main/assets/web"
    rm -rf "$android_assets"
    mkdir -p "$(dirname "$android_assets")"
    cp -r "$dist_dir" "$android_assets"
    ok "Synced to Android assets"
  fi
}

# ─── Go server ────────────────────────────────────────────────────
build_server() {
  log "Building Go server..."
  ensure_cmd go

  cd "$SERVER_DIR"
  make all
  ok "Server binary: $SERVER_DIR/cmd/palm-racer/palm-racer"
}

# ─── Android SDK paths ────────────────────────────────────────────
find_android_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}" ]; then
    return 0
  fi
  for candidate in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "/usr/local/share/android-sdk" \
    "$(brew --prefix 2>/dev/null)/share/android-commandlinetools" \
    ; do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      return 0
    fi
  done
  # Auto-install Android command line tools via brew
  if has_brew; then
    warn "Android SDK not found, installing via: brew install --cask android-commandlinetools"
    brew install --cask android-commandlinetools || true
    local brew_sdk="$(brew --prefix)/share/android-commandlinetools"
    if [ -d "$brew_sdk" ]; then
      export ANDROID_HOME="$brew_sdk"
      ok "Android SDK installed: $ANDROID_HOME"
      return 0
    fi
  fi
  return 1
}

find_adb() {
  # 1) PATH
  if command -v adb &>/dev/null; then
    echo "adb"
    return 0
  fi
  # 2) ANDROID_HOME
  find_android_sdk || true
  if [ -n "${ANDROID_HOME:-}" ]; then
    local adb_path="$ANDROID_HOME/platform-tools/adb"
    if [ -x "$adb_path" ]; then
      echo "$adb_path"
      return 0
    fi
  fi
  # 3) Auto-install platform-tools via brew
  if has_brew; then
    warn "adb not found, installing via: brew install --cask android-platform-tools"
    brew install --cask android-platform-tools || true
    if command -v adb &>/dev/null; then
      echo "adb"
      return 0
    fi
  fi
  return 1
}

# ─── Android APK ──────────────────────────────────────────────────
build_android() {
  log "Building Android APK..."

  # Ensure JDK 17 is available
  ensure_jdk

  if [ ! -d "$ANDROID_DIR" ]; then
    err "Android directory not found: $ANDROID_DIR"
    return 1
  fi

  # Always rebuild web and sync to assets (ensure latest code)
  build_web
  sync_native_assets

  cd "$ANDROID_DIR"

  # Require gradlew (bundled with the Android project)
  if [ ! -f "./gradlew" ]; then
    err "gradlew not found in $ANDROID_DIR. Open the project in Android Studio first."
    return 1
  fi

  ./gradlew assembleDebug

  local apk_path="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
  if [ ! -f "$apk_path" ]; then
    apk_path=$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -name "*.apk" 2>/dev/null | head -1)
  fi

  if [ -z "$apk_path" ] || [ ! -f "$apk_path" ]; then
    err "APK not found after build"
    return 1
  fi

  ok "APK built: $apk_path"

  # Auto-install to connected device
  local adb_cmd
  if adb_cmd=$(find_adb); then
    local device_count
    device_count=$("$adb_cmd" devices | grep -c "device$" || true)
    if [ "$device_count" -gt 0 ]; then
      log "Installing APK to connected device..."
      "$adb_cmd" install -r "$apk_path"
      ok "APK installed on device"

      # Port-forward so the app can reach localhost:8080 on the host
      "$adb_cmd" reverse tcp:8080 tcp:8080
      ok "adb reverse tcp:8080 -> localhost:8080"
    else
      warn "No Android device connected. APK at: $apk_path"
    fi
  else
    warn "adb not found (set ANDROID_HOME or install platform-tools). APK at: $apk_path"
  fi
}

# ─── Docker deploy (web + nginx) ─────────────────────────────────
deploy_docker() {
  log "Deploying via Docker..."
  ensure_cmd docker

  # Build web first
  build_web

  # Copy dist to deploy context
  rm -rf "$DEPLOY_DIR/html"
  cp -r "$WEB_DIR/dist" "$DEPLOY_DIR/html"

  cd "$DEPLOY_DIR"

  if command -v docker-compose &>/dev/null; then
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
  elif docker compose version &>/dev/null 2>&1; then
    docker compose down 2>/dev/null || true
    docker compose up -d --build
  else
    err "docker-compose / docker compose not found"
    return 1
  fi

  ok "Docker deployment running on http://localhost:80"
}

# ─── Run locally (server serves web dist) ─────────────────────────
run_local() {
  build_web
  build_server

  log "Starting server locally..."
  cd "$SERVER_DIR"
  ./cmd/palm-racer/palm-racer --config conf/palm-racer.yaml &
  local server_pid=$!

  ok "Server running (PID: $server_pid) at http://localhost:8080"
  echo ""
  log "Press Ctrl+C to stop"
  wait "$server_pid"
}

# ─── Dev mode (vite dev + server) ─────────────────────────────────
run_dev() {
  dev_web
  build_server

  log "Starting server locally..."
  cd "$SERVER_DIR"
  ./cmd/palm-racer/palm-racer --config conf/palm-racer.yaml &
  local server_pid=$!

  ok "Dev mode running:"
  ok "  Web (Vite):   http://localhost:5173"
  ok "  Server (Go):  http://localhost:8080"
  echo ""
  log "Press Ctrl+C to stop server (Vite runs in background)"
  wait "$server_pid"
}

# ─── Build all ────────────────────────────────────────────────────
build_all() {
  build_web
  sync_native_assets
  build_server
  build_android
  ok "All components built successfully!"
}

# ─── Main ─────────────────────────────────────────────────────────
print_usage() {
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  (none)     Build all: web + server + android"
  echo "  web        Build web frontend only"
  echo "  dev        Start Vite dev server (port 5173) + Go server"
  echo "  dev-web    Start Vite dev server only (port 5173)"
  echo "  server     Build Go server only"
  echo "  android    Build Android APK (+ auto-install via adb)"
  echo "  docker     Deploy web via Docker + Nginx"
  echo "  run        Build all + start server locally"
  echo "  help       Show this help"
}

case "${1:-all}" in
  web)
    build_web
    sync_native_assets
    ;;
  dev)
    run_dev
    ;;
  dev-web)
    dev_web
    ;;
  server)
    build_server
    ;;
  android)
    build_android
    ;;
  docker)
    deploy_docker
    ;;
  run)
    run_local
    ;;
  all)
    build_all
    ;;
  help|-h|--help)
    print_usage
    ;;
  *)
    err "Unknown command: $1"
    print_usage
    exit 1
    ;;
esac
