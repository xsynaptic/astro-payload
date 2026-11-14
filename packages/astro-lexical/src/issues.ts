import type { z } from 'zod';

import type { LexicalBaseNode } from './types.ts';

export type RenderIssue = { documentLabel?: string; node: LexicalBaseNode; nodeLabel: string } & (
	{ issues: Array<z.core.$ZodIssue>; kind: 'invalid' } | { kind: 'unknown' }
);

export interface IssueReporterOptions {
	// Throwing lets a static build fail rather than publish a page with content silently missing
	strict?: boolean;
}

export function createIssueReporter({ strict = false }: IssueReporterOptions = {}) {
	// Warns once per document and node; the same drift otherwise repeats on every render of that document
	const warned = new Set<string>();

	return (issue: RenderIssue): void => {
		const message = describeIssue(issue);

		if (strict) throw new Error(message);

		const key = `${issue.kind}:${issue.nodeLabel}:${issue.documentLabel ?? ''}`;
		if (warned.has(key)) return;
		warned.add(key);

		console.warn(message);
	};
}

function describeIssue(issue: RenderIssue): string {
	const where = issue.documentLabel ? ` in ${issue.documentLabel}` : '';

	if (issue.kind === 'unknown') {
		return `[lexical] no converter for node "${issue.nodeLabel}"${where}`;
	}

	const details = issue.issues
		.map((zodIssue) => `${zodIssue.path.join('.')}: ${zodIssue.message}`)
		.join('; ');

	return `[lexical] node "${issue.nodeLabel}" failed validation${where}, so its schema may be out of date. ${details}`;
}
