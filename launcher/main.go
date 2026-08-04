package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type runtimeInfo struct {
	URL   string `json:"url"`
	Token string `json:"token"`
	PID   int    `json:"pid"`
}

func main() {
	executable, err := os.Executable()
	if err != nil {
		fatal(err)
	}
	root := filepath.Dir(executable)
	dataDir := filepath.Join(root, "data")
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		fatal(err)
	}
	logFile, err := os.OpenFile(filepath.Join(dataDir, "nolane-agent.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		fatal(err)
	}
	defer logFile.Close()

	electronPath, err := ensureElectronRuntime(root, logFile)
	if err != nil {
		fatal(err)
	}

	lockPath := filepath.Join(dataDir, "nolane-agent.lock")
	runtimeFile := filepath.Join(dataDir, "runtime-electron.json")
	lock, lockErr := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if lockErr != nil {
		if info, readErr := readRuntime(runtimeFile); readErr == nil && healthy(info.URL) {
			appRoot, _ := currentAppRoot(root, dataDir)
			command := newElectronCommand(electronPath, appRoot, dataDir, runtimeFile)
			command.Dir = root
			configureChild(command)
			_ = command.Start()
			return
		}
		_ = os.Remove(lockPath)
		lock, lockErr = os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if lockErr != nil {
			fatal(fmt.Errorf("another Nolane Agent launcher may be running: %w", lockErr))
		}
	}
	_, _ = lock.WriteString(strconv.Itoa(os.Getpid()))
	_ = lock.Close()
	defer os.Remove(lockPath)
	_ = os.Remove(runtimeFile)

	if recoveryErr := recoverIncompleteUpdate(root, dataDir); recoveryErr != nil {
		fatal(fmt.Errorf("recover incomplete update: %w", recoveryErr))
	}
	selection, updateErr := prepareAppSelection(root, dataDir)
	if updateErr != nil {
		_, _ = fmt.Fprintf(logFile, "Update rejected; continuing with current version: %v\n", updateErr)
		appRoot, version := currentAppRoot(root, dataDir)
		selection = appSelection{AppRoot: appRoot, Version: version, Finalize: func(bool) error { return nil }}
	}

	cmd, _, err := launchApplication(electronPath, selection.AppRoot, root, dataDir, runtimeFile, logFile)
	if err != nil && selection.Updated {
		_, _ = fmt.Fprintf(logFile, "Updated version failed health check; rolling back: %v\n", err)
		terminateCommand(cmd)
		_ = selection.Finalize(false)
		_ = os.Remove(runtimeFile)
		appRoot, version := currentAppRoot(root, dataDir)
		selection = appSelection{AppRoot: appRoot, Version: version, Finalize: func(bool) error { return nil }}
		cmd, _, err = launchApplication(electronPath, selection.AppRoot, root, dataDir, runtimeFile, logFile)
	}
	if err != nil {
		terminateCommand(cmd)
		fatal(err)
	}
	if selection.Updated {
		if err := selection.Finalize(true); err != nil {
			_, _ = fmt.Fprintf(logFile, "Update finalize warning: %v\n", err)
		}
	}
	err = cmd.Wait()
	_ = os.Remove(runtimeFile)
	if err != nil {
		_, _ = fmt.Fprintf(logFile, "Nolane Agent exited: %v\n", err)
	}
}

func newElectronCommand(electronPath, appRoot, dataDir, runtimeFile string) *exec.Cmd {
	command := exec.Command(electronPath, appRoot)
	command.Env = append(os.Environ(),
		"NOLANE_AGENT_ELECTRON_USER_DATA="+dataDir,
		"NOLANE_AGENT_ELECTRON_RUNTIME_FILE="+runtimeFile,
	)
	return command
}

func launchApplication(electronPath, appRoot, installRoot, dataDir, runtimeFile string, logFile io.Writer) (*exec.Cmd, runtimeInfo, error) {
	entry := filepath.Join(appRoot, "desktop", "main.cjs")
	if info, err := os.Stat(entry); err != nil || !info.Mode().IsRegular() {
		return nil, runtimeInfo{}, fmt.Errorf("Nolane Agent Electron entry is missing: %s", entry)
	}
	command := newElectronCommand(electronPath, appRoot, dataDir, runtimeFile)
	command.Dir = installRoot
	appendUpdateEnvironment(command, installRoot)
	command.Stdout, command.Stderr = logFile, logFile
	configureChild(command)
	if err := command.Start(); err != nil {
		return command, runtimeInfo{}, err
	}
	info, err := waitRuntime(runtimeFile, 30*time.Second)
	return command, info, err
}

func appendUpdateEnvironment(command *exec.Cmd, installRoot string) {
	updateConfig := filepath.Join(installRoot, "config", "update.json")
	body, err := os.ReadFile(updateConfig)
	if err != nil {
		return
	}
	var config struct{ Endpoint, PublicKeyFile, Channel string }
	if json.Unmarshal(body, &config) != nil {
		return
	}
	if config.Endpoint != "" {
		command.Env = append(command.Env, "NOLANE_AGENT_UPDATE_ENDPOINT="+config.Endpoint)
	}
	if config.PublicKeyFile != "" {
		value := config.PublicKeyFile
		if !filepath.IsAbs(value) {
			value = filepath.Join(installRoot, "config", value)
		}
		command.Env = append(command.Env, "NOLANE_AGENT_UPDATE_PUBLIC_KEY_FILE="+value)
	}
	if config.Channel != "" {
		command.Env = append(command.Env, "NOLANE_AGENT_UPDATE_CHANNEL="+config.Channel)
	}
}

func terminateCommand(command *exec.Cmd) {
	if command != nil && command.Process != nil {
		_ = command.Process.Kill()
		_, _ = command.Process.Wait()
	}
}

func waitRuntime(file string, timeout time.Duration) (runtimeInfo, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if info, err := readRuntime(file); err == nil && healthy(info.URL) {
			return info, nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return runtimeInfo{}, errors.New("Nolane Agent Electron runtime did not become ready")
}

func readRuntime(file string) (runtimeInfo, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return runtimeInfo{}, err
	}
	var info runtimeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return runtimeInfo{}, err
	}
	if info.URL == "" || info.Token == "" {
		return runtimeInfo{}, errors.New("invalid runtime handoff")
	}
	return info, nil
}

func healthy(url string) bool {
	client := http.Client{Timeout: 700 * time.Millisecond}
	response, err := client.Get(strings.TrimRight(url, "/") + "/health")
	if err != nil {
		return false
	}
	defer response.Body.Close()
	return response.StatusCode == http.StatusOK
}

func fatal(err error) {
	showFatalError(err.Error())
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
