//go:build !windows

package main

import "os/exec"

func configureChild(cmd *exec.Cmd) {}
