import path from 'node:path';

const EXECUTABLE_EXTENSIONS = new Set(['.exe','.dll','.so','.dylib','.bin','.app','.com','.msi','.apk','.jar']);
const SECRET_PATTERNS = [
  /npm_[A-Za-z0-9]{20,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /hf_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const OVERRIDE_PATTERNS = [/ignore\s+(?:all\s+)?previous\s+instructions/i,/override\s+(?:the\s+)?system\s+prompt/i,/reveal\s+(?:hidden|system)\s+instructions/i];
const UNSAFE_NETWORK = /https?:\/\/(?:127\.0\.0\.1|localhost|169\.254\.169\.254|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01]))/i;
const DESTRUCTIVE_ROOT = /\b(?:rm\s+-[^\n]*\brf?\s+(?:\/|~|\$HOME)|Remove-Item\s+(?:-Recurse\s+)?(?:[A-Z]:\\|\/|\$env:USERPROFILE)|rmdir\s+\/s\s+(?:[A-Z]:\\|\\|\/))/i;
const CREDENTIAL_READ = /\b(?:cat|type|Get-Content)\s+(?:~\/\.ssh\/|\.\.?(?:[\\/])?\.ssh[\\/]|(?:\.\.?(?:[\\/]))?\.env\b)/i;
const EXTERNAL_WRITE = /\b(?:git\s+push\b|gh\s+(?:pr|issue|release)\s+create\b|curl\b[^\n]*\s-X\s*POST\b|Invoke-WebRequest\b[^\n]*\s-Method\s+Post\b|npm\s+publish\b|(?:kubectl|helm)\s+(?:apply|upgrade)\b)/i;

export function scanSkillPackage(files, source = {}) {
  const findings = [];
  const add = (code, severity, file, message) => findings.push({ code, severity, file, message });
  const permissions = new Set((source.permissions ?? []).map(String));
  for (const item of files ?? []) {
    const rawPath = String(item.path ?? '');
    const normalized = path.posix.normalize(rawPath.replaceAll('\\','/'));
    const content = String(item.content ?? '');
    if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) add('path-traversal','blocker',rawPath,'Package path escapes the skill root');
    const ext = path.posix.extname(normalized).toLowerCase();
    if (EXECUTABLE_EXTENSIONS.has(ext) || /(^|\/)\.[^/]+\/.*\.(?:sh|ps1|bat|cmd)$/i.test(normalized)) add('hidden-executable','blocker',rawPath,'Hidden or binary executable content requires manual review');
    if (OVERRIDE_PATTERNS.some((pattern) => pattern.test(content))) add('instruction-override','blocker',rawPath,'External instructions attempt to override host policy');
    if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) add('secret-material','blocker',rawPath,'Credential-like material is embedded in the package');
    if (UNSAFE_NETWORK.test(content)) add('unsafe-network-target','blocker',rawPath,'Instructions reference a local or metadata network target');
    if (/\b(?:curl|wget|Invoke-WebRequest)\b/i.test(content) && /\|\s*(?:sh|bash|zsh|pwsh|powershell)\b/i.test(content)) add('remote-pipe-execution','blocker',rawPath,'Instructions pipe remote content into a shell');
    if (DESTRUCTIVE_ROOT.test(content)) add('destructive-root-operation','blocker',rawPath,'Instructions target a filesystem root or home directory recursively');
    if (CREDENTIAL_READ.test(content)) add('credential-read-request','blocker',rawPath,'Instructions request direct credential or environment-file access');
    if (EXTERNAL_WRITE.test(content) && !permissions.has('external-write')) add('undeclared-external-write','warning',rawPath,'Instructions request an external write without a declared permission');
  }
  const blockers = findings.filter((finding) => finding.severity === 'blocker').map((finding) => finding.code);
  return { sourceId: source.sourceId ?? null, blocked: blockers.length > 0, blockers: [...new Set(blockers)], warnings: findings.filter((f) => f.severity !== 'blocker').map((f) => f.code), findings };
}
