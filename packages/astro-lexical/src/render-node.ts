import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import type { Converters, LexicalBaseNode } from './types.ts';

import { selectEntry } from './dispatch.ts';

// Every alignment the element schema allows is already a CSS `text-align` keyword
const textAlignValues = new Set(['center', 'end', 'justify', 'left', 'right', 'start']);

// A table's format places the table itself, as upstream reads it
const tableAlignments: Partial<Record<string, Record<string, string>>> = {
	center: { marginInline: 'auto' },
	right: { marginLeft: 'auto' },
};

export function computeNodeStyles(node: LexicalBaseNode): Record<string, string> | undefined {
	const style: Record<string, string> = alignmentStyle(node);

	// List items carry their own indentation through the list markup
	if (typeof node.indent === 'number' && node.indent > 0 && node.type !== 'listitem') {
		style.paddingInlineStart = `${String(node.indent * 40)}px`;
	}

	return Object.keys(style).length > 0 ? style : undefined;
}

export function getNodeDirection(node: LexicalBaseNode) {
	return node.direction === 'ltr' || node.direction === 'rtl' ? node.direction : undefined;
}

function alignmentStyle(node: LexicalBaseNode): Record<string, string> {
	if (typeof node.format !== 'string') return {};
	if (node.type === 'table') {
		return Object.hasOwn(tableAlignments, node.format) ? { ...tableAlignments[node.format] } : {};
	}
	if (!textAlignValues.has(node.format)) return {};

	return { textAlign: node.format };
}

// A cast can hand the renderer data its converter map does not cover, so a gap fails loudly
export function getConverter(node: LexicalBaseNode, converters: Converters): AstroComponentFactory {
	const { entry, label } = selectEntry(node, converters);

	if (!entry) throw new Error(`[lexical] no converter for node "${label}"`);

	return entry;
}
