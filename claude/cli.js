#!/usr/bin/env node
// Standalone CLI — the engine without any host. Reads stdin, writes the
// compressed result to stdout, and a one-line savings summary to stderr (so it
// composes in pipes). RTK-style:
//
//   noisy-command 2>&1 | node cli.js            # compress command output
//   node cli.js --prompt < prompt.txt           # compress a prose prompt
//   node cli.js --discover < prompt.txt         # dry-run savings report
//
// Default mode is output compression (dedupe/noise/truncate). `--prompt`
// switches to the prose rules; `--discover` prints a per-group breakdown.

const {
	optimizePrompt,
	compressOutput,
	discover,
	estimateTokens,
} = require('./mcp/optimizer.js');

const mode = process.argv.includes('--prompt')
	? 'prompt'
	: process.argv.includes('--discover')
		? 'discover'
		: 'output';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
	const before = estimateTokens(input);
	let out;
	if (mode === 'prompt') {
		out = optimizePrompt(input).optimized;
	} else if (mode === 'discover') {
		const r = discover(input);
		process.stderr.write(
			`~tokens ${r.estTokensBefore} → ${r.estTokensAfter} (saved ${r.saved}, ${r.percent}%)\n` +
				r.groups.map((g) => `  • ${g.name}: ~${g.saved}`).join('\n') +
				'\n',
		);
		process.stdout.write(r.optimized + '\n');
		return;
	} else {
		out = compressOutput(input).compressed;
	}
	const after = estimateTokens(out);
	const saved = before - after;
	const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
	process.stdout.write(out);
	if (!out.endsWith('\n')) {
		process.stdout.write('\n');
	}
	process.stderr.write(`~tokens ${before} → ${after} (saved ${saved}, ${pct}%)\n`);
});
