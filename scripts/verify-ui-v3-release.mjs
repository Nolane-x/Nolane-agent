#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUiV3MasterPlan } from '../src/forensics/ui-v3-gap-auditor.mjs';
import { auditUiV3Accessibility } from './audit-ui-v3-accessibility.mjs';
import { captureUiV3States } from './capture-ui-v3-states.mjs';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const SHA = /^[a-f0-9]{64}$/i;
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
export async function verifyUiV3Release({ root = process.cwd(), write = true, outputPath = path.join(root, 'docs/ui-v3/ui-v3-source-release.json') } = {}) {
  const gaps = await auditUiV3MasterPlan({ root });
  const accessibility = await auditUiV3Accessibility({ root });
  const visual = await captureUiV3States({ root, write: false });
  let manifest = null; let distRelease = null;
  try { manifest = await readJson(path.join(root, 'ui-dist/manifest.json')); distRelease = await readJson(path.join(root, 'ui-dist/source-release.json')); } catch {}
  const receiptMatched = Boolean(manifest && distRelease && SHA.test(manifest.receiptSha256 ?? '') && distRelease.manifestReceiptSha256 === manifest.receiptSha256 && distRelease.sourceLocalVerified === true);
  const sourceLocalPass = gaps.sourceLocalComplete === true && accessibility.sourceLocalPass === true && visual.sourceFixturesComplete === true && receiptMatched;
  const base = { schema: 'nolane.ui.source-release.v1', sourceLocalPass, uiV3SourceLocalComplete: gaps.sourceLocalComplete === true, defaultUiVersion: gaps.defaultUiVersion, missingModules: gaps.summary.missing + gaps.summary.partial, accessibilitySourcePass: accessibility.sourceLocalPass, visualFixturesComplete: visual.sourceFixturesComplete, manifestReceiptSha256: manifest?.receiptSha256 ?? null, distributionReceiptMatched: receiptMatched, windows8GbCertified: false, screenReaderCertified: false, externalScreenshotCertified: false, performanceOnWindows8GbCertified: false, nonClaims: ['external-screenshot-certification','screen-reader-certification','windows-8gb-performance-certification'] };
  const report = Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
  if (write) { await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) verifyUiV3Release({}).then((value) => { console.log(JSON.stringify(value)); if (!value.sourceLocalPass) process.exitCode = 1; }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
