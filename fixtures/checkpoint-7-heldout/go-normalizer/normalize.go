package normalizer

import "strings"

func Normalize(input string) string {
	normalized := strings.TrimSpace(input)
	return strings.ToLower(normalized)
}
