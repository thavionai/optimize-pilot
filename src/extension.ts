import * as vscode from 'vscode';
import {
	optimizePrompt,
	estimateTokens,
	OptimizerOptions,
	CustomRule,
} from './optimizer';
import {
	ResolvedAttachment,
	ProcessedAttachment,
	processAttachment,
	formatBundle,
} from './attachments';

// Skip attachments larger than this (bytes) or that look binary.
const MAX_ATTACHMENT_BYTES = 512 * 1024;

const PARTICIPANT_ID = 'prompt-optimizer.optimize';

// Appended to the forwarded prompt when response brevity is on but no custom
// instruction is configured. This is what actually reduces output tokens.
const DEFAULT_BREVITY_INSTRUCTION =
	'Be concise: answer directly with no preamble, restatement, or filler. ' +
	'Prefer short bullet points; omit obvious caveats.';

function readOptions(): OptimizerOptions & {
	forwardToModel: boolean;
	showSavings: boolean;
	responseBrevity: boolean;
	brevityInstruction: string;
	includeAttachments: boolean;
	compressAttachmentLogs: boolean;
} {
	const cfg = vscode.workspace.getConfiguration('promptOptimizer');
	const customRules = cfg
		.get<CustomRule[]>('customRules', [])
		.filter((r) => r && typeof r.find === 'string');
	return {
		collapseWhitespace: cfg.get('collapseWhitespace', true),
		removeFillerWords: cfg.get('removeFillerWords', true),
		simplifyVerbosePhrases: cfg.get('simplifyVerbosePhrases', true),
		contractions: cfg.get('contractions', true),
		customRules,
		forwardToModel: cfg.get('forwardToModel', true),
		showSavings: cfg.get('showSavings', true),
		responseBrevity: cfg.get('responseBrevity', false),
		brevityInstruction: cfg.get('brevityInstruction', '').trim(),
		includeAttachments: cfg.get('includeAttachments', true),
		compressAttachmentLogs: cfg.get('compressAttachmentLogs', true),
	};
}

// --- Lifetime savings ------------------------------------------------------
// Cumulative token savings, persisted in globalState (like RTK's `gain`).

const STATS_KEY = 'promptOptimizer.lifetime';
interface Lifetime {
	prompts: number;
	tokensBefore: number;
	tokensAfter: number;
}
let memento: vscode.Memento | undefined;

function recordSavings(before: number, after: number): void {
	if (!memento || before <= 0) {
		return;
	}
	const s = memento.get<Lifetime>(STATS_KEY, {
		prompts: 0,
		tokensBefore: 0,
		tokensAfter: 0,
	});
	s.prompts += 1;
	s.tokensBefore += before;
	s.tokensAfter += after;
	void memento.update(STATS_KEY, s);
}

function lifetimeSummary(): string {
	const s = memento?.get<Lifetime>(STATS_KEY);
	if (!s || s.prompts === 0) {
		return 'Optimize Pilot: no prompts optimized yet.';
	}
	const saved = s.tokensBefore - s.tokensAfter;
	const pct = s.tokensBefore > 0 ? Math.round((saved / s.tokensBefore) * 100) : 0;
	return (
		`Optimize Pilot lifetime: ${s.prompts} prompt(s) · ` +
		`${s.tokensBefore} → ${s.tokensAfter} tokens (saved ${saved}, ${pct}%)`
	);
}

/** Decode a file to text, skipping oversized or binary content. */
async function readFileText(uri: vscode.Uri): Promise<string | null> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
			return null;
		}
		if (bytes.subarray(0, 8000).includes(0)) {
			return null; // NUL byte -> binary
		}
		return Buffer.from(bytes).toString('utf8');
	} catch {
		return null;
	}
}

function basename(uri: vscode.Uri): string {
	const parts = uri.path.split('/');
	return parts[parts.length - 1] || uri.path;
}

/** Resolve chat references (files / selections) into plain text attachments. */
async function resolveAttachments(
	references: readonly vscode.ChatPromptReference[],
): Promise<ResolvedAttachment[]> {
	const out: ResolvedAttachment[] = [];
	for (const ref of references) {
		const value = ref.value;
		if (typeof value === 'string') {
			out.push({ name: ref.id || 'selection', content: value });
		} else if (value instanceof vscode.Uri) {
			const content = await readFileText(value);
			if (content !== null) {
				out.push({ name: basename(value), content });
			}
		} else if (value instanceof vscode.Location) {
			const content = await readFileText(value.uri);
			if (content !== null) {
				const lines = content.split('\n');
				const slice = lines
					.slice(value.range.start.line, value.range.end.line + 1)
					.join('\n');
				out.push({ name: basename(value.uri), content: slice });
			}
		}
	}
	return out;
}

async function countTokens(
	model: vscode.LanguageModelChat,
	text: string,
	token: vscode.CancellationToken,
): Promise<{ count: number; exact: boolean }> {
	try {
		return { count: await model.countTokens(text, token), exact: true };
	} catch {
		return { count: estimateTokens(text), exact: false };
	}
}

const handler: vscode.ChatRequestHandler = async (
	request,
	_context,
	stream,
	token,
) => {
	const opts = readOptions();
	const original = (request.prompt ?? '').trim();

	if (!original) {
		stream.markdown(
			'Type a prompt after `@optimize` and I will compress it (removing filler, ' +
				'collapsing whitespace, shortening verbose phrases) before forwarding it ' +
				'to the model selected in the chat dropdown.',
		);
		return;
	}

	const { optimized, applied } = optimizePrompt(original, opts);

	// Fold in attached files: compress prose, preserve code verbatim.
	let rawAtts: ResolvedAttachment[] = [];
	let procAtts: ProcessedAttachment[] = [];
	if (opts.includeAttachments && request.references?.length) {
		rawAtts = await resolveAttachments(request.references);
		procAtts = rawAtts.map((a) =>
			processAttachment(a, opts, opts.compressAttachmentLogs),
		);
	}

	const beforeBundle = formatBundle(
		original,
		rawAtts.map((a) => ({
			name: a.name,
			content: a.content,
			mode: 'preserved' as const,
		})),
	);
	const afterBundle = formatBundle(optimized, procAtts);

	// Response brevity shapes the model's *output* (where most tokens go). It is
	// appended to what we send; the token-savings figure below reflects input
	// compression only, so it stays honest.
	const brevity = opts.responseBrevity
		? opts.brevityInstruction || DEFAULT_BREVITY_INSTRUCTION
		: '';
	const promptToSend = brevity ? `${afterBundle}\n\n${brevity}` : afterBundle;

	// Always measure (for lifetime tracking); only render when showSavings is on.
	const [before, after] = await Promise.all([
		countTokens(request.model, beforeBundle, token),
		countTokens(request.model, afterBundle, token),
	]);
	recordSavings(before.count, after.count);

	if (opts.showSavings) {
		const saved = before.count - after.count;
		const pct = before.count > 0 ? Math.round((saved / before.count) * 100) : 0;
		const approx = before.exact && after.exact ? '' : '~';
		const sign = saved >= 0 ? 'saved' : 'added';
		const proseN = procAtts.filter((a) => a.mode === 'prose').length;
		const logN = procAtts.filter((a) => a.mode === 'output').length;
		const keptN = procAtts.filter((a) => a.mode === 'preserved').length;

		stream.markdown(
			`**Tokens:** ${approx}${before.count} → ${approx}${after.count} ` +
				`(${sign} ${approx}${Math.abs(saved)}, ${Math.abs(pct)}%)  \n` +
				`**Model:** ${request.model.name}  \n` +
				(applied.length
					? `**Applied:** ${applied.join(', ')}  \n`
					: '_No changes were needed._  \n') +
				(procAtts.length
					? `**Attachments:** ${procAtts.length} included ` +
						`(${proseN} prose compressed, ${logN} log compressed, ${keptN} code preserved)  \n`
					: '') +
				(brevity
					? '**Response brevity:** on — asked the model for a shorter answer to cut output tokens.\n\n'
					: '\n'),
		);
	}

	if (!opts.forwardToModel) {
		stream.markdown('**Optimized prompt:**\n');
		stream.markdown(
			'```text\n' + (brevity ? `${optimized}\n\n${brevity}` : optimized) + '\n```',
		);
		if (procAtts.length) {
			const compressedN = procAtts.filter((a) => a.mode !== 'preserved').length;
			stream.markdown(
				`\n\n_+ ${procAtts.length} attachment(s) would be forwarded ` +
					`(${compressedN} compressed, the rest preserved)._`,
			);
		}
		return;
	}

	stream.markdown('---\n\n');

	try {
		const messages = [vscode.LanguageModelChatMessage.User(promptToSend)];
		const response = await request.model.sendRequest(messages, {}, token);
		for await (const fragment of response.text) {
			stream.markdown(fragment);
		}
	} catch (err) {
		if (err instanceof vscode.LanguageModelError) {
			stream.markdown(`\n\n_Model request failed: ${err.message}_`);
		} else if (err instanceof vscode.CancellationError || token.isCancellationRequested) {
			// User cancelled — nothing to report.
		} else {
			stream.markdown(
				`\n\n_Unexpected error: ${err instanceof Error ? err.message : String(err)}_`,
			);
		}
	}
};

export function activate(context: vscode.ExtensionContext) {
	memento = context.globalState;

	const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
	participant.iconPath = new vscode.ThemeIcon('rocket');
	context.subscriptions.push(participant);

	context.subscriptions.push(
		vscode.commands.registerCommand('promptOptimizer.showStats', () => {
			void vscode.window.showInformationMessage(lifetimeSummary());
		}),
	);
}

export function deactivate() {}
