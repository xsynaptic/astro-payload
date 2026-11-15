import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import type { ConvertersProp, CoreRichTextDefinitions, ParsedEditorState } from './definitions.ts';
import type { NodeTable } from './dispatch.ts';
import type { LexicalNode } from './schemas/lexical.ts';

// Any serialized node the dispatcher can meet; the parse has vouched for its shape by then
export interface LexicalBaseNode {
	[key: string]: unknown;
	type: string;
	version?: number | undefined;
}

export interface ConverterProps<TNode = LexicalNode, TContext = unknown> {
	config: RichTextConfig<TContext>;
	converters: Converters;
	dir?: 'ltr' | 'rtl';
	node: TNode;
	RenderNode: AstroComponentFactory;
	style?: Record<string, string>;
}

export type Converters = NodeTable<AstroComponentFactory>;

export type RichTextProps<T extends CoreRichTextDefinitions = CoreRichTextDefinitions> =
	ConvertersProp<T> & {
		config?: Partial<RichTextConfig>;
		data: ParsedEditorState<T>;
	};

export interface RichTextConfig<TContext = unknown> {
	// Converters are instantiated inside RichText and cannot receive app props
	context: TContext;
	// Called with each authored URL that passed the scheme check; the app knows which of them are its own pages
	siteHref: (href: string) => string;
	// A text node's style is arbitrary authored CSS, so only these properties reach the page
	textStyleProperties?: ReadonlyArray<string>;
}
