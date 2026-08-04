# Model Operations Research Sources — 2026-08-03

## Source package evidence

The merged profile package supplied the normalized schema, identity inference, family and size templates, exact profile seeds, catalog imports, discovery, sync/export scripts, provenance model, tests, and baseline catalog evidence. These files are preserved under `src/model-profiles`, `config/model-profiles`, `scripts`, `tests`, and the original model-profile research documents.

## External primary references

The implementation was reviewed against official documentation for current operational patterns:

### Anthropic Claude Code

- Overview: https://docs.anthropic.com/en/docs/claude-code/overview
- Subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- Hooks guide and reference: https://docs.anthropic.com/en/docs/claude-code/hooks-guide and https://docs.anthropic.com/en/docs/claude-code/hooks
- Settings: https://docs.anthropic.com/en/docs/claude-code/settings
- Skills: https://docs.anthropic.com/en/docs/claude-code/skills
- MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- CLI reference: https://docs.anthropic.com/en/docs/claude-code/cli-reference
- SDK: https://docs.anthropic.com/en/docs/claude-code/sdk

### Ollama

- API introduction: https://docs.ollama.com/api/introduction
- List, show, and running models: https://docs.ollama.com/api/tags, https://docs.ollama.com/api/show, https://docs.ollama.com/api/ps
- Modelfile: https://docs.ollama.com/modelfile
- OpenAI compatibility: https://docs.ollama.com/openai
- Anthropic compatibility: https://docs.ollama.com/api/anthropic-compatibility
- Pull/delete/usage endpoints: official Ollama API documentation.

### LiteLLM

- Proxy and model management: https://docs.litellm.ai/docs/simple_proxy
- Routing, retries, fallbacks, load balancing, budgets, and spend controls: official LiteLLM proxy/router documentation.

## Derived design decisions

External documentation informed the need for role separation, configurable tool-aware policies, lifecycle automation points, provider interoperability, local model inventory, routing/fallback, budget controls, and auditable automation. Exact field values and profile records remain grounded in the supplied profile package, not inferred from these external pages unless represented in provenance.
