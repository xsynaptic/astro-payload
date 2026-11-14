import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import type { RenderIssue } from './issues.ts';
import type { ConverterEntry, Converters, LexicalBaseNode, RichTextConfig } from './types.ts';

import { createIssueReporter } from './issues.ts';

const warnOnIssue = createIssueReporter();

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

export function getConverterForNode(
	node: LexicalBaseNode,
	converters: Converters,
): ConverterEntry | undefined {
	return selectEntry(node, getEntry(node, converters));
}

export function resolveNode(
	node: LexicalBaseNode,
	converters: Converters,
	config: Pick<RichTextConfig, 'documentLabel' | 'onIssue'>,
): { converter: AstroComponentFactory | undefined; node: LexicalBaseNode } {
	const registered = getEntry(node, converters);
	const entry = selectEntry(node, registered);
	const onIssue = config.onIssue ?? warnOnIssue;

	if (!entry) {
		onIssue({ ...describeSource(node, registered, config), kind: 'unknown' });
		return { converter: undefined, node };
	}

	if (!entry.schema) return { converter: entry.converter, node };

	const parsed = entry.schema.safeParse(node);

	if (!parsed.success) {
		onIssue({
			...describeSource(node, registered, config),
			issues: parsed.error.issues,
			kind: 'invalid',
		});
		return { converter: undefined, node };
	}

	// The dispatcher cannot know an app node's type; the schema is the app's assertion about it
	return { converter: entry.converter, node: parsed.data as LexicalBaseNode };
}

function describeSource(
	node: LexicalBaseNode,
	registered: Converters[string] | undefined,
	{ documentLabel }: Pick<RichTextConfig, 'documentLabel'>,
): Pick<RenderIssue, 'documentLabel' | 'node' | 'nodeLabel'> {
	const nodeLabel = registered && 'describe' in registered ? registered.describe(node) : node.type;

	return documentLabel === undefined ? { node, nodeLabel } : { documentLabel, node, nodeLabel };
}

// An own-key check, so a node type such as `constructor` never reaches the prototype
function getEntry(node: LexicalBaseNode, converters: Converters) {
	return Object.hasOwn(converters, node.type) ? converters[node.type] : undefined;
}

function selectEntry(node: LexicalBaseNode, registered: Converters[string] | undefined) {
	return registered && 'select' in registered ? registered.select(node) : registered;
}
