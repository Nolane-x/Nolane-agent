//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

const (
	tiocgptn   = 0x80045430
	tiocsptlck = 0x40045431
	tiocswinsz = 0x5414
)

type winsize struct {
	Row    uint16
	Col    uint16
	Xpixel uint16
	Ypixel uint16
}
type unixPTY struct {
	master   *os.File
	cmd      *exec.Cmd
	waited   chan struct{}
	exitCode int
	waitErr  error
}

func ioctl(fd uintptr, request uintptr, value unsafe.Pointer) error {
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, fd, request, uintptr(value))
	if errno != 0 {
		return errno
	}
	return nil
}

func startPTY(params createParams) (ptyProcess, error) {
	master, err := os.OpenFile("/dev/ptmx", os.O_RDWR|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, fmt.Errorf("open /dev/ptmx: %w", err)
	}
	cleanup := func(e error) (ptyProcess, error) { _ = master.Close(); return nil, e }
	unlock := int32(0)
	if err := ioctl(master.Fd(), tiocsptlck, unsafe.Pointer(&unlock)); err != nil {
		return cleanup(fmt.Errorf("unlock PTY: %w", err))
	}
	var number uint32
	if err := ioctl(master.Fd(), tiocgptn, unsafe.Pointer(&number)); err != nil {
		return cleanup(fmt.Errorf("get PTY number: %w", err))
	}
	slavePath := filepath.Join("/dev/pts", fmt.Sprint(number))
	slave, err := os.OpenFile(slavePath, os.O_RDWR, 0)
	if err != nil {
		return cleanup(fmt.Errorf("open PTY slave: %w", err))
	}
	size := winsize{Row: uint16(params.Rows), Col: uint16(params.Cols)}
	if err := ioctl(master.Fd(), tiocswinsz, unsafe.Pointer(&size)); err != nil {
		_ = slave.Close()
		return cleanup(fmt.Errorf("resize PTY: %w", err))
	}
	cmd := exec.Command(params.Shell, params.Args...)
	cmd.Dir = params.Cwd
	cmd.Env = os.Environ()
	for key, value := range params.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = slave, slave, slave
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Setctty: true, Ctty: 0, Pdeathsig: syscall.SIGKILL}
	if err := cmd.Start(); err != nil {
		_ = slave.Close()
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
	size := winsize{Row: uint16(rows), Col: uint16(cols)}
	return ioctl(p.master.Fd(), tiocswinsz, unsafe.Pointer(&size))
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
