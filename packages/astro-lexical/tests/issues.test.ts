/* eslint-disable @typescript-eslint/no-empty-function -- console spies are intentional no-ops */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RenderIssue } from '#issues.ts';

import { createIssueReporter } from '#issues.ts';

const issues = [{ code: 'invalid_type', message: 'Required', path: ['fields', 'url'] }] as never;

function source(nodeLabel: string, documentLabel?: string): Omit<RenderIssue, 'kind'> {
	const node = { type: nodeLabel };

	return documentLabel === undefined ? { node, nodeLabel } : { documentLabel, node, nodeLabel };
}

describe('createIssueReporter', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('warns rather than throwing unless strict', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = createIssueReporter();

		expect(() => {
			report({ ...source('upload'), issues, kind: 'invalid' });
		}).not.toThrow();
		expect(warn).toHaveBeenCalledOnce();
	});

	it('warns once per kind and node label', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = createIssueReporter();

		report({ ...source('upload'), issues, kind: 'invalid' });
		report({ ...source('upload'), issues, kind: 'invalid' });
		report({ ...source('upload'), kind: 'unknown' });
		report({ ...source('mystery'), kind: 'unknown' });

		expect(warn).toHaveBeenCalledTimes(3);
	});

	it('names every document that carries the same drift', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = createIssueReporter();

		report({ ...source('mystery', 'posts/en:12'), kind: 'unknown' });
		report({ ...source('mystery', 'posts/en:13'), kind: 'unknown' });
		report({ ...source('mystery', 'posts/en:13'), kind: 'unknown' });

		expect(warn.mock.calls).toEqual([
			[expect.stringContaining('in posts/en:12')],
			[expect.stringContaining('in posts/en:13')],
		]);
	});

	it('throws on an invalid node when strict, naming the failing path', () => {
		const report = createIssueReporter({ strict: true });

		expect(() => {
			report({ ...source('upload'), issues, kind: 'invalid' });
		}).toThrow(/"upload".*fields\.url: Required/);
	});

	it('throws on a node with no converter when strict', () => {
		const report = createIssueReporter({ strict: true });

		expect(() => {
			report({ ...source('mystery'), kind: 'unknown' });
		}).toThrow(/no converter for node "mystery"/);
	});

	it('names the document when the render config carries a label', () => {
		const report = createIssueReporter({ strict: true });

		expect(() => {
			report({ ...source('mystery', 'posts/en:12'), kind: 'unknown' });
		}).toThrow(/"mystery" in posts\/en:12/);
	});
});
