# ForgeOS Platform TCK

The Technology Compatibility Kit records what this repository can prove locally for the current source version.

## Executable verification

For every adapter marked `executable`, the TCK:

1. loads the adapter command/arguments;
2. spawns the configured stdio process;
3. sends MCP `initialize` with the stable target version;
4. sends `notifications/initialized`;
5. calls `tools/list`;
6. records exit state, protocol version, tool count and evidence digest.

## Documentation verification

Adapters marked `documentation` are checked for required instructions and repository links only. They are not reported as runtime-tested.

## Output

```bash
npm run adapter:tck
```

The result is written to `evidence/adapter-tck.json`. A pass is evidence for this repository and local environment, not certification by ChatGPT, OpenAI, Anthropic, Google, Microsoft, or any other platform vendor.
