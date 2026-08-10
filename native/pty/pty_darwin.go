//go:build darwin && cgo

package main

/*
#cgo LDFLAGS: -lutil
#include <errno.h>
#include <sys/ioctl.h>
#include <util.h>

static int forge_openpty(int *master, int *slave, unsigned short rows, unsigned short cols) {
	struct winsize size = { .ws_row = rows, .ws_col = cols, .ws_xpixel = 0, .ws_ypixel = 0 };
	if (openpty(master, slave, NULL, NULL, &size) == 0) return 0;
	return errno;
}

static int forge_resize(int fd, unsigned short rows, unsigned short cols) {
	struct winsize size = { .ws_row = rows, .ws_col = cols, .ws_xpixel = 0, .ws_ypixel = 0 };
	if (ioctl(fd, TIOCSWINSZ, &size) == 0) return 0;
	return errno;
}
*/
import "C"

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
)

type unixPTY struct {
	master   *os.File
	cmd      *exec.Cmd
	waited   chan struct{}
	exitCode int
	waitErr  error
}

func startPTY(params createParams) (ptyProcess, error) {
	var masterFD, slaveFD C.int
	if errno := C.forge_openpty(&masterFD, &slaveFD, C.ushort(params.Rows), C.ushort(params.Cols)); errno != 0 {
		return nil, fmt.Errorf("open PTY: %w", syscall.Errno(errno))
	}
	master := os.NewFile(uintptr(masterFD), "pty-master")
	slave := os.NewFile(uintptr(slaveFD), "pty-slave")
	cleanup := func(e error) (ptyProcess, error) {
		_ = master.Close()
		_ = slave.Close()
		return nil, e
	}
	cmd := exec.Command(params.Shell, params.Args...)
	cmd.Dir = params.Cwd
	cmd.Env = os.Environ()
	for key, value := range params.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = slave, slave, slave
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Setctty: true, Ctty: 0}
	if err := cmd.Start(); err != nil {
		return cleanup(fmt.Errorf("start PTY process: %w", err))
	}
	_ = slave.Close()
	p := &unixPTY{master: master, cmd: cmd, waited: make(chan struct{})}
	go func() {
		p.waitErr = cmd.Wait()
		if cmd.ProcessState != nil {
			p.exitCode = cmd.ProcessState.ExitCode()
		}
		close(p.waited)
	}()
	return p, nil
}

func (p *unixPTY) Read(data []byte) (int, error)  { return p.master.Read(data) }
func (p *unixPTY) Write(data []byte) (int, error) { return p.master.Write(data) }
func (p *unixPTY) Resize(cols, rows int) error {
	if errno := C.forge_resize(C.int(p.master.Fd()), C.ushort(rows), C.ushort(cols)); errno != 0 {
		return syscall.Errno(errno)
	}
	return nil
}
func (p *unixPTY) Terminate() error {
	if p.cmd.Process == nil {
		return nil
	}
	_ = syscall.Kill(-p.cmd.Process.Pid, syscall.SIGTERM)
	select {
	case <-p.waited:
		return nil
	case <-time.After(750 * time.Millisecond):
	}
	return syscall.Kill(-p.cmd.Process.Pid, syscall.SIGKILL)
}
func (p *unixPTY) Wait() (int, error) { <-p.waited; return p.exitCode, p.waitErr }
func (p *unixPTY) PID() int {
	if p.cmd.Process == nil {
		return 0
	}
	return p.cmd.Process.Pid
}
func (p *unixPTY) Close() error { return p.master.Close() }
