#!/usr/bin/env node
import { trainBootstrapSpecialistSuite } from '../src/small-model/bootstrap-specialist-suite-training.mjs';

trainBootstrapSpecialistSuite({ root: process.cwd(), variants: 30, writeOutputs: true })
  .then((suite) => console.log(JSON.stringify({ status: 'trained', specialists: suite.specialistSummary, receiptSha256: suite.receiptSha256 })))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
