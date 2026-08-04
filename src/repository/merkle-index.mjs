import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function buildMerkleTree(files = []) {
  const normalized = [...files].map((file) => ({ path: String(file.path).replaceAll('\\', '/'), sha256: String(file.sha256) })).sort((a, b) => a.path.localeCompare(b.path));
  const nodes = new Map();
  for (const file of normalized) nodes.set(file.path, sha256(`file\0${file.path}\0${file.sha256}`));
  const directories = new Set(['']);
  for (const file of normalized) {
    const parts = file.path.split('/');
    for (let index = 1; index < parts.length; index += 1) directories.add(parts.slice(0, index).join('/'));
  }
  const ordered = [...directories].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
  for (const directory of ordered) {
    const prefix = directory ? `${directory}/` : '';
    const direct = [];
    for (const [nodePath, digest] of nodes.entries()) {
      if (!nodePath.startsWith(prefix) || nodePath === directory) continue;
      const rest = nodePath.slice(prefix.length);
      if (!rest.includes('/')) direct.push([rest, digest]);
    }
    direct.sort((a, b) => a[0].localeCompare(b[0]));
    nodes.set(directory, sha256(`dir\0${directory}\0${direct.map(([name, digest]) => `${name}:${digest}`).join('\n')}`));
  }
  return Object.freeze({ rootSha256: nodes.get('') ?? sha256('dir\0\0'), nodes: Object.freeze(Object.fromEntries([...nodes.entries()].sort())) });
}

export function similarityHash(files = []) {
  const weights = Array(64).fill(0);
  for (const file of files) {
    const digest = Buffer.from(String(file.sha256).slice(0, 16).padEnd(16, '0'), 'hex');
    const weight = Math.max(1, Number(file.bytes ?? 1));
    for (let bit = 0; bit < 64; bit += 1) {
      const set = (digest[Math.floor(bit / 8)] & (1 << (7 - (bit % 8)))) !== 0;
      weights[bit] += set ? weight : -weight;
    }
  }
  let output = 0n;
  for (let bit = 0; bit < 64; bit += 1) if (weights[bit] >= 0) output |= 1n << BigInt(63 - bit);
  return output.toString(16).padStart(16, '0');
}

export function buildChunkMerkleTree(chunks = []) {
  return buildMerkleTree(chunks.map((chunk) => ({
    path: `${String(chunk.path).replaceAll('\\', '/')}#${String(chunk.chunkId)}`,
    sha256: String(chunk.sha256),
  })));
}

export function diffMerkleNodes(before, after) {
  const left = before?.nodes ?? {};
  const right = after?.nodes ?? {};
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const changed = keys.filter((key) => left[key] !== right[key]);
  const leaves = keys.filter((key) => key.includes('#'));
  return Object.freeze({
    changedNodes: Object.freeze(changed),
    changedLeaves: Object.freeze(changed.filter((key) => key.includes('#'))),
    unchangedLeaves: Object.freeze(leaves.filter((key) => left[key] != null && left[key] === right[key])),
    addedLeaves: Object.freeze(leaves.filter((key) => left[key] == null && right[key] != null)),
    removedLeaves: Object.freeze(leaves.filter((key) => left[key] != null && right[key] == null)),
  });
}
