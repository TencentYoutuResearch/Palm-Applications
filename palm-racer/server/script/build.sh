# Created on 2020-10-11 19:34:08
#!/usr/bin/env bash

# exit by command return non-zero exit code
set -o errexit
# Indicate an error when it encounters an undefined variable
set -o nounset
# Fail on any error.
set -o pipefail
# set -o xtrace

TARGET=sealet
ENV=

help() {
    echo "Usage:"
    echo "getopts.sh [-t target -e env]"
    echo "Description:"
    echo "target,the name of server."
    echo "env,environment variable of server."
    exit -1
}

while getopts 't:e:' option; do
  case ${option} in
    t) TARGET=${OPTARG};;
    e) ENV=${OPTARG};;
    ?) help ;;
  esac
done


SEA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SEA_CMD_ROOT=${SEA_ROOT}/cmd
SEA_OUTPUT_SUB_PATH=${SEA_OUTPUT_SUB_PATH:-output/${TARGET}}
SEA_OUTPUT_PATH=${SEA_ROOT}/${SEA_OUTPUT_SUB_PATH}
SEA_OUTPUT_BIN_PATH=${SEA_OUTPUT_PATH}/bin


VERSION_PATH="${SEA_ROOT}/script/version.sh"
if [[ ! -f "${VERSION_PATH}" ]]; then curl -s -L -o ${VERSION_PATH} https://raw.githubusercontent.com/kaydxh/sea/master/script/version.sh; fi
source "${VERSION_PATH}"

export CGO_ENABLED=0
# 注释掉 -mod=readonly 以支持 go.work
# export GOFLAGS="-mod=readonly"

function platform() {
  echo "$(go env GOHOSTOS)/$(go env GOHOSTARCH)"
}

function make_build_ld_args() {
  local goldflags

  goldflags="all=$(ldflags ${TARGET}) ${GOLDFLAGS:-}"
  local -a build_ld_args
   build_ld_args=(
   -ldflags="${goldflags}"
   )

   echo "${build_ld_args[*]}"
}

function build() {
  # -a force rebuilding of packages that are already up-to-date
  GO_BUILD_ARGS="-a"
  GO_BUILD_LD_ARGS="$(make_build_ld_args)"

  #go build -mod=vendor -o ${OUT_PUT_PATH}/sealet ./cmd/sealet
  # 如果使用 go.work，跳过 go mod tidy（go mod tidy 会忽略 go.work）
  if [[ -z "$(go env GOWORK)" ]]; then
    go mod tidy
  fi

  set -x
  if [[ ! -z ${ENV} ]]; then export ${ENV}; fi
  go build "${GO_BUILD_ARGS}" "${GO_BUILD_LD_ARGS}" -o "${SEA_CMD_ROOT}/${TARGET}/${TARGET}" ${SEA_CMD_ROOT}/${TARGET}/*.go
}

echo "==> Building in $(platform)"
build
