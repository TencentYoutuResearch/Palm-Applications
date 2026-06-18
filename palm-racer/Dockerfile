# =============================================================================
# Palm Racer 统一 Dockerfile（本地开发 / 独立 Docker 构建）
#
# 多阶段构建：从源码编译 Web + Go Server，生成单个运行时镜像。
# Go server 内置静态文件服务，无需单独 Nginx。
#
# 注意：CI 流水线使用 build.sh 编译后自动生成 pack/Dockerfile，
#       不使用此文件。此文件用于本地开发或独立 Docker 构建场景。
#
# 构建：docker build -t palm-racer .
# 运行：docker run -p 9090:9090 \
#         -e PALM_SECRET_ID=xxx \
#         -e PALM_SECRET_KEY=xxx \
#         palm-racer
# =============================================================================

# ---- Stage 1: 构建 Web 前端 ----
FROM node:20-alpine AS web-builder

WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Stage 2: 构建 Go Server ----
FROM golang:1.25-alpine AS server-builder

RUN apk add --no-cache make bash git

ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /build/server
COPY server/ ./
RUN go mod download
RUN bash script/build.sh -t "palm-racer"

# ---- Stage 3: 运行时镜像 ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai

WORKDIR /app

# 拷贝 Go 二进制
COPY --from=server-builder /build/server/cmd/palm-racer/palm-racer ./palm-racer

# 拷贝配置文件
COPY server/conf/palm-racer.yaml ./conf/palm-racer.yaml

# 拷贝 Web 前端构建产物
COPY --from=web-builder /build/web/dist ./web/dist

# 设置静态文件根目录，Go server 通过 STATIC_ROOT 环境变量读取
ENV STATIC_ROOT=/app/web/dist

EXPOSE 9090

CMD ["./palm-racer", "--config", "conf/palm-racer.yaml"]
