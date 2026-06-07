import * as assert from 'assert';
import { optimizePrompt, estimateTokens, DEFAULT_OPTIONS } from '../optimizer';

suite('optimizePrompt', () => {
	test('collapses whitespace and trims', () => {
		const { optimized } = optimizePrompt('Write   a\n\n\n\nfunction   .   ');
		assert.strictEqual(optimized, 'Write a\n\nfunction.');
	});

	test('removes politeness words', () => {
		const { optimized, applied } = optimizePrompt(
			'Please write a function. Thanks in advance!',
		);
		assert.strictEqual(optimized, 'write a function.');
		assert.ok(applied.includes('filler words'));
	});

	test('strips request preambles only at sentence start', () => {
		const { optimized } = optimizePrompt('Could you write a parser?');
		assert.strictEqual(optimized, 'write a parser?');
	});

	test('keeps mid-sentence "can you" intact', () => {
		const { optimized } = optimizePrompt('Explain how a compiler can you trust it');
		assert.ok(
			optimized.includes('can you'),
			`expected mid-sentence phrase preserved, got: ${optimized}`,
		);
	});

	test('shortens verbose phrases', () => {
		const { optimized } = optimizePrompt(
			'Refactor this in order to utilize the cache.',
		);
		assert.strictEqual(optimized, 'Refactor this to use the cache.');
	});

	test('preserves fenced code blocks verbatim', () => {
		const input = 'Optimize:\n```js\nconst   x =   1;  // please keep spacing\n```';
		const { optimized } = optimizePrompt(input);
		assert.ok(
			optimized.includes('const   x =   1;  // please keep spacing'),
			`code spacing/words should be untouched, got: ${optimized}`,
		);
	});

	test('preserves inline code spans', () => {
		const { optimized } = optimizePrompt('Use `a   please   b` here.');
		assert.ok(optimized.includes('`a   please   b`'));
	});

	test('handles code block at start and end', () => {
		const input = '```\nfoo\n```';
		const { optimized } = optimizePrompt(input);
		assert.strictEqual(optimized, '```\nfoo\n```');
	});

	test('respects disabled options', () => {
		const input = 'Please   keep   this.';
		const { optimized } = optimizePrompt(input, {
			...DEFAULT_OPTIONS,
			removeFillerWords: false,
			collapseWhitespace: false,
			simplifyVerbosePhrases: false,
		});
		assert.strictEqual(optimized, 'Please   keep   this.');
	});

	test('estimateTokens approximates by length', () => {
		assert.strictEqual(estimateTokens('abcd'), 1);
		assert.strictEqual(estimateTokens('abcde'), 2);
	});
});
