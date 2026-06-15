// Tiny, dependency-free cumulative savings store.
//
// RTK reports lifetime "tokens killed"; this is the same idea for optimize-pilot.
// State is a single JSON file under the user's config dir. Writes are best-effort
// and never throw into the caller — losing a stats update must never break a hook
// or an MCP call.

const fs = require('fs');
const os = require('os');
const path = require('path');

function configDir() {
	const base =
		process.env.XDG_CONFIG_HOME ||
		path.join(os.homedir() || os.tmpdir(), '.config');
	return path.join(base, 'optimize-pilot');
}

function statsPath() {
	return path.join(configDir(), 'stats.json');
}

const EMPTY = {
	prompts: 0, // input optimizations performed
	outputs: 0, // command outputs compressed
	estTokensBefore: 0,
	estTokensAfter: 0,
};

function read() {
	try {
		const raw = fs.readFileSync(statsPath(), 'utf8');
		return { ...EMPTY, ...JSON.parse(raw) };
	} catch {
		return { ...EMPTY };
	}
}

/**
 * Record one optimization. `kind` is "prompt" or "output". Returns the updated
 * totals (or the prior totals if persistence failed).
 */
function record(kind, before, after) {
	const s = read();
	if (kind === 'output') {
		s.outputs += 1;
	} else {
		s.prompts += 1;
	}
	s.estTokensBefore += Math.max(0, before | 0);
	s.estTokensAfter += Math.max(0, after | 0);
	try {
		fs.mkdirSync(configDir(), { recursive: true });
		fs.writeFileSync(statsPath(), JSON.stringify(s, null, 2));
	} catch {
		// Read-only home / no perms — keep going with in-memory totals.
	}
	return s;
}

/** Human-readable one-line summary of lifetime savings. */
function summary(s = read()) {
	const saved = s.estTokensBefore - s.estTokensAfter;
	const pct =
		s.estTokensBefore > 0 ? Math.round((saved / s.estTokensBefore) * 100) : 0;
	return (
		`optimize-pilot lifetime: ${s.prompts} prompt(s) + ${s.outputs} output(s) · ` +
		`~${s.estTokensBefore} → ~${s.estTokensAfter} tokens (saved ~${saved}, ${pct}%)`
	);
}

module.exports = { read, record, summary, statsPath };
