function cleanPath(value) {
  const raw = String(value ?? '').trim().split(/\s+/)[0];
  if (!raw || raw === '/dev/null') return null;
  return raw.replace(/^[ab]\//, '').replaceAll('\\', '/');
}

function freezePatch({ oldPath, newPath, hunks = [], renameOnly = false }) {
  return Object.freeze({ oldPath, newPath, hunks: Object.freeze(hunks), renameOnly: renameOnly === true });
}

export function parseUnifiedPatch(value) {
  const text = String(value ?? '').replaceAll('\r\n', '\n');
  if (!text.trim()) throw new TypeError('patch is required');
  const lines = text.split('\n');
  const renameFrom = lines.find((line) => line.startsWith('rename from '));
  const renameTo = lines.find((line) => line.startsWith('rename to '));
  if (renameFrom || renameTo) {
    if (!renameFrom || !renameTo) throw new Error('Git rename patch must contain rename from and rename to');
    const oldPath = cleanPath(renameFrom.slice('rename from '.length));
    const newPath = cleanPath(renameTo.slice('rename to '.length));
    if (!oldPath || !newPath || oldPath === newPath) throw new Error('Git rename patch paths are invalid');
    return freezePatch({ oldPath, newPath, renameOnly: true });
  }

  let index = 0;
  while (index < lines.length && !lines[index].startsWith('--- ')) index += 1;
  if (index >= lines.length - 1 || !lines[index + 1].startsWith('+++ ')) throw new Error('Unified patch must contain --- and +++ file headers');
  const oldPath = cleanPath(lines[index].slice(4));
  const newPath = cleanPath(lines[index + 1].slice(4));
  if (!oldPath && !newPath) throw new Error('Patch cannot delete and create /dev/null simultaneously');
  index += 2;
  const hunks = [];
  while (index < lines.length) {
    const line = lines[index];
    if (!line) { index += 1; continue; }
    if (line.startsWith('--- ')) throw new Error('Only one file per fs.patch call is supported');
    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/);
    if (!header) throw new Error(`Invalid unified patch line: ${line.slice(0, 120)}`);
    const hunk = {
      oldStart: Number(header[1]), oldCount: Number(header[2] ?? 1),
      newStart: Number(header[3]), newCount: Number(header[4] ?? 1), lines: [],
    };
    index += 1;
    while (index < lines.length && !lines[index].startsWith('@@ ') && !lines[index].startsWith('--- ')) {
      const hunkLine = lines[index];
      if (hunkLine === '\\ No newline at end of file') { index += 1; continue; }
      if (hunkLine === '' && index === lines.length - 1) { index += 1; break; }
      if (![' ', '+', '-'].includes(hunkLine[0])) throw new Error(`Invalid hunk line: ${hunkLine.slice(0, 120)}`);
      hunk.lines.push(hunkLine);
      index += 1;
    }
    const oldSeen = hunk.lines.filter((item) => item[0] !== '+').length;
    const newSeen = hunk.lines.filter((item) => item[0] !== '-').length;
    if (oldSeen !== hunk.oldCount || newSeen !== hunk.newCount) throw new Error(`Hunk count mismatch at old line ${hunk.oldStart}`);
    hunks.push(Object.freeze({ ...hunk, lines: Object.freeze(hunk.lines) }));
  }
  if (!hunks.length) throw new Error('Unified patch contains no hunks');
  return freezePatch({ oldPath, newPath, hunks });
}

export function applyUnifiedPatch(original, parsedPatch, { dryRun = false } = {}) {
  const patch = parsedPatch?.hunks ? parsedPatch : parseUnifiedPatch(parsedPatch);
  const source = String(original ?? '').replaceAll('\r\n', '\n');
  if (patch.renameOnly) return Object.freeze({ content: source, appliedHunks: 0, oldPath: patch.oldPath, newPath: patch.newPath, renameOnly: true, dryRun: dryRun === true });
  const hadTrailingNewline = source.endsWith('\n');
  const output = source.split('\n');
  if (hadTrailingNewline) output.pop();
  let offset = 0;
  for (let hunkIndex = 0; hunkIndex < patch.hunks.length; hunkIndex += 1) {
    const hunk = patch.hunks[hunkIndex];
    const at = hunk.oldStart - 1 + offset;
    if (at < 0 || at > output.length) throw new Error(`Patch conflict at hunk ${hunkIndex + 1}: target line is outside file`);
    const replacement = []; let cursor = at;
    for (const line of hunk.lines) {
      const prefix = line[0]; const expected = line.slice(1);
      if (prefix === ' ' || prefix === '-') {
        const actual = output[cursor];
        if (actual !== expected) throw new Error(`Patch conflict at hunk ${hunkIndex + 1}: expected ${JSON.stringify(expected)} at line ${cursor + 1}, got ${JSON.stringify(actual)}`);
        if (prefix === ' ') replacement.push(actual);
        cursor += 1;
      } else replacement.push(expected);
    }
    const consumed = cursor - at;
    output.splice(at, consumed, ...replacement);
    offset += replacement.length - consumed;
  }
  return Object.freeze({ content: output.join('\n') + (hadTrailingNewline ? '\n' : ''), appliedHunks: patch.hunks.length, oldPath: patch.oldPath, newPath: patch.newPath, renameOnly: false, dryRun: dryRun === true });
}

export function reverseUnifiedPatch(parsedPatch) {
  const patch = parsedPatch?.hunks ? parsedPatch : parseUnifiedPatch(parsedPatch);
  if (patch.renameOnly) return freezePatch({ oldPath: patch.newPath, newPath: patch.oldPath, renameOnly: true });
  const hunks = patch.hunks.map((hunk) => Object.freeze({
    oldStart: hunk.newStart,
    oldCount: hunk.newCount,
    newStart: hunk.oldStart,
    newCount: hunk.oldCount,
    lines: Object.freeze(hunk.lines.map((line) => line[0] === '+' ? `-${line.slice(1)}` : line[0] === '-' ? `+${line.slice(1)}` : line)),
  }));
  return freezePatch({ oldPath: patch.newPath, newPath: patch.oldPath, hunks });
}

function splitLines(value) {
  const text = String(value ?? '').replaceAll('\r\n', '\n');
  const trailing = text.endsWith('\n');
  const lines = text.split('\n');
  if (trailing) lines.pop();
  return { lines, trailing };
}

export function threeWayMerge({ base, ours, theirs, oursLabel = 'ours', theirsLabel = 'theirs' } = {}) {
  const baseDoc = splitLines(base); const oursDoc = splitLines(ours); const theirsDoc = splitLines(theirs);
  if (String(ours) === String(theirs)) return Object.freeze({ content: String(ours), conflicted: false, conflictCount: 0 });
  if (String(ours) === String(base)) return Object.freeze({ content: String(theirs), conflicted: false, conflictCount: 0 });
  if (String(theirs) === String(base)) return Object.freeze({ content: String(ours), conflicted: false, conflictCount: 0 });
  if (baseDoc.lines.length !== oursDoc.lines.length || baseDoc.lines.length !== theirsDoc.lines.length) {
    const content = `<<<<<<< ${oursLabel}\n${String(ours)}${String(ours).endsWith('\n') ? '' : '\n'}=======\n${String(theirs)}${String(theirs).endsWith('\n') ? '' : '\n'}>>>>>>> ${theirsLabel}\n`;
    return Object.freeze({ content, conflicted: true, conflictCount: 1 });
  }
  const output = []; let conflicts = 0;
  for (let index = 0; index < baseDoc.lines.length; index += 1) {
    const original = baseDoc.lines[index]; const left = oursDoc.lines[index]; const right = theirsDoc.lines[index];
    if (left === right) output.push(left);
    else if (left === original) output.push(right);
    else if (right === original) output.push(left);
    else {
      conflicts += 1;
      output.push(`<<<<<<< ${oursLabel}`, left, '=======', right, `>>>>>>> ${theirsLabel}`);
    }
  }
  const trailing = baseDoc.trailing || oursDoc.trailing || theirsDoc.trailing;
  return Object.freeze({ content: output.join('\n') + (trailing ? '\n' : ''), conflicted: conflicts > 0, conflictCount: conflicts });
}
