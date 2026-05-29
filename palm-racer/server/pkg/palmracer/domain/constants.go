// Package domain 定义 palmracer 领域层的共享常量和接口。
package domain

import "time"

// ================== Palm Service Configuration ==================

const (
	// PalmSDKVersion is the default version of the Palm SDK.
	// Can be overridden via environment variable: PALM_SDK_VERSION
	PalmSDKVersion = "v1.11.0-v170"

	// PalmTokenRefreshAheadSeconds is the number of seconds before token expiry
	// to proactively refresh the token.
	// Can be overridden via environment variable: PALM_TOKEN_REFRESH_AHEAD_SECONDS
	PalmTokenRefreshAheadSeconds = 60

	// PalmTokenExpirySeconds is the default token expiry time when not provided by API.
	// Can be overridden via environment variable: PALM_TOKEN_EXPIRY_SECONDS
	PalmTokenExpirySeconds = 7200

	// PalmHTTPClientTimeout is the timeout for HTTP requests to Palm platform.
	// Can be overridden via environment variable: PALM_HTTP_CLIENT_TIMEOUT_SECONDS
	PalmHTTPClientTimeout = 5 * time.Second

	// PalmResponsePreviewMaxLen is the maximum length of response preview in logs.
	PalmResponsePreviewMaxLen = 300
)

// ================== Score Service Configuration ==================

const (
	// DefaultLeaderboardPageSize is the default page size for leaderboard queries.
	// Can be overridden via environment variable: LEADERBOARD_DEFAULT_PAGE_SIZE
	DefaultLeaderboardPageSize = 20

	// MaxLeaderboardPageSize is the maximum allowed page size for leaderboard queries.
	// Can be overridden via environment variable: LEADERBOARD_MAX_PAGE_SIZE
	MaxLeaderboardPageSize = 500

	// LeaderboardLimitAll 全时排行榜展示条数（Top 500）。
	LeaderboardLimitAll = 500
	// LeaderboardLimitToday 今日排行榜展示条数（Top 20）。
	LeaderboardLimitToday = 20
	// LeaderboardLimitWeek 本周排行榜展示条数（Top 50）。
	LeaderboardLimitWeek = 50

	// DefaultUserHistoryLimit is the default page size for user history queries.
	DefaultUserHistoryLimit = 20

	// MaxUserHistoryLimit is the maximum allowed page size for user history queries.
	MaxUserHistoryLimit = 100

	// MaxScoreValue is the maximum valid score value.
	MaxScoreValue = 999999

	// MaxSpeedValue is the maximum valid speed value.
	MaxSpeedValue = 1000.0
)

// ================== HTTP/TLS Configuration ==================

const (
	// MinTLSVersion is the minimum TLS version required for connections.
	// Currently set to TLS 1.2 to prevent MITM attacks.
	MinTLSVersion = "tls12"

	// MaxIdleConns is the maximum number of idle connections.
	MaxIdleConns = 20

	// MaxIdleConnsPerHost is the maximum number of idle connections per host.
	MaxIdleConnsPerHost = 10

	// IdleConnTimeout is the timeout for idle connections.
	IdleConnTimeout = 90 * time.Second
)
