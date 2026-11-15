import type { z } from 'zod';

export type RichTextIssue = (
	{ issues: Array<z.core.$ZodIssue>; kind: 'invalid' | 'malformed' } | { kind: 'unknown' }
) & { node: unknown; nodeLabel: string; path: Array<number | string> };

export function addRichTextIssues(
	context: Pick<z.core.$RefinementCtx, 'addIssue'>,
	issues: ReadonlyArray<RichTextIssue>,
	{ path = [] }: { path?: ReadonlyArray<PropertyKey> } = {},
): void {
	for (const issue of issues) {
		context.addIssue({
			code: 'custom',
			input: issue.node,
			message: describeIssue(issue),
			path: [...path, ...issue.path],
		});
	}
}

export function createIssueReporter() {
	// A drifted schema fails every node of its type, so one warning per document says enough
	const warned = new Set<string>();

	return (
		issues: ReadonlyArray<RichTextIssue>,
		{ documentLabel }: { documentLabel?: string } = {},
	): void => {
		for (const issue of issues) {
			const key = `${issue.kind}:${issue.nodeLabel}:${documentLabel ?? ''}`;
			if (warned.has(key)) continue;
			warned.add(key);

			const where = documentLabel ? ` in ${documentLabel}` : '';

			console.warn(`[lexical] ${describeIssue(issue)}${where}`);
		}
	};
}

function describeIssue(issue: RichTextIssue): string {
	const at = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';

	if (issue.kind === 'unknown') return `no definition for node "${issue.nodeLabel}"${at}`;

	const details = issue.issues
		.map((zodIssue) => `${zodIssue.path.join('.') || '(node)'}: ${zodIssue.message}`)
		.join('; ');

	if (issue.kind === 'malformed') return `malformed node${at}. ${details}`;

	return `node "${issue.nodeLabel}"${at} failed validation, so its schema may be out of date. ${details}`;
}
