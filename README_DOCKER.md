# GlassWiper Docker 部署指南

## 快速开始

### 1. 构建和运行容器

```bash
# 使用 Docker Compose（推荐）
docker-compose up -d

# 或者直接使用 Docker
# 构建镜像
docker build -t glasswiper .

# 运行容器
docker run -d \
  -p 8000:3000 \
  -e PALM_HOST=your_palm_host \
  -e PALM_BEARER_TOKEN=your_token \
  -e PALM_USER_ID=your_user_id \
  --name glasswiper-app \
  glasswiper
```

### 2. 访问应用

应用将在以下地址运行：
- http://localhost:8000

## 环境变量配置

| 变量名 | 描述 | 默认值 | 必填 |
|--------|------|--------|------|
| `PORT` | 应用监听端口 | 3000 | 否 |
| `PALM_HOST` | 掌纹网关地址 | - | 是（生产环境） |
| `PALM_BEARER_TOKEN` | Bearer Token认证 | - | 是（生产环境） |
| `PALM_USER_ID` | 掌纹用户ID | - | 是（生产环境） |
| `NODE_ENV` | 环境模式 | production | 否 |

## 生产环境部署示例

```bash
# 创建环境变量文件
echo "PALM_HOST=your-palm-api-host.example.com" > .env
echo "PALM_BEARER_TOKEN=your_actual_token" >> .env
echo "PALM_USER_ID=your_user_id" >> .env

# 使用环境变量文件启动
docker run -d \
  -p 8000:3000 \
  --env-file .env \
  --name glasswiper-prod \
  glasswiper
```

## 常用命令

```bash
# 查看容器日志
docker logs glasswiper-app

# 进入容器终端
docker exec -it glasswiper-app sh

# 停止容器
docker stop glasswiper-app

# 重启容器
docker restart glasswiper-app

# 删除容器
docker rm glasswiper-app

# 查看运行状态
docker ps
```

## 健康检查

容器内置健康检查，可以通过以下命令验证：
```bash
docker inspect --format='{{.State.Health.Status}}' glasswiper-app
```

## 安全建议

1. **不要将敏感信息硬编码**在Dockerfile中
2. 使用`.env`文件或Docker Secrets管理敏感数据
3. 定期更新基础镜像以获取安全补丁
4. 使用非root用户运行容器（已配置）

## 故障排除

1. **端口冲突**: 如果8000端口被占用，修改docker-compose.yml中的端口映射
2. **环境变量缺失**: 确保所有必需的环境变量都已设置
3. **构建失败**: 检查网络连接和Docker守护进程状态
