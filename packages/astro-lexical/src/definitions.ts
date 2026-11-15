import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { z } from 'zod';

import type { DispatchEntry, NodeTable } from './dispatch.ts';
import type { LexicalRootNode } from './schemas/lexical.ts';
import type { LexicalBaseNode } from './types.ts';

import {
	LexicalAutolinkNodeSchema,
	LexicalCodeHighlightNodeSchema,
	LexicalCodeNodeSchema,
	LexicalHeadingNodeSchema,
	LexicalHorizontalRuleNodeSchema,
	LexicalLinebreakNodeSchema,
	LexicalLinkNodeSchema,
	LexicalListItemNodeSchema,
	LexicalListNodeSchema,
	LexicalParagraphNodeSchema,
	LexicalQuoteNodeSchema,
	LexicalTableCellNodeSchema,
	LexicalTableNodeSchema,
	LexicalTableRowNodeSchema,
	LexicalTabNodeSchema,
	LexicalTextNodeSchema,
} from './schemas/lexical.ts';

export interface LexicalNodeDefinition<
	TType extends string = string,
	TSchema extends NodeSchema = NodeSchema,
> {
	schema: TSchema;
	type: TType;
}

export type LiteralOf<TSchema> =
	TSchema extends z.ZodLiteral<infer TValue extends string> ? TValue : never;

type NodeSchema = z.ZodObject<Record<string, z.ZodType> & { type: z.ZodLiteral<string> }>;

// A tag declared beside the schema compiles even when the two disagree
export function defineNode<TSchema extends NodeSchema>(
	schema: TSchema,
): LexicalNodeDefinition<LiteralOf<TSchema['shape']['type']>, TSchema> {
	// The shape is intersected with an index signature, which widens the lookup back to `string`
	const type = schema.shape.type.value as LiteralOf<TSchema['shape']['type']>;

	return { schema, type };
}

export const coreNodes = [
	defineNode(LexicalTextNodeSchema),
	defineNode(LexicalLinebreakNodeSchema),
	defineNode(LexicalTabNodeSchema),
	defineNode(LexicalHorizontalRuleNodeSchema),
	defineNode(LexicalParagraphNodeSchema),
	defineNode(LexicalHeadingNodeSchema),
	defineNode(LexicalListNodeSchema),
	defineNode(LexicalListItemNodeSchema),
	defineNode(LexicalLinkNodeSchema),
	defineNode(LexicalAutolinkNodeSchema),
	defineNode(LexicalQuoteNodeSchema),
	defineNode(LexicalCodeNodeSchema),
	defineNode(LexicalCodeHighlightNodeSchema),
	defineNode(LexicalTableNodeSchema),
	defineNode(LexicalTableRowNodeSchema),
	defineNode(LexicalTableCellNodeSchema),
] as const;

// No upload, relationship or block nodes; those belong to the Payload preset and the app
export type LexicalNode = z.infer<(typeof coreNodes)[number]['schema']>;

// Type only, and unexported, so only a parse (or a deliberate cast) produces branded data
declare const richTextBrand: unique symbol;

// `defaults` take an optional converter override; `nodes`, `blocks` and `inlineBlocks` each need one
export interface RichTextKeys {
	blocks: string;
	defaults: string;
	inlineBlocks: string;
	nodes: string;
}

// Payload's text and link nodes differ from upstream's, so data parsed for one renders wrongly through the other
export type RichTextVariant = 'core' | 'payload';

export interface RichTextDefinitions<
	TVariant extends RichTextVariant = RichTextVariant,
	TKeys extends RichTextKeys = RichTextKeys,
> {
	readonly [richTextBrand]?: { keys: TKeys; variant: TVariant };
	readonly schemas: NodeTable<z.ZodType>;
}

export type CoreRichTextDefinitions = RichTextDefinitions<'core'>;

export interface ParsedRootNode extends Omit<LexicalRootNode, 'children'> {
	children: Array<LexicalBaseNode>;
}

// The brand is the definitions' type, so a renderer infers its converter map from the data alone
export interface ParsedEditorState<T extends RichTextDefinitions = RichTextDefinitions> {
	readonly [richTextBrand]: T;
	root: ParsedRootNode;
}

type KeysOf<T extends RichTextDefinitions> = NonNullable<T[typeof richTextBrand]>['keys'];

type ConverterRecord<TKey extends string> = Record<TKey, AstroComponentFactory>;

type NodeConverters<TKeys extends RichTextKeys> = ConverterRecord<TKeys['nodes']> &
	Partial<ConverterRecord<Exclude<TKeys['defaults'], TKeys['nodes']>>>;

type NodeSection<TKeys extends RichTextKeys> = [TKeys['nodes']] extends [never]
	? { nodes?: NodeConverters<TKeys> }
	: { nodes: NodeConverters<TKeys> };

type VariantSection<TKey extends string, TSection extends string> = [TKey] extends [never]
	? unknown
	: Record<TSection, ConverterRecord<TKey>>;

export type ConverterMap<T extends RichTextDefinitions> = NodeSection<KeysOf<T>> &
	VariantSection<KeysOf<T>['blocks'], 'blocks'> &
	VariantSection<KeysOf<T>['inlineBlocks'], 'inlineBlocks'>;

export interface ConverterMapShape {
	blocks?: Readonly<Record<string, AstroComponentFactory>>;
	inlineBlocks?: Readonly<Record<string, AstroComponentFactory>>;
	nodes?: Readonly<Record<string, AstroComponentFactory>>;
}

type RequiredKeys<T extends RichTextDefinitions> =
	KeysOf<T>['blocks'] | KeysOf<T>['inlineBlocks'] | KeysOf<T>['nodes'];

// The data alone decides the definitions, so the map is checked against them rather than widening them
export type ConvertersProp<T extends RichTextDefinitions> = [RequiredKeys<T>] extends [never]
	? { converters?: ConverterMap<NoInfer<T>> }
	: { converters: ConverterMap<NoInfer<T>> };

type CoreNodeType = LexicalNode['type'];

export function defineRichText<const TNodes extends ReadonlyArray<LexicalNodeDefinition> = []>(
	options: { nodes?: TNodes } = {},
): RichTextDefinitions<
	'core',
	{ blocks: never; defaults: CoreNodeType; inlineBlocks: never; nodes: TNodes[number]['type'] }
> {
	return { schemas: toSchemaTable([...coreNodes, ...(options.nodes ?? [])], {}) };
}

export function toSchemaTable(
	definitions: ReadonlyArray<LexicalNodeDefinition>,
	dispatch: Readonly<Record<string, DispatchEntry<z.ZodType>>>,
): NodeTable<z.ZodType> {
	const nodes: Record<string, z.ZodType> = {};

	for (const definition of definitions) nodes[definition.type] = toWalkerSchema(definition.schema);

	return { dispatch, nodes };
}

export const walkerChildrenSchema = z.array(z.unknown()).default([]);

// The walker checks each child itself, so one bad child drops alone instead of failing its parent
// `.extend` throws on a schema with refinements, which a consumer's node schema may carry
function toWalkerSchema(schema: z.ZodObject): z.ZodType {
	if (!Object.hasOwn(schema.shape, 'children')) return schema;

	return schema.safeExtend({ children: walkerChildrenSchema });
}
