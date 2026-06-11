#!/usr/bin/env bash

# exit by command return non-zero exit code
set -o errexit
# Indicate an error when it encounters an undefined variable
set -o nounset
# Fail on any error.
set -o pipefail
# set -o xtrace

function get_version_from_git() {
  GIT="git"
  GIT_COMMIT=$("${GIT}" rev-parse "HEAD^{commit}")
  GIT_TAG=$(git describe --long --tags --dirty --tags --always)
  GIT_BUILD_TIME=$(TZ=UTC date -u '+%Y-%m-%dT%H:%M:%SZ')


  GIT_DIRTY=$(test -n "`git status --porcelain`" && echo "+CHANGES" || true)

  GIT_TREE_STATE=${GIT_TREE_STATE-}
  if git_status=$("${GIT}" status --porcelain) && [[ -z ${git_status} ]]; then
     GIT_TREE_STATE="clean"
  else
     GIT_TREE_STATE="dirty"
  fi
}

function ldflags() {
  get_version_from_git

  local -a ldflags
  function add_ldflag() {
    local key=${1}
    local val=${2}

    # update the list github.com/kaydxh/golang/pkg/webserver/app.
    ldflags+=(
      "-X 'github.com/kaydxh/golang/pkg/webserver/app.${key}=${val}'"
    )
  }

 add_ldflag "buildDate" "${GIT_BUILD_TIME}"
 add_ldflag "gitVersion" "${GIT_TAG}"
 add_ldflag "gitCommit" "${GIT_COMMIT}"
 add_ldflag "gitTreeState" "${GIT_TREE_STATE}"
 add_ldflag "appName" "$1"

 # "$*" => get arg1 arg2 arg3 as a single argument "a1 a2 a3"
 # "$@" => gets arg1, arg2 and arg3 as a separate arguments "a1" "a2" "a3"
 # if no quotes, $* is the same to $@, as a separate arguments "a1" "a2" "a3"

 echo "${ldflags[*]}"
}
