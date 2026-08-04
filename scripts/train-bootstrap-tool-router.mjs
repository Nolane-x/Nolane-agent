#!/usr/bin/env node
import { trainBootstrapToolRouter } from '../src/small-model/bootstrap-tool-router-training.mjs';
trainBootstrapToolRouter({ root: process.cwd(), variants: 30, writeOutputs: true })
  .then(({ artifact, benchmark }) => console.log(JSON.stringify({ status: 'trained', artifactSha256: artifact.artifactSha256, heldOutAccuracy: benchmark.heldOut.accuracy, benchmarkReceiptSha256: benchmark.receiptSha256 })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
