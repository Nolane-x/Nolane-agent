import ts from '../third_party/typescript/lib/typescript.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const configPath = path.resolve(process.argv[2] ?? 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const format = (diagnostics) => diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n');
if (configFile.error) {
  process.stderr.write(`${format([configFile.error])}\n`);
  process.exitCode = 1;
} else {
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath), undefined, configPath);
  const rootDir = path.resolve(parsed.options.rootDir ?? path.dirname(configPath));
  const outDir = path.resolve(parsed.options.outDir ?? path.join(path.dirname(configPath), 'dist'));
  const diagnostics = [...(parsed.errors ?? [])];
  for (const sourcePath of parsed.fileNames.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
    const source = await readFile(sourcePath, 'utf8');
    const result = ts.transpileModule(source, { compilerOptions: parsed.options, fileName: sourcePath, reportDiagnostics: true });
    diagnostics.push(...(result.diagnostics ?? []));
    const relative = path.relative(rootDir, sourcePath).replace(/\.ts$/i, '.js');
    const outputPath = path.join(outDir, relative);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.outputText, 'utf8');
  }
  if (diagnostics.length) {
    process.stderr.write(`${format(diagnostics)}\n`);
    process.exitCode = 1;
  }
}
