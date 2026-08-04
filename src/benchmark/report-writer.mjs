import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BenchmarkScorer } from './benchmark-scorer.mjs';
export async function writeBenchmarkReport({ outputDirectory, suite, runs, independentEvidence = null, minimumTasks = 20, generatedAt = new Date().toISOString() } = {}) {
  const directory = path.resolve(String(outputDirectory)); await mkdir(directory, { recursive: true });
  const comparison = new BenchmarkScorer().compareSystems(runs, { independentEvidence, minimumTasks });
  const report = { schemaVersion: 1, generatedAt, suite: { id: suite.id, version: suite.version, title: suite.title }, independent: comparison.independent, independentEvidence: comparison.independentEvidence, claimAllowed: comparison.claimAllowed, claimReason: comparison.reason, comparison, runs };
  await writeFile(path.join(directory, 'benchmark-runs.json'), `${JSON.stringify(runs, null, 2)}\n`);
  await writeFile(path.join(directory, 'benchmark-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const rows = Object.entries(comparison.systems).map(([name, score]) => `| ${name} | ${score.tasks} | ${score.runs} | ${(score.functional * 100).toFixed(1)}% | ${(score.functionalConfidence95.low * 100).toFixed(1)}–${(score.functionalConfidence95.high * 100).toFixed(1)}% | ${score.latencyMs.toFixed(1)} | ${score.costUsd.toFixed(4)} | ${(score.reproducibility * 100).toFixed(1)}% |`).join('\n');
  const markdown = `# Benchmark Report\n\n- Suite: ${suite.title} (${suite.id} v${suite.version})\n- Generated: ${generatedAt}\n- Independent attestation verified: ${comparison.independent ? 'yes' : 'no'}\n- Common tasks: ${comparison.commonTaskCount}\n- Comparative claim allowed: ${comparison.claimAllowed ? 'yes' : 'no'}\n- Reason: ${comparison.reason}\n\n| System | Tasks | Runs | Functional | Functional 95% CI | Mean latency ms | Mean cost USD | Reproducibility |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows || '| none | 0 | 0 | 0% | 0–100% | 0 | 0 | 0% |'}\n`;
  await writeFile(path.join(directory, 'benchmark-report.md'), markdown);
  return Object.freeze(report);
}
