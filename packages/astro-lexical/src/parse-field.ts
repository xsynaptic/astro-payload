import type { z } from 'zod';

import type { ParsedEditorState, RichTextDefinitions } from './definitions.ts';

import { addRichTextIssues, createIssueReporter } from './issues.ts';
import { parseRichText } from './parse.ts';

export interface RichTextFieldOptions {
	context: Pick<z.core.$RefinementCtx, 'addIssue'>;
	documentLabel: string;
	path?: ReadonlyArray<PropertyKey>;
	strict: boolean;
}

const warn = createIssueReporter();

export function parseRichTextField<T extends RichTextDefinitions>(
	definitions: T,
	value: unknown,
	{ context, documentLabel, path = [], strict }: RichTextFieldOptions,
): ParsedEditorState<T> | undefined {
	const { data, issues } = parseRichText(definitions, value);

	if (strict) addRichTextIssues(context, issues, { path });
	else warn(issues, { documentLabel });

	return data;
}
