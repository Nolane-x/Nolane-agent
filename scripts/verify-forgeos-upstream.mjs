import { verifyForgeOsUpstream } from '../src/nolane-native/forgeos-upstream-provenance.mjs';

const result = await verifyForgeOsUpstream(process.cwd());
console.log(JSON.stringify(result));
if (result.status !== 'pass') process.exitCode = 2;
