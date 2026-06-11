#!/bin/bash

set -euo pipefail

# =============================================================================
# build.sh - Palm Racer 编译打包脚本（CI 流水线入口）
#
# 用法:
#   ./build.sh              # 同时构建 web + server
#   ./build.sh -w           # 仅构建 web
#   ./build.sh -s           # 仅构建 server
#   ./build.sh -s -p        # 构建 server 并开启 pprof（仅测试环境）
#   ./build.sh -b <tag>     # 指定 Go build tag
#   ./build.sh -h           # 显示帮助
#
# 产物目录:
#   pack/
#   ├── server/             # Go 服务产物（bin + conf + start.sh）
#   │   ├── bin/palm-racer
#   │   ├── conf/
#   │   └── start.sh
#   └── web/                # 前端静态资源
#       └── dist/
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
PACK_DIR="${PROJECT_DIR}/pack"

target="palm-racer"
build_web=true
build_server=true
enable_pprof=OFF  # 测试环境可以开启，发布版本不准开，安全合规
go_build_tag=""

# Node.js 目标版本（项目依赖 Vite 6.x / Vitest 4.x 要求 Node >= 18）
REQUIRED_NODE_MAJOR=20

usage() {
  echo "Usage: $0 [-w] [-s] [-p] [-b <build_tag>] [-h]"
  echo ""
  echo "Options:"
  echo "  -w    仅构建 web 前端"
  echo "  -s    仅构建 server 后端"
  echo "  -p    开启 pprof（仅测试环境，安全合规禁止用于生产）"
  echo "  -b    指定 Go build tag"
  echo "  -h    显示帮助信息"
}

while getopts :wsb:ph option; do
  case "$option" in
    w) build_server=false ;;
    s) build_web=false ;;
    p) enable_pprof=ON ;;
    b) go_build_tag="$OPTARG" ;;
    h) usage; exit 0 ;;
    ?) echo "Error: unknown option -$OPTARG"; usage; exit 1 ;;
  esac
done

# =============================================================================
# 确保 Node.js 版本 >= REQUIRED_NODE_MAJOR
# 策略优先级：
#   1) 当前 node 版本已满足要求且可正常运行，直接使用
#   2) 检测系统 GLIBC 版本，决定安装策略：
#      a) GLIBC >= 2.28：使用官方 Node.js 二进制
#      b) GLIBC < 2.28（如 CentOS 7）：使用 unofficial-builds 的 glibc-217 版本
#   3) 安装方式优先级：直接下载二进制 > nvm > 包管理器
# =============================================================================

# 获取系统 GLIBC 版本号（如 2.17 返回 217，2.28 返回 228）
get_glibc_version_num() {
  local glibc_ver
  if command -v ldd >/dev/null 2>&1; then
    glibc_ver=$(ldd --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+$' || true)
  fi
  if [ -z "$glibc_ver" ]; then
    # 回退：从 libc.so.6 获取
    glibc_ver=$(strings /lib64/libc.so.6 2>/dev/null | grep -oE 'GLIBC_[0-9]+\.[0-9]+' | sort -V | tail -1 | sed 's/GLIBC_//' || true)
  fi
  if [ -z "$glibc_ver" ]; then
    echo "0"
    return
  fi
  # 转换为整数比较：2.17 -> 217, 2.28 -> 228
  echo "$glibc_ver" | awk -F'.' '{printf "%d%02d", $1, $2}'
}

# 检测 node 是否可正常运行（不仅仅是存在，还要能执行）
node_is_usable() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  # 尝试实际执行 node，防止 GLIBC 不兼容导致无法运行
  node -e "process.exit(0)" >/dev/null 2>&1
}

ensure_node_version() {
  local required="$1"
  local current_major=0

  # 编译镜像内已预装 Node.js，直接验证即可
  if [ "${PALM_BUILDER_IMAGE:-}" = "1" ]; then
    if node_is_usable; then
      echo "[web] 检测到编译镜像环境 (PALM_BUILDER_IMAGE=1)，使用预装 Node.js: $(node -v)"
      return 0
    else
      echo "WARNING: 编译镜像内 Node.js 不可用，回退到自动安装逻辑"
    fi
  fi

  if node_is_usable; then
    current_major=$(node -v | sed 's/v//' | cut -d'.' -f1)
    if [ "${current_major}" -ge "${required}" ] 2>/dev/null; then
      echo "[web] 当前 Node.js 版本满足要求: $(node -v)"
      return 0
    fi
  fi

  echo "[web] 当前 Node.js 不可用或版本过低，需要 >= v${required}"

  # 检测 GLIBC 版本，决定安装策略
  local glibc_num
  glibc_num=$(get_glibc_version_num)
  echo "[web] 系统 GLIBC 版本号: ${glibc_num}"

  local node_ver="v${required}.20.2"  # 指定具体版本，保证可复现
  local node_dir="${PROJECT_DIR}/.node_local"

  if [ "${glibc_num}" -lt 228 ] 2>/dev/null; then
    # GLIBC < 2.28（如 CentOS 7 的 GLIBC 2.17）
    # 使用 unofficial-builds 提供的 glibc-217 兼容版本
    echo "[web] GLIBC < 2.28，使用 unofficial-builds (glibc-217) 版本的 Node.js"
    local node_archive="node-${node_ver}-linux-x64-glibc-217.tar.xz"
    local node_url="https://unofficial-builds.nodejs.org/download/release/${node_ver}/${node_archive}"

    echo "[web] 下载 Node.js ${node_ver} (glibc-217): ${node_url}"
    mkdir -p "${node_dir}"
    if ! curl -fsSL --retry 3 --retry-delay 5 "${node_url}" -o "${node_dir}/${node_archive}"; then
      echo "[web] unofficial-builds 下载失败，尝试 Node.js 18.x 作为回退..."
      node_ver="v18.20.8"
      node_archive="node-${node_ver}-linux-x64-glibc-217.tar.xz"
      node_url="https://unofficial-builds.nodejs.org/download/release/${node_ver}/${node_archive}"
      echo "[web] 下载 Node.js ${node_ver} (glibc-217): ${node_url}"
      if ! curl -fsSL --retry 3 --retry-delay 5 "${node_url}" -o "${node_dir}/${node_archive}"; then
        echo "ERROR: 无法下载兼容 GLIBC 2.17 的 Node.js，请升级构建环境或手动安装"
        exit 1
      fi
    fi

    tar -xf "${node_dir}/${node_archive}" -C "${node_dir}" --strip-components=1
    rm -f "${node_dir}/${node_archive}"
  else
    # GLIBC >= 2.28，使用官方二进制
    echo "[web] GLIBC >= 2.28，使用官方 Node.js 二进制"
    local node_archive="node-${node_ver}-linux-x64.tar.xz"
    local node_url="https://nodejs.org/dist/${node_ver}/${node_archive}"

    echo "[web] 下载 Node.js ${node_ver}: ${node_url}"
    mkdir -p "${node_dir}"
    if ! curl -fsSL --retry 3 --retry-delay 5 "${node_url}" -o "${node_dir}/${node_archive}"; then
      echo "ERROR: Node.js 下载失败: ${node_url}"
      exit 1
    fi

    tar -xf "${node_dir}/${node_archive}" -C "${node_dir}" --strip-components=1
    rm -f "${node_dir}/${node_archive}"
  fi

  # 将下载的 Node.js 加入 PATH（优先级最高）
  export PATH="${node_dir}/bin:${PATH}"

  # 验证安装结果
  if ! node_is_usable; then
    echo "ERROR: Node.js 安装后仍无法运行，请检查系统兼容性"
    echo "  node path: $(which node)"
    echo "  ldd info:"
    ldd "$(which node)" 2>&1 || true
    exit 1
  fi

  echo "[web] Node.js 安装完成: $(node -v) (npm $(npm -v))"
}

# 清理旧的打包产物
rm -rf "${PACK_DIR}"
mkdir -p "${PACK_DIR}"

# --- 构建 Web 前端 ---
if [ "$build_web" = true ]; then
  echo "========================================"
  echo "  构建 Web 前端"
  echo "========================================"

  WEB_DIR="${PROJECT_DIR}/web"
  if [ ! -d "$WEB_DIR" ]; then
    echo "ERROR: web 目录不存在: $WEB_DIR"
    exit 1
  fi

  # 确保 Node.js 版本满足项目要求
  ensure_node_version "${REQUIRED_NODE_MAJOR}"

  command -v npm >/dev/null 2>&1 || {
    echo "ERROR: npm 未安装，请先安装 Node.js"
    exit 1
  }

  echo "[web] node version: $(node --version)"
  echo "[web] npm version: $(npm --version)"

  cd "$WEB_DIR"

  echo "[web] 安装依赖..."
  # CI 流水线使用 npm ci 保证依赖一致性
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi

  echo "[web] 编译构建..."
  npm run build

  echo "[web] 打包产物..."
  mkdir -p "${PACK_DIR}/web"
  cp -r "${WEB_DIR}/dist" "${PACK_DIR}/web/dist"

  echo "[web] 构建完成: ${PACK_DIR}/web/dist"
  echo ""
fi

# --- 构建 Go Server ---
if [ "$build_server" = true ]; then
  echo "========================================"
  echo "  构建 Go Server"
  echo "========================================"

  SERVER_DIR="${PROJECT_DIR}/server"
  if [ ! -d "$SERVER_DIR" ]; then
    echo "ERROR: server 目录不存在: $SERVER_DIR"
    exit 1
  fi

  if [ "${enable_pprof}"x = "ON"x ]; then
    echo "[server] pprof 已开启，禁止在生产环境使用！"
  fi

  command -v go >/dev/null 2>&1 || {
    echo "ERROR: go 未安装"
    exit 1
  }

  command -v go
  go version

  if [ -z "$target" ]; then
    echo "ERROR: target 为空"
    exit 1
  fi

  echo "[server] 编译构建 target=${target}..."
  cd "$SERVER_DIR"

  # 编译 Go 二进制
  make all

  echo "[server] 打包产物..."
  SERVER_PACK_DIR="${PACK_DIR}/server"
  mkdir -p "${SERVER_PACK_DIR}/bin"
  mkdir -p "${SERVER_PACK_DIR}/conf"

  # 拷贝二进制
  cp -v "${SERVER_DIR}/cmd/${target}/${target}" "${SERVER_PACK_DIR}/bin/"

  # 拷贝配置文件
  cp -v "${SERVER_DIR}/conf/${target}"* "${SERVER_PACK_DIR}/conf/" 2>/dev/null || true

  # 拷贝启动脚本
  if [ -d "${SERVER_DIR}/script/${target}" ]; then
    cp -rv "${SERVER_DIR}/script/${target}/"* "${SERVER_PACK_DIR}/"
  fi

  echo "[server] 构建完成: ${SERVER_PACK_DIR}"
  echo ""
fi

# --- 生成运行时 Dockerfile（供CI 流水线 Docker 构建步骤使用） ---
# CI 流水线执行: docker build ./pack --file ./pack/Dockerfile
# 此 Dockerfile 直接使用 build.sh 已编译好的产物，不含编译阶段
echo "========================================"
echo "  生成运行时 Dockerfile"
echo "========================================"

cat > "${PACK_DIR}/Dockerfile" <<'DOCKERFILE'
# =============================================================================
# Palm Racer 运行时 Dockerfile（CI 流水线产物打包）
#
# 此文件由 build.sh 自动生成，直接使用预编译产物。
# 如需从源码构建，请使用项目根目录的 Dockerfile。
# 使用腾讯云内网 CentOS 7 镜像，与CI 构建环境保持一致，避免 Alpine 版本不可用问题
# =============================================================================
FROM centos:7

# 修复 CentOS 7 EOL 后 yum 源不可用问题
RUN sed -i 's|^mirrorlist=|#mirrorlist=|g' /etc/yum.repos.d/CentOS-*.repo \
    && sed -i 's|^#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo

RUN yum install -y ca-certificates tzdata && yum clean all && rm -rf /var/cache/yum
ENV TZ=Asia/Shanghai

WORKDIR /app

# 拷贝 Go 二进制
COPY server/bin/palm-racer ./palm-racer

# 拷贝配置文件
COPY server/conf/ ./conf/

# 拷贝 Web 前端构建产物
COPY web/dist ./web/dist

# 设置静态文件根目录，Go server 通过 STATIC_ROOT 环境变量读取
ENV STATIC_ROOT=/app/web/dist

EXPOSE 8080

CMD ["./palm-racer", "--config", "conf/palm-racer.yaml"]
DOCKERFILE

echo "[docker] 运行时 Dockerfile 已生成: ${PACK_DIR}/Dockerfile"
echo ""

# --- 构建摘要 ---
echo "========================================"
echo "  构建完成"
echo "========================================"
echo "  产物目录: ${PACK_DIR}"
if [ "$build_web" = true ]; then
  echo "  Web:    ${PACK_DIR}/web/dist"
fi
if [ "$build_server" = true ]; then
  echo "  Server: ${PACK_DIR}/server"
fi
echo "  Dockerfile: ${PACK_DIR}/Dockerfile"
echo "========================================"
echo ""
ls -Rhl "${PACK_DIR}"
