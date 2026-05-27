// Package palm 实现刷掌平台 API 代理的基础设施层。
//
// 新版 API 使用 Bearer Token 鉴权 + 直接路径调用，不再需要 TC3 签名或 SM4 加密。
package palm

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

appconfig "github.com/EdgeSenseAI/palm-racer/server/pkg/palmracer/domain"
	palmdomain "github.com/EdgeSenseAI/palm-racer/server/pkg/palmracer/domain/palm"
	io_ "github.com/kaydxh/golang/go/io"
	http_ "github.com/kaydxh/golang/go/net/http"
	logs_ "github.com/kaydxh/golang/pkg/logs"
)

const (
	// 上游 API 路径前缀
	pathSearchRgbPalm   = "/palm/openai/search_rgb_palm"
	pathRegisterRgbPalm = "/palm/openai/register_rgb_palm"
)

// PalmConfig 刷掌平台 API 配置。
type PalmConfig struct {
	// Host API 域名（如 open.palmoa.youtu.qq.com）
	Host string
	// APIToken Bearer Token（存储在 yaml secret_key 字段）
	APIToken string
	// DumpEnabled 是否保存 1:N 搜索接口传入的图片
	DumpEnabled bool
	// DumpDir 图片保存目录
	DumpDir string
}

type palmServiceImpl struct {
	cfg    *PalmConfig
	client *http_.Client
}

// NewPalmService 创建刷掌平台代理业务逻辑实例。
func NewPalmService(cfg *PalmConfig) palmdomain.PalmService {
	client, err := http_.NewClient(
		http_.WithTimeout(appconfig.PalmHTTPClientTimeout),
		http_.WithMaxIdleConns(appconfig.MaxIdleConns),
		http_.WithIdleConnTimeout(appconfig.IdleConnTimeout),
	)
	if err != nil {
		panic(fmt.Sprintf("palm: create http client: %v", err))
	}
	return &palmServiceImpl{
		cfg:    cfg,
		client: client,
	}
}

// SearchRgbPalm 搜索 RGB 手掌。
func (s *palmServiceImpl) SearchRgbPalm(ctx context.Context, req *palmdomain.SearchRgbPalmRequest) (*palmdomain.SearchRgbPalmResponse, error) {
	respBody, err := s.doRequest(ctx, pathSearchRgbPalm, req)
	if err != nil {
		return nil, fmt.Errorf("palm_service: search rgb palm: %w", err)
	}

	var resp palmdomain.SearchRgbPalmResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("palm_service: unmarshal search response: %w", err)
	}

	// 异步保存搜索图片到磁盘，便于排查问题
	if s.cfg.DumpEnabled && req.RgbImage != nil && req.RgbImage.Data != "" {
		rawBuf, decErr := base64.StdEncoding.DecodeString(req.RgbImage.Data)
		if decErr == nil {
			respUserID := ""
			if resp.Data != nil {
				respUserID = resp.Data.UserId
			}
			go saveDumpImage(ctx, s.cfg, rawBuf, "search", req.UserId, respUserID, resp.Code)
		}
	}

	return &resp, nil
}

// RegisterRgbPalm 注册 RGB 手掌。
func (s *palmServiceImpl) RegisterRgbPalm(ctx context.Context, req *palmdomain.RegisterRgbPalmRequest) (*palmdomain.RegisterRgbPalmResponse, error) {
	respBody, err := s.doRequest(ctx, pathRegisterRgbPalm, req)
	if err != nil {
		return nil, fmt.Errorf("palm_service: register rgb palm: %w", err)
	}

	var resp palmdomain.RegisterRgbPalmResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("palm_service: unmarshal register response: %w", err)
	}

	// 异步保存注册图片到磁盘，便于排查问题
	if s.cfg.DumpEnabled && req.RgbImage != nil && req.RgbImage.Data != "" {
		rawBuf, decErr := base64.StdEncoding.DecodeString(req.RgbImage.Data)
		if decErr == nil {
			go saveDumpImage(ctx, s.cfg, rawBuf, "register", req.UserId, "", resp.Code)
		}
	}

	return &resp, nil
}

// doRequest 发送 POST 请求到刷掌平台，附带 Bearer Token 和 X-TraceId。
func (s *palmServiceImpl) doRequest(ctx context.Context, path string, payload interface{}) (json.RawMessage, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	reqURL := fmt.Sprintf("https://%s%s", s.cfg.Host, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.APIToken)
	req.Header.Set("X-TraceId", generateTraceID())

	logger := logs_.GetLogger(ctx)
	logger.Infof("[Proxy] -> POST %s", reqURL)

	resp, err := s.client.Do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("request to %s: %w", reqURL, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	logger.Infof("[Proxy] <- %d (%d bytes)", resp.StatusCode, len(respBody))
	if len(respBody) > 0 {
		preview := string(respBody)
		if len(preview) > appconfig.PalmResponsePreviewMaxLen {
			preview = preview[:appconfig.PalmResponsePreviewMaxLen]
		}
		logger.Infof("[Proxy]   Response: %s", preview)
	}

	return json.RawMessage(respBody), nil
}

// generateTraceID 生成 32 位小写 hex 的 trace ID。
func generateTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// saveDumpImage 将图片保存到磁盘（按日期分目录）。
// 文件名格式：{时间戳}_{操作}_{userId}_code{响应码}_{识别userId}.jpg
// 异步调用，不影响主流程性能。
// 清理逻辑由 diskcleaner 插件统一处理，此处不再自行清理。
func saveDumpImage(ctx context.Context, cfg *PalmConfig, imageData []byte, action string, userID string, detectedUserID string, respCode int) {
	if cfg == nil || !cfg.DumpEnabled || cfg.DumpDir == "" {
		return
	}

	now := time.Now()

	// 按日期创建子目录，便于管理和清理
	dateDir := filepath.Join(cfg.DumpDir, now.Format("2006-01-02"))

	// 构建文件名：时间戳_操作_userId_code响应码_detected_识别userId.jpg
	if detectedUserID == "" {
		detectedUserID = "none"
	}
	filename := fmt.Sprintf("%s_%s_%s_code%d_detected_%s.jpg",
		now.Format("150405.000"),
		action,
		sanitizeFileName(userID),
		respCode,
		sanitizeFileName(detectedUserID),
	)
	filePath := filepath.Join(dateDir, filename)

	// 使用 golang 基础库的 WriteFile，内部自动创建目录
	if err := io_.WriteFile(filePath, imageData, false); err != nil {
		logs_.GetLogger(ctx).Warnf("[Dump] 保存图片失败: path=%s, err=%v", filePath, err)
		return
	}

	logs_.GetLogger(ctx).Infof("[Dump] 图片已保存: path=%s, size=%d bytes, action=%s, code=%d, user=%s, detected=%s",
		filePath, len(imageData), action, respCode, userID, detectedUserID)
}

// sanitizeFileName 清理文件名中的非法字符。
func sanitizeFileName(name string) string {
	if name == "" {
		return "unknown"
	}
	replacer := strings.NewReplacer(
		"/", "_", "\\", "_", ":", "_", "*", "_",
		"?", "_", "\"", "_", "<", "_", ">", "_", "|", "_",
	)
	result := replacer.Replace(name)
	if len(result) > 64 {
		result = result[:64]
	}
	return result
}


