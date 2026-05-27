/**
 * server.js — 本地开发服务器
 * 功能：
 * 1. 静态文件服务（替代直接用 file:// 打开 HTML）
 * 2. API 代理转发（解决浏览器 CORS 跨域问题）
 *    使用 Bearer Token 认证，直接转发到掌纹网关
 *
 * 用法：node server.js
 * 然后浏览器访问 http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// ==================== 加载 .env 环境变量（本地开发用，部署时可不提供） ====================
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('ℹ️  未找到 .env 文件，将从系统环境变量读取配置');
    return;
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
})();

const PORT = process.env.PORT || 3000;

// 路径前缀（部署到子路径时使用，如 /palm-glasswiper）
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// API Key 认证
const API_KEY = process.env.API_KEY;

// CORS 允许的来源
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());

// 速率限制配置
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30', 10);
const rateLimitMap = new Map(); // IP -> { count, resetTime }

// 掌纹网关配置（Bearer Token 方式）
const PALM_HOST = process.env.PALM_HOST || 'your-palm-api-host.example.com';
const PALM_BEARER_TOKEN = process.env.PALM_BEARER_TOKEN;
const PALM_USER_ID = process.env.PALM_USER_ID;

// 校验必填配置
if (!PALM_BEARER_TOKEN) {
  console.error('❌ 缺少必要的环境变量，请检查 .env 文件：');
  console.error('   PALM_BEARER_TOKEN');
  process.exit(1);
}
if (!API_KEY) {
  console.error('❌ 缺少必要的环境变量：API_KEY');
  process.exit(1);
}

// ==================== 安全工具函数 ====================

/**
 * 获取请求来源的 Origin
 */
function getOrigin(req) {
  return req.headers.origin || req.headers.referer || '';
}

/**
 * 检查 CORS Origin 是否允许
 */
function isOriginAllowed(origin) {
  if (!origin) return true; // 同源请求无 Origin header
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

/**
 * 获取客户端 IP
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

/**
 * 速率限制检查
 */
function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_PER_MINUTE;
}

/**
 * 验证 API Key
 */
function isValidApiKey(req) {
  const key = req.headers['x-api-key'];
  return key === API_KEY;
}

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 剥离路径前缀
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    pathname = pathname.substring(BASE_PATH.length) || '/';
  }

  // ==================== API 代理 ====================
  if (pathname.startsWith('/api/palm/')) {
    handleApiProxy(req, res, pathname);
    return;
  }

  // ==================== 前端配置（注入 API Key） ====================
  if (pathname === '/api/frontend-config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(`window.__GLASSWIPER_API_KEY__="${API_KEY}";`);
    return;
  }

  // ==================== 静态文件服务 ====================
  handleStaticFile(req, res, pathname);
});

// ==================== 工具函数 ====================

/**
 * 将 PascalCase 动作名转为 snake_case 路径
 * 例: RegisterRgbPalm -> register_rgb_palm
 *     SearchRgbPalm  -> search_rgb_palm
 *     CompareRgbPalm -> compare_rgb_palm
 */
function actionToPath(action) {
  return action
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * 生成 32 位小写 hex 的 TraceId
 */
function genTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

// ==================== HTTPS 请求工具 ====================

/**
 * 发送 HTTPS POST 请求到掌纹网关
 */
function httpsPost(apiPath, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyBuffer = Buffer.from(body, 'utf-8');
    const options = {
      hostname: PALM_HOST,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': bodyBuffer.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ==================== API 代理 ====================

/**
 * API 代理：将请求转发到掌纹网关
 * 新方式：POST /palm/openai/{action_snake_case} + Bearer Token + X-TraceId
 */
function handleApiProxy(req, res, pathname) {
  const origin = getOrigin(req);
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    });
    res.end();
    return;
  }

  // API Key 验证
  if (!isValidApiKey(req)) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin
    });
    res.end(JSON.stringify({ code: -1, message: 'Unauthorized: invalid or missing API key' }));
    return;
  }

  // 速率限制
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin
    });
    res.end(JSON.stringify({ code: -1, message: 'Too many requests, please try again later' }));
    return;
  }

  // 提取 action: /api/palm/RegisterRgbPalm -> RegisterRgbPalm
  const action = pathname.replace('/api/palm/', '');
  const remotePath = `/palm/openai/${actionToPath(action)}`;
  const traceId = genTraceId();

  console.log(`[代理] ${req.method} ${pathname} -> POST ${remotePath} (TraceId: ${traceId})`);

  // 收集请求体
  const chunks = [];
  req.on('data', chunk => { chunks.push(chunk); });
  req.on('end', async () => {
    const bodyBuffer = Buffer.concat(chunks);
    let body = bodyBuffer.toString('utf-8');

    // 对注册请求注入环境变量中的 UserId
    if (action === 'RegisterRgbPalm' && PALM_USER_ID) {
      try {
        const parsed = JSON.parse(body);
        parsed.UserId = PALM_USER_ID;
        body = JSON.stringify(parsed);
      } catch (e) { /* 保持原始 body */ }
    }

    // 打印请求体摘要
    try {
      const parsed = JSON.parse(body);
      const summary = { ...parsed };
      if (summary.RgbImage && summary.RgbImage.Data) {
        summary.RgbImage = { ...summary.RgbImage, Data: `[base64, ${summary.RgbImage.Data.length} chars]` };
      }
      console.log(`[代理] ${action} 请求体:`, JSON.stringify(summary));
    } catch (e) {
      console.log(`[代理] ${action} 请求体(raw):`, body.substring(0, 300));
    }

    try {
      const responseData = await httpsPost(remotePath, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PALM_BEARER_TOKEN}`,
        'X-TraceId': traceId
      }, body);

      console.log(`[代理] ${action} 响应体:`, responseData.substring(0, 500));

      // 返回给浏览器（加上 CORS 头）
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
      });
      res.end(responseData);
    } catch (err) {
      console.error(`[代理] 请求失败:`, err.message);
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin
      });
      res.end(JSON.stringify({ code: -1, message: err.message, data: {} }));
    }
  });
}

/**
 * 静态文件服务
 */
function handleStaticFile(req, res, pathname) {
  // 默认首页
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // 安全检查：阻止访问隐藏文件（.env, .git 等）
  if (pathname.split('/').some(seg => seg.startsWith('.'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 安全检查：阻止访问服务器端敏感文件
  const BLOCKED_PATHS = [
    '/server.js', '/package.json', '/package-lock.json',
    '/Dockerfile', '/docker-compose.yml',
    '/node_modules'
  ];
  if (BLOCKED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 安全检查：只允许访问前端资源类型
  const ALLOWED_DIRS = ['/', '/js/', '/css/', '/assets/', '/fonts/'];
  const isAllowedPath = pathname === '/index.html' ||
    ALLOWED_DIRS.some(dir => dir !== '/' && pathname.startsWith(dir)) ||
    /^\/(index\.html|favicon\.ico|robots\.txt)$/.test(pathname);
  if (!isAllowedPath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = path.join(__dirname, pathname);

  // 安全检查：防止目录遍历
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 对 HTML 文件注入 BASE_PATH 变量和 <base> 标签，确保所有相对路径正确
    if (ext === '.html' && BASE_PATH) {
      let html = data.toString('utf-8');
      const baseTag = `<base href="${BASE_PATH}/">`;
      const script = `<script>window.GLASSWIPER_BASE_PATH="${BASE_PATH}";</script>`;
      html = html.replace('<head>', `<head>\n${baseTag}\n${script}`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(html);
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log('========================================');
  console.log(`  GlassWiper 服务器已启动`);
  console.log(`  访问地址: http://localhost:${PORT}${BASE_PATH || '/'}`);
  console.log(`  路径前缀: ${BASE_PATH || '(无)'}`);
  console.log(`  API 代理: ${BASE_PATH}/api/palm/{Action} -> /palm/openai/{action_snake_case}`);
  console.log(`  认证方式: Bearer Token`);
  console.log(`  网关地址: ${PALM_HOST}`);
  console.log('========================================');
});
