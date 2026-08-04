package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"sync"
	"time"
)

const protocolVersion = 1
const maxFrameBytes = 1024 * 1024
const defaultRingBytes = 2 * 1024 * 1024

type request struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type response struct {
	ID     string    `json:"id,omitempty"`
	Result any       `json:"result,omitempty"`
	Error  *rpcError `json:"error,omitempty"`
	Method string    `json:"method,omitempty"`
	Params any       `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type createParams struct {
	ID    string            `json:"id"`
	Cwd   string            `json:"cwd"`
	Shell string            `json:"shell"`
	Args  []string          `json:"args"`
	Cols  int               `json:"cols"`
	Rows  int               `json:"rows"`
	Env   map[string]string `json:"env"`
}

func (p createParams) validate() error {
	if p.ID == "" {
		return errors.New("session id is required")
	}
	if p.Cwd == "" {
		return errors.New("cwd is required")
	}
	if p.Shell == "" {
		return errors.New("shell is required")
	}
	if p.Cols == 0 {
		p.Cols = 100
	}
	if p.Rows == 0 {
		p.Rows = 30
	}
	if p.Cols < 20 || p.Cols > 500 || p.Rows < 5 || p.Rows > 200 {
		return errors.New("invalid terminal size")
	}
	if len(p.Args) > 128 || len(p.Env) > 64 {
		return errors.New("terminal request exceeds limits")
	}
	return nil
}

type outputChunk struct {
	Cursor uint64 `json:"cursor"`
	Data   string `json:"data"`
}
type outputRing struct {
	mu     sync.Mutex
	max    int
	bytes  int
	cursor uint64
	data   []byte
}

func newOutputRing(max int) *outputRing {
	if max < 1 {
		max = 1
	}
	return &outputRing{max: max}
}
func (r *outputRing) append(data []byte) outputChunk {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cursor++
	r.data = append(r.data, data...)
	if len(r.data) > r.max {
		r.data = append([]byte(nil), r.data[len(r.data)-r.max:]...)
	}
	r.bytes = len(r.data)
	return outputChunk{Cursor: r.cursor, Data: base64.StdEncoding.EncodeToString(data)}
}
func (r *outputRing) snapshot(after uint64) []outputChunk {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cursor == 0 || after >= r.cursor || len(r.data) == 0 {
		return []outputChunk{}
	}
	return []outputChunk{{Cursor: r.cursor, Data: base64.StdEncoding.EncodeToString(append([]byte(nil), r.data...))}}
}
func (r *outputRing) currentCursor() uint64 { r.mu.Lock(); defer r.mu.Unlock(); return r.cursor }

type ptyProcess interface {
	io.Reader
	io.Writer
	Resize(cols, rows int) error
	Terminate() error
	Wait() (int, error)
	PID() int
	Close() error
}

type session struct {
	mu           sync.Mutex
	id           string
	cwd          string
	shell        string
	args         []string
	cols         int
	rows         int
	state        string
	createdAt    time.Time
	lastActivity time.Time
	process      ptyProcess
	ring         *outputRing
	exitCode     *int
}

func (s *session) view() map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := map[string]any{"id": s.id, "cwd": s.cwd, "shell": s.shell, "args": s.args, "cols": s.cols, "rows": s.rows, "state": s.state, "pid": s.process.PID(), "cursor": s.ring.currentCursor(), "createdAt": s.createdAt.UTC().Format(time.RFC3339Nano), "lastActivityAt": s.lastActivity.UTC().Format(time.RFC3339Nano)}
	if s.exitCode != nil {
		result["exitCode"] = *s.exitCode
	}
	return result
}

type host struct {
	mu        sync.RWMutex
	sessions  map[string]*session
	encoder   *json.Encoder
	outputMu  sync.Mutex
	closing   chan struct{}
	closeOnce sync.Once
}

func newHost(writer io.Writer) *host {
	return &host{sessions: map[string]*session{}, encoder: json.NewEncoder(writer), closing: make(chan struct{})}
}
func (h *host) send(value response) {
	h.outputMu.Lock()
	defer h.outputMu.Unlock()
	_ = h.encoder.Encode(value)
}
func (h *host) notify(method string, params any) { h.send(response{Method: method, Params: params}) }
func (h *host) reply(id string, result any, err error) {
	if err != nil {
		h.send(response{ID: id, Error: &rpcError{Code: -32000, Message: err.Error()}})
		return
	}
	h.send(response{ID: id, Result: result})
}

func decodeParams(raw json.RawMessage, target any) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, target)
}

func (h *host) handle(req request) bool {
	switch req.Method {
	case "initialize":
		h.reply(req.ID, map[string]any{"protocolVersion": protocolVersion, "host": "ForgePty", "capabilities": []string{"pty", "resize", "snapshot", "bounded-output"}}, nil)
	case "session/create":
		var params createParams
		if err := decodeParams(req.Params, &params); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		if params.Cols == 0 {
			params.Cols = 100
		}
		if params.Rows == 0 {
			params.Rows = 30
		}
		if err := params.validate(); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		h.mu.Lock()
		if _, exists := h.sessions[params.ID]; exists {
			h.mu.Unlock()
			h.reply(req.ID, nil, errors.New("session already exists"))
			break
		}
		proc, err := startPTY(params)
		if err != nil {
			h.mu.Unlock()
			h.reply(req.ID, nil, err)
			break
		}
		now := time.Now()
		s := &session{id: params.ID, cwd: params.Cwd, shell: params.Shell, args: append([]string(nil), params.Args...), cols: params.Cols, rows: params.Rows, state: "running", createdAt: now, lastActivity: now, process: proc, ring: newOutputRing(defaultRingBytes)}
		h.sessions[s.id] = s
		h.mu.Unlock()
		h.reply(req.ID, s.view(), nil)
		go h.pump(s)
		go h.wait(s)
	case "session/input":
		var params struct {
			SessionID string `json:"sessionId"`
			Data      string `json:"data"`
		}
		if err := decodeParams(req.Params, &params); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		s, err := h.get(params.SessionID)
		if err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		if len(params.Data) > 64*1024 {
			h.reply(req.ID, nil, errors.New("input exceeds 65536 bytes"))
			break
		}
		n, err := s.process.Write([]byte(params.Data))
		if err == nil {
			s.mu.Lock()
			s.lastActivity = time.Now()
			s.mu.Unlock()
		}
		h.reply(req.ID, map[string]any{"acceptedBytes": n, "cursor": s.ring.currentCursor()}, err)
	case "session/resize":
		var params struct {
			SessionID string `json:"sessionId"`
			Cols      int    `json:"cols"`
			Rows      int    `json:"rows"`
		}
		if err := decodeParams(req.Params, &params); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		s, err := h.get(params.SessionID)
		if err == nil && (params.Cols < 20 || params.Cols > 500 || params.Rows < 5 || params.Rows > 200) {
			err = errors.New("invalid terminal size")
		}
		if err == nil {
			err = s.process.Resize(params.Cols, params.Rows)
		}
		if err == nil {
			s.mu.Lock()
			s.cols, s.rows, s.lastActivity = params.Cols, params.Rows, time.Now()
			s.mu.Unlock()
		}
		h.reply(req.ID, map[string]any{"cols": params.Cols, "rows": params.Rows}, err)
	case "session/snapshot":
		var params struct {
			SessionID string `json:"sessionId"`
			After     uint64 `json:"afterCursor"`
		}
		if err := decodeParams(req.Params, &params); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		s, err := h.get(params.SessionID)
		if err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		h.reply(req.ID, map[string]any{"sessionId": s.id, "cursor": s.ring.currentCursor(), "chunks": s.ring.snapshot(params.After)}, nil)
	case "session/list":
		h.mu.RLock()
		keys := make([]string, 0, len(h.sessions))
		for id := range h.sessions {
			keys = append(keys, id)
		}
		sort.Strings(keys)
		values := make([]map[string]any, 0, len(keys))
		for _, id := range keys {
			values = append(values, h.sessions[id].view())
		}
		h.mu.RUnlock()
		h.reply(req.ID, values, nil)
	case "session/terminate":
		var params struct {
			SessionID string `json:"sessionId"`
		}
		if err := decodeParams(req.Params, &params); err != nil {
			h.reply(req.ID, nil, err)
			break
		}
		s, err := h.get(params.SessionID)
		if err == nil {
			err = s.process.Terminate()
		}
		h.reply(req.ID, map[string]any{"terminated": err == nil}, err)
	case "shutdown":
		h.closeAll()
		h.reply(req.ID, map[string]any{"closing": true}, nil)
		return false
	default:
		h.reply(req.ID, nil, fmt.Errorf("unknown method: %s", req.Method))
	}
	return true
}

func (h *host) get(id string) (*session, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	s := h.sessions[id]
	if s == nil {
		return nil, errors.New("unknown session")
	}
	return s, nil
}
func (h *host) pump(s *session) {
	buffer := make([]byte, 32*1024)
	for {
		n, err := s.process.Read(buffer)
		if n > 0 {
			data := append([]byte(nil), buffer[:n]...)
			chunk := s.ring.append(data)
			s.mu.Lock()
			s.lastActivity = time.Now()
			s.mu.Unlock()
			h.notify("session/output", map[string]any{"sessionId": s.id, "cursor": chunk.Cursor, "data": chunk.Data})
		}
		if err != nil {
			if !errors.Is(err, io.EOF) {
				h.notify("session/error", map[string]any{"sessionId": s.id, "message": err.Error()})
			}
			return
		}
	}
}
func (h *host) wait(s *session) {
	code, err := s.process.Wait()
	s.mu.Lock()
	s.state = "exited"
	s.exitCode = &code
	s.lastActivity = time.Now()
	s.mu.Unlock()
	_ = s.process.Close()
	params := map[string]any{"sessionId": s.id, "exitCode": code}
	if err != nil {
		params["message"] = err.Error()
	}
	h.notify("session/exit", params)
}
func (h *host) closeAll() {
	h.closeOnce.Do(func() {
		close(h.closing)
		h.mu.RLock()
		values := make([]*session, 0, len(h.sessions))
		for _, s := range h.sessions {
			values = append(values, s)
		}
		h.mu.RUnlock()
		for _, s := range values {
			_ = s.process.Terminate()
		}
	})
}

func main() {
	host := newHost(os.Stdout)
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 4096), maxFrameBytes)
	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			host.send(response{Error: &rpcError{Code: -32700, Message: "invalid JSON"}})
			continue
		}
		if req.ID == "" || req.Method == "" {
			host.send(response{ID: req.ID, Error: &rpcError{Code: -32600, Message: "invalid request"}})
			continue
		}
		if !host.handle(req) {
			return
		}
	}
	host.closeAll()
}
