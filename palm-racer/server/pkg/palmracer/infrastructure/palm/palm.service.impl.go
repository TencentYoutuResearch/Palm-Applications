// Package palm 实现刷掌平台 API 代理的基础设施层。
//
// 新版 API 使用 Bearer Token 鉴权 + 直接路径调用，不再需要 TC3 签名或 SM4 加密。
package palm

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	appconfig "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain"
	palmdomain "github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/domain/palm"
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
	// Host API 域名
	Host string
	// APIToken Bearer Token
	APIToken string
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
