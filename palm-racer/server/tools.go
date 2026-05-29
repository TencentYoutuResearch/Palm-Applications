//go:build tools

// 此文件仅用于保持 proto 编译所需的工具依赖，不会被编译到最终二进制中。
// grpc-gateway v1 的 third_party/googleapis 目录包含 google/api/annotations.proto，
// 供 proto-gen.sh 通过 go list -m 动态获取路径使用。
// genproto 显式引入新版主模块，防止 grpc-gateway v1 间接依赖的旧版 genproto
// 与拆分后的 genproto/googleapis/api、genproto/googleapis/rpc 子模块产生 ambiguous import。
package server

import (
	_ "github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger"
	_ "google.golang.org/genproto/protobuf/field_mask"
)
