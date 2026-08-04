package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const activeVersionSchema = "nolane.agent.active-version.v1"
const legacyActiveVersionSchema = "forge.studio.active-version.v1"
const pendingUpdateSchema = "nolane.agent.pending-update.v1"
const legacyPendingUpdateSchema = "forge.studio.pending-update.v1"

var safeVersion = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$`)

type pendingUpdate struct {
	Schema          string `json:"schema"`
	Version         string `json:"version"`
	SHA256          string `json:"sha256"`
	Bytes           int64  `json:"bytes"`
	PackagePath     string `json:"packagePath"`
	StagedAt        string `json:"stagedAt,omitempty"`
	HealthTimeoutMs int    `json:"healthTimeoutMs,omitempty"`
}

type activeVersion struct {
	Schema          string `json:"schema"`
	Version         string `json:"version"`
	PreviousVersion string `json:"previousVersion,omitempty"`
	ActivatedAt     string `json:"activatedAt,omitempty"`
}

type appSelection struct {
	AppRoot  string
	Version  string
	Updated  bool
	Finalize func(success bool) error
}

func readJSONFile(file string, target any) error {
	body, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	if len(body) > 256*1024 {
		return errors.New("metadata file exceeds limit")
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("invalid JSON metadata: %w", err)
	}
	return nil
}

func writeJSONAtomic(file string, value any) error {
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		return err
	}
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	temporary := fmt.Sprintf("%s.%d.tmp", file, os.Getpid())
	if err := os.WriteFile(temporary, body, 0600); err != nil {
		return err
	}
	if err := replaceFile(temporary, file); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return nil
}

func activeVersionPath(dataDir string) string {
	return filepath.Join(dataDir, "updates", "active-version.json")
}
func readActiveVersion(dataDir string) (activeVersion, error) {
	var value activeVersion
	if err := readJSONFile(activeVersionPath(dataDir), &value); err != nil {
		return activeVersion{}, err
	}
	if (value.Schema != activeVersionSchema && value.Schema != legacyActiveVersionSchema) || !safeVersion.MatchString(value.Version) {
		return activeVersion{}, errors.New("invalid active version marker")
	}
	return value, nil
}
func writeActiveVersion(dataDir string, value activeVersion) error {
	value.Schema = activeVersionSchema
	if !safeVersion.MatchString(value.Version) {
		return errors.New("invalid active version")
	}
	if value.PreviousVersion != "" && !safeVersion.MatchString(value.PreviousVersion) {
		return errors.New("invalid previous version")
	}
	if value.ActivatedAt == "" {
		value.ActivatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	return writeJSONAtomic(activeVersionPath(dataDir), value)
}

func pathInside(root, candidate string) bool {
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(candidate))
	return err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) && !filepath.IsAbs(relative)
}

func hashFile(file string) (int64, string, error) {
	handle, err := os.Open(file)
	if err != nil {
		return 0, "", err
	}
	defer handle.Close()
	info, err := handle.Stat()
	if err != nil {
		return 0, "", err
	}
	hash := sha256.New()
	if _, err := io.Copy(hash, io.LimitReader(handle, info.Size()+1)); err != nil {
		return 0, "", err
	}
	return info.Size(), hex.EncodeToString(hash.Sum(nil)), nil
}

func safeZipPath(name string) (string, error) {
	value := strings.ReplaceAll(name, `\`, "/")
	if value == "" || strings.HasPrefix(value, "/") || strings.ContainsRune(value, 0) || regexp.MustCompile(`^[A-Za-z]:/`).MatchString(value) {
		return "", fmt.Errorf("unsafe ZIP path: %s", name)
	}
	parts := strings.Split(value, "/")
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", fmt.Errorf("unsafe ZIP path: %s", name)
		}
	}
	return filepath.FromSlash(value), nil
}

func extractUpdatePackage(packagePath, destination string) error {
	reader, err := zip.OpenReader(packagePath)
	if err != nil {
		return fmt.Errorf("open update ZIP: %w", err)
	}
	defer reader.Close()
	if len(reader.File) == 0 || len(reader.File) > 100000 {
		return errors.New("update ZIP has invalid entry count")
	}
	var total uint64
	for _, entry := range reader.File {
		if entry.FileInfo().Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("ZIP symlink is not allowed: %s", entry.Name)
		}
		if entry.UncompressedSize64 > 512*1024*1024 {
			return fmt.Errorf("ZIP entry exceeds limit: %s", entry.Name)
		}
		total += entry.UncompressedSize64
		if total > 2*1024*1024*1024 {
			return errors.New("update ZIP exceeds uncompressed size limit")
		}
		relative, err := safeZipPath(entry.Name)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if !pathInside(destination, target) {
			return fmt.Errorf("ZIP path escapes destination: %s", entry.Name)
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
			continue
		}
		if !entry.Mode().IsRegular() {
			return fmt.Errorf("unsupported ZIP entry: %s", entry.Name)
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
			return fmt.Errorf("ZIP entry size mismatch: %s", entry.Name)
		}
	}
	entry := filepath.Join(destination, "app", "src", "app.mjs")
	if info, err := os.Stat(entry); err != nil || !info.Mode().IsRegular() {
		return errors.New("update package is missing app/src/app.mjs")
	}
	return nil
}

func currentAppRoot(root, dataDir string) (string, string) {
	active, err := readActiveVersion(dataDir)
	if err == nil {
		candidate := filepath.Join(root, "versions", active.Version, "app")
		if info, statErr := os.Stat(filepath.Join(candidate, "src", "app.mjs")); statErr == nil && info.Mode().IsRegular() {
			return candidate, active.Version
		}
	}
	return filepath.Join(root, "app"), ""
}

func recoverIncompleteUpdate(root, dataDir string) error {
	updatesDir := filepath.Join(dataDir, "updates")
	applyingPath := filepath.Join(updatesDir, "applying-update.json")
	var applying pendingUpdate
	if err := readJSONFile(applyingPath, &applying); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read incomplete update marker: %w", err)
	}
	if (applying.Schema != pendingUpdateSchema && applying.Schema != legacyPendingUpdateSchema) || !safeVersion.MatchString(applying.Version) {
		return errors.New("invalid incomplete update marker")
	}
	active, err := readActiveVersion(dataDir)
	if err != nil {
		return fmt.Errorf("read active version during recovery: %w", err)
	}
	if active.Version != applying.Version {
		return errors.New("incomplete update does not match active version")
	}
	if active.PreviousVersion != "" {
		previousRoot := filepath.Join(root, "versions", active.PreviousVersion, "app", "src", "app.mjs")
		if info, statErr := os.Stat(previousRoot); statErr != nil || !info.Mode().IsRegular() {
			return errors.New("incomplete update previous version is unavailable")
		}
		if err := writeActiveVersion(dataDir, activeVersion{Version: active.PreviousVersion}); err != nil {
			return err
		}
	} else if err := os.Remove(activeVersionPath(dataDir)); err != nil && !os.IsNotExist(err) {
		return err
	}
	failedPath := filepath.Join(updatesDir, fmt.Sprintf("failed-update-%s.json", applying.Version))
	if err := replaceFile(applyingPath, failedPath); err != nil {
		return err
	}
	if packagePath := filepath.Clean(applying.PackagePath); packagePath != "" {
		if !filepath.IsAbs(packagePath) {
			packagePath = filepath.Join(updatesDir, packagePath)
		}
		if pathInside(updatesDir, packagePath) {
			_ = os.Remove(packagePath)
		}
	}
	return os.RemoveAll(filepath.Join(root, "versions", applying.Version))
}

func prepareAppSelection(root, dataDir string) (appSelection, error) {
	updatesDir := filepath.Join(dataDir, "updates")
	pendingPath := filepath.Join(updatesDir, "pending-update.json")
	applyingPath := filepath.Join(updatesDir, "applying-update.json")
	var pending pendingUpdate
	if err := readJSONFile(pendingPath, &pending); err != nil {
		if os.IsNotExist(err) {
			appRoot, version := currentAppRoot(root, dataDir)
			return appSelection{AppRoot: appRoot, Version: version, Finalize: func(bool) error { return nil }}, nil
		}
		return appSelection{}, fmt.Errorf("read pending update: %w", err)
	}
	if pending.Schema != pendingUpdateSchema || !safeVersion.MatchString(pending.Version) || pending.Bytes < 1 || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(pending.SHA256) {
		return appSelection{}, errors.New("invalid pending update marker")
	}
	packagePath := filepath.Clean(pending.PackagePath)
	if !filepath.IsAbs(packagePath) {
		packagePath = filepath.Join(updatesDir, packagePath)
	}
	if !pathInside(updatesDir, packagePath) {
		return appSelection{}, errors.New("update package must be inside data/updates")
	}
	bytes, digest, err := hashFile(packagePath)
	if err != nil {
		return appSelection{}, err
	}
	if bytes != pending.Bytes || digest != pending.SHA256 {
		return appSelection{}, errors.New("update package size or SHA-256 mismatch")
	}
	previous, _ := readActiveVersion(dataDir)
	versionRoot := filepath.Join(root, "versions", pending.Version)
	staging := versionRoot + fmt.Sprintf(".staging-%d", os.Getpid())
	_ = os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0700); err != nil {
		return appSelection{}, err
	}
	if err := extractUpdatePackage(packagePath, staging); err != nil {
		_ = os.RemoveAll(staging)
		return appSelection{}, err
	}
	_ = os.RemoveAll(versionRoot)
	if err := os.Rename(staging, versionRoot); err != nil {
		_ = os.RemoveAll(staging)
		return appSelection{}, err
	}
	if err := os.Rename(pendingPath, applyingPath); err != nil {
		_ = os.RemoveAll(versionRoot)
		return appSelection{}, err
	}
	if err := writeActiveVersion(dataDir, activeVersion{Version: pending.Version, PreviousVersion: previous.Version}); err != nil {
		_ = os.Rename(applyingPath, pendingPath)
		_ = os.RemoveAll(versionRoot)
		return appSelection{}, err
	}
	finalize := func(success bool) error {
		if success {
			if err := writeActiveVersion(dataDir, activeVersion{Version: pending.Version}); err != nil {
				return err
			}
			_ = os.Remove(applyingPath)
			_ = os.Remove(packagePath)
			return nil
		}
		if previous.Version != "" {
			if err := writeActiveVersion(dataDir, activeVersion{Version: previous.Version}); err != nil {
				return err
			}
		} else {
			_ = os.Remove(activeVersionPath(dataDir))
		}
		failed := filepath.Join(updatesDir, fmt.Sprintf("failed-update-%s.json", pending.Version))
		_ = os.Rename(applyingPath, failed)
		return os.RemoveAll(versionRoot)
	}
	return appSelection{AppRoot: filepath.Join(versionRoot, "app"), Version: pending.Version, Updated: true, Finalize: finalize}, nil
}
