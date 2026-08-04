package normalizer

import "testing"

func TestNormalizeTrimsAndLowercases(t *testing.T) {
	if got := Normalize("  NoLane  "); got != "nolane" {
		t.Fatalf("expected nolane, got %q", got)
	}
}

func TestNormalizeEmpty(t *testing.T) {
	if got := Normalize("   "); got != "" {
		t.Fatalf("expected empty, got %q", got)
	}
}
