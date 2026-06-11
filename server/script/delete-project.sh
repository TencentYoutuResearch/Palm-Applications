#!/usr/bin/env bash

# fail on any error
set -euo pipefail
#set -o xtrace

SEA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PROJECT_NAME=

help() {
    echo "Usage:"
    echo "./delete-project.sh [-t target]"
    echo "Description:"
    echo "target, the name of delete project."
    exit -1
}

while getopts 't:' option; do
  case ${option} in
    t) PROJECT_NAME=${OPTARG};;
    ?) help ;;
  esac
done

function usage() {
    echo >&2 "Usage: $0 PROJECT_NAME"
}

function checkParams {
  if [[ -z "${PROJECT_NAME}" ]]; then
    help
    exit 1
  fi
}

function deleteProject() {
  PROJECT_JOINT_NAME="${PROJECT_NAME//-/}"
  for it in $(find . ! -path "*third_party*" ! -path "*node_modules*" -type d -path "*${PROJECT_NAME}*" -o -path "*${PROJECT_JOINT_NAME}*")
  do
   echo "delete dir: ${it}" 
   rm -rf ${it}
  done
}

checkParams 
deleteProject
