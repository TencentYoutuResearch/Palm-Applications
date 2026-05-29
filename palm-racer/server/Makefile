# example
# make TARGET=sea-date
# make new TARGET=date NEW_GIT_REPOSITORY_NAME="github.com/kaydxh/sea"
# set default target to sea-palm-racer
TARGET=palm-racer
DEPS_NAME=deps.yaml
DO_PARSE_DEPS="ON"

MAKEFILE_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
PROJECT_ROOT_DIR := $(realpath ${MAKEFILE_DIR})
PROJECT_CMD_ROOT_DIR := ${PROJECT_ROOT_DIR}/cmd/${TARGET}
PKG_CONFIG_PATH := ${PROJECT_CMD_ROOT_DIR}/pkgconfig
SCRIPT_PATH := ${MAKEFILE_DIR}/../script
BUILD_ENV_VAR :=
OUTPUT_DIR := ${PROJECT_ROOT_DIR}/pack/${TARGET}
OUTPUT_CONF_DIR=${OUTPUT_DIR}/conf
OUTPUT_LIB_DIR=${OUTPUT_DIR}/lib
OUTPUT_BIN_DIR=${OUTPUT_DIR}/bin
OUTPUT_MODEL_DIR=${OUTPUT_DIR}/model
OUTPUT_BIN_PATH=${OUTPUT_DIR}/bin/${TARGET}

NEW_GIT_REPOSITORY_NAME=

.PHONY: all
all: generate
	@echo "building all ${TARGET}"
	@bash script/build.sh -t "${TARGET}" -e "${BUILD_ENV_VAR}"

# pack target for CI: same as all (backward compat with QCI build scripts)
.PHONY: pack
pack: all

.PHONY: generate
generate:
	@echo "make generate"
	@# 检查 protoc 是否可用；CI 环境可能没有 proto 工具链
	@if ! command -v protoc >/dev/null 2>&1; then \
		if ls api/protoapi-spec/*/v1/*.pb.go >/dev/null 2>&1; then \
			echo "WARN: protoc not found, but .pb.go files exist — skipping proto generation"; \
			exit 0; \
		else \
			echo "ERROR: protoc not found and no .pb.go files exist — cannot build"; \
			echo "  install: apt-get install -y protobuf-compiler && go install google.golang.org/protobuf/cmd/protoc-gen-go@latest"; \
			exit 1; \
		fi; \
	fi
	@# 优先使用本地 script/proto-gen.sh;离线环境或内网可跳过 curl 更新
	@if [ "${OFFLINE:-0}" = "0" ]; then \
		curl -s -L --connect-timeout 5 -o ./script/proto-gen.sh.new https://raw.githubusercontent.com/kaydxh/golang/main/script/go_proto_gen.sh \
			&& mv ./script/proto-gen.sh.new ./script/proto-gen.sh \
			|| echo "WARN: failed to refresh proto-gen.sh from upstream, using local version (set OFFLINE=1 to skip network refresh)"; \
	else \
		echo "OFFLINE=1, skip upstream refresh of proto-gen.sh"; \
	fi
	@bash  script/proto-gen.sh -I . --proto_file_path api/protoapi-spec  --with-go --with-doc

.PHONY: deps
deps:
	@echo "> make deps..."

.PHONY: install
install: all clean
	@echo "> make install..."
	@echo " > install conf..."
	@mkdir -p ${OUTPUT_CONF_DIR}
	@cp -Rv "${PROJECT_ROOT_DIR}/conf/${TARGET}"* ${OUTPUT_CONF_DIR}

	@echo " > install bin..."
	@mkdir -p ${OUTPUT_BIN_DIR}
	@cp -Rv "${PROJECT_CMD_ROOT_DIR}/${TARGET}" ${OUTPUT_BIN_DIR}

	@echo " > install libs..."
	@mkdir -p ${OUTPUT_LIB_DIR}
	@$(eval LINK_THIRD_LIB_PATHS := $(shell find -L ${PROJECT_CMD_ROOT_DIR}/third_path/ -maxdepth 3 -mindepth 2 -type d -iname "lib*" -print0 |xargs -0 -I {} sh -c 'echo {}'|grep -v "stubs"))
	@echo "${LINK_THIRD_LIB_PATHS}"
	@$(eval JOINED_LINK_THIRD_LIB_PATHS := $(call joinwith,:,$(LINK_THIRD_LIB_PATHS)))
	@LD_LIBRARY_PATH="$(JOINED_LINK_THIRD_LIB_PATHS):${LD_LIBRARY_PATH}" ldd "${OUTPUT_BIN_PATH}" | awk '{if (match($$3,"/")){ print $$3  }}' | grep "third_path" | grep -v "^/lib64" | grep -v "^/lib" | xargs -I {} sh -c 'cp -v -L {} ${OUTPUT_LIB_DIR}'
	@LD_LIBRARY_PATH="$(JOINED_LINK_THIRD_LIB_PATHS):${LD_LIBRARY_PATH}" ldd "${OUTPUT_BIN_PATH}" | awk '{if (match($$3,"/")){ print $$3  }}' | grep "libgomp" | xargs -I {} sh -c 'cp -v -L {} ${OUTPUT_LIB_DIR}'
	@LD_LIBRARY_PATH="$(JOINED_LINK_THIRD_LIB_PATHS):${LD_LIBRARY_PATH}" ldd "${OUTPUT_BIN_PATH}" | awk '{if (match($$3,"/")){ print $$3  }}' | grep "libjbig" | xargs -I {} sh -c 'cp -v -L {} ${OUTPUT_LIB_DIR}'
	@LD_LIBRARY_PATH="$(JOINED_LINK_THIRD_LIB_PATHS):${LD_LIBRARY_PATH}" ldd "${OUTPUT_BIN_PATH}" | awk '{if (match($$3,"/")){ print $$3  }}' | grep "libstdc++.so" | xargs -I {} sh -c 'cp -v -L {} ${OUTPUT_LIB_DIR}'

	@echo " > install model..."
	@cd ${PROJECT_CMD_ROOT_DIR}; find -L ./third_path/ -maxdepth 3 -type d \( -iname "model" -o -iname "sdk_data" -o -iname "config" \) -print0  2>/dev/null | xargs -0 -I {} sh -c 'mkdir -p ${OUTPUT_MODEL_DIR}; cp -r -v -d {}/* ${OUTPUT_MODEL_DIR}'
	@echo " > install script..."
	@cp -Rv "${PROJECT_ROOT_DIR}/script/${TARGET}/"* ${OUTPUT_DIR}

	@echo -e "\n==> Results:"
	@ls -Rhl ${OUTPUT_DIR}

.PHONY: pkg-config
pkg-config: deps
	@echo "> make pkg-config..."
	@$(eval THIRD_LIB_PATHS := $(shell find -L ${PROJECT_CMD_ROOT_DIR}/third_path/ -maxdepth 3 -mindepth 2 -type d -iname "lib*" -print0 |xargs -0 -I {} bash -c 'echo {}'|grep -v "stubs"))
	@$(eval JOINED_THIRD_LIB_PATHS := $(call joinwith,:,${THIRD_LIB_PATHS}))
	@$(eval BUILD_ENV_VAR = PKG_CONFIG_PATH=${PKG_CONFIG_PATH} LD_LIBRARY_PATH=${JOINED_THIRD_LIB_PATHS}:${LD_LIBRARY_PATH} LIBRARY_PATH=${JOINED_THIRD_LIB_PATHS}:${LIBRARY_PATH})
	@echo "copy pkg-config..."
	@mkdir -p ${PKG_CONFIG_PATH}
	@if [[ (( -d "${PROJECT_CMD_ROOT_DIR}"/third_path/yt-sdk-go/pkgconfig )) ]]; then cp -df "${PROJECT_CMD_ROOT_DIR}"/third_path/yt-sdk-go/pkgconfig/* "${PKG_CONFIG_PATH}/"; fi
	@${BUILD_ENV_VAR} go mod tidy

.PHONY: copyright
copyright:
	@echo "make copyright"
	@# 脚本和许可证模板已本地化到 script/ 目录;仅在 OFFLINE != 1 时尝试上游刷新
	@if [ "${OFFLINE:-0}" = "0" ]; then \
		curl -s -L --connect-timeout 5 -o ./script/copyright.sh.new https://raw.githubusercontent.com/kaydxh/golang/main/script/copyright.sh \
			&& mv ./script/copyright.sh.new ./script/copyright.sh \
			|| echo "WARN: failed to refresh copyright.sh from upstream, using local version"; \
		curl -s -L --connect-timeout 5 -o ./script/copyright.txt.new https://raw.githubusercontent.com/kaydxh/golang/main/script/copyright.txt \
			&& mv ./script/copyright.txt.new ./script/copyright.txt \
			|| echo "WARN: failed to refresh copyright.txt from upstream, using local version"; \
	else \
		echo "OFFLINE=1, skip upstream refresh of copyright.sh/copyright.txt"; \
	fi
	@bash script/copyright.sh

.PHONY: new
new:
	@echo "make new project ${TARGET}"
	@bash script/new-project.sh -t "${TARGET}"  -g "${NEW_GIT_REPOSITORY_NAME}"

.PHONY: delete
delete:
	@echo "make delete project ${TARGET}"
	@bash script/delete-project.sh -t "${TARGET}"

.PHONY: test
test:
	@echo "running tests (race detector + fresh run)..."
	@go test ./... -v -race -count=1

.PHONY: test-short
test-short:
	@echo "running tests (fast, no race)..."
	@go test ./... -count=1

.PHONY: vet
vet:
	@echo "running go vet..."
	@go vet ./...

.PHONY: lint
lint:
	@echo "running golangci-lint..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "WARN: golangci-lint not installed"; \
		echo "  install: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
		exit 1; \
	fi

.PHONY: check
check: vet lint test
	@echo "all quality gates passed"

.PHONY: clean
clean:
	@echo "clean"
	@bash script/clean.sh ${OUTPUT_DIR}
