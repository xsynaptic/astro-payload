import type { z } from 'zod';

import type { RichTextDefinitions } from '#definitions.ts';
import type { DispatchEntry } from '#dispatch.ts';
import type { LexicalNodeDefinition } from '#registry.ts';
import type { LexicalNode } from '#schemas/lexical.ts';

import { toSchemaTable } from '#definitions.ts';
import { coreNodes } from '#schemas/lexical.ts';

import type { LexicalBlockDefinition } from './blocks.ts';
import type { BlockNodeType, PayloadNodeType } from './schemas.ts';

import { readBlockType } from './blocks.ts';
import { payloadNodes, toBlockNodeSchema } from './schemas.ts';

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
		schemas: toSchemaTable(definitions, {
			block: toBlockDispatch('block', options.blocks ?? []),
			inlineBlock: toBlockDispatch('inlineBlock', options.inlineBlocks ?? []),
		}),
	};
}

function toBlockDispatch(
	type: BlockNodeType,
	blocks: ReadonlyArray<LexicalBlockDefinition>,
): DispatchEntry<z.ZodType> {
	const variants: Record<string, z.ZodType> = {};

	for (const block of blocks) variants[block.blockType] = toBlockNodeSchema(type, block.schema);

	return { key: readBlockType, variants };
}
