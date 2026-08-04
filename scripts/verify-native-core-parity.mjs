#!/usr/bin/env node
import { verifyNativeCoreParity } from '../src/release/native-core-parity-verifier.mjs';
verifyNativeCoreParity({ rootDirectory: process.argv[2] ?? process.cwd() }).then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
