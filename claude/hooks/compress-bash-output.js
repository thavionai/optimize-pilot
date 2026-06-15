#!/usr/bin/env node
// PostToolUse hook for the Bash tool.
//
// The command runs untouched (exit codes, side effects, and behaviour are
// unchanged); we only compress the *text it returned* before it lands in the
// model's context — dropping noise, collapsing exact repeats, and truncating
// the long middle of oversized output. This is the RTK idea applied at the
// point Claude Code actually exposes: `updatedToolOutput` on PostToolUse.
//
// Deterministic, no model call, meaning-preserving. Output is left untouched
// unless compression is both safe and worthwhile.

const { optimizeCommandOutput, estimateTokens } = require('../mcp/optimizer.js');
const stats = require('../mcp/stats.js');

// Don't bother with small outputs — overhead isn't worth it and tiny results
// are usually all-signal.
const MIN_CHARS = 1500;

function emit(obj) {
	process.stdout.write(JSON.stringify(obj));
}

function readStdin() {
	return new Promise((resolve) => {
		let buf = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (c) => (buf += c));
		process.stdin.on('end', () => resolve(buf));
		// If nothing arrives, don't hang the tool pipeline.
		setTimeout(() => resolve(buf), 2000).unref?.();
	});
}

(async () => {
	if (process.env.OPTIMIZE_PILOT_DISABLE_OUTPUT === '1') {
		process.exit(0);
	}
	let input;
	try {
		input = JSON.parse((await readStdin()) || '{}');
	} catch {
		process.exit(0); // not our concern — pass through
	}

	const resp = input.tool_response;
	// Only act on plain string output; anything structured is passed through.
	if (typeof resp !== 'string' || resp.length < MIN_CHARS) {
		process.exit(0);
	}

	const command =
		input.tool_input && typeof input.tool_input.command === 'string'
			? input.tool_input.command
			: '';
	const { compressed } = optimizeCommandOutput(command, resp);
	if (compressed.length >= resp.length) {
		process.exit(0); // nothing gained — leave it alone
	}

	const before = estimateTokens(resp);
	const after = estimateTokens(compressed);
	stats.record('output', before, after);

	emit({
		hookSpecificOutput: {
			hookEventName: 'PostToolUse',
			updatedToolOutput: compressed,
		},
	});
	process.exit(0);
})();
