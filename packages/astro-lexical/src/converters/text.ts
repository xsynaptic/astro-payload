import type { LexicalTextNode } from '#schemas/lexical.ts';

import { textFormat } from '#constants.ts';

// Outermost first; code last, so every other format wraps outside the terminal `<code>`
const wrappingFormats = [
	'highlight',
	'superscript',
	'subscript',
	'underline',
	'strikethrough',
	'italic',
	'bold',
	'code',
] as const;

export const formatTags = {
	bold: 'strong',
	code: 'code',
	highlight: 'mark',
	italic: 'em',
	strikethrough: 's',
	subscript: 'sub',
	superscript: 'sup',
	underline: 'u',
} as const satisfies Record<(typeof wrappingFormats)[number], string>;

export function getActiveFormat(format: number) {
	return wrappingFormats.find((name) => (format & textFormat[name]) !== 0) ?? 'none';
}

// Upstream's precedence when more than one case bit is set
const textTransforms = [
	['lowercase', textFormat.lowercase],
	['uppercase', textFormat.uppercase],
	['capitalize', textFormat.capitalize],
] as const;

// A CSS escape can spell any of these function names
const resourceValue = /\\|(?:url|src|image|image-set|cross-fade)\(/i;

function readDeclaration(
	declaration: string,
	properties: ReadonlyArray<string>,
): [string, string] | undefined {
	const separator = declaration.indexOf(':');
	if (separator === -1) return undefined;

	const property = declaration.slice(0, separator).trim();
	const value = declaration.slice(separator + 1).trim();
	if (property === '' || value === '' || resourceValue.test(value)) return undefined;

	return properties.includes(property) ? [property, value] : undefined;
}

export function getTextStyle(
	node: Pick<LexicalTextNode, 'format' | 'style'>,
	properties: ReadonlyArray<string> = [],
): Record<string, string> | undefined {
	const declarations = (node.style ?? '').split(';');
	const style: Record<string, string> = {};

	for (const declaration of declarations) {
		const parsed = readDeclaration(declaration, properties);
		if (parsed) style[parsed[0]] = parsed[1];
	}

	// Set after the authored style, so the format bit wins as it does upstream
	const transform = textTransforms.find(([, bit]) => ((node.format ?? 0) & bit) !== 0);
	if (transform) style['text-transform'] = transform[0];

	return Object.keys(style).length > 0 ? style : undefined;
}
