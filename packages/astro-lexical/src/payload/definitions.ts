import type { LexicalNode, LexicalNodeDefinition, RichTextDefinitions } from '#definitions.ts';

import { coreNodes, defineNode, toSchemaTable } from '#definitions.ts';

import type { LexicalBlockDefinition } from './blocks.ts';

import { toBlockDispatch } from './blocks.ts';
import {
	PayloadAutolinkNodeSchema,
	PayloadLinkNodeSchema,
	PayloadRelationshipNodeSchema,
	PayloadTextNodeSchema,
	PayloadUploadNodeSchema,
	toBlockNodeSchema,
} from './schemas.ts';

export const payloadNodes = [
	defineNode(PayloadTextNodeSchema),
	defineNode(PayloadLinkNodeSchema),
	defineNode(PayloadAutolinkNodeSchema),
	defineNode(PayloadUploadNodeSchema),
	defineNode(PayloadRelationshipNodeSchema),
] as const;

export type PayloadNodeType = (typeof payloadNodes)[number]['type'];

export type PayloadRichTextDefinitions = RichTextDefinitions<'payload'>;

// Payload keeps inline blocks in a list of their own, so a slug may be both and render differently in each
export function definePayloadRichText<
	const TNodes extends ReadonlyArray<LexicalNodeDefinition> = [],
	const TBlocks extends ReadonlyArray<LexicalBlockDefinition> = [],
	const TInlineBlocks extends ReadonlyArray<LexicalBlockDefinition> = [],
>(
	options: { blocks?: TBlocks; inlineBlocks?: TInlineBlocks; nodes?: TNodes } = {},
): RichTextDefinitions<
	'payload',
	{
		blocks: TBlocks[number]['blockType'];
		defaults: LexicalNode['type'] | PayloadNodeType;
		inlineBlocks: TInlineBlocks[number]['blockType'];
		nodes: TNodes[number]['type'];
	}
> {
	// Payload's text, link and autolink replace upstream's, and a passed node replaces either
	const definitions = [...coreNodes, ...payloadNodes, ...(options.nodes ?? [])];

	return {
		schemas: toSchemaTable(
			definitions,
			toBlockDispatch((section, type) => {
				const blocks: ReadonlyArray<LexicalBlockDefinition> = options[section] ?? [];

				return Object.fromEntries(
					blocks.map((block) => [block.blockType, toBlockNodeSchema(type, block.schema)]),
				);
			}),
		),
	};
}
