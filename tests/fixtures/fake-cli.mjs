const args = process.argv.slice(2);
let input = '';
for await (const chunk of process.stdin) input += chunk;
if (args.includes('--echo')) process.stdout.write(JSON.stringify({ text: `Processed ${input.length} characters safely.` }) + '\n');
else process.stdout.write('0.0.1\n');
