#!/usr/bin/env node
import { verifyMasterAcceptanceLedger } from '../src/release/master-ledger-verifier.mjs';
verifyMasterAcceptanceLedger({ rootDirectory: process.argv[2] ?? process.cwd() }).then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
