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

	reqURL := buildURL(s.cfg.Host, path)
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

	// 非 2xx 状态码直接报错，避免把上游错误页（"404 page not found"
	// 之类的纯文本）当成 JSON 喂给 Unmarshal，掩盖真实失败原因。
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream %s returned HTTP %d: %s",
			reqURL, resp.StatusCode, bodyPreview(respBody, appconfig.PalmResponsePreviewMaxLen))
	}

	return json.RawMessage(respBody), nil
}

// bodyPreview 截取响应体前 N 字节用于错误信息，避免将巨大的上游响应原样回写到 error。
func bodyPreview(body []byte, maxLen int) string {
	if len(body) == 0 {
		return "(empty body)"
	}
	if len(body) <= maxLen {
		return string(body)
	}
	return string(body[:maxLen]) + "...(truncated)"
}

// generateTraceID 生成 32 位小写 hex 的 trace ID。
func generateTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// buildURL 拼接刷掌平台请求 URL。
//
// host 兼容三种形态：
//  1. 已带 scheme："https://palm.example.com" / "http://localhost:8080"
//     直接拼接，便于本地用纯 HTTP mock 联调。
//  2. 仅域名/IP:port："palm.example.com" / "10.0.0.1:9090"
//     默认补 "https://" 前缀，符合生产环境刷掌平台对外 HTTPS 的常态。
//  3. 末尾多余 "/"：会被裁掉，避免出现 "https://host//palm/..."。
func buildURL(host, path string) string {
	host = strings.TrimRight(host, "/")
	if !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") {
		host = "https://" + host
	}
	return host + path
}
