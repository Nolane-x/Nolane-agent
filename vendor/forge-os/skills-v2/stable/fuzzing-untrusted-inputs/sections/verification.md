# Verification

- Does the fuzzer reach deep parser states?
- Are hangs and resource exhaustion treated as failures?
- Can the same seed reproduce the issue?
- Are sensitive production systems excluded from unsafe fuzzing?

Required evidence:
- seed corpus
- fuzz configuration
- crash or hang artifacts
- minimized regression cases
