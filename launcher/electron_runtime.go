package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

const electronVersion = "43.2.0"
const electronArchiveSHA256 = "eba5f5088af40ecb364fe258809c79a5234c6ece5a75c64722772eba01b02786"

var drivePath = regexp.MustCompile(`^[A-Za-z]:[/\\]`)

func electronRuntimeRoot(root string) string {
	return filepath.Join(root, "runtime", "electron-"+electronVersion)
}

func findElectronRuntime(root string) (string, bool) {
	directory := electronRuntimeRoot(root)
	executable := filepath.Join(directory, "electron.exe")
	info, err := os.Stat(executable)
	if err != nil || info.IsDir() {
		return "", false
	}
	version, err := os.ReadFile(filepath.Join(directory, "version"))
	if err != nil || strings.TrimSpace(string(version)) != electronVersion {
		return "", false
	}
	return executable, true
}

func verifyElectronArchive(file, expected string) error {
	if !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(expected) {
		return errors.New("invalid Electron archive SHA-256")
	}
	handle, err := os.Open(file)
	if err != nil {
		return err
	}
	defer handle.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, io.LimitReader(handle, 256*1024*1024+1)); err != nil {
		return err
	}
	actual := hex.EncodeToString(digest.Sum(nil))
	if actual != expected {
		return fmt.Errorf("Electron archive SHA-256 mismatch: expected %s, got %s", expected, actual)
	}
	return nil
}

func safeElectronPath(name string) (string, error) {
	value := strings.ReplaceAll(name, `\`, "/")
	if value == "" || strings.HasPrefix(value, "/") || drivePath.MatchString(value) || strings.ContainsRune(value, 0) {
		return "", fmt.Errorf("unsafe Electron archive path: %s", name)
	}
	cleaned := filepath.Clean(filepath.FromSlash(value))
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) || filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("unsafe Electron archive path: %s", name)
	}
	return cleaned, nil
}

func extractElectronArchive(archive, destination string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer reader.Close()
	if len(reader.File) == 0 || len(reader.File) > 2048 {
		return errors.New("Electron archive has invalid entry count")
	}
	if err := os.MkdirAll(destination, 0700); err != nil {
		return err
	}
	var total uint64
	for _, entry := range reader.File {
		if entry.FileInfo().Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("Electron archive symlink is not allowed: %s", entry.Name)
		}
		if entry.UncompressedSize64 > 512*1024*1024 {
			return fmt.Errorf("Electron archive entry exceeds limit: %s", entry.Name)
		}
		total += entry.UncompressedSize64
		if total > 768*1024*1024 {
			return errors.New("Electron archive exceeds uncompressed size limit")
		}
		relative, err := safeElectronPath(entry.Name)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if !pathInside(destination, target) {
			return fmt.Errorf("Electron archive path escapes destination: %s", entry.Name)
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if !entry.Mode().IsRegular() {
			return fmt.Errorf("unsupported Electron archive entry: %s", entry.Name)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		input, err := entry.Open()
		if err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, entry.Mode().Perm()&0777)
		if err != nil {
			_ = input.Close()
			return err
		}
		written, copyErr := io.Copy(output, io.LimitReader(input, int64(entry.UncompressedSize64)+1))
		closeErr := output.Close()
		_ = input.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if uint64(written) != entry.UncompressedSize64 {
			return fmt.Errorf("Electron archive entry size mismatch: %s", entry.Name)
		}
	}
	executable := filepath.Join(destination, "electron.exe")
	if info, err := os.Stat(executable); err != nil || !info.Mode().IsRegular() {
		return errors.New("Electron archive is missing electron executable")
	}
	version, err := os.ReadFile(filepath.Join(destination, "version"))
	if err != nil {
		return errors.New("Electron archive is missing version marker")
	}
	if strings.TrimSpace(string(version)) != electronVersion {
		return fmt.Errorf("Electron archive version mismatch: %s", strings.TrimSpace(string(version)))
	}
	return nil
}

func ensureElectronRuntime(root string, output io.Writer) (string, error) {
	if executable, ok := findElectronRuntime(root); ok {
		return executable, nil
	}
	if runtime.GOOS != "windows" {
		return "", errors.New("Electron runtime bootstrap is currently supported on Windows")
	}
	installer := filepath.Join(root, "Install-Electron-Runtime.ps1")
	if info, err := os.Stat(installer); err != nil || !info.Mode().IsRegular() {
		return "", errors.New("Install-Electron-Runtime.ps1 is missing")
	}
	command := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installer, "-InstallRoot", root)
	command.Dir = root
	command.Stdout = output
	command.Stderr = output
	configureChild(command)
	if err := command.Run(); err != nil {
		return "", fmt.Errorf("install Electron runtime: %w", err)
	}
	executable, ok := findElectronRuntime(root)
	if !ok {
		return "", errors.New("Electron runtime installer completed without a valid pinned runtime")
	}
	return executable, nil
}
