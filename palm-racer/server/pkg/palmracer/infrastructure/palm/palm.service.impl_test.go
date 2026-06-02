package palm

import "testing"

// TestBuildURL 覆盖 host 三种形态：已带 scheme / 裸域名 / 末尾带 /。
func TestBuildURL(t *testing.T) {
	const path = "/palm/openai/search_rgb_palm"

	cases := []struct {
		name string
		host string
		want string
	}{
		{
			name: "host with https scheme keeps it",
			host: "https://palm.example.com",
			want: "https://palm.example.com/palm/openai/search_rgb_palm",
		},
		{
			name: "host with http scheme keeps it (local mock)",
			host: "http://localhost:8080",
			want: "http://localhost:8080/palm/openai/search_rgb_palm",
		},
		{
			name: "bare host defaults to https",
			host: "palm.example.com",
			want: "https://palm.example.com/palm/openai/search_rgb_palm",
		},
		{
			name: "bare host:port defaults to https",
			host: "palm.example.com:9090",
			want: "https://palm.example.com:9090/palm/openai/search_rgb_palm",
		},
		{
			name: "trailing slash is stripped",
			host: "https://palm.example.com/",
			want: "https://palm.example.com/palm/openai/search_rgb_palm",
		},
		{
			name: "bare host with trailing slash defaults to https and stripped",
			host: "palm.example.com/",
			want: "https://palm.example.com/palm/openai/search_rgb_palm",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := buildURL(tc.host, path)
			if got != tc.want {
				t.Errorf("buildURL(%q, %q) = %q, want %q", tc.host, path, got, tc.want)
			}
		})
	}
}
