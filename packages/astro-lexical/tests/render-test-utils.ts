import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import type { ConverterMapShape } from '#definitions.ts';
import type { RichTextConfig } from '#types.ts';

import { defineRichText } from '#definitions.ts';
import { parseRichText } from '#parse.ts';
import RichText from '#rich-text.astro';

// eslint-disable-next-line unicorn/no-null -- Lexical serializes an unset direction as `null`
export const element = { direction: null, format: '', indent: 0, version: 1 };

export const coreRichText = defineRichText();

export function editorState(children: Array<unknown>) {
	return { root: { ...element, children, type: 'root' } };
}

// Converters are only ever compared by identity, so a named stub is enough
export function stubConverter(name: string): AstroComponentFactory {
	return (() => name) as unknown as AstroComponentFactory;
}

export async function renderCore(
	children: Array<unknown>,
	config: Partial<RichTextConfig> = {},
	converters?: ConverterMapShape,
) {
	const { data, issues } = parseRichText(coreRichText, editorState(children));
	if (!data) return { html: '', issues };

	const container = await AstroContainer.create();
	const html = await container.renderToString(RichText, { props: { config, converters, data } });

	return { html, issues };
}
