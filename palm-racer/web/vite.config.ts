import basicSsl from '@vitejs/plugin-basic-ssl';
import vue from '@vitejs/plugin-vue';
import {resolve} from 'path';
import {defineConfig} from 'vite';

// HTTPS is required by the browser for camera access (getUserMedia) on any
// non-localhost origin. Enable by default for `npm run dev` so LAN clients
// (phones, other machines) can access by IP. Set VITE_HTTPS=false to opt out.
const enableHttps = process.env.VITE_HTTPS !== 'false';

export default defineConfig({
  plugins: [vue(), ...(enableHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    // HMR WebSocket 默认连接 localhost，当手机等 LAN 设备通过 IP 访问时会连不上。
    // 不指定 hmr.host 让客户端自动使用 window.location.host 建立 WebSocket 连接。
    hmr: {
      // 使用 HTTPS 时 WebSocket 也需要走 wss，端口与 dev server 一致
      protocol: enableHttps ? 'wss' : 'ws',
    },
    // Extra hostnames allowed by the dev server. Vite rejects Host headers
    // that don't match localhost/IP by default to mitigate DNS rebinding.
    //   - `palm-racer.local`       本机 hosts 指向 LAN IP 时用
    // Use `true` to allow any host if you need temporary open access.
    allowedHosts: [
      'palm-racer.local',
    ],
    proxy: {
      '/api': {
        // 转发到本机 Go 后端 (端口与 conf/palm-racer.yaml 中 web.bind_address.port 一致)
        target: 'http://localhost:9090',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Use relative paths so WebView asset loading works correctly
    // index.html will reference "./assets/xxx.js" instead of "/assets/xxx.js"
    assetsDir: 'assets',
    // BabylonJS core is ~2.6MB minified (3D engine, expected).
    // Raise the limit above its size to suppress false-positive warnings.
    chunkSizeWarningLimit: 2700,
    rollupOptions: {
      output: {
        // Split heavy dependencies into their own cacheable chunks instead
        // of bundling everything into one >500kB blob. Order matters: more
        // specific prefixes must be checked before generic 'vendor'.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@babylonjs/loaders')) return 'babylon-loaders';
          if (id.includes('@babylonjs')) return 'babylon';
          if (id.includes('@mediapipe')) return 'mediapipe';
          // 注意：不再将 Vue 相关包单独分割为 vue-vendor，
          // 因为 vue-vendor 和 vendor 之间存在循环依赖，
          // 会导致 Android WebView 中出现 TDZ 错误（Cannot access 'Y' before initialization）
          return 'vendor';
        },
      },
    },
  },
  base: './',
});
