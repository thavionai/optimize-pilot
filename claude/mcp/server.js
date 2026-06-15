#!/usr/bin/env node
// Zero-dependency MCP stdio server exposing `optimize_prompt`.
//
// Implements the minimal JSON-RPC 2.0 subset MCP needs (initialize,
// tools/list, tools/call) over newline-delimited stdio. No npm dependencies, so
// the plugin runs as soon as it is installed — nothing to build or install.
//
// IMPORTANT: only JSON-RPC messages go to stdout. Diagnostics go to stderr.

const {
	optimizePrompt,
	estimateTokens,
	compressOutput,
	optimizeCommandOutput,
	compressDocument,
	discover,
} = require('./optimizer.js');
const stats = require('./stats.js');

const DEFAULT_PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'optimize-pilot', version: '0.2.2' };

const TOOLS = [
	{
		name: 'optimize_prompt',
		description:
			'Compress text/prompt deterministically using local rules (filler & ' +
			'politeness removal, verbose-phrase shortening, contractions, whitespace). ' +
			'Preserves meaning and never touches fenced or inline code. Does NOT call ' +
			'any model and costs no tokens. Returns the optimized text plus stats.',
		inputSchema: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The text or prompt to compress.',
				},
			},
			required: ['text'],
		},
	},
	{
		name: 'compress_output',
		description:
			'Compress raw command/log/tool output deterministically: strip ANSI & ' +
			'progress noise, collapse exact-repeat lines into "… (×N)", and truncate ' +
			'oversized output to head+tail. Never paraphrases a line. No model call. ' +
			'Pass the originating `command` to use a command-aware profile (jest → ' +
			'failures only, npm install → drop chatter, git status → drop hints).',
		inputSchema: {
			type: 'object',
			properties: {
				text: { type: 'string', description: 'Raw output to compress.' },
				command: {
					type: 'string',
					description:
						'Optional: the command that produced the output, for profile selection.',
				},
			},
			required: ['text'],
		},
	},
	{
		name: 'compress_document',
		description:
			'Compress a long instruction/skill document (SKILL.md, CLAUDE.md, system ' +
			'prompts) losslessly: drop duplicate/near-duplicate paragraphs (keeping the ' +
			'first copy), then apply the prose rules. Never touches code; short blocks ' +
			'like headings are protected. No model call.',
		inputSchema: {
			type: 'object',
			properties: {
				text: { type: 'string', description: 'The document text to compress.' },
			},
			required: ['text'],
		},
	},
	{
		name: 'optimize_discover',
		description:
			'Dry-run report: show how many tokens compression would save and which ' +
			'rule group accounts for each saving, WITHOUT forwarding anything to a ' +
			'model. Returns the optimized text plus a per-group breakdown.',
		inputSchema: {
			type: 'object',
			properties: {
				text: { type: 'string', description: 'The text to analyze.' },
			},
			required: ['text'],
		},
	},
	{
		name: 'optimize_stats',
		description:
			'Report lifetime token savings across all prompt optimizations and ' +
			'command-output compressions performed by optimize-pilot on this machine.',
		inputSchema: { type: 'object', properties: {} },
	},
];

function send(message) {
	process.stdout.write(JSON.stringify(message) + '\n');
}
function sendResult(id, result) {
	send({ jsonrpc: '2.0', id, result });
}
function sendError(id, code, message) {
	send({ jsonrpc: '2.0', id, error: { code, message } });
}

function runOptimize(args) {
	const text = typeof args.text === 'string' ? args.text : String(args.text ?? '');
	const { optimized, applied } = optimizePrompt(text);
	const before = estimateTokens(text);
	const after = estimateTokens(optimized);
	const saved = before - after;
	const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
	const summary =
		`~tokens ${before} → ${after} (saved ${saved}, ${pct}%) · ` +
		`chars ${text.length} → ${optimized.length} · ` +
		`applied: ${applied.length ? applied.join(', ') : 'none'}`;
	stats.record('prompt', before, after);
	return {
		content: [{ type: 'text', text: `${optimized}\n\n---\n${summary}` }],
		structuredContent: {
			optimized,
			applied,
			estTokensBefore: before,
			estTokensAfter: after,
			saved,
			percent: pct,
		},
	};
}

function runCompress(args) {
	const text = typeof args.text === 'string' ? args.text : String(args.text ?? '');
	const command = typeof args.command === 'string' ? args.command : '';
	const { compressed, linesBefore, linesAfter, profile } = command
		? optimizeCommandOutput(command, text)
		: { ...compressOutput(text), profile: 'generic' };
	const before = estimateTokens(text);
	const after = estimateTokens(compressed);
	const saved = before - after;
	const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
	const summary =
		`~tokens ${before} → ${after} (saved ${saved}, ${pct}%) · ` +
		`lines ${linesBefore} → ${linesAfter} · profile: ${profile}`;
	stats.record('output', before, after);
	return {
		content: [{ type: 'text', text: `${compressed}\n\n---\n${summary}` }],
		structuredContent: {
			compressed,
			profile,
			linesBefore,
			linesAfter,
			estTokensBefore: before,
			estTokensAfter: after,
			saved,
			percent: pct,
		},
	};
}

function runCompressDocument(args) {
	const text = typeof args.text === 'string' ? args.text : String(args.text ?? '');
	const { compressed, blocksBefore, blocksAfter, duplicatesRemoved, applied } =
		compressDocument(text);
	const before = estimateTokens(text);
	const after = estimateTokens(compressed);
	const saved = before - after;
	const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
	const summary =
		`~tokens ${before} → ${after} (saved ${saved}, ${pct}%) · ` +
		`blocks ${blocksBefore} → ${blocksAfter} · ` +
		`removed ${duplicatesRemoved} duplicate(s) · ` +
		`applied: ${applied.length ? applied.join(', ') : 'none'}`;
	stats.record('prompt', before, after);
	return {
		content: [{ type: 'text', text: `${compressed}\n\n---\n${summary}` }],
		structuredContent: {
			compressed,
			blocksBefore,
			blocksAfter,
			duplicatesRemoved,
			applied,
			estTokensBefore: before,
			estTokensAfter: after,
			saved,
			percent: pct,
		},
	};
}

function runDiscover(args) {
	const text = typeof args.text === 'string' ? args.text : String(args.text ?? '');
	const report = discover(text);
	const lines = report.groups.map((g) => `  • ${g.name}: ~${g.saved} tokens`);
	const summary =
		`~tokens ${report.estTokensBefore} → ${report.estTokensAfter} ` +
		`(saved ${report.saved}, ${report.percent}%)\n` +
		(lines.length ? `Savings by rule group:\n${lines.join('\n')}` : 'No savings found.');
	return {
		content: [{ type: 'text', text: summary }],
		structuredContent: report,
	};
}

function runStats() {
	const s = stats.read();
	return {
		content: [{ type: 'text', text: stats.summary(s) }],
		structuredContent: s,
	};
}

const HANDLERS = {
	optimize_prompt: runOptimize,
	compress_output: runCompress,
	compress_document: runCompressDocument,
	optimize_discover: runDiscover,
	optimize_stats: runStats,
};

function handle(message) {
	const { id, method, params } = message;
	switch (method) {
		case 'initialize':
			sendResult(id, {
				protocolVersion: (params && params.protocolVersion) || DEFAULT_PROTOCOL_VERSION,
				capabilities: { tools: {} },
				serverInfo: SERVER_INFO,
			});
			return;
		case 'notifications/initialized':
		case 'initialized':
			return; // notification, no response
		case 'ping':
			sendResult(id, {});
			return;
		case 'tools/list':
			sendResult(id, { tools: TOOLS });
			return;
		case 'tools/call': {
			const name = params && params.name;
			const fn = HANDLERS[name];
			if (!fn) {
				sendError(id, -32602, `Unknown tool: ${name}`);
				return;
			}
			try {
				sendResult(id, fn((params && params.arguments) || {}));
			} catch (e) {
				sendResult(id, {
					content: [{ type: 'text', text: `Error: ${e && e.message ? e.message : e}` }],
					isError: true,
				});
			}
			return;
		}
		default:
			if (id !== undefined && id !== null) {
				sendError(id, -32601, `Method not found: ${method}`);
			}
	}
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
	buffer += chunk;
	let nl;
	while ((nl = buffer.indexOf('\n')) >= 0) {
		const line = buffer.slice(0, nl).trim();
		buffer = buffer.slice(nl + 1);
		if (!line) {
			continue;
		}
		let message;
		try {
			message = JSON.parse(line);
		} catch {
			continue; // ignore non-JSON lines
		}
		try {
			handle(message);
		} catch (e) {
			if (message && message.id !== undefined && message.id !== null) {
				sendError(message.id, -32603, String((e && e.message) || e));
			}
		}
	}
});
process.stdin.on('end', () => process.exit(0));
