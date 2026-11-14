import type { LexicalCodeNode } from '#schemas/lexical.ts';

type CodeChild = LexicalCodeNode['children'][number];

const codeWhitespace = new Map([
	['linebreak', '\n'],
	['tab', '\t'],
]);
const textTypes = new Set(['code-highlight', 'text']);

export function getCodeWhitespace(child: CodeChild) {
	return codeWhitespace.get(child.type);
}

function childText(child: CodeChild) {
	const whitespace = getCodeWhitespace(child);

	if (whitespace !== undefined) return whitespace;
	if (!textTypes.has(child.type) || typeof child.text !== 'string') return '';

	return child.text;
}

export function getCodeText({ children }: Pick<LexicalCodeNode, 'children'>) {
	return children.map((child) => childText(child)).join('');
}

export function getLanguageClass(language: string | undefined) {
	if (!language || /\s/.test(language)) return;

	return `language-${language}`;
}
