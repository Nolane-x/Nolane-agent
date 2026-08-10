//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
	"unsafe"
)

const (
	jobObjectAssignProcess = 0x0001
	jobObjectTerminate     = 0x0008
	synchronizeAccess      = 0x00100000
	eventModifyState       = 0x0002
	processTerminate       = 0x0001
	processSetQuota        = 0x0100
	waitObject0            = 0x00000000
	waitTimeout            = 0x00000102
	infiniteWait           = 0xffffffff

	jobObjectExtendedLimitInformation = 9
	jobObjectCPURateControlInformation = 15
	jobObjectLimitActiveProcess        = 0x00000008
	jobObjectLimitJobMemory            = 0x00000200
	jobObjectLimitKillOnJobClose       = 0x00002000
	jobObjectCPURateControlEnable      = 0x00000001
	jobObjectCPURateControlHardCap     = 0x00000004

	detachedProcess       = 0x00000008
	createNewProcessGroup = 0x00000200
)

var (
	kernel32                         = syscall.NewLazyDLL("kernel32.dll")
	procCreateJobObjectW             = kernel32.NewProc("CreateJobObjectW")
	procOpenJobObjectW               = kernel32.NewProc("OpenJobObjectW")
	procSetInformationJobObject      = kernel32.NewProc("SetInformationJobObject")
	procAssignProcessToJobObject     = kernel32.NewProc("AssignProcessToJobObject")
	procTerminateJobObject           = kernel32.NewProc("TerminateJobObject")
	procOpenProcess                  = kernel32.NewProc("OpenProcess")
	procCreateEventW                 = kernel32.NewProc("CreateEventW")
	procOpenEventW                   = kernel32.NewProc("OpenEventW")
	procSetEvent                     = kernel32.NewProc("SetEvent")
	procWaitForSingleObject          = kernel32.NewProc("WaitForSingleObject")
	procCloseHandle                  = kernel32.NewProc("CloseHandle")
)

type windowsBackend struct{}

type ioCounters struct {
	ReadOperationCount  uint64
	WriteOperationCount uint64
	OtherOperationCount uint64
	ReadTransferCount   uint64
	WriteTransferCount  uint64
	OtherTransferCount  uint64
}

type basicLimitInformation struct {
	PerProcessUserTimeLimit int64
	PerJobUserTimeLimit     int64
	LimitFlags              uint32
	MinimumWorkingSetSize   uintptr
	MaximumWorkingSetSize   uintptr
	ActiveProcessLimit      uint32
	Affinity                uintptr
	PriorityClass           uint32
	SchedulingClass         uint32
}

type extendedLimitInformation struct {
	BasicLimitInformation basicLimitInformation
	IoInfo                ioCounters
	ProcessMemoryLimit     uintptr
	JobMemoryLimit         uintptr
	PeakProcessMemoryUsed  uintptr
	PeakJobMemoryUsed      uintptr
}

type cpuRateControlInformation struct {
	ControlFlags uint32
	CPURate      uint32
}

func newBackend() jobBackend { return windowsBackend{} }

func objectNames(id string) (job, ready, stop string) {
	return `Local\NolaneAgent.Job.` + id, `Local\NolaneAgent.Ready.` + id, `Local\NolaneAgent.Stop.` + id
}

func ptr(value string) (*uint16, error) { return syscall.UTF16PtrFromString(value) }

func closeHandle(handle uintptr) {
	if handle != 0 {
		procCloseHandle.Call(handle)
	}
}

func failed(api string, callErr error) error {
	if errno, ok := callErr.(syscall.Errno); ok && errno != 0 {
		return fmt.Errorf("%s failed: %w", api, errno)
	}
	return fmt.Errorf("%s failed", api)
}

func openJob(id string, access uint32) (uintptr, error) {
	jobName, _, _ := objectNames(id)
	name, err := ptr(jobName)
	if err != nil {
		return 0, err
	}
	handle, _, callErr := procOpenJobObjectW.Call(uintptr(access), 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return 0, failed("OpenJobObjectW", callErr)
	}
	return handle, nil
}

func openEvent(nameValue string, access uint32) (uintptr, error) {
	name, err := ptr(nameValue)
	if err != nil {
		return 0, err
	}
	handle, _, callErr := procOpenEventW.Call(uintptr(access), 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return 0, failed("OpenEventW", callErr)
	}
	return handle, nil
}

func (windowsBackend) capabilities() (map[string]any, error) {
	for name, procedure := range map[string]*syscall.LazyProc{
		"CreateJobObjectW": procCreateJobObjectW,
		"SetInformationJobObject": procSetInformationJobObject,
		"AssignProcessToJobObject": procAssignProcessToJobObject,
		"TerminateJobObject": procTerminateJobObject,
	} {
		if err := procedure.Find(); err != nil {
			return nil, fmt.Errorf("%s unavailable: %w", name, err)
		}
	}
	return map[string]any{"jobObjects": true, "version": helperVersion, "platform": "windows", "supervised": true}, nil
}

func (windowsBackend) create(id string, limits jobLimits) (map[string]any, error) {
	if existing, err := openJob(id, synchronizeAccess); err == nil {
		closeHandle(existing)
		return nil, errors.New("job id is already active")
	}
	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}
	command := exec.Command(executable, "hold", "--id", id,
		"--cpu-percent", fmt.Sprint(limits.CPUPercent),
		"--memory-bytes", fmt.Sprint(limits.MemoryBytes),
		"--process-count", fmt.Sprint(limits.ProcessCount))
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: detachedProcess | createNewProcessGroup, HideWindow: true}
	if err := command.Start(); err != nil {
		return nil, err
	}
	_ = command.Process.Release()

	_, readyName, _ := objectNames(id)
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		ready, openErr := openEvent(readyName, synchronizeAccess)
		if openErr == nil {
			result, _, _ := procWaitForSingleObject.Call(ready, 50)
			closeHandle(ready)
			if result == waitObject0 {
				return map[string]any{"id": id, "state": "created", "supervised": true}, nil
			}
		}
		time.Sleep(25 * time.Millisecond)
	}
	return nil, errors.New("timed out waiting for Job Object supervisor")
}

func configureJob(job uintptr, limits jobLimits) error {
	if uint64(uintptr(limits.MemoryBytes)) != limits.MemoryBytes {
		return errors.New("memory-bytes exceeds platform pointer size")
	}
	extended := extendedLimitInformation{
		BasicLimitInformation: basicLimitInformation{
			LimitFlags: jobObjectLimitActiveProcess | jobObjectLimitJobMemory | jobObjectLimitKillOnJobClose,
			ActiveProcessLimit: uint32(limits.ProcessCount),
		},
		JobMemoryLimit: uintptr(limits.MemoryBytes),
	}
	result, _, callErr := procSetInformationJobObject.Call(job, jobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&extended)), unsafe.Sizeof(extended))
	if result == 0 {
		return failed("SetInformationJobObject(extended)", callErr)
	}
	cpu := cpuRateControlInformation{ControlFlags: jobObjectCPURateControlEnable | jobObjectCPURateControlHardCap, CPURate: uint32(limits.CPUPercent * 100)}
	result, _, callErr = procSetInformationJobObject.Call(job, jobObjectCPURateControlInformation, uintptr(unsafe.Pointer(&cpu)), unsafe.Sizeof(cpu))
	if result == 0 {
		return failed("SetInformationJobObject(cpu)", callErr)
	}
	return nil
}

func createNamedEvent(nameValue string) (uintptr, error) {
	name, err := ptr(nameValue)
	if err != nil {
		return 0, err
	}
	handle, _, callErr := procCreateEventW.Call(0, 1, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return 0, failed("CreateEventW", callErr)
	}
	return handle, nil
}

func (windowsBackend) hold(id string, limits jobLimits) error {
	jobName, readyName, stopName := objectNames(id)
	jobNamePtr, err := ptr(jobName)
	if err != nil {
		return err
	}
	job, _, callErr := procCreateJobObjectW.Call(0, uintptr(unsafe.Pointer(jobNamePtr)))
	if job == 0 {
		return failed("CreateJobObjectW", callErr)
	}
	defer closeHandle(job)
	ready, err := createNamedEvent(readyName)
	if err != nil {
		return err
	}
	defer closeHandle(ready)
	stop, err := createNamedEvent(stopName)
	if err != nil {
		return err
	}
	defer closeHandle(stop)
	if err := configureJob(job, limits); err != nil {
		return err
	}
	if result, _, callErr := procSetEvent.Call(ready); result == 0 {
		return failed("SetEvent(ready)", callErr)
	}
	result, _, callErr := procWaitForSingleObject.Call(stop, infiniteWait)
	if result != waitObject0 {
		return failed("WaitForSingleObject(stop)", callErr)
	}
	return nil
}

func (windowsBackend) attach(id string, pid uint64) (map[string]any, error) {
	job, err := openJob(id, jobObjectAssignProcess)
	if err != nil {
		return nil, err
	}
	defer closeHandle(job)
	process, _, callErr := procOpenProcess.Call(processSetQuota|processTerminate, 0, uintptr(uint32(pid)))
	if process == 0 {
		return nil, failed("OpenProcess", callErr)
	}
	defer closeHandle(process)
	if result, _, callErr := procAssignProcessToJobObject.Call(job, process); result == 0 {
		return nil, failed("AssignProcessToJobObject", callErr)
	}
	return map[string]any{"id": id, "pid": pid, "state": "attached"}, nil
}

func (windowsBackend) terminate(id string) (map[string]any, error) {
	job, err := openJob(id, jobObjectTerminate)
	if err != nil {
		return nil, err
	}
	if result, _, callErr := procTerminateJobObject.Call(job, 1); result == 0 {
		closeHandle(job)
		return nil, failed("TerminateJobObject", callErr)
	}
	closeHandle(job)
	_, _, stopName := objectNames(id)
	stop, err := openEvent(stopName, eventModifyState)
	if err != nil {
		return nil, err
	}
	defer closeHandle(stop)
	if result, _, callErr := procSetEvent.Call(stop); result == 0 {
		return nil, failed("SetEvent(stop)", callErr)
	}
	return map[string]any{"id": id, "state": "terminated"}, nil
}
