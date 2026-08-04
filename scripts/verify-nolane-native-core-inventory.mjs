#!/usr/bin/env node
import { verifyNolaneNativeCoreInventory } from '../src/release/nolane-native-core-inventory-verifier.mjs';
verifyNolaneNativeCoreInventory({ rootDirectory: process.argv[2] ?? process.cwd() }).then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
