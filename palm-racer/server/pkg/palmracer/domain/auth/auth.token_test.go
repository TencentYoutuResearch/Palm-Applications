// Package auth 身份 token 服务的单元测试。
package auth

import (
	"errors"
	"testing"
	"time"
)

const testSecret = "palm-racer-test-secret-at-least-32-bytes!"

func TestTokenServiceIssueAndVerify(t *testing.T) {
	t.Parallel()

	svc := NewTokenService(testSecret, time.Hour)
	token, err := svc.Issue("alice")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	uid, err := svc.Verify(token)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if uid != "alice" {
		t.Errorf("Verify() uid = %q, want alice", uid)
	}
}

func TestTokenServiceVerifyUnauthorized(t *testing.T) {
	t.Parallel()

	svc := NewTokenService(testSecret, time.Hour)
	valid, _ := svc.Issue("bob")

	tests := []struct {
		name  string
		token string
	}{
		{name: "empty", token: ""},
		{name: "malformed", token: "x.y"},
		{name: "tampered", token: valid + "z"},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if _, err := svc.Verify(tt.token); !errors.Is(err, ErrUnauthorized) {
				t.Errorf("Verify(%s) error = %v, want ErrUnauthorized", tt.name, err)
			}
		})
	}
}

func TestTokenServiceWrongSecret(t *testing.T) {
	t.Parallel()

	issuer := NewTokenService(testSecret, time.Hour)
	verifier := NewTokenService("a-totally-different-secret-32-bytes!!", time.Hour)
	token, _ := issuer.Issue("carol")

	if _, err := verifier.Verify(token); !errors.Is(err, ErrUnauthorized) {
		t.Errorf("Verify() with wrong secret error = %v, want ErrUnauthorized", err)
	}
}

func TestTokenServiceExpired(t *testing.T) {
	t.Parallel()

	svc := NewTokenService(testSecret, time.Millisecond)
	token, _ := svc.Issue("dave")
	time.Sleep(10 * time.Millisecond)

	_, err := svc.Verify(token)
	// 过期 token 应同时满足 ErrTokenExpired（细分语义）和 ErrUnauthorized（兼容旧调用方）。
	if !errors.Is(err, ErrTokenExpired) {
		t.Errorf("Verify() expired error = %v, want ErrTokenExpired", err)
	}
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("Verify() expired error = %v, want errors.Is ErrUnauthorized", err)
	}
}

// TestTokenServiceVerifyExpiredVsInvalid 确认非过期失败不会被识别为过期，
// 防止上层基于过期做的"降级到 session"被签名错误等绕过。
func TestTokenServiceVerifyExpiredVsInvalid(t *testing.T) {
	t.Parallel()

	svc := NewTokenService(testSecret, time.Hour)
	tampered, _ := svc.Issue("eve")
	tampered += "x"

	_, err := svc.Verify(tampered)
	if errors.Is(err, ErrTokenExpired) {
		t.Errorf("Verify(tampered) error = %v, must NOT match ErrTokenExpired", err)
	}
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("Verify(tampered) error = %v, want ErrUnauthorized", err)
	}
}
