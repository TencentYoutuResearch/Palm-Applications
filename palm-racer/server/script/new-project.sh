#!/usr/bin/env bash

# fail on any error
set -euo pipefail
#set -o xtrace

SEA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
NEW_PROJECT_NAME=
NEW_GIT_REPOSITORY_NAME=
DOWNLOAD_DIR=${SEA_ROOT}/.download
SEA_TEMPLATE_TAR_FILE="${DOWNLOAD_DIR}/master.zip"
SEA_MASTER_TEMPLATE_ROOT_DIR="${DOWNLOAD_DIR}/sea-master"
SEA_TEMPLATE_ROOT_DIR="${DOWNLOAD_DIR}/sea"
SEA_TEMPLATE_PROJECT_NAME=date
RENAME_PRJECT_SCRIPT=${SEA_TEMPLATE_ROOT_DIR}/script/rename-project.sh
#RENAME_PRJECT_SCRIPT=${SEA_ROOT}/script/rename-project.sh
OLD_GIT_REPOSITORY_NAME="github.com/kaydxh/sea"

help() {
    echo "Usage:"
    echo "./new-project.sh [-t target  -g git_package_address]"
    echo "Description:"
    echo "target, the name of new project."
    echo "git_package_address."
    exit -1
}

while getopts 't:g:' option; do
  case ${option} in
    t) NEW_PROJECT_NAME=${OPTARG};;
    g) NEW_GIT_REPOSITORY_NAME=${OPTARG};;
    ?) help ;;
  esac
done

function usage() {
    echo >&2 "Usage: $0 NEW_PROJECT_NAME"
}

function checkParams {
  if [[ -z "${NEW_PROJECT_NAME}" ]]; then
    help
    exit 1
  fi
}

function downloadSeaProject() {
  rm -rf ${DOWNLOAD_DIR}
  mkdir -p ${DOWNLOAD_DIR}
  curl -s -L -o ${SEA_TEMPLATE_TAR_FILE} https://github.com/kaydxh/sea/archive/refs/heads/master.zip
}

function tarFile() {
  #tar xvzf ${SEA_TEMPLATE_TAR_FILE} -C ${DOWNLOAD_DIR}
  unzip ${SEA_TEMPLATE_TAR_FILE} -d ${DOWNLOAD_DIR}
  mv ${SEA_MASTER_TEMPLATE_ROOT_DIR} ${SEA_TEMPLATE_ROOT_DIR}
}

function newProject() {
  cd ${SEA_TEMPLATE_ROOT_DIR}; bash ${RENAME_PRJECT_SCRIPT} -s "${SEA_TEMPLATE_PROJECT_NAME}" -t "${NEW_PROJECT_NAME}" -l "${OLD_GIT_REPOSITORY_NAME}" -r "${NEW_GIT_REPOSITORY_NAME}"
  for it in $(find . ! -path "*third_party*" ! -path "*node_modules*" -type f)
  do
   echo "src file: ${it}, dst file: ${SEA_ROOT}/${it}" 
   #dst=$(dirname ${SEA_ROOT}/${it})
   mkdir -p $(dirname ${SEA_ROOT}/${it})
   mv -nv ${it} ${SEA_ROOT}/${it}
  done

 # rm  -rf ${DOWNLOAD_DIR}
}

checkParams 
downloadSeaProject
tarFile
newProject
