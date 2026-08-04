package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func electronArchive(t *testing.T, entries map[string]string) ([]byte, string) {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, body := range entries {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(buffer.Bytes())
	return buffer.Bytes(), hex.EncodeToString(digest[:])
}

func TestVerifyElectronArchiveRejectsWrongHash(t *testing.T) {
	root := t.TempDir()
	archive := filepath.Join(root, "electron.zip")
	body, _ := electronArchive(t, map[string]string{"electron.exe": "binary", "version": electronVersion})
	if err := os.WriteFile(archive, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := verifyElectronArchive(archive, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); err == nil {
		t.Fatal("expected hash mismatch")
	}
}

func TestExtractElectronArchiveRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	archive := filepath.Join(root, "electron.zip")
	body, _ := electronArchive(t, map[string]string{"../escape.txt": "bad", "electron.exe": "binary", "version": electronVersion})
	if err := os.WriteFile(archive, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := extractElectronArchive(archive, filepath.Join(root, "runtime")); err == nil {
		t.Fatal("expected traversal rejection")
	}
	if _, err := os.Stat(filepath.Join(root, "escape.txt")); !os.IsNotExist(err) {
		t.Fatalf("escape created: %v", err)
	}
}

func TestExtractElectronArchiveRequiresPinnedRuntime(t *testing.T) {
	root := t.TempDir()
	archive := filepath.Join(root, "electron.zip")
	body, _ := electronArchive(t, map[string]string{"electron.exe": "binary", "version": electronVersion})
	if err := os.WriteFile(archive, body, 0600); err != nil {
		t.Fatal(err)
	}
	destination := filepath.Join(root, "runtime")
	if err := extractElectronArchive(archive, destination); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(destination, "electron.exe")); err != nil {
		t.Fatal(err)
	}
	version, err := os.ReadFile(filepath.Join(destination, "version"))
	if err != nil {
		t.Fatal(err)
	}
	if string(version) != electronVersion {
		t.Fatalf("version=%q", version)
	}
}

func TestFindElectronRuntimeUsesPinnedInstalledCopy(t *testing.T) {
	root := t.TempDir()
	installed := filepath.Join(root, "runtime", "electron-"+electronVersion)
	if err := os.MkdirAll(installed, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(installed, "electron.exe"), []byte("binary"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(installed, "version"), []byte(electronVersion), 0600); err != nil {
		t.Fatal(err)
	}
	got, ok := findElectronRuntime(root)
	if !ok {
		t.Fatal("expected installed runtime")
	}
	if got != filepath.Join(installed, "electron.exe") {
		t.Fatalf("runtime=%s", got)
	}
}

func TestNewElectronCommandLaunchesAppWithIsolatedUserData(t *testing.T) {
	root := t.TempDir()
	appRoot := filepath.Join(root, "app")
	dataDir := filepath.Join(root, "data")
	runtimeFile := filepath.Join(dataDir, "runtime-electron.json")
	command := newElectronCommand(filepath.Join(root, "runtime", "electron.exe"), appRoot, dataDir, runtimeFile)
	if len(command.Args) != 2 || command.Args[1] != appRoot {
		t.Fatalf("args=%v", command.Args)
	}
	joined := strings.Join(command.Env, "\n")
	for _, expected := range []string{"NOLANE_AGENT_ELECTRON_USER_DATA=" + dataDir, "NOLANE_AGENT_ELECTRON_RUNTIME_FILE=" + runtimeFile} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("missing %s", expected)
		}
	}
}
