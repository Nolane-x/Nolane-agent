//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"syscall"
	"unsafe"
)

var (
	kernel32                              = syscall.NewLazyDLL("kernel32.dll")
	procCreatePseudoConsole               = kernel32.NewProc("CreatePseudoConsole")
	procResizePseudoConsole               = kernel32.NewProc("ResizePseudoConsole")
	procClosePseudoConsole                = kernel32.NewProc("ClosePseudoConsole")
	procInitializeProcThreadAttributeList = kernel32.NewProc("InitializeProcThreadAttributeList")
	procUpdateProcThreadAttribute         = kernel32.NewProc("UpdateProcThreadAttribute")
	procDeleteProcThreadAttributeList     = kernel32.NewProc("DeleteProcThreadAttributeList")
	procGetProcessHeap                    = kernel32.NewProc("GetProcessHeap")
	procHeapAlloc                         = kernel32.NewProc("HeapAlloc")
	procHeapFree                          = kernel32.NewProc("HeapFree")
	procCreateProcessW                    = kernel32.NewProc("CreateProcessW")
	procWaitForSingleObject               = kernel32.NewProc("WaitForSingleObject")
	procGetExitCodeProcess                = kernel32.NewProc("GetExitCodeProcess")
	procTerminateProcess                  = kernel32.NewProc("TerminateProcess")
	procCloseHandle                       = kernel32.NewProc("CloseHandle")
)

const (
	procThreadAttributePseudoConsole = 0x00020016
	extendedStartupInfoPresent       = 0x00080000
	createUnicodeEnvironment         = 0x00000400
	infinite                         = 0xFFFFFFFF
)

type coord struct {
	X int16
	Y int16
}
type startupInfo struct {
	Cb                                                                 uint32
	Reserved, Desktop, Title                                           *uint16
	X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags uint32
	ShowWindow, CbReserved2                                            uint16
	Reserved2                                                          *byte
	StdInput, StdOutput, StdErr                                        syscall.Handle
}
type startupInfoEx struct {
	StartupInfo   startupInfo
	AttributeList uintptr
}
type processInformation struct {
	Process   syscall.Handle
	Thread    syscall.Handle
	ProcessID uint32
	ThreadID  uint32
}
type windowsPTY struct {
	input      *os.File
	output     *os.File
	pseudo     uintptr
	process    syscall.Handle
	pid        int
	waitOnce   sync.Once
	waited     chan struct{}
	exitCode   int
	waitErr    error
	attributes uintptr
}

func winError(name string, result uintptr) error {
	if result == 0 {
		return fmt.Errorf("%s failed", name)
	}
	return nil
}
func quoteCommand(shell string, args []string) string {
	values := []string{syscall.EscapeArg(shell)}
	for _, arg := range args {
		values = append(values, syscall.EscapeArg(arg))
	}
	return strings.Join(values, " ")
}

func startPTY(params createParams) (ptyProcess, error) {
	var inputRead, inputWrite, outputRead, outputWrite syscall.Handle
	if err := syscall.CreatePipe(&inputRead, &inputWrite, nil, 0); err != nil {
		return nil, err
	}
	cleanup := func() {
		for _, h := range []syscall.Handle{inputRead, inputWrite, outputRead, outputWrite} {
			if h != 0 {
				procCloseHandle.Call(uintptr(h))
			}
		}
	}
	if err := syscall.CreatePipe(&outputRead, &outputWrite, nil, 0); err != nil {
		cleanup()
		return nil, err
	}
	size := coord{X: int16(params.Cols), Y: int16(params.Rows)}
	var pseudo uintptr
	r, _, e := procCreatePseudoConsole.Call(*(*uintptr)(unsafe.Pointer(&size)), uintptr(inputRead), uintptr(outputWrite), 0, uintptr(unsafe.Pointer(&pseudo)))
	if r != 0 {
		cleanup()
		return nil, fmt.Errorf("CreatePseudoConsole: %w", e)
	}
	procCloseHandle.Call(uintptr(inputRead))
	inputRead = 0
	procCloseHandle.Call(uintptr(outputWrite))
	outputWrite = 0

	var attributeBytes uintptr
	procInitializeProcThreadAttributeList.Call(0, 1, 0, uintptr(unsafe.Pointer(&attributeBytes)))
	heap, _, _ := procGetProcessHeap.Call()
	attributes, _, _ := procHeapAlloc.Call(heap, 0, attributeBytes)
	if attributes == 0 {
		cleanup()
		procClosePseudoConsole.Call(pseudo)
		return nil, fmt.Errorf("HeapAlloc failed")
	}
	r, _, e = procInitializeProcThreadAttributeList.Call(attributes, 1, 0, uintptr(unsafe.Pointer(&attributeBytes)))
	if r == 0 {
		cleanup()
		procClosePseudoConsole.Call(pseudo)
		procHeapFree.Call(heap, 0, attributes)
		return nil, fmt.Errorf("InitializeProcThreadAttributeList: %w", e)
	}
	r, _, e = procUpdateProcThreadAttribute.Call(attributes, 0, procThreadAttributePseudoConsole, pseudo, unsafe.Sizeof(pseudo), 0, 0)
	if r == 0 {
		cleanup()
		procClosePseudoConsole.Call(pseudo)
		procDeleteProcThreadAttributeList.Call(attributes)
		procHeapFree.Call(heap, 0, attributes)
		return nil, fmt.Errorf("UpdateProcThreadAttribute: %w", e)
	}

	commandLine, err := syscall.UTF16PtrFromString(quoteCommand(params.Shell, params.Args))
	if err != nil {
		cleanup()
		return nil, err
	}
	cwd, err := syscall.UTF16PtrFromString(params.Cwd)
	if err != nil {
		cleanup()
		return nil, err
	}
	startup := startupInfoEx{AttributeList: attributes}
	startup.StartupInfo.Cb = uint32(unsafe.Sizeof(startup))
	var info processInformation
	r, _, e = procCreateProcessW.Call(0, uintptr(unsafe.Pointer(commandLine)), 0, 0, 0, extendedStartupInfoPresent|createUnicodeEnvironment, 0, uintptr(unsafe.Pointer(cwd)), uintptr(unsafe.Pointer(&startup)), uintptr(unsafe.Pointer(&info)))
	if r == 0 {
		cleanup()
		procClosePseudoConsole.Call(pseudo)
		procDeleteProcThreadAttributeList.Call(attributes)
		procHeapFree.Call(heap, 0, attributes)
		return nil, fmt.Errorf("CreateProcessW: %w", e)
	}
	procCloseHandle.Call(uintptr(info.Thread))
	p := &windowsPTY{input: os.NewFile(uintptr(inputWrite), "conpty-input"), output: os.NewFile(uintptr(outputRead), "conpty-output"), pseudo: pseudo, process: info.Process, pid: int(info.ProcessID), waited: make(chan struct{}), attributes: attributes}
	go p.wait()
	return p, nil
}

func (p *windowsPTY) wait() {
	p.waitOnce.Do(func() {
		procWaitForSingleObject.Call(uintptr(p.process), infinite)
		var code uint32
		r, _, e := procGetExitCodeProcess.Call(uintptr(p.process), uintptr(unsafe.Pointer(&code)))
		if r == 0 {
			p.waitErr = e
		}
		p.exitCode = int(code)
		close(p.waited)
	})
}
func (p *windowsPTY) Read(data []byte) (int, error)  { return p.output.Read(data) }
func (p *windowsPTY) Write(data []byte) (int, error) { return p.input.Write(data) }
func (p *windowsPTY) Resize(cols, rows int) error {
	size := coord{X: int16(cols), Y: int16(rows)}
	r, _, e := procResizePseudoConsole.Call(p.pseudo, *(*uintptr)(unsafe.Pointer(&size)))
	if r != 0 {
		return e
	}
	return nil
}
func (p *windowsPTY) Terminate() error {
	r, _, e := procTerminateProcess.Call(uintptr(p.process), 1)
	if r == 0 {
		return e
	}
	return nil
}
func (p *windowsPTY) Wait() (int, error) { <-p.waited; return p.exitCode, p.waitErr }
func (p *windowsPTY) PID() int           { return p.pid }
func (p *windowsPTY) Close() error {
	var errs []error
	if p.input != nil {
		if err := p.input.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if p.output != nil {
		if err := p.output.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if p.pseudo != 0 {
		procClosePseudoConsole.Call(p.pseudo)
		p.pseudo = 0
	}
	if p.process != 0 {
		procCloseHandle.Call(uintptr(p.process))
		p.process = 0
	}
	if p.attributes != 0 {
		procDeleteProcThreadAttributeList.Call(p.attributes)
		heap, _, _ := procGetProcessHeap.Call()
		procHeapFree.Call(heap, 0, p.attributes)
		p.attributes = 0
	}
	return errorsJoin(errs)
}
func errorsJoin(values []error) error {
	if len(values) == 0 {
		return nil
	}
	return fmt.Errorf("%v", values)
}

var _ io.Reader = (*windowsPTY)(nil)
