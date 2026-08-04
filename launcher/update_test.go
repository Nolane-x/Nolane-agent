package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeUpdateZip(t *testing.T, file string, entries map[string]string) (int64, string) {
	t.Helper()
	handle, err := os.Create(file)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(handle)
	for name, body := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := handle.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(data)
	return int64(len(data)), hex.EncodeToString(hash[:])
}

func writePending(t *testing.T, dataDir, version, packagePath string, bytes int64, hash string) {
	t.Helper()
	updates := filepath.Join(dataDir, "updates")
	if err := os.MkdirAll(updates, 0700); err != nil {
		t.Fatal(err)
	}
	value := pendingUpdate{Schema: "nolane.agent.pending-update.v1", Version: version, PackagePath: packagePath, Bytes: bytes, SHA256: hash, HealthTimeoutMs: 30000}
	body, _ := json.Marshal(value)
	if err := os.WriteFile(filepath.Join(updates, "pending-update.json"), body, 0600); err != nil {
		t.Fatal(err)
	}
}

func TestPrepareAppSelectionAppliesSafePackageAndFinalizes(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	if err := os.MkdirAll(filepath.Join(root, "app", "src"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "app", "src", "app.mjs"), []byte("old"), 0600); err != nil {
		t.Fatal(err)
	}
	packagePath := filepath.Join(dataDir, "updates", "update.zip")
	if err := os.MkdirAll(filepath.Dir(packagePath), 0700); err != nil {
		t.Fatal(err)
	}
	bytes, hash := writeUpdateZip(t, packagePath, map[string]string{"app/src/app.mjs": "new", "app/ui/index.html": "ui"})
	writePending(t, dataDir, "0.3.1", packagePath, bytes, hash)
	selection, err := prepareAppSelection(root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if !selection.Updated || selection.Version != "0.3.1" {
		t.Fatalf("unexpected selection: %+v", selection)
	}
	body, err := os.ReadFile(filepath.Join(selection.AppRoot, "src", "app.mjs"))
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "new" {
		t.Fatalf("unexpected body: %s", body)
	}
	if err := selection.Finalize(true); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dataDir, "updates", "applying-update.json")); !os.IsNotExist(err) {
		t.Fatalf("applying marker remains: %v", err)
	}
	active, err := readActiveVersion(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if active.Version != "0.3.1" || active.PreviousVersion != "" {
		t.Fatalf("unexpected active marker: %+v", active)
	}
}

func TestPrepareAppSelectionRejectsTraversalAndHashMismatch(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	packagePath := filepath.Join(dataDir, "updates", "bad.zip")
	if err := os.MkdirAll(filepath.Dir(packagePath), 0700); err != nil {
		t.Fatal(err)
	}
	bytes, hash := writeUpdateZip(t, packagePath, map[string]string{"../escape": "bad", "app/src/app.mjs": "new"})
	writePending(t, dataDir, "0.3.1", packagePath, bytes, hash)
	if _, err := prepareAppSelection(root, dataDir); err == nil {
		t.Fatal("expected traversal rejection")
	}
	_ = os.Remove(filepath.Join(dataDir, "updates", "pending-update.json"))
	bytes, hash = writeUpdateZip(t, packagePath, map[string]string{"app/src/app.mjs": "new"})
	writePending(t, dataDir, "0.3.1", packagePath, bytes, "0"+hash[1:])
	if _, err := prepareAppSelection(root, dataDir); err == nil {
		t.Fatal("expected hash rejection")
	}
}

func TestPrepareAppSelectionRollsBackToPreviousVersion(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	previous := filepath.Join(root, "versions", "0.3.0", "app", "src")
	if err := os.MkdirAll(previous, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(previous, "app.mjs"), []byte("previous"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := writeActiveVersion(dataDir, activeVersion{Schema: activeVersionSchema, Version: "0.3.0"}); err != nil {
		t.Fatal(err)
	}
	packagePath := filepath.Join(dataDir, "updates", "update.zip")
	if err := os.MkdirAll(filepath.Dir(packagePath), 0700); err != nil {
		t.Fatal(err)
	}
	bytes, hash := writeUpdateZip(t, packagePath, map[string]string{"app/src/app.mjs": "broken"})
	writePending(t, dataDir, "0.3.1", packagePath, bytes, hash)
	selection, err := prepareAppSelection(root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if err := selection.Finalize(false); err != nil {
		t.Fatal(err)
	}
	active, err := readActiveVersion(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if active.Version != "0.3.0" {
		t.Fatalf("rollback failed: %+v", active)
	}
	if _, err := os.Stat(filepath.Join(root, "versions", "0.3.1")); !os.IsNotExist(err) {
		t.Fatalf("failed version remains: %v", err)
	}
}

func TestRecoverIncompleteUpdateRollsBackBeforeNextLaunch(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	for _, version := range []string{"0.3.0", "0.3.1"} {
		directory := filepath.Join(root, "versions", version, "app", "src")
		if err := os.MkdirAll(directory, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(directory, "app.mjs"), []byte(version), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := writeActiveVersion(dataDir, activeVersion{Version: "0.3.1", PreviousVersion: "0.3.0"}); err != nil {
		t.Fatal(err)
	}
	updates := filepath.Join(dataDir, "updates")
	if err := os.MkdirAll(updates, 0700); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(pendingUpdate{Schema: pendingUpdateSchema, Version: "0.3.1", SHA256: strings.Repeat("a", 64), Bytes: 10, PackagePath: filepath.Join(updates, "update.zip")})
	if err := os.WriteFile(filepath.Join(updates, "applying-update.json"), body, 0600); err != nil {
		t.Fatal(err)
	}

	if err := recoverIncompleteUpdate(root, dataDir); err != nil {
		t.Fatal(err)
	}
	active, err := readActiveVersion(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if active.Version != "0.3.0" {
		t.Fatalf("expected rollback to 0.3.0, got %+v", active)
	}
	if _, err := os.Stat(filepath.Join(root, "versions", "0.3.1")); !os.IsNotExist(err) {
		t.Fatalf("failed update directory remains: %v", err)
	}
	if _, err := os.Stat(filepath.Join(updates, "applying-update.json")); !os.IsNotExist(err) {
		t.Fatalf("applying marker remains: %v", err)
	}
	if _, err := os.Stat(filepath.Join(updates, "failed-update-0.3.1.json")); err != nil {
		t.Fatalf("failed marker missing: %v", err)
	}
}

func TestWindowsAtomicMetadataReplacementUsesMoveFileEx(t *testing.T) {
	body, err := os.ReadFile("replace_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(body)
	for _, marker := range []string{"MoveFileExW", "moveFileReplaceExisting", "moveFileWriteThrough"} {
		if !strings.Contains(text, marker) {
			t.Fatalf("missing Windows atomic replacement marker %q", marker)
		}
	}
	updateBody, err := os.ReadFile("update.go")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(updateBody), "replaceFile(temporary, file)") {
		t.Fatal("writeJSONAtomic must use platform replacement")
	}
}
