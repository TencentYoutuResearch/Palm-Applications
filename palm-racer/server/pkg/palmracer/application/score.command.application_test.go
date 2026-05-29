package application

import (
	"context"
	"testing"

	"github.com/TencentYoutuResearch/Palm-Applications/palm-racer/server/pkg/palmracer/infrastructure/database/model"
)

// mockScoreRepo is a minimal mock for ScoreRepository.
type mockScoreRepo struct {
	insertCalled bool
	insertErr    error
}

func (m *mockScoreRepo) InsertScore(_ context.Context, _, _ string, _ int, _, _ float64, _ bool, _ string) error {
	m.insertCalled = true
	return m.insertErr
}

func (m *mockScoreRepo) GetLeaderboard(_ context.Context, _ string, _ int, _ int) ([]model.LeaderboardEntry, error) {
	return nil, nil
}

func (m *mockScoreRepo) GetLeaderboardTotal(_ context.Context, _ string, _ int) (int, error) {
	return 0, nil
}

func (m *mockScoreRepo) GetUserRank(_ context.Context, _, _ string) (model.LeaderboardEntry, bool, error) {
	return model.LeaderboardEntry{}, false, nil
}

func (m *mockScoreRepo) GetUserHistory(_ context.Context, _ string, _ int64, _ int32) ([]model.HistoryEntry, error) {
	return nil, nil
}

func (m *mockScoreRepo) GetUserHistoryStats(_ context.Context, _ string) (model.UserHistoryStats, error) {
	return model.UserHistoryStats{}, nil
}

func TestSubmitScore_Validation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		req     *SubmitScoreRequest
		wantErr bool
	}{
		{
			name:    "valid request",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, MaxSpeed: 50.5, SurviveTime: 120.0},
			wantErr: false,
		},
		{
			name:    "empty user_id",
			req:     &SubmitScoreRequest{UserID: "", Score: 100},
			wantErr: true,
		},
		{
			name:    "negative score",
			req:     &SubmitScoreRequest{UserID: "u1", Score: -1},
			wantErr: true,
		},
		{
			name:    "score too high",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 1000000},
			wantErr: true,
		},
		{
			name:    "score at max boundary",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 999999},
			wantErr: false,
		},
		{
			name:    "score zero",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 0},
			wantErr: false,
		},
		{
			name:    "negative max_speed",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, MaxSpeed: -0.1},
			wantErr: true,
		},
		{
			name:    "max_speed too high",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, MaxSpeed: 1001},
			wantErr: true,
		},
		{
			name:    "max_speed at boundary",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, MaxSpeed: 1000},
			wantErr: false,
		},
		{
			name:    "negative survive_time",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, SurviveTime: -1},
			wantErr: true,
		},
		{
			name:    "survive_time too high",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, SurviveTime: 3601},
			wantErr: true,
		},
		{
			name:    "survive_time at boundary",
			req:     &SubmitScoreRequest{UserID: "u1", Score: 100, SurviveTime: 3600},
			wantErr: false,
		},
		{
			name:    "with optional fields",
			req:     &SubmitScoreRequest{UserID: "u1", UserName: "Alice", Score: 500, Cheated: true, CheatUserID: "u2"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			// 每个子测试使用独立的 mock，避免并行写入导致 data race
			localRepo := &mockScoreRepo{}
			localHandler := NewScoreHandler(localRepo)
			err := localHandler.SubmitScore(context.Background(), tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("SubmitScore() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSubmitScore_NilRepo(t *testing.T) {
	t.Parallel()

	handler := NewScoreHandler(nil)
	err := handler.SubmitScore(context.Background(), &SubmitScoreRequest{UserID: "u1", Score: 100})
	if err == nil {
		t.Error("expected error for nil repo, got nil")
	}
}

func TestGetLeaderboard_Defaults(t *testing.T) {
	t.Parallel()

	repo := &mockScoreRepo{}
	handler := NewScoreHandler(repo)

	// Test with empty period and zero page size → should use defaults
	_, err := handler.GetLeaderboard(context.Background(), &GetLeaderboardRequest{})
	if err != nil {
		t.Errorf("GetLeaderboard() unexpected error: %v", err)
	}
}

func TestGetLeaderboard_NilRepo(t *testing.T) {
	t.Parallel()

	handler := NewScoreHandler(nil)
	_, err := handler.GetLeaderboard(context.Background(), &GetLeaderboardRequest{})
	if err == nil {
		t.Error("expected error for nil repo, got nil")
	}
}

func TestGetUserHistory_Validation(t *testing.T) {
	t.Parallel()

	repo := &mockScoreRepo{}
	handler := NewScoreHandler(repo)

	// Empty user ID should fail
	_, err := handler.GetUserHistory(context.Background(), &GetUserHistoryRequest{UserID: ""})
	if err == nil {
		t.Error("expected error for empty user_id, got nil")
	}

	// Nil repo should fail
	nilHandler := NewScoreHandler(nil)
	_, err = nilHandler.GetUserHistory(context.Background(), &GetUserHistoryRequest{UserID: "u1"})
	if err == nil {
		t.Error("expected error for nil repo, got nil")
	}
}
