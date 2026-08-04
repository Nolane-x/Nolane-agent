export class AgentToolGateway {
  constructor({ orchestrator } = {}) { this.orchestrator = orchestrator; }
  schemasFor({ permissions = [] } = {}) {
    const schemas = [{ name: 'agent.listProfiles', description: 'List bounded custom agent profiles', inputSchema: { type: 'object', additionalProperties: false } }];
    if (permissions.includes('agent.create')) schemas.push({ name: 'agent.runSubagent', description: 'Run a scoped child agent', inputSchema: { type: 'object', required: ['profileId', 'objective'], additionalProperties: false, properties: { profileId: { type: 'string', minLength: 1, maxLength: 64 }, objective: { type: 'string', minLength: 1, maxLength: 20000 } } } });
    return Object.freeze(schemas);
  }
  async call(name, args, context) {
    if (name === 'agent.listProfiles') return this.orchestrator.listProfiles().map(({ prompt, ...profile }) => profile);
    if (name === 'agent.runSubagent') return this.orchestrator.run({ parentTask: context.parentTask, profileId: args.profileId, objective: args.objective, signal: context.signal });
    throw new Error(`AGENT_TOOL_UNKNOWN: ${name}`);
  }
}
