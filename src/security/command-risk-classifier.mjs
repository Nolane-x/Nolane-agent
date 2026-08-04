import path from 'node:path';

const CAPABILITIES = Object.freeze({
  'system-change': ['system.admin'],
  'permission-change': ['system.admin'],
  'download-and-execute': ['network.use', 'software.install'],
  administrator: ['system.admin'],
  'firewall-change': ['port.open', 'system.admin'],
  'service-start': ['system.admin'],
  'service-stop': ['system.admin'],
  'outbound-transfer': ['file.upload', 'network.use'],
  'dangerous-sql': ['database.mutate'],
});

const SYSTEM_COMMANDS = new Set(['shutdown', 'shutdown.exe', 'reboot', 'halt', 'poweroff', 'init', 'bcdedit', 'diskpart', 'reg', 'reg.exe']);
const PERMISSION_COMMANDS = new Set(['chmod', 'chown', 'chgrp', 'setfacl', 'icacls', 'icacls.exe', 'takeown', 'takeown.exe']);
const ADMIN_COMMANDS = new Set(['sudo', 'su', 'doas', 'runas', 'runas.exe']);
const FIREWALL_COMMANDS = new Set(['ufw', 'iptables', 'ip6tables', 'nft', 'firewall-cmd', 'netsh', 'netsh.exe']);
const TRANSFER_COMMANDS = new Set(['scp', 'sftp', 'rsync', 'rclone', 'azcopy']);
const SQL_COMMANDS = new Set(['psql', 'mysql', 'mysql.exe', 'sqlite3', 'sqlite3.exe', 'sqlcmd', 'sqlcmd.exe']);

function executableName(command) {
  return path.basename(String(command ?? '')).toLowerCase();
}

function joined(args, stdin = '') {
  return `${Array.isArray(args) ? args.join(' ') : ''}\n${String(stdin ?? '')}`.toLowerCase();
}

function includesAny(text, patterns) { return patterns.some((pattern) => text.includes(pattern)); }

function dangerousSql(text) {
  const stripped = String(text ?? '').replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
  if (!stripped) return false;
  if (/\b(drop\s+(?:database|table|schema)|truncate\s+(?:table\s+)?|alter\s+system|pragma\s+writable_schema\s*=\s*(?:1|on|true)|vacuum\s+into)\b/i.test(stripped)) return true;
  if (/\bdelete\s+from\b/i.test(stripped) && !/\bwhere\b/i.test(stripped)) return true;
  if (/\bupdate\s+[A-Za-z0-9_."`\[\]-]+\s+set\b/i.test(stripped) && !/\bwhere\b/i.test(stripped)) return true;
  return false;
}

function uniqueSorted(values) { return [...new Set(values)].sort(); }

export class CommandRiskClassifier {
  classify(input = {}) {
    const command = executableName(input.command);
    const args = Array.isArray(input.args) ? input.args.map(String) : [];
    const lowerArgs = args.map((value) => value.toLowerCase());
    const text = joined(args, input.stdin);
    const categories = [];
    const evidence = [];
    const add = (category, detector) => { if (!categories.includes(category)) { categories.push(category); evidence.push(Object.freeze({ category, detector })); } };

    if (SYSTEM_COMMANDS.has(command) || (command === 'systemctl' && includesAny(text, [' reboot', ' poweroff', ' halt', ' suspend']))) add('system-change', `executable:${command}`);
    if (PERMISSION_COMMANDS.has(command)) add('permission-change', `executable:${command}`);
    if (ADMIN_COMMANDS.has(command) || (command.startsWith('powershell') && /\bstart-process\b[\s\S]*\b-ver[b]?\s+runas\b/i.test(text))) add('administrator', `executable:${command}`);
    if (FIREWALL_COMMANDS.has(command) || /\b(?:new|set|remove|enable|disable)-netfirewallrule\b/i.test(text)) add('firewall-change', `executable:${command}`);

    if (command === 'systemctl' || command === 'service' || command === 'sc' || command === 'sc.exe' || command === 'net' || command === 'net.exe') {
      if (lowerArgs.includes('start') || (command === 'service' && lowerArgs.at(-1) === 'start')) add('service-start', `service-control:${command}`);
      if (lowerArgs.includes('stop') || (command === 'service' && lowerArgs.at(-1) === 'stop')) add('service-stop', `service-control:${command}`);
    }
    if (command.startsWith('powershell')) {
      if (/\bstart-service\b/i.test(text)) add('service-start', 'powershell:Start-Service');
      if (/\bstop-service\b/i.test(text)) add('service-stop', 'powershell:Stop-Service');
    }

    if ((command === 'bash' || command === 'sh' || command === 'zsh' || command === 'cmd' || command === 'cmd.exe')
      && /(?:curl|wget|invoke-webrequest|\biwr\b)[\s\S]*(?:\||&&|;)\s*(?:sh|bash|zsh|cmd|powershell|pwsh|python|node)\b/i.test(text)) add('download-and-execute', `shell-wrapper:${command}`);
    if (command.startsWith('powershell') && /(?:invoke-webrequest|\biwr\b|downloadstring)[\s\S]*(?:invoke-expression|\biex\b)/i.test(text)) add('download-and-execute', 'powershell:web-to-exec');

    if (command === 'curl') {
      if (lowerArgs.some((arg) => ['-t', '--upload-file', '-f', '--form', '--data', '--data-binary', '--data-raw', '-d'].includes(arg))
        || lowerArgs.some((arg, index) => arg === '-x' && ['post', 'put', 'patch'].includes(lowerArgs[index + 1]))) add('outbound-transfer', 'curl:upload');
    }
    if (command === 'wget' && lowerArgs.some((arg) => arg.startsWith('--post-') || arg === '--body-file')) add('outbound-transfer', 'wget:upload');
    if (TRANSFER_COMMANDS.has(command) && args.some((arg) => /^[^\s:@]+@[^\s:]+:|^[^\s:]+:[^/\\]/.test(arg))) add('outbound-transfer', `transfer:${command}`);
    if (command.startsWith('powershell') && /\b(?:invoke-webrequest|invoke-restmethod)\b[\s\S]*\b(?:-method\s+(?:post|put|patch)|-infile\b)/i.test(text)) add('outbound-transfer', 'powershell:upload');

    if (SQL_COMMANDS.has(command) && dangerousSql(text)) add('dangerous-sql', `sql:${command}`);
    if (input.sql !== undefined && dangerousSql(input.sql)) add('dangerous-sql', 'sql:explicit');

    const requiredCapabilities = uniqueSorted(categories.flatMap((category) => CAPABILITIES[category] ?? []));
    return Object.freeze({ categories: Object.freeze(categories), requiredCapabilities: Object.freeze(requiredCapabilities), evidence: Object.freeze(evidence) });
  }
}

export { dangerousSql };
