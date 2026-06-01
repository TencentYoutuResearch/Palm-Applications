package options

import (
	"testing"
	"time"
)

// TestResolveTokenTTL 覆盖三种语义：正值采用、0 走 fallback、负值表示永不过期。
func TestResolveTokenTTL(t *testing.T) {
	const fallback = 7 * 24 * time.Hour

	cases := []struct {
		name     string
		cfgValue int32
		want     time.Duration
	}{
		{
			name:     "positive value used as-is",
			cfgValue: 3600,
			want:     time.Hour,
		},
		{
			name:     "zero falls back to default (treated as unset)",
			cfgValue: 0,
			want:     fallback,
		},
		{
			name:     "negative one means never expire",
			cfgValue: -1,
			want:     0,
		},
		{
			name:     "any negative value means never expire",
			cfgValue: -9999,
			want:     0,
		},
		{
			name:     "small positive boundary",
			cfgValue: 1,
			want:     time.Second,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveTokenTTL(tc.cfgValue, fallback)
			if got != tc.want {
				t.Errorf("resolveTokenTTL(%d, %v) = %v, want %v",
					tc.cfgValue, fallback, got, tc.want)
			}
		})
	}
}
