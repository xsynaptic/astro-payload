import type { LexicalBaseNode } from './types.ts';

// A paragraph holding only carriage returns renders as dead space, so the converter skips it
export function isBlankInline(children: ReadonlyArray<LexicalBaseNode>) {
	return children.every((child) => {
		if (child.type === 'linebreak') return true;
		if (child.type !== 'text') return false;

		return typeof child.text === 'string' && child.text.trim() === '';
	});
}

export function isBlankParagraph(node: LexicalBaseNode) {
	return node.type === 'paragraph' && isBlankInline(toChildren(node.children));
}

// The same rule as the paragraph converter's, so a document that would render nothing reads as having no content
export function isEmptyDocument(children: ReadonlyArray<LexicalBaseNode>) {
	return children.every((child) => isBlankParagraph(child));
}

function toChildren(children: unknown): ReadonlyArray<LexicalBaseNode> {
	return Array.isArray(children) ? (children as Array<LexicalBaseNode>) : [];
}
