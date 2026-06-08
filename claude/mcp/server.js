#!/usr/bin/env node
// Zero-dependency MCP stdio server exposing `optimize_prompt`.
//
// Implements the minimal JSON-RPC 2.0 subset MCP needs (initialize,
// tools/list, tools/call) over newline-delimited stdio. No npm dependencies, so
// the plugin runs as soon as it is installed — nothing to build or install.
//
// IMPORTANT: only JSON-RPC messages go to stdout. Diagnostics go to stderr.

const { optimizePrompt, estimateTokens } = require('./optimizer.js');

const DEFAULT_PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'optimize-pilot', version: '0.1.0' };

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
			if (name !== 'optimize_prompt') {
				sendError(id, -32602, `Unknown tool: ${name}`);
				return;
			}
			try {
				sendResult(id, runOptimize((params && params.arguments) || {}));
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
