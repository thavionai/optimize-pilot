import * as vscode from 'vscode';
import {
	optimizePrompt,
	estimateTokens,
	OptimizerOptions,
} from './optimizer';

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
} {
	const cfg = vscode.workspace.getConfiguration('promptOptimizer');
	return {
		collapseWhitespace: cfg.get('collapseWhitespace', true),
		removeFillerWords: cfg.get('removeFillerWords', true),
		simplifyVerbosePhrases: cfg.get('simplifyVerbosePhrases', true),
		contractions: cfg.get('contractions', true),
		forwardToModel: cfg.get('forwardToModel', true),
		showSavings: cfg.get('showSavings', true),
		responseBrevity: cfg.get('responseBrevity', false),
		brevityInstruction: cfg.get('brevityInstruction', '').trim(),
	};
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

	// Response brevity shapes the model's *output* (where most tokens go). It is
	// appended to the prompt we send; the token-savings figure below still
	// reflects input compression only, so it stays honest.
	const brevity = opts.responseBrevity
		? opts.brevityInstruction || DEFAULT_BREVITY_INSTRUCTION
		: '';
	const promptToSend = brevity ? `${optimized}\n\n${brevity}` : optimized;

	if (opts.showSavings) {
		const [before, after] = await Promise.all([
			countTokens(request.model, original, token),
			countTokens(request.model, optimized, token),
		]);
		const saved = before.count - after.count;
		const pct = before.count > 0 ? Math.round((saved / before.count) * 100) : 0;
		const approx = before.exact && after.exact ? '' : '~';
		const sign = saved >= 0 ? 'saved' : 'added';

		stream.markdown(
			`**Tokens:** ${approx}${before.count} → ${approx}${after.count} ` +
				`(${sign} ${approx}${Math.abs(saved)}, ${Math.abs(pct)}%)  \n` +
				`**Model:** ${request.model.name}  \n` +
				(applied.length
					? `**Applied:** ${applied.join(', ')}  \n`
					: '_No changes were needed._  \n') +
				(brevity
					? '**Response brevity:** on — asked the model for a shorter answer to cut output tokens.\n\n'
					: '\n'),
		);
	}

	if (!opts.forwardToModel) {
		stream.markdown('**Optimized prompt:**\n');
		stream.markdown('```text\n' + promptToSend + '\n```');
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
	const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
	participant.iconPath = new vscode.ThemeIcon('rocket');
	context.subscriptions.push(participant);
}

export function deactivate() {}
