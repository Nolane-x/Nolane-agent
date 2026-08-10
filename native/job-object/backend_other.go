//go:build !windows

package main

import "errors"

type unavailableBackend struct{}

func newBackend() jobBackend { return unavailableBackend{} }

func (unavailableBackend) capabilities() (map[string]any, error) {
	return map[string]any{"jobObjects": false, "version": helperVersion, "platform": "unsupported"}, nil
}
func (unavailableBackend) create(string, jobLimits) (map[string]any, error) { return nil, errors.New("Windows Job Objects are unavailable on this platform") }
func (unavailableBackend) attach(string, uint64) (map[string]any, error) { return nil, errors.New("Windows Job Objects are unavailable on this platform") }
func (unavailableBackend) terminate(string) (map[string]any, error) { return nil, errors.New("Windows Job Objects are unavailable on this platform") }
func (unavailableBackend) hold(string, jobLimits) error { return errors.New("Windows Job Objects are unavailable on this platform") }
