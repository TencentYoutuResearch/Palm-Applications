// Package palm 定义刷掌平台 API 代理的领域逻辑接口。
package palm

import "context"

// RgbImageInfo RGB 手掌图片信息。
type RgbImageInfo struct {
	Data      string `json:"Data"`      // base64 编码的图片数据
	ImageType int    `json:"ImageType"` // 图片类型（1=RGB）
}

// SearchRgbPalmRequest 搜索 RGB 手掌请求。
type SearchRgbPalmRequest struct {
	RgbImage *RgbImageInfo `json:"RgbImage"`
	UserId   string        `json:"UserId,omitempty"`
}

// SearchRgbPalmResponseData 搜索 RGB 手掌响应中的 data 字段。
type SearchRgbPalmResponseData struct {
	UserId           string  `json:"UserId"`
	Score            float64 `json:"Score"`
	AlgorithmVersion string  `json:"AlgorithmVersion"`
	PalmDirection    int     `json:"PalmDirection"`
}

// SearchRgbPalmResponse 搜索 RGB 手掌响应。
// 新接口格式: {"code": 0, "message": "...", "data": {...}}
type SearchRgbPalmResponse struct {
	Code    int                        `json:"code"`
	Message string                     `json:"message"`
	Data    *SearchRgbPalmResponseData `json:"data"`
}

// RegisterRgbPalmRequest 注册 RGB 手掌请求。
type RegisterRgbPalmRequest struct {
	UserId  string        `json:"UserId"`
	RgbImage *RgbImageInfo `json:"RgbImage"`
	IsForce bool          `json:"IsForce"`
}

// RegisterRgbPalmResponseData 注册 RGB 手掌响应中的 data 字段。
type RegisterRgbPalmResponseData struct {
	PalmId string `json:"PalmId"`
}

// RegisterRgbPalmResponse 注册 RGB 手掌响应。
// 新接口格式: {"code": 0, "message": "...", "data": {...}}
type RegisterRgbPalmResponse struct {
	Code    int                          `json:"code"`
	Message string                       `json:"message"`
	Data    *RegisterRgbPalmResponseData `json:"data"`
}

// PalmService 刷掌平台 API 代理业务逻辑接口。
type PalmService interface {
	// SearchRgbPalm 搜索 RGB 手掌。
	SearchRgbPalm(ctx context.Context, req *SearchRgbPalmRequest) (*SearchRgbPalmResponse, error)

	// RegisterRgbPalm 注册 RGB 手掌。
	RegisterRgbPalm(ctx context.Context, req *RegisterRgbPalmRequest) (*RegisterRgbPalmResponse, error)
}
