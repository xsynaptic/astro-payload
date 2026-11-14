import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import type { RenderIssue } from '#issues.ts';
import type { Converters, RichTextConfig } from '#types.ts';

import RichText from '#rich-text.astro';

// eslint-disable-next-line unicorn/no-null -- Lexical serializes an unset direction as `null`
export const element = { direction: null, format: '', indent: 0, version: 1 };

export async function renderCore(
	children: Array<unknown>,
	config: Partial<RichTextConfig> = {},
	converters?: Converters,
) {
	const issues: Array<RenderIssue> = [];
	const container = await AstroContainer.create();
	const html = await container.renderToString(RichText, {
		props: {
			config: {
				onIssue: (issue: RenderIssue) => {
					issues.push(issue);
				},
				...config,
			},
			converters,
			data: { root: { ...element, children, type: 'root' } },
		},
	});

	return { html, issues };
}
