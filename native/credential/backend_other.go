//go:build !windows

package main

import "errors"

func newCredentialBackend() (credentialBackend, error) {
	return nil, errors.New("OS credential backend is unavailable on this platform; release mode fails closed")
}
