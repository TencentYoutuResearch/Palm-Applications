# Feature Flags: Guest Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/app_config` endpoint that serves feature flags from YAML config, and wire the frontend to conditionally show/hide guest mode based on the response.

**Architecture:** Backend reads `features` section from `palm-racer.yaml` via protobuf Configuration, exposes it through a new gRPC/HTTP endpoint. Frontend fetches config at startup into a Pinia store, LoginPage and MenuPage reactively show/hide guest UI.

**Tech Stack:** Go + protobuf + grpc-gateway (backend), Vue 3 + Pinia + TypeScript (frontend)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `server/api/protoapi-spec/sea-palm-racer/v1/configuration.proto` | Add `Features` message to Configuration |
| Modify | `server/api/protoapi-spec/sea-palm-racer/v1/api.proto` | Add `GetAppConfig` RPC + request/response messages |
| Create | `server/web/modules/seapalmracer/get_app_config.go` | Handler implementation |
| Modify | `server/conf/palm-racer.yaml` | Add `features:` section |
| Create | `web/src/services/ConfigService.ts` | API call to fetch config |
| Create | `web/src/stores/appConfig.ts` | Pinia store for feature flags |
| Modify | `web/src/features/login/LoginPage.vue` | Conditional guest button |
| Modify | `web/src/features/menu/MenuPage.vue` | Conditional guest hints |
| Modify | `web/src/main.ts` | Init appConfig store on startup |

---

### Task 1: Add Features to Proto Configuration

**Files:**
- Modify: `server/api/protoapi-spec/sea-palm-racer/v1/configuration.proto`

- [ ] **Step 1: Add Features message to configuration.proto**

Add after the `AppVersion` message (inside `Configuration`):

```protobuf
  // 功能开关配置
  Features features = 3;

  message Features {
    // 是否启用游客模式（前端登录页展示游客按钮）
    bool guest_mode = 1;
  }
```

The full file should read:

```protobuf
syntax = "proto3";

package sea.api.seapalmracer;
import "google/protobuf/duration.proto";

option go_package = "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1;v1";

// config file yaml
message Configuration {
  // 刷掌平台 API 配置
  Palm palm = 1;

  // App 版本管理配置
  AppVersion app_version = 2;

  // 功能开关配置
  Features features = 3;

  message Palm {
    int32 app_id = 1;
    string secret_id = 2;
    string secret_key = 3;
    string host = 4;
    string base_url = 5;
    string version = 6;
  }

  // App 版本管理配置，用于控制客户端升级策略
  message AppVersion {
    // 最新版本号（如 "1.0.0"），客户端通过语义化版本号比较判断是否需要升级
    string version = 1;
    // APK 下载链接
    string download_url = 3;
    // 是否强制更新（true 时客户端必须升级才能继续使用）
    bool force_update = 4;
    // 更新日志
    string changelog = 5;
  }

  // 功能开关配置
  message Features {
    // 是否启用游客模式（前端登录页展示游客按钮）
    bool guest_mode = 1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/api/protoapi-spec/sea-palm-racer/v1/configuration.proto
git commit -m "feat(proto): add Features message to Configuration for feature flags"
```

---

### Task 2: Add GetAppConfig RPC to api.proto

**Files:**
- Modify: `server/api/protoapi-spec/sea-palm-racer/v1/api.proto`

- [ ] **Step 1: Add RPC method to service block**

Add inside `service SeaPalmRacerService` block, after `GetAppVersion`:

```protobuf
  // 获取应用功能配置（feature flags）
  rpc GetAppConfig(GetAppConfigRequest) returns (GetAppConfigResponse) {
    option (google.api.http) = {
      post: "/api/app/config"
      body: "*"
    };
  };
```

- [ ] **Step 2: Add request/response messages at end of file**

Append to end of `api.proto`:

```protobuf
// ==================== App 功能配置 ====================

// 获取应用功能配置请求
message GetAppConfigRequest {
  string request_id = 1 [json_name = "RequestId"];
}

// 获取应用功能配置响应
message GetAppConfigResponse {
  int32 code = 1 [json_name = "Code"];
  string message = 2 [json_name = "Message"];
  AppConfigData data = 3 [json_name = "Data"];
}

// 应用功能配置数据
message AppConfigData {
  AppConfigFeatures features = 1 [json_name = "Features"];
}

// 功能开关
message AppConfigFeatures {
  bool guest_mode = 1 [json_name = "GuestMode"];
}
```

- [ ] **Step 3: Regenerate Go code from proto**

```bash
cd server && make proto
```

If `make proto` isn't available, run the protoc command directly (check Makefile for exact invocation).

- [ ] **Step 4: Commit**

```bash
git add server/api/protoapi-spec/
git commit -m "feat(proto): add GetAppConfig RPC endpoint for feature flags"
```

---

### Task 3: Implement GetAppConfig Handler

**Files:**
- Create: `server/web/modules/seapalmracer/get_app_config.go`

- [ ] **Step 1: Create handler file**

```go
package seapalmracer

import (
	"context"

	v1 "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/api/protoapi-spec/sea-palm-racer/v1"
	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/provider"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

// GetAppConfig 获取应用功能配置（feature flags）。
//
// 从配置文件 palm-racer.yaml 的 features 段读取功能开关，
// 运维侧修改配置文件并重启服务即可控制前端功能展示。
//
// 配置示例（palm-racer.yaml）：
//
//	features:
//	  guest_mode: true
func (c *Controller) GetAppConfig(
	ctx context.Context,
	req *v1.GetAppConfigRequest,
) (*v1.GetAppConfigResponse, error) {
	logger := logs_.GetLogger(ctx)
	logger.Infof("GetAppConfig called")

	conf := provider.GetConfig()
	var featuresConf *v1.Configuration_Features
	if conf != nil {
		featuresConf = conf.GetFeatures()
	}

	// Default: guest_mode enabled
	guestMode := true
	if featuresConf != nil {
		guestMode = featuresConf.GetGuestMode()
	}

	return &v1.GetAppConfigResponse{
		Code:    CodeOK,
		Message: "ok",
		Data: &v1.AppConfigData{
			Features: &v1.AppConfigFeatures{
				GuestMode: guestMode,
			},
		},
	}, nil
}
```

- [ ] **Step 2: Update controller file header comment**

In `palmracer.controller.go`, add to the file-level comment list:

```go
//   - get_app_config.go      : GetAppConfig 方法
```

- [ ] **Step 3: Verify build**

```bash
cd server && go build ./...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/web/modules/seapalmracer/get_app_config.go server/web/modules/seapalmracer/palmracer.controller.go
git commit -m "feat(server): implement GetAppConfig handler for feature flags"
```

---

### Task 4: Add features config to palm-racer.yaml

**Files:**
- Modify: `server/conf/palm-racer.yaml`

- [ ] **Step 1: Add features section**

Append at end of `palm-racer.yaml`:

```yaml
# 功能开关配置（控制前端功能展示）
features:
  guest_mode: true            # 是否启用游客模式（登录页显示游客按钮）
```

- [ ] **Step 2: Commit**

```bash
git add server/conf/palm-racer.yaml
git commit -m "feat(config): add features section with guest_mode toggle"
```

---

### Task 5: Create Frontend ConfigService

**Files:**
- Create: `web/src/services/ConfigService.ts`

- [ ] **Step 1: Create ConfigService.ts**

```typescript
/**
 * @file ConfigService.ts
 * @description Fetches application feature flags from backend /app_config endpoint.
 */

import api from './api';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ConfigService');

export interface AppConfigFeatures {
  guestMode: boolean;
}

export interface AppConfig {
  features: AppConfigFeatures;
}

/** Default config used when backend is unreachable or returns invalid data. */
const DEFAULT_CONFIG: AppConfig = {
  features: {
    guestMode: true,
  },
};

/**
 * Fetch application config from backend.
 * Falls back to defaults on any error (fail-open for guest mode).
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const resp = await api.post('/app/config', {});
    const data = resp?.data?.Data ?? resp?.data?.data;
    if (!data?.Features && !data?.features) {
      logger.warn('ConfigService', 'Invalid config response, using defaults');
      return DEFAULT_CONFIG;
    }
    const features = data.Features ?? data.features;
    return {
      features: {
        guestMode: features.GuestMode ?? features.guest_mode ?? true,
      },
    };
  } catch (e) {
    logger.warn('ConfigService', 'Failed to fetch config, using defaults:', (e as Error).message);
    return DEFAULT_CONFIG;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/services/ConfigService.ts
git commit -m "feat(web): add ConfigService for fetching feature flags"
```

---

### Task 6: Create Frontend appConfig Pinia Store

**Files:**
- Create: `web/src/stores/appConfig.ts`

- [ ] **Step 1: Create appConfig.ts**

```typescript
/**
 * @file appConfig.ts
 * @description Pinia store for application feature flags.
 * Fetched from backend at app startup, falls back to defaults on error.
 */

import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { fetchAppConfig, type AppConfigFeatures } from '@/services/ConfigService';

export const useAppConfigStore = defineStore('appConfig', () => {
  const features = reactive<AppConfigFeatures>({
    guestMode: true, // default: enabled until backend responds
  });

  const loaded = ref(false);

  /**
   * Fetch config from backend. Non-blocking — caller doesn't need to await.
   * Reactively updates features when response arrives.
   */
  async function init(): Promise<void> {
    const config = await fetchAppConfig();
    features.guestMode = config.features.guestMode;
    loaded.value = true;
  }

  return {
    features,
    loaded,
    init,
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add web/src/stores/appConfig.ts
git commit -m "feat(web): add appConfig Pinia store for feature flags"
```

---

### Task 7: Wire appConfig Init in main.ts

**Files:**
- Modify: `web/src/main.ts`

- [ ] **Step 1: Add import and init call**

After `app.mount('#app');` (line 33), add:

```typescript
import { useAppConfigStore } from './stores/appConfig';

// Fetch feature flags (non-blocking, UI reactively updates)
const appConfigStore = useAppConfigStore();
appConfigStore.init();
```

Note: The import should go at the top of the file with other imports. The init call goes after `app.mount('#app')` so Pinia is already installed.

Full updated `main.ts`:

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import App from './App.vue';
import router from './router';
import zh from './assets/locales/zh.json';
import en from './assets/locales/en.json';
import ja from './assets/locales/ja.json';
import './assets/styles/global.scss';
import { useAppConfigStore } from './stores/appConfig';

// ... existing i18n setup ...

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');

// Fetch feature flags (non-blocking, UI reactively updates)
const appConfigStore = useAppConfigStore();
appConfigStore.init();
```

- [ ] **Step 2: Verify dev server starts**

```bash
cd web && npm run dev
```

Expected: no compile errors, app loads.

- [ ] **Step 3: Commit**

```bash
git add web/src/main.ts
git commit -m "feat(web): init appConfig store on app startup"
```

---

### Task 8: Conditionally Render Guest UI in LoginPage

**Files:**
- Modify: `web/src/features/login/LoginPage.vue`

- [ ] **Step 1: Add appConfig store import**

In the `<script setup>` section, add:

```typescript
import { useAppConfigStore } from '@/stores/appConfig';

const appConfigStore = useAppConfigStore();
```

- [ ] **Step 2: Wrap guest button with v-if**

Change line 30 from:

```vue
      <button class="btn-guest" @click="handleGuestLogin">
        🎮 {{ t('login.guestLogin') }}
      </button>
```

To:

```vue
      <button v-if="appConfigStore.features.guestMode" class="btn-guest" @click="handleGuestLogin">
        🎮 {{ t('login.guestLogin') }}
      </button>
```

- [ ] **Step 3: Verify in browser**

1. Set `features.guest_mode: true` in yaml → guest button visible
2. Set `features.guest_mode: false` in yaml, restart server → guest button hidden

- [ ] **Step 4: Commit**

```bash
git add web/src/features/login/LoginPage.vue
git commit -m "feat(web): conditionally show guest login button based on feature flag"
```

---

### Task 9: Conditionally Render Guest Hints in MenuPage

**Files:**
- Modify: `web/src/features/menu/MenuPage.vue`

- [ ] **Step 1: Add appConfig store import**

In the `<script setup>` section, add:

```typescript
import { useAppConfigStore } from '@/stores/appConfig';

const appConfigStore = useAppConfigStore();
```

- [ ] **Step 2: Update guest hint conditional**

Change line 52 from:

```vue
      <p v-if="userStore.isGuest" class="guest-hint">{{ t('menu.guestHint') }}</p>
```

To:

```vue
      <p v-if="userStore.isGuest && appConfigStore.features.guestMode" class="guest-hint">{{ t('menu.guestHint') }}</p>
```

Note: The welcome text on line 6 (`userStore.isGuest ? t('menu.guestMode') : ...`) can stay — if a user somehow enters guest mode while flag is off, showing the label is harmless and aids debugging.

- [ ] **Step 3: Commit**

```bash
git add web/src/features/menu/MenuPage.vue
git commit -m "feat(web): conditionally show guest hints based on feature flag"
```

---

### Task 10: Integration Test

**Files:** None (manual verification)

- [ ] **Step 1: Test with guest_mode enabled (default)**

1. Start backend: `cd server && go run ./cmd/... -conf conf/palm-racer.yaml`
2. Start frontend: `cd web && npm run dev`
3. Open login page → guest button visible
4. Click guest → enters guest mode → menu shows guest hint

- [ ] **Step 2: Test with guest_mode disabled**

1. Edit `server/conf/palm-racer.yaml`: set `guest_mode: false`
2. Restart backend
3. Refresh login page → guest button hidden
4. (If previously logged in as guest, logout first)

- [ ] **Step 3: Test fallback (backend down)**

1. Stop backend
2. Refresh login page → guest button visible (default: true)

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: integration test fixups for feature flags"
```

Only commit if changes were needed during testing.
