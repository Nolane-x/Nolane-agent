#!/usr/bin/env node
import path from 'node:path';
import { verifyCheckpoint6SpecialistSuite } from '../src/small-model/checkpoint-6-specialist-training.mjs';

const result = await verifyCheckpoint6SpecialistSuite({ outputRoot: path.join(process.cwd(), 'models', 'specialists-checkpoint-6') });
console.log(JSON.stringify(result, null, 2));
