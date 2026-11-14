import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { z } from 'zod';

import type { RenderIssue } from './issues.ts';
import type { LexicalEditorState, LexicalNode } from './schemas/lexical.ts';

// Any serialized node the dispatcher can meet, before a schema has vouched for its shape
export interface LexicalBaseNode {
	[key: string]: unknown;
	type: string;
	version?: number | undefined;
}

// An entry with no schema renders unvalidated; every preset node carries one
export interface ConverterEntry {
	converter: AstroComponentFactory;
	schema?: z.ZodType;
}

export interface ConverterProps<TNode = LexicalNode, TContext = unknown> {
	config: RichTextConfig<TContext>;
	converters: Converters;
	dir?: 'ltr' | 'rtl';
	node: TNode;
	RenderNode: AstroComponentFactory;
	style?: Record<string, string>;
}

// Keyed by node type; presets and app converters compose by spreading, later keys winning
export type Converters = Record<string, ConverterEntry | DispatchEntry>;

export interface DispatchEntry {
	// Names the node in an issue report, since its type alone does not say which converter it wanted
	describe: (node: LexicalBaseNode) => string;
	select: (node: LexicalBaseNode) => ConverterEntry | undefined;
}

export interface RichTextProps {
	config?: Partial<RichTextConfig>;
	converters?: Converters;
	data: LexicalEditorState;
}

export interface RichTextConfig<TContext = unknown> {
	// Converters are instantiated inside RichText and cannot receive app props
	context: TContext;
	// Names the document in an issue report; the node alone cannot say which page it came from
	documentLabel?: string;
	// An invalid or unconverted node renders nothing either way; this decides whether that is fatal
	onIssue?: (issue: RenderIssue) => void;
	// Called with each authored URL that passed the scheme check; the app knows which of them are its own pages
	siteHref: (href: string) => string;
	// A text node's style is arbitrary authored CSS, so only these properties reach the page
	textStyleProperties?: ReadonlyArray<string>;
}
