# Feature Flags: Guest Mode Toggle via `/app_config`

**Date:** 2026-05-31
**Status:** Approved

## Goal

Allow guest mode to be enabled/disabled via server-side configuration, without rebuilding the frontend. The frontend fetches feature flags at startup and conditionally renders guest-related UI.

## Architecture

### Backend

**Config (`server/conf/palm-racer.yaml`):**

```yaml
features:
  guest_mode: true    # Enable/disable guest login button on frontend
```

**Handler (`server/web/modules/seapalmracer/get_app_config.go`):**

- Reads `features` section from loaded YAML config
- Returns JSON response: `{ "code": 0, "data": { "features": { "guest_mode": true } } }`
- No authentication required (public endpoint)
- No database dependency

**Route:** `POST /app_config` (consistent with existing POST convention)

### Frontend

**`src/services/ConfigService.ts`:**

- `fetchAppConfig(): Promise<AppConfig>` — calls `POST /app_config`
- On failure: returns default values (`{ guestMode: true }`) to ensure graceful degradation

**`src/stores/appConfig.ts` (Pinia store):**

- State: `features: { guestMode: boolean }`
- Action: `init()` — fetches config and populates state
- Defaults: `{ guestMode: true }` (fail-open for guest mode)

**UI Changes:**

| File | Change |
|------|--------|
| `LoginPage.vue` | Wrap guest button in `v-if="appConfigStore.features.guestMode"` |
| `MenuPage.vue` | Wrap guest hints in same condition |

### Startup Sequence

```
App mount → appConfigStore.init() → POST /app_config → store features
                                          ↓ (fail)
                                    use defaults (guest=true)
```

- Non-blocking: config request is fire-and-forget
- LoginPage uses computed property for reactive binding
- If config arrives after render, UI reactively updates

## Extensibility

Adding new feature flags requires:

1. Add field to `features:` in `palm-racer.yaml`
2. Add field to frontend `AppConfig` TypeScript type
3. Add `v-if` at relevant UI location

No new endpoints, no schema migrations, no frontend rebuild.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Backend unreachable | Frontend uses defaults (guest=true) |
| Invalid response format | Frontend uses defaults |
| New flag added but frontend not updated | Unknown fields ignored |

## Testing

- **Backend:** Unit test for `get_app_config` handler returning correct config
- **Frontend:** Unit test for `appConfig` store — verify fetch success path and fallback path
- **Integration:** Toggle `guest_mode: false` in yaml, verify guest button disappears
