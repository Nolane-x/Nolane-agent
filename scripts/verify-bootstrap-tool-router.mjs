#!/usr/bin/env node
import { verifyBootstrapToolRouter } from '../src/small-model/bootstrap-tool-router-training.mjs';
verifyBootstrapToolRouter({ root: process.cwd() })
  .then((value) => console.log(JSON.stringify(value)))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
