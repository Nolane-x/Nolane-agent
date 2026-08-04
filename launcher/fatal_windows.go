//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

func showFatalError(message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	title, _ := syscall.UTF16PtrFromString("Nolane Agent")
	body, _ := syscall.UTF16PtrFromString(message)
	_, _, _ = proc.Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x10)
}
