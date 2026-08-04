package main

import (
	"bytes"
	"encoding/base64"
	"testing"
)

func TestRingBufferBoundsAndSnapshots(t *testing.T) {
	ring := newOutputRing(10)
	ring.append([]byte("123456"))
	first := ring.cursor
	ring.append([]byte("abcdef"))
	if ring.bytes != 10 {
		t.Fatalf("bytes=%d", ring.bytes)
	}
	chunks := ring.snapshot(0)
	if len(chunks) != 1 {
		t.Fatalf("chunks=%d", len(chunks))
	}
	decoded, err := base64.StdEncoding.DecodeString(chunks[0].Data)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(decoded, []byte("3456abcdef")) {
		t.Fatalf("snapshot=%q", decoded)
	}
	if got := ring.snapshot(first); len(got) != 1 || got[0].Cursor != ring.cursor {
		t.Fatalf("cursor snapshot=%v", got)
	}
}

func TestValidateCreateRequest(t *testing.T) {
	request := createParams{ID: "s1", Cwd: "/tmp", Shell: "/bin/sh", Cols: 120, Rows: 40}
	if err := request.validate(); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []createParams{
		{Cwd: "/tmp", Shell: "/bin/sh"},
		{ID: "s1", Shell: "/bin/sh"},
		{ID: "s1", Cwd: "/tmp"},
		{ID: "s1", Cwd: "/tmp", Shell: "/bin/sh", Cols: 9999, Rows: 40},
	} {
		if err := invalid.validate(); err == nil {
			t.Fatalf("expected invalid: %+v", invalid)
		}
	}
}
