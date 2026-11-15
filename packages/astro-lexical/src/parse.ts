import { z } from 'zod';

import type { ParsedEditorState, RichTextDefinitions } from './definitions.ts';
import type { NodeTable } from './dispatch.ts';
import type { RichTextIssue } from './issues.ts';
import type { LexicalBaseNode } from './types.ts';

import { isEmptyDocument } from './blank.ts';
import { walkerChildrenSchema } from './definitions.ts';
import { selectEntry } from './dispatch.ts';
import { LexicalRootNodeSchema } from './schemas/lexical.ts';

export interface RichTextParseResult<T extends RichTextDefinitions> {
	data: ParsedEditorState<T> | undefined;
	issues: Array<RichTextIssue>;
}

interface WalkContext {
	issues: Array<RichTextIssue>;
	schemas: NodeTable<z.ZodType>;
}

// The root carries no refinements, so `.extend` is safe here
const editorStateSchema = z.object({
	root: LexicalRootNodeSchema.extend({ children: walkerChildrenSchema }),
});

const nodeTypeSchema = z.looseObject({ type: z.string() });

// Synchronous, so every node schema must be
export function parseRichText<T extends RichTextDefinitions>(
	definitions: T,
	value: unknown,
): RichTextParseResult<T> {
	if (value === null || value === undefined) return { data: undefined, issues: [] };

	const state = editorStateSchema.safeParse(value);

	if (!state.success) {
		return {
			data: undefined,
			issues: [
				{ issues: state.error.issues, kind: 'invalid', node: value, nodeLabel: 'root', path: [] },
			],
		};
	}

	const context: WalkContext = { issues: [], schemas: definitions.schemas };
	const { root } = state.data;
	const children = walkChildren(root.children, ['root', 'children'], context);

	if (isEmptyDocument(children)) return { data: undefined, issues: context.issues };

	// The brand is type only; this walk is what earns it
	const data = { root: { ...root, children } } as unknown as ParsedEditorState<T>;

	return { data, issues: context.issues };
}

function walkChildren(
	children: ReadonlyArray<unknown>,
	path: Array<number | string>,
	context: WalkContext,
): Array<LexicalBaseNode> {
	const walked: Array<LexicalBaseNode> = [];

	for (const [index, child] of children.entries()) {
		const node = walkNode(child, [...path, index], context);
		if (node) walked.push(node);
	}

	return walked;
}

function walkNode(
	raw: unknown,
	path: Array<number | string>,
	context: WalkContext,
): LexicalBaseNode | undefined {
	const typed = nodeTypeSchema.safeParse(raw);

	if (!typed.success) {
		const issues = typed.error.issues;
		context.issues.push({ issues, kind: 'malformed', node: raw, nodeLabel: 'node', path });
		return undefined;
	}

	const { entry: schema, label } = selectEntry(typed.data, context.schemas);

	if (!schema) {
		context.issues.push({ kind: 'unknown', node: raw, nodeLabel: label, path });
		return undefined;
	}

	const parsed = schema.safeParse(raw);

	if (!parsed.success) {
		const issues = parsed.error.issues;
		context.issues.push({ issues, kind: 'invalid', node: raw, nodeLabel: label, path });
		return undefined;
	}

	// The walker cannot know an app node's type; the schema is the app's assertion about it
	const node = parsed.data as LexicalBaseNode;

	if (!Array.isArray(node.children)) return node;

	return { ...node, children: walkChildren(node.children, [...path, 'children'], context) };
}
