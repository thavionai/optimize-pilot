import * as vscode from 'vscode';
import {
	optimizePrompt,
	estimateTokens,
	OptimizerOptions,
} from './optimizer';

const PARTICIPANT_ID = 'prompt-optimizer.optimize';

function readOptions(): OptimizerOptions & {
	forwardToModel: boolean;
	showSavings: boolean;
} {
	const cfg = vscode.workspace.getConfiguration('promptOptimizer');
	return {
		collapseWhitespace: cfg.get('collapseWhitespace', true),
		removeFillerWords: cfg.get('removeFillerWords', true),
		simplifyVerbosePhrases: cfg.get('simplifyVerbosePhrases', true),
		forwardToModel: cfg.get('forwardToModel', true),
		showSavings: cfg.get('showSavings', true),
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
					? `**Applied:** ${applied.join(', ')}\n\n`
					: '_No changes were needed._\n\n'),
		);
	}

	if (!opts.forwardToModel) {
		stream.markdown('**Optimized prompt:**\n');
		stream.markdown('```text\n' + optimized + '\n```');
		return;
	}

	stream.markdown('---\n\n');

	try {
		const messages = [vscode.LanguageModelChatMessage.User(optimized)];
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
