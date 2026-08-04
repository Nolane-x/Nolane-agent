#!/usr/bin/env node
import { verifyBootstrapSpecialistSuite } from '../src/small-model/bootstrap-specialist-suite-training.mjs';

verifyBootstrapSpecialistSuite({ outputRoot: new URL('../models/specialists', import.meta.url).pathname })
  .then((value) => console.log(JSON.stringify(value)))
  .catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
