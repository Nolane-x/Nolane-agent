#!/usr/bin/env node
import { verifyRepositorySpecialistSuite } from '../src/small-model/repository-specialist-suite-training.mjs';
const verification = await verifyRepositorySpecialistSuite();
console.log(JSON.stringify(verification));
