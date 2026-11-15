/* eslint-disable @typescript-eslint/no-empty-function -- console spies are intentional no-ops */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RichTextIssue } from '#issues.ts';

import { createIssueReporter } from '#issues.ts';

const zodIssues = [{ code: 'invalid_type', message: 'Required', path: ['fields', 'url'] }] as never;

function invalid(nodeLabel: string): RichTextIssue {
	return {
		issues: zodIssues,
		kind: 'invalid',
		node: { type: nodeLabel },
		nodeLabel,
		path: ['root', 'children', 2],
	};
}

function malformed(): RichTextIssue {
	return {
		issues: zodIssues,
		kind: 'malformed',
		node: 'stray',
		nodeLabel: 'node',
		path: ['root', 'children', 2],
	};
}

function unknown(nodeLabel: string): RichTextIssue {
	return { kind: 'unknown', node: { type: nodeLabel }, nodeLabel, path: ['root', 'children', 0] };
}

describe('createIssueReporter', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('warns with the node, its tree path and the failing field', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		createIssueReporter()([invalid('upload')]);

		expect(warn.mock.calls).toEqual([
			[expect.stringMatching(/"upload" at root\.children\.2 .*fields\.url: Required/)],
		]);
	});

	it('blames corrupt data rather than the schema for a child that is not a node', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		createIssueReporter()([malformed(), invalid('upload')]);

		expect(warn.mock.calls).toEqual([
			['[lexical] malformed node at root.children.2. fields.url: Required'],
			[
				expect.stringContaining(
					'"upload" at root.children.2 failed validation, so its schema may be out of date',
				),
			],
		]);
	});

	it('warns once per kind and node label', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = createIssueReporter();

		report([invalid('upload'), invalid('upload'), unknown('upload')]);
		report([unknown('mystery')]);

		expect(warn).toHaveBeenCalledTimes(3);
	});

	it('names every document that carries the same drift', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = createIssueReporter();

		report([unknown('mystery')], { documentLabel: 'posts/en/12' });
		report([unknown('mystery')], { documentLabel: 'posts/en/13' });
		report([unknown('mystery')], { documentLabel: 'posts/en/13' });

		expect(warn.mock.calls).toEqual([
			[expect.stringContaining('"mystery" at root.children.0 in posts/en/12')],
			[expect.stringContaining('"mystery" at root.children.0 in posts/en/13')],
		]);
	});
});
