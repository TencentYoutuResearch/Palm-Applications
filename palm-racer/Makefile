# Palm Racer - Top-level Makefile
# Quick reference for common development tasks

.PHONY: help dev build test clean docker generate

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# === Development ===

dev-server: ## Run server in dev mode
	cd server && go run ./cmd/palm-racer/ --config=./conf/palm-racer.yaml

dev-web: ## Run web frontend (Vite dev server)
	cd web && npm run dev

dev: ## Run both server and web (Ctrl+C stops both)
	trap 'kill 0' EXIT; \
	(cd server && go run ./cmd/palm-racer/ --config=./conf/palm-racer.yaml) & \
	(cd web && npm run dev) & \
	wait

# === Build ===

generate: ## Generate proto files (api.pb.gw.go etc.)
	cd server && bash script/proto-gen.sh -I . --proto_file_path api/protoapi-spec --with-go --with-doc

build-server: generate ## Build server binary
	cd server && go build -o ./bin/palm-racer ./cmd/palm-racer/

build-web: ## Build web frontend
	cd web && npm ci && npm run build

build: build-web build-server ## Build everything

# === Test ===

test-server: ## Run server tests
	cd server && go test ./... -race

test-web: ## Run web tests
	cd web && npm run test:run

test: test-server test-web ## Run all tests

# === Docker ===

docker: ## Build Docker image
	docker build -t palm-racer:latest .

docker-up: ## Start with docker-compose (server + mysql)
	docker compose up -d

docker-down: ## Stop docker-compose
	docker compose down

# === Android ===

build-android: ## Build Android APK (debug)
	cd android && ./gradlew assembleDebug

# === Utility ===

clean: ## Clean build artifacts
	rm -rf server/bin/ server/pack/ web/dist/ pack/
	cd android && ./gradlew clean 2>/dev/null || true

lint-server: ## Run Go vet
	cd server && go vet ./...

lint-web: ## Run TypeScript type check
	cd web && npx vue-tsc --noEmit
