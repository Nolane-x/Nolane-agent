//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

const CREATE_NEW_PROCESS_GROUP = 0x00000200

func configureChild(cmd *exec.Cmd) {
	windowsHide := true
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: windowsHide, CreationFlags: CREATE_NEW_PROCESS_GROUP}
}
