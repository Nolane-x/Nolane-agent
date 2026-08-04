package main

import "testing"

func TestAliasValidationAndTargetRoundTrip(t *testing.T) {
	for _, value := range []string{"forge.provider.openai", "main", "account-1:local"} {
		if err := validateAlias(value); err != nil {
			t.Fatalf("%q: %v", value, err)
		}
	}
	for _, value := range []string{"", "../bad", "bad/account", " space"} {
		if err := validateAlias(value); err == nil {
			t.Fatalf("expected invalid alias: %q", value)
		}
	}
	target, err := credentialTarget("forge.provider.openai", "main")
	if err != nil {
		t.Fatal(err)
	}
	service, account, ok := parseCredentialTarget(target)
	if !ok || service != "forge.provider.openai" || account != "main" {
		t.Fatalf("round trip: %q %q %v", service, account, ok)
	}
}
