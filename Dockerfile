FROM python:3.13-slim

WORKDIR /app

ENV TZ=Asia/Shanghai

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用源代码
COPY . .

# 创建非root用户运行应用（安全最佳实践）
RUN groupadd -r palmuser && useradd -r -g palmuser palmuser \
    && mkdir -p /app/logs /app/static/uploads \
    && chown -R palmuser:palmuser /app

# 切换到非root用户
USER palmuser

# 暴露端口
EXPOSE 8000

# 健康检查（容器内直接访问，不经过网关，不需要 BASE_PATH 前缀）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/api/v1/health')" || exit 1

# 环境变量默认值
ENV PORT=8000
ENV BASE_PATH=/palm-destiny

# 启动应用
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --root-path ${BASE_PATH:-} --limit-concurrency 256 --timeout-keep-alive 30
