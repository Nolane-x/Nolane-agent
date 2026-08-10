package main

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

type fakeBackend struct {
	created jobLimits
	id      string
	pid     uint64
}

func (backend *fakeBackend) capabilities() (map[string]any, error) { return map[string]any{"jobObjects": true}, nil }
func (backend *fakeBackend) create(id string, limits jobLimits) (map[string]any, error) { backend.id, backend.created = id, limits; return map[string]any{"id": id}, nil }
func (backend *fakeBackend) attach(id string, pid uint64) (map[string]any, error) { backend.id, backend.pid = id, pid; return map[string]any{"id": id}, nil }
func (backend *fakeBackend) terminate(id string) (map[string]any, error) { backend.id = id; return map[string]any{"id": id}, nil }
func (backend *fakeBackend) hold(string, jobLimits) error { return errors.New("not used") }

func TestCreateParsesBoundedLimits(t *testing.T) {
	backend := &fakeBackend{}
	var stdout, stderr bytes.Buffer
	exit := run([]string{"create", "--id", "gate-1", "--cpu-percent", "50", "--memory-bytes", "1048576", "--process-count", "4"}, &stdout, &stderr, backend)
	if exit != 0 { t.Fatalf("exit=%d stderr=%s", exit, stderr.String()) }
	if backend.id != "gate-1" || backend.created.CPUPercent != 50 || backend.created.MemoryBytes != 1048576 || backend.created.ProcessCount != 4 { t.Fatalf("unexpected create: %#v", backend) }
}

func TestRejectsUnsafeIDAndLimits(t *testing.T) {
	for _, args := range [][]string{
		{"create", "--id", "../escape", "--cpu-percent", "50", "--memory-bytes", "1", "--process-count", "1"},
		{"create", "--id", "safe", "--cpu-percent", "0", "--memory-bytes", "1", "--process-count", "1"},
		{"attach", "--id", "safe", "--pid", "0"},
	} {
		var stdout, stderr bytes.Buffer
		if exit := run(args, &stdout, &stderr, &fakeBackend{}); exit == 0 || strings.TrimSpace(stderr.String()) == "" { t.Fatalf("expected failure for %v", args) }
	}
}
