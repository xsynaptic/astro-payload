import type { CodeHighlightNode, SerializedCodeNode } from '@lexical/code';
import type { SerializedHorizontalRuleNode } from '@lexical/extension';
import type { SerializedAutoLinkNode, SerializedLinkNode } from '@lexical/link';
import type { SerializedListItemNode, SerializedListNode } from '@lexical/list';
import type { SerializedHeadingNode, SerializedQuoteNode } from '@lexical/rich-text';
import type {
	SerializedTableCellNode,
	SerializedTableNode,
	SerializedTableRowNode,
} from '@lexical/table';
import type {
	SerializedAutoLinkNode as PayloadSerializedAutoLinkNode,
	SerializedLinkNode as PayloadSerializedLinkNode,
	SerializedBlockNode,
	SerializedInlineBlockNode,
	SerializedRelationshipNode,
	SerializedUploadNode,
} from '@payloadcms/richtext-lexical';
import type {
	SerializedLineBreakNode,
	SerializedParagraphNode,
	SerializedRootNode,
	SerializedTabNode,
	SerializedTextNode,
} from 'lexical';
import type { FileData, FileSize, TypeWithID } from 'payload';
import type { z } from 'zod';

import { describe, expectTypeOf, it } from 'vitest';

import type {
	BlockNodeType,
	PayloadAutolinkNodeSchema,
	PayloadLinkNodeSchema,
	PayloadRelationshipNodeSchema,
	PayloadTextNodeSchema,
	PayloadUploadNodeSchema,
	toBlockNodeSchema,
	uploadSizeSchema,
} from '#payload/schemas.ts';
import type {
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
	LexicalRootNodeSchema,
	LexicalTableCellNodeSchema,
	LexicalTableNodeSchema,
	LexicalTableRowNodeSchema,
	LexicalTabNodeSchema,
	LexicalTextNodeSchema,
} from '#schemas/lexical.ts';

// The schema may leave optional a key upstream always writes; the input check covers the required ones
type Loosened<T> =
	T extends Array<infer TItem>
		? Array<Loosened<TItem>>
		: T extends object
			? { [K in keyof T]?: Loosened<T[K]> | undefined }
			: T;

// An index signature, on a loose schema or a Payload field type, turns `keyof` into `string` and hides every named key
type KnownKeys<T> = { [K in keyof T as string extends K ? never : K]: T[K] };

// A key the schema validates but upstream no longer writes; structural assignability alone lets it pass
type StaleKeys<TSchema extends z.ZodType, TSerialized> = Exclude<
	keyof KnownKeys<z.output<TSchema>>,
	keyof TSerialized
>;

// Pinned both ways: the schema accepts what upstream writes, and narrows it without inventing keys
interface PinFailures<TSchema extends z.ZodType, TSerialized> {
	outrunsUpstream: [z.output<TSchema>] extends [Loosened<TSerialized>] ? never : true;
	rejectsUpstream: [TSerialized] extends [z.input<TSchema>] ? never : true;
	staleKeys: StaleKeys<TSchema, TSerialized>;
}

interface Pinned {
	outrunsUpstream: never;
	rejectsUpstream: never;
	staleKeys: never;
}

// Upstream types every node `type` as `string`; the schema narrows it to its own literal
type Typed<TSerialized, TType extends string> = Omit<TSerialized, 'type'> & { type: TType };

describe('core schemas match upstream lexical', () => {
	it('pins every core node', () => {
		expectTypeOf<
			PinFailures<typeof LexicalTextNodeSchema, Typed<SerializedTextNode, 'text'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalLinebreakNodeSchema, Typed<SerializedLineBreakNode, 'linebreak'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalTabNodeSchema, Typed<SerializedTabNode, 'tab'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<
				typeof LexicalHorizontalRuleNodeSchema,
				Typed<SerializedHorizontalRuleNode, 'horizontalrule'>
			>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalParagraphNodeSchema, Typed<SerializedParagraphNode, 'paragraph'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalHeadingNodeSchema, Typed<SerializedHeadingNode, 'heading'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalListNodeSchema, Typed<SerializedListNode, 'list'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalListItemNodeSchema, Typed<SerializedListItemNode, 'listitem'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalLinkNodeSchema, Typed<SerializedLinkNode, 'link'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalAutolinkNodeSchema, Typed<SerializedAutoLinkNode, 'autolink'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalQuoteNodeSchema, Typed<SerializedQuoteNode, 'quote'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalCodeNodeSchema, Typed<SerializedCodeNode, 'code'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<
				typeof LexicalCodeHighlightNodeSchema,
				Typed<ReturnType<CodeHighlightNode['exportJSON']>, 'code-highlight'>
			>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalTableNodeSchema, Typed<SerializedTableNode, 'table'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalTableRowNodeSchema, Typed<SerializedTableRowNode, 'tablerow'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalTableCellNodeSchema, Typed<SerializedTableCellNode, 'tablecell'>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof LexicalRootNodeSchema, Typed<SerializedRootNode, 'root'>>
		>().toEqualTypeOf<Pinned>();
	});
});

describe('Payload preset schemas match @payloadcms/richtext-lexical', () => {
	// Payload reads every upload field as optional and nullable; `FileData` types the upload operation
	// The preset requires the two it cannot render without, as it requires a populated value
	type UploadDoc = Pick<FileData, 'mimeType'> &
		Required<Pick<FileData, 'url'>> &
		TypeWithID & { [K in keyof FileData]?: FileData[K] | null } & { alt?: null | string };

	it('pins the text node with its node state', () => {
		expectTypeOf<
			PinFailures<typeof PayloadTextNodeSchema, Typed<SerializedTextNode, 'text'>>
		>().toEqualTypeOf<Pinned>();
	});

	it('pins the Payload link nodes', () => {
		expectTypeOf<
			PinFailures<typeof PayloadLinkNodeSchema, PayloadSerializedLinkNode>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof PayloadAutolinkNodeSchema, PayloadSerializedAutoLinkNode>
		>().toEqualTypeOf<Pinned>();
	});

	it('pins the fields Payload writes on its link nodes', () => {
		expectTypeOf<
			PinFailures<
				typeof PayloadLinkNodeSchema.shape.fields,
				KnownKeys<PayloadSerializedLinkNode['fields']>
			>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<
				typeof PayloadAutolinkNodeSchema.shape.fields,
				KnownKeys<PayloadSerializedAutoLinkNode['fields']>
			>
		>().toEqualTypeOf<Pinned>();
	});

	it('pins the populated upload and relationship nodes', () => {
		// The preset rejects a bare id, so it pins against the populated member of Payload's `value` union
		type Populated<
			TSerialized extends { value: unknown },
			TDoc = Extract<TSerialized['value'], object>,
		> = Omit<TSerialized, 'value'> & { value: null | TDoc };

		expectTypeOf<
			// Payload types the populated document as an opaque `JsonObject`, so its shape comes from the document pin
			PinFailures<typeof PayloadUploadNodeSchema, Populated<SerializedUploadNode, UploadDoc>>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<typeof PayloadRelationshipNodeSchema, Populated<SerializedRelationshipNode>>
		>().toEqualTypeOf<Pinned>();
	});

	it('pins the documents Payload populates them with', () => {
		expectTypeOf<
			PinFailures<
				ReturnType<typeof PayloadRelationshipNodeSchema.shape.value.unwrap>,
				KnownKeys<Extract<SerializedRelationshipNode['value'], object>>
			>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<ReturnType<typeof PayloadUploadNodeSchema.shape.value.unwrap>, UploadDoc>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<PinFailures<typeof uploadSizeSchema, FileSize>>().toEqualTypeOf<Pinned>();
	});

	it('pins the block and inline block nodes around their fields', () => {
		// The fields schema is the app's, so upstream's own fields type stands in and only the node around it is pinned
		type BlockNodeSchema<
			TType extends BlockNodeType,
			TSerialized extends { fields: unknown },
		> = ReturnType<
			typeof toBlockNodeSchema<TType, z.ZodType<TSerialized['fields'], TSerialized['fields']>>
		>;

		expectTypeOf<
			PinFailures<BlockNodeSchema<'block', SerializedBlockNode>, SerializedBlockNode>
		>().toEqualTypeOf<Pinned>();
		expectTypeOf<
			PinFailures<
				BlockNodeSchema<'inlineBlock', SerializedInlineBlockNode>,
				SerializedInlineBlockNode
			>
		>().toEqualTypeOf<Pinned>();
	});
});
