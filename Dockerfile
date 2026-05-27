# 使用官方Node.js LTS版本作为基础镜像
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装生产依赖（使用npm ci确保版本一致性）
RUN npm ci --only=production

# 第二阶段：运行时镜像
FROM node:18-alpine AS runtime

# 设置工作目录
WORKDIR /app

# 从构建阶段复制node_modules和package.json
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# 复制应用源代码
COPY . .

# 创建非root用户运行应用（安全最佳实践）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S glasswiper -u 1001

# 更改文件所有权
RUN chown -R glasswiper:nodejs /app

# 切换到非root用户
USER glasswiper

# 暴露端口（通过环境变量 PORT 控制）
EXPOSE 9091

# 健康检查（使用环境变量端口）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-9091}/ || exit 1

# 设置环境变量（生产环境推荐配置）
ENV NODE_ENV=production
ENV PORT=9091

# 启动应用
CMD ["node", "server.js"]
