const REGISTRY = Object.freeze({
  'research-questions': ['questions'],
  'research-evidence': ['sources'],
  'problem-discovery': ['problem'],
  'research-synthesis': ['findings'],
  'creative-brief': ['challenge'],
  'candidate-ideas': ['ideas'],
  'scored-ideas': ['scores'],
  'selected-concept': ['ideaId'],
  'product-definition': ['definition'],
  'product-thesis': ['thesis'],
  'capability-map': ['capabilities'],
  'user-workflows': ['workflows'],
  'ux-contract': ['journeys'],
  'system-boundaries': ['boundaries'],
  'architecture-decision': ['decision'],
  'threat-model': ['threats'],
  'execution-plan': ['tasks'],
  'acceptance-contracts': ['criteria'],
  'implemented-increment': ['change'],
  'verified-build': ['build'],
  'test-plan': ['tests'],
  'verification-report': ['results'],
  'security-review': ['findings'],
  'ux-evidence': ['results'],
  'deployment-plan': ['plan'],
  'operations-evidence': ['results'],
  'security-release-decision': ['decision'],
  'release-dossier': ['evidence'],
  'domain-blueprint': ['domain'],
  'domain-evidence': ['results'],
  'quality-report': ['findings'],
  'security-assessment': ['findings'],
  'operations-plan': ['procedures'],
  'skill-evaluation': ['cases'],
  'adapter-certification': ['adapter'],
});

export const ARTIFACT_TYPES = Object.freeze(Object.keys(REGISTRY));

export function requiredArtifactFields(type) {
  const required = REGISTRY[type];
  if (!required) throw new TypeError(`Unknown artifact type: ${type}`);
  return [...required];
}


export function validateArtifactContent(type, content) {
  const required = REGISTRY[type];
  if (!required) throw new TypeError(`Unknown artifact type: ${type}`);
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new TypeError(`Artifact ${type} content must be an object`);
  for (const field of required) {
    const value = content[field];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      throw new TypeError(`Artifact ${type} requires content.${field}`);
    }
  }
  return content;
}
