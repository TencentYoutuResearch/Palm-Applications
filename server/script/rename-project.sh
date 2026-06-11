#!/usr/bin/env bash

# Fail on any error
set -euo pipefail
set -o xtrace
#
#
PROJECT_ROOT_NAME=sea
OLD_PROJECT_NAME=
NEW_PROJECT_NAME=
OLD_PROJECT_DASH_NAME="${PROJECT_ROOT_NAME}-${OLD_PROJECT_NAME}"
NEW_PROJECT_DASH_NAME="${PROJECT_ROOT_NAME}-${NEW_PROJECT_NAME}"
OLD_PROJECT_JOINT_NAME="${PROJECT_ROOT_NAME}${OLD_PROJECT_NAME}"
# 删除${NEW_PROJECT_NAME}中的-
NEW_PROJECT_JOINT_NAME="${PROJECT_ROOT_NAME}${NEW_PROJECT_NAME//-/}"

OLD_GIT_REPOSITORY_NAME=  #github.com/kaydxh/sea
NEW_GIT_REPOSITORY_NAME=  #gitlab.com/kaydxh/sea

help() {
    echo "Usage:"
    echo "rename-project.sh [-s source -t target -l old_git_address -r new_git_address]"
    echo "Description:"
    echo "source, the name of old project."
    echo "target, the name of new project."
    echo "old_git_address, the name of old git address."
    echo "new_git_address, the name of new git address."
    echo "sourc and target must have value"
    echo "old_git_address and new_git_address must have value in the same time"
    exit -1
}

while getopts 's:t:l:r::' option; do
  case ${option} in
    s) OLD_PROJECT_NAME=${OPTARG};;
    t) NEW_PROJECT_NAME=${OPTARG};;
    l) OLD_GIT_REPOSITORY_NAME=${OPTARG};;
    r) NEW_GIT_REPOSITORY_NAME=${OPTARG};;
    ?) help ;;
  esac
done

function init() {
  OLD_PROJECT_DASH_NAME="${PROJECT_ROOT_NAME}-${OLD_PROJECT_NAME}"
  NEW_PROJECT_DASH_NAME="${PROJECT_ROOT_NAME}-${NEW_PROJECT_NAME}"
  OLD_PROJECT_JOINT_NAME="${PROJECT_ROOT_NAME}${OLD_PROJECT_NAME}"
  # 删除${NEW_PROJECT_NAME}中的-
  # https://www.codeplayer.org/Wiki/Program/Shell/%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%88%AA%E5%8F%96%E3%80%81%E6%9B%BF%E6%8D%A2%E3%80%81%E5%88%A0%E9%99%A4.html#org6ed1d5e
  NEW_PROJECT_JOINT_NAME="${PROJECT_ROOT_NAME}${NEW_PROJECT_NAME//-/}"
}


function checkParams() {
  if [[ -z "${OLD_PROJECT_NAME}" ]]  || [[ -z "${NEW_PROJECT_NAME}" ]]; then
    help
    exit 1
  fi

  if [[ -z "${OLD_GIT_REPOSITORY_NAME}" ]]  && [[ ! -z "${NEW_GIT_REPOSITORY_NAME}" ]]; then
    echo "OLD_GIT_REPOSITORY_NAME is empty"
    exit 1
  fi

  if [[ ! -z "${OLD_GIT_REPOSITORY_NAME}" ]]  && [[ -z "${NEW_GIT_REPOSITORY_NAME}" ]]; then
    echo "NEW_GIT_REPOSITORY_NAM is empty"
    exit 1
  fi

}


# #代表删除从前往后最小匹配的内容
# %代表删除从后往前最小匹配的内容
# %/*代表取从头到最后一个slash之前的所有内容
# */代表去取从第一个slash之后的所有内容

# sed 默认大小写敏感，/i参数不区分大小写
function renameFilesAndDirectories() {
  for it in $(find . ! -path "*third_party*" ! -path "*node_modules*" -type f -path "*${OLD_PROJECT_NAME}*")
  do
    newIt="${it//${OLD_PROJECT_JOINT_NAME}/${NEW_PROJECT_JOINT_NAME}}"
    newIt="${newIt//${OLD_PROJECT_DASH_NAME}/${NEW_PROJECT_DASH_NAME}}"
    newIt="${newIt//${OLD_PROJECT_NAME}/${NEW_PROJECT_NAME//-/}}"
    renameProjectDir ${it} ${newIt}
  done

  if [[ x"${OLD_PROJECT_NAME}" != x"${NEW_PROJECT_NAME}" ]]; then
    echo ""
    rmDirectories 
  fi
}

# $1 file or dir name
# 老服务文件名/目录名 替换为 新服务文件名/目录名
function renameProjectDir() {
    oldFile=$1
    newFile=$2
    #newFile=`echo ${oldFile} | sed -e "s/${OLD_PROJECT_NAME}/${NEW_PROJECT_NAME}/g"`
    #newFile=`echo ${oldFile} | sed -e "s/$2/$3/g"`
    newDir=${newFile%/*}
    if [[ -f ${oldFile} ]]; then mkdir -p ${newDir}; mv -nv ${oldFile} ${newFile}; echo "${oldFile} ==> ${newFile}"; fi
}

function rmDirectories {
  for it in $(find . ! -path "*third_party*" ! -path "*node_modules*"  -type d -path "*${OLD_PROJECT_NAME}*")
  do
    oldDir=${it}
    rm -rf ${oldDir}
  done
}

function replaceContentOfFiles() {
   #首字母大写替换
   #将OLD_PROJECT_NAME变量值的首字母转化为大写，并保存在UPPER_BEGIN_OLD_PROJECT_NAME变量中
 # UPPER_BEGIN_OLD_PROJECT_NAME=$(echo ${OLD_PROJECT_NAME:0:1} | tr '[a-z]' '[A-Z]')${OLD_PROJECT_NAME:1}
 # UPPER_BEGIN_NEW_PROJECT_NAME=$(echo ${NEW_PROJECT_NAME:0:1} | tr '[a-z]' '[A-Z]')${NEW_PROJECT_NAME:1}
 # 最后1是打印所有行
 # https://unix.stackexchange.com/questions/701219/convert-the-first-letter-of-all-separated-parts-of-a-filename-to-uppercase-e
  UPPER_BEGIN_OLD_PROJECT_NAME=$(echo ${OLD_PROJECT_NAME} |  awk 'BEGIN{FS=OFS="-"} {for (i=1;i<=NF;i++) {$i=toupper(substr($i,1,1)) substr($i,2)}}1')
  UPPER_BEGIN_NEW_PROJECT_NAME=$(echo ${NEW_PROJECT_NAME} |  awk 'BEGIN{FS=OFS="-"} {for (i=1;i<=NF;i++) {$i=toupper(substr($i,1,1)) substr($i,2)}}1')
  #for it in $(grep -E -RIl --exclude-dir={*third_party*,*node_modules*,*output*} '${OLD_PROJECT_NAME}|${UPPER_BEGIN_OLD_PROJECT_NAME}' .)
  for it in $(grep -E -RIl --exclude-dir={third_party,node_modules,script,output} "${OLD_PROJECT_NAME}|${UPPER_BEGIN_OLD_PROJECT_NAME}" .)
  do
    echo "${it}"
    # skip soft link file
    if [[ -h ${it} ]];then
      continue
    fi
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "/Validate/!s/${OLD_PROJECT_DASH_NAME}/${NEW_PROJECT_DASH_NAME}/g" "${it}" 
    sed -i '' "/Validate/!s/${OLD_PROJECT_NAME}/${NEW_PROJECT_NAME//-/}/g" "${it}" 
    sed -i '' "s/${UPPER_BEGIN_OLD_PROJECT_NAME}/${UPPER_BEGIN_NEW_PROJECT_NAME//-/}/g" "${it}"
  else
    sed -i "/Validate/!s/${OLD_PROJECT_DASH_NAME}/${NEW_PROJECT_DASH_NAME}/g" "${it}" 
    sed -i "/Validate/!s/${OLD_PROJECT_NAME}/${NEW_PROJECT_NAME//-/}/g" "${it}" 
    sed -i "s/${UPPER_BEGIN_OLD_PROJECT_NAME}/${UPPER_BEGIN_NEW_PROJECT_NAME//-/}/g" "${it}"
  fi

   # support by base 4.0
   #sed -i "" "s/${OLD_PROJECT_NAME^}/${NEW_PROJECT_NAME^}/g" "${it}"
  done
}

function replaceString() {
    ESCAPED_OLD_GIT_NAME=$(printf '%s\n' "$1" | sed -e 's/[]\/$*.^[]/\\&/g')
    ESCAPED_NEW_GIT_NAME=$(printf '%s\n' "$2" | sed -e 's/[]\/$*.^[]/\\&/g')
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/${ESCAPED_OLD_GIT_NAME}/${ESCAPED_NEW_GIT_NAME}/g" "${it}"
  else
    sed -i "s/${ESCAPED_OLD_GIT_NAME}/${ESCAPED_NEW_GIT_NAME}/g" "${it}"
  fi
   # support by base 4.0
   #sed -i "" "s/${OLD_PROJECT_NAME^}/${NEW_PROJECT_NAME^}/g" "${it}"
}


function replaceGitRespositoryNameOfFiles() {
  if [[ -z ${OLD_GIT_REPOSITORY_NAME} || -z ${NEW_GIT_REPOSITORY_NAME} ]]; then
    exit
  fi
  for it in $(grep -RIl --exclude-dir={third_party,node_modules,script,output} --exclude={rename-project.sh,Makefile} "${OLD_GIT_REPOSITORY_NAME}" .)
  do
    echo "${it}"
    # skip soft link file
    if [[ -h ${it} ]];then
      continue
    fi

    OLD_GIT_NAME=${OLD_GIT_REPOSITORY_NAME}/${OLD_PROJECT_NAME}
    NEW_GIT_NAME=${NEW_GIT_REPOSITORY_NAME}/${NEW_PROJECT_NAME}
    replaceString ${OLD_GIT_NAME} ${NEW_GIT_NAME}
    replaceString ${OLD_GIT_REPOSITORY_NAME} ${NEW_GIT_REPOSITORY_NAME}
  done
}


function replaceProjectRootName() {
  if [[ -d ../${OLD_PROJECT_NAME} ]]; then
    mv ../${OLD_PROJECT_NAME} ../${NEW_PROJECT_NAME}
  fi
}

init
checkParams 
renameFilesAndDirectories
replaceContentOfFiles 
replaceProjectRootName 
replaceGitRespositoryNameOfFiles 

