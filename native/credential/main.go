package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
)

const credentialPrefix = "ForgeStudio/"
const maxCredentialFrame = 64 * 1024

var aliasPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)

func validateAlias(value string) error {
	if !aliasPattern.MatchString(value) {
		return errors.New("credential alias is invalid")
	}
	return nil
}
func credentialTarget(service, account string) (string, error) {
	if err := validateAlias(service); err != nil {
		return "", err
	}
	if err := validateAlias(account); err != nil {
		return "", err
	}
	return credentialPrefix + service + "/" + account, nil
}
func parseCredentialTarget(target string) (string, string, bool) {
	if !strings.HasPrefix(target, credentialPrefix) {
		return "", "", false
	}
	parts := strings.Split(strings.TrimPrefix(target, credentialPrefix), "/")
	if len(parts) != 2 || validateAlias(parts[0]) != nil || validateAlias(parts[1]) != nil {
		return "", "", false
	}
	return parts[0], parts[1], true
}

type credentialRecord struct {
	Service string `json:"service"`
	Account string `json:"account"`
	Present bool   `json:"present"`
}
type credentialBackend interface {
	Set(service, account string, secret []byte) error
	Resolve(service, account string) ([]byte, error)
	List(service string) ([]credentialRecord, error)
	Delete(service, account string) (bool, error)
	Name() string
}

type request struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
type response struct {
	ID     string    `json:"id,omitempty"`
	Result any       `json:"result,omitempty"`
	Error  *rpcError `json:"error,omitempty"`
}
type server struct {
	backend credentialBackend
	encoder *json.Encoder
	mu      sync.Mutex
}

func (s *server) reply(id string, result any, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		_ = s.encoder.Encode(response{ID: id, Error: &rpcError{Code: -32000, Message: err.Error()}})
		return
	}
	_ = s.encoder.Encode(response{ID: id, Result: result})
}
func parse(raw json.RawMessage, target any) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, target)
}

func (s *server) handle(req request) bool {
	switch req.Method {
	case "initialize":
		s.reply(req.ID, map[string]any{"protocolVersion": 1, "backend": s.backend.Name(), "capabilities": []string{"set", "resolve", "list", "delete"}}, nil)
	case "credential/set":
		var p struct{ Service, Account, Secret string }
		if err := parse(req.Params, &p); err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		if _, err := credentialTarget(p.Service, p.Account); err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		if p.Secret == "" {
			s.reply(req.ID, nil, errors.New("secret is required"))
			break
		}
		secret := []byte(p.Secret)
		err := s.backend.Set(p.Service, p.Account, secret)
		for i := range secret {
			secret[i] = 0
		}
		s.reply(req.ID, credentialRecord{Service: p.Service, Account: p.Account, Present: err == nil}, err)
	case "credential/resolve":
		var p struct{ Service, Account string }
		if err := parse(req.Params, &p); err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		secret, err := s.backend.Resolve(p.Service, p.Account)
		if err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		value := string(secret)
		for i := range secret {
			secret[i] = 0
		}
		s.reply(req.ID, map[string]any{"secret": value}, nil)
	case "credential/list":
		var p struct{ Service string }
		if err := parse(req.Params, &p); err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		records, err := s.backend.List(p.Service)
		sort.Slice(records, func(i, j int) bool {
			if records[i].Service == records[j].Service {
				return records[i].Account < records[j].Account
			}
			return records[i].Service < records[j].Service
		})
		s.reply(req.ID, records, err)
	case "credential/delete":
		var p struct{ Service, Account string }
		if err := parse(req.Params, &p); err != nil {
			s.reply(req.ID, nil, err)
			break
		}
		deleted, err := s.backend.Delete(p.Service, p.Account)
		s.reply(req.ID, map[string]any{"deleted": deleted}, err)
	case "shutdown":
		s.reply(req.ID, map[string]any{"closing": true}, nil)
		return false
	default:
		s.reply(req.ID, nil, fmt.Errorf("unknown method: %s", req.Method))
	}
	return true
}

func main() {
	backend, err := newCredentialBackend()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	server := &server{backend: backend, encoder: json.NewEncoder(os.Stdout)}
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 4096), maxCredentialFrame)
	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			server.reply("", nil, errors.New("invalid JSON"))
			continue
		}
		if req.ID == "" || req.Method == "" {
			server.reply(req.ID, nil, errors.New("invalid request"))
			continue
		}
		if !server.handle(req) {
			return
		}
	}
}
