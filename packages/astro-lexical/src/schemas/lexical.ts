import { z } from 'zod';

import { tableCellHeader } from '#constants.ts';

// Loose child node schema; avoids recursive Zod inference issues
// Runtime validates shape; TypeScript types provide full recursion
const LexicalChildNodeSchema = z.object({ type: z.string(), version: z.number() }).loose();

// Common element node fields
export const elementFields = {
	children: z.array(LexicalChildNodeSchema).default([]),
	direction: z.enum(['ltr', 'rtl']).nullable(),
	format: z.enum(['', 'left', 'start', 'center', 'right', 'end', 'justify']),
	indent: z.number(),
	version: z.number(),
};

export const LexicalTextNodeSchema = z.object({
	detail: z.number().optional(),
	format: z.number().optional(),
	mode: z.enum(['normal', 'segmented', 'token']).optional(),
	style: z.string().optional(),
	text: z.string(),
	type: z.literal('text'),
	version: z.number().optional(),
});

export const LexicalLinebreakNodeSchema = z.object({
	type: z.literal('linebreak'),
	version: z.number().optional(),
});

export const LexicalTabNodeSchema = z.object({
	type: z.literal('tab'),
	version: z.number().optional(),
});

export const LexicalHorizontalRuleNodeSchema = z.object({
	type: z.literal('horizontalrule'),
	version: z.number().optional(),
});

export const LexicalParagraphNodeSchema = z.object({
	type: z.literal('paragraph'),
	...elementFields,
	textFormat: z.number().optional(),
	textStyle: z.string().optional(),
});

export const LexicalHeadingNodeSchema = z.object({
	type: z.literal('heading'),
	...elementFields,
	tag: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
});

export const LexicalListNodeSchema = z.object({
	type: z.literal('list'),
	...elementFields,
	listType: z.enum(['bullet', 'number', 'check']),
	start: z.number().optional(),
	tag: z.enum(['ol', 'ul']).optional(),
});

export const LexicalListItemNodeSchema = z.object({
	type: z.literal('listitem'),
	...elementFields,
	checked: z.boolean().optional(),
	value: z.number().optional(),
});

// The upstream `@lexical/link` shape; Payload's own link nodes live in the Payload preset
const linkFields = {
	...elementFields,
	rel: z.string().nullable().optional(),
	target: z.string().nullable().optional(),
	title: z.string().nullable().optional(),
	url: z.string(),
};

export const LexicalLinkNodeSchema = z.object({
	type: z.literal('link'),
	...linkFields,
});

export const LexicalAutolinkNodeSchema = z.object({
	type: z.literal('autolink'),
	...linkFields,
	isUnlinked: z.boolean().optional(),
});

export const LexicalQuoteNodeSchema = z.object({
	type: z.literal('quote'),
	...elementFields,
});

export const LexicalCodeNodeSchema = z.object({
	type: z.literal('code'),
	...elementFields,
	language: z.string().nullish(),
	theme: z.string().optional(),
});

export const LexicalCodeHighlightNodeSchema = LexicalTextNodeSchema.extend({
	highlightType: z.string().nullish(),
	type: z.literal('code-highlight'),
});

export const LexicalTableNodeSchema = z.object({
	type: z.literal('table'),
	...elementFields,
});

export const LexicalTableRowNodeSchema = z.object({
	type: z.literal('tablerow'),
	...elementFields,
});

export const LexicalTableCellNodeSchema = z.object({
	type: z.literal('tablecell'),
	...elementFields,
	colSpan: z
		.number()
		.int()
		.nullish()
		.transform((span) => span || 1),
	headerState: z
		.number()
		.int()
		.transform((state) => state & tableCellHeader.both),
	rowSpan: z
		.number()
		.int()
		.nullish()
		.transform((span) => span || 1),
});

export const LexicalRootNodeSchema = z.object({
	type: z.literal('root'),
	...elementFields,
});

export const LexicalEditorStateSchema = z.object({
	root: LexicalRootNodeSchema,
});

export type LexicalAutolinkNode = z.infer<typeof LexicalAutolinkNodeSchema>;
export type LexicalCodeHighlightNode = z.infer<typeof LexicalCodeHighlightNodeSchema>;
export type LexicalCodeNode = z.infer<typeof LexicalCodeNodeSchema>;
export type LexicalEditorState = z.infer<typeof LexicalEditorStateSchema>;
export type LexicalHeadingNode = z.infer<typeof LexicalHeadingNodeSchema>;
export type LexicalLinkNode = z.infer<typeof LexicalLinkNodeSchema>;
export type LexicalListItemNode = z.infer<typeof LexicalListItemNodeSchema>;
export type LexicalListNode = z.infer<typeof LexicalListNodeSchema>;
export type LexicalParagraphNode = z.infer<typeof LexicalParagraphNodeSchema>;
export type LexicalQuoteNode = z.infer<typeof LexicalQuoteNodeSchema>;
export type LexicalRootNode = z.infer<typeof LexicalRootNodeSchema>;
export type LexicalTableCellNode = z.infer<typeof LexicalTableCellNodeSchema>;
export type LexicalTableNode = z.infer<typeof LexicalTableNodeSchema>;
export type LexicalTableRowNode = z.infer<typeof LexicalTableRowNodeSchema>;
export type LexicalTextNode = z.infer<typeof LexicalTextNodeSchema>;
