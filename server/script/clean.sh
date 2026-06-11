# Created on 2020-10-11 21:04:00
#!/usr/bin/env bash

# Fail on any error
set -euo pipefail

OUT_PUT_PATH=pack
help() {
    echo "Usage:"
    echo "getopts.sh [-d dir]"
    echo "Description:"
    echo "dir,the name of direction."
    exit -1
}

while getopts 'd::' option; do
  case ${option} in
    d) OUT_PUT_PATH=${OPTARG};;
    ?) help ;;
  esac
done

echo " ==> Clean..."
if [[ -d  ${OUT_PUT_PATH} ]]; then
  rm -rf ${OUT_PUT_PATH} >/dev/null 2>&1 || true
fi

echo "==> Clean finish"
