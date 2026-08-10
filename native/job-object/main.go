package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"regexp"
)

const helperVersion = "5.0.0-beta.6"

var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`)

type jobLimits struct {
	CPUPercent  uint64
	MemoryBytes uint64
	ProcessCount uint64
}

type jobBackend interface {
	capabilities() (map[string]any, error)
	create(id string, limits jobLimits) (map[string]any, error)
	attach(id string, pid uint64) (map[string]any, error)
	terminate(id string) (map[string]any, error)
	hold(id string, limits jobLimits) error
}

func validID(value string) (string, error) {
	if !idPattern.MatchString(value) {
		return "", errors.New("job id must match [A-Za-z0-9][A-Za-z0-9_.-]{0,63}")
	}
	return value, nil
}

func emit(out io.Writer, value any) error {
	encoder := json.NewEncoder(out)
	encoder.SetEscapeHTML(true)
	return encoder.Encode(value)
}

func parseID(flags *flag.FlagSet, args []string) (string, error) {
	id := flags.String("id", "", "bounded job id")
	if err := flags.Parse(args); err != nil {
		return "", err
	}
	if flags.NArg() != 0 {
		return "", errors.New("unexpected positional arguments")
	}
	return validID(*id)
}

func parseLimits(flags *flag.FlagSet) (*uint64, *uint64, *uint64) {
	cpu := flags.Uint64("cpu-percent", 0, "CPU hard cap from 1 to 100")
	memory := flags.Uint64("memory-bytes", 0, "job memory cap in bytes")
	processes := flags.Uint64("process-count", 0, "active process cap")
	return cpu, memory, processes
}

func checkedLimits(cpu, memory, processes uint64) (jobLimits, error) {
	if cpu < 1 || cpu > 100 {
		return jobLimits{}, errors.New("cpu-percent must be between 1 and 100")
	}
	if memory < 1 {
		return jobLimits{}, errors.New("memory-bytes must be positive")
	}
	if processes < 1 || processes > 65535 {
		return jobLimits{}, errors.New("process-count must be between 1 and 65535")
	}
	return jobLimits{CPUPercent: cpu, MemoryBytes: memory, ProcessCount: processes}, nil
}

func run(args []string, stdout, stderr io.Writer, backend jobBackend) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "usage: ForgeJobObject.exe <capabilities|create|attach|terminate>")
		return 2
	}
	command := args[0]
	commandArgs := args[1:]
	var result map[string]any
	var err error

	switch command {
	case "capabilities":
		if len(commandArgs) != 1 || commandArgs[0] != "--json" {
			err = errors.New("capabilities requires --json")
			break
		}
		result, err = backend.capabilities()
	case "create", "hold":
		flags := flag.NewFlagSet(command, flag.ContinueOnError)
		flags.SetOutput(stderr)
		id := flags.String("id", "", "bounded job id")
		cpu, memory, processes := parseLimits(flags)
		if parseErr := flags.Parse(commandArgs); parseErr != nil {
			err = parseErr
			break
		}
		if flags.NArg() != 0 {
			err = errors.New("unexpected positional arguments")
			break
		}
		var jobID string
		jobID, err = validID(*id)
		if err != nil {
			break
		}
		var limits jobLimits
		limits, err = checkedLimits(*cpu, *memory, *processes)
		if err != nil {
			break
		}
		if command == "hold" {
			err = backend.hold(jobID, limits)
			if err == nil {
				result = map[string]any{"id": jobID, "state": "closed"}
			}
		} else {
			result, err = backend.create(jobID, limits)
		}
	case "attach":
		flags := flag.NewFlagSet(command, flag.ContinueOnError)
		flags.SetOutput(stderr)
		id := flags.String("id", "", "bounded job id")
		pid := flags.Uint64("pid", 0, "process id")
		if parseErr := flags.Parse(commandArgs); parseErr != nil {
			err = parseErr
			break
		}
		var jobID string
		jobID, err = validID(*id)
		if err == nil && (*pid == 0 || *pid > 0xffffffff) {
			err = errors.New("pid must be a positive 32-bit process id")
		}
		if err == nil {
			result, err = backend.attach(jobID, *pid)
		}
	case "terminate":
		flags := flag.NewFlagSet(command, flag.ContinueOnError)
		flags.SetOutput(stderr)
		var jobID string
		jobID, err = parseID(flags, commandArgs)
		if err == nil {
			result, err = backend.terminate(jobID)
		}
	default:
		err = fmt.Errorf("unsupported command: %s", command)
	}

	if err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 1
	}
	if err := emit(stdout, result); err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 1
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newBackend()))
}
