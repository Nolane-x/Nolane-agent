//go:build darwin && !cgo

package main

import "errors"

func startPTY(createParams) (ptyProcess, error) {
	return nil, errors.New("native PTY support on macOS requires CGO")
}
