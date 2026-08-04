//go:build windows

package main

import (
	"errors"
	"fmt"
	"syscall"
	"unsafe"
)

var (
	advapi32           = syscall.NewLazyDLL("advapi32.dll")
	procCredWriteW     = advapi32.NewProc("CredWriteW")
	procCredReadW      = advapi32.NewProc("CredReadW")
	procCredEnumerateW = advapi32.NewProc("CredEnumerateW")
	procCredDeleteW    = advapi32.NewProc("CredDeleteW")
	procCredFree       = advapi32.NewProc("CredFree")
)

const (
	credTypeGeneric         = 1
	credPersistLocalMachine = 2
	errorNotFound           = 1168
	maxWindowsSecretBytes   = 2560
)

type filetime struct {
	LowDateTime  uint32
	HighDateTime uint32
}
type credentialAttribute struct {
	Keyword   *uint16
	Flags     uint32
	ValueSize uint32
	Value     *byte
}
type credential struct {
	Flags              uint32
	Type               uint32
	TargetName         *uint16
	Comment            *uint16
	LastWritten        filetime
	CredentialBlobSize uint32
	CredentialBlob     *byte
	Persist            uint32
	AttributeCount     uint32
	Attributes         *credentialAttribute
	TargetAlias        *uint16
	UserName           *uint16
}
type windowsCredentialBackend struct{}

func newCredentialBackend() (credentialBackend, error) { return &windowsCredentialBackend{}, nil }
func (b *windowsCredentialBackend) Name() string       { return "windows-credential-manager" }
func windowsError(name string, err error) error {
	if errno, ok := err.(syscall.Errno); ok && errno != 0 {
		return fmt.Errorf("%s: %w", name, errno)
	}
	return fmt.Errorf("%s failed", name)
}

func (b *windowsCredentialBackend) Set(service, account string, secret []byte) error {
	target, err := credentialTarget(service, account)
	if err != nil {
		return err
	}
	if len(secret) == 0 {
		return errors.New("secret is required")
	}
	if len(secret) > maxWindowsSecretBytes {
		return fmt.Errorf("secret exceeds %d byte Windows Credential Manager limit", maxWindowsSecretBytes)
	}
	targetPtr, err := syscall.UTF16PtrFromString(target)
	if err != nil {
		return err
	}
	userPtr, err := syscall.UTF16PtrFromString(account)
	if err != nil {
		return err
	}
	value := credential{Type: credTypeGeneric, TargetName: targetPtr, CredentialBlobSize: uint32(len(secret)), CredentialBlob: &secret[0], Persist: credPersistLocalMachine, UserName: userPtr}
	result, _, callErr := procCredWriteW.Call(uintptr(unsafe.Pointer(&value)), 0)
	if result == 0 {
		return windowsError("CredWriteW", callErr)
	}
	return nil
}
func (b *windowsCredentialBackend) Resolve(service, account string) ([]byte, error) {
	target, err := credentialTarget(service, account)
	if err != nil {
		return nil, err
	}
	targetPtr, err := syscall.UTF16PtrFromString(target)
	if err != nil {
		return nil, err
	}
	var value uintptr
	result, _, callErr := procCredReadW.Call(uintptr(unsafe.Pointer(targetPtr)), credTypeGeneric, 0, uintptr(unsafe.Pointer(&value)))
	if result == 0 {
		if errno, ok := callErr.(syscall.Errno); ok && errno == errorNotFound {
			return nil, nil
		}
		return nil, windowsError("CredReadW", callErr)
	}
	defer procCredFree.Call(value)
	cred := (*credential)(unsafe.Pointer(value))
	if cred.CredentialBlobSize == 0 || cred.CredentialBlob == nil {
		return []byte{}, nil
	}
	source := unsafe.Slice(cred.CredentialBlob, int(cred.CredentialBlobSize))
	output := append([]byte(nil), source...)
	return output, nil
}
func (b *windowsCredentialBackend) List(service string) ([]credentialRecord, error) {
	filter := credentialPrefix + "*"
	if service != "" {
		if err := validateAlias(service); err != nil {
			return nil, err
		}
		filter = credentialPrefix + service + "/*"
	}
	filterPtr, err := syscall.UTF16PtrFromString(filter)
	if err != nil {
		return nil, err
	}
	var count uint32
	var values uintptr
	result, _, callErr := procCredEnumerateW.Call(uintptr(unsafe.Pointer(filterPtr)), 0, uintptr(unsafe.Pointer(&count)), uintptr(unsafe.Pointer(&values)))
	if result == 0 {
		if errno, ok := callErr.(syscall.Errno); ok && errno == errorNotFound {
			return []credentialRecord{}, nil
		}
		return nil, windowsError("CredEnumerateW", callErr)
	}
	defer procCredFree.Call(values)
	pointers := unsafe.Slice((**credential)(unsafe.Pointer(values)), int(count))
	records := make([]credentialRecord, 0, count)
	for _, ptr := range pointers {
		if ptr == nil || ptr.TargetName == nil {
			continue
		}
		target := syscall.UTF16ToString((*[32768]uint16)(unsafe.Pointer(ptr.TargetName))[:])
		itemService, account, ok := parseCredentialTarget(target)
		if ok {
			records = append(records, credentialRecord{Service: itemService, Account: account, Present: true})
		}
	}
	return records, nil
}
func (b *windowsCredentialBackend) Delete(service, account string) (bool, error) {
	target, err := credentialTarget(service, account)
	if err != nil {
		return false, err
	}
	targetPtr, err := syscall.UTF16PtrFromString(target)
	if err != nil {
		return false, err
	}
	result, _, callErr := procCredDeleteW.Call(uintptr(unsafe.Pointer(targetPtr)), credTypeGeneric, 0)
	if result == 0 {
		if errno, ok := callErr.(syscall.Errno); ok && errno == errorNotFound {
			return false, nil
		}
		return false, windowsError("CredDeleteW", callErr)
	}
	return true, nil
}
