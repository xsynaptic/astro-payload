import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import type { LexicalNode } from './schemas/lexical.ts';

import BlockquoteConverter from './converters/blockquote.astro';
import CodeHighlightConverter from './converters/code-highlight.astro';
import CodeConverter from './converters/code.astro';
import HeadingConverter from './converters/heading.astro';
import HorizontalRuleConverter from './converters/horizontal-rule.astro';
import LinebreakConverter from './converters/linebreak.astro';
import LinkConverter from './converters/link.astro';
import ListItemConverter from './converters/list-item.astro';
import ListConverter from './converters/list.astro';
import ParagraphConverter from './converters/paragraph.astro';
import TabConverter from './converters/tab.astro';
import TableCellConverter from './converters/table-cell.astro';
import TableRowConverter from './converters/table-row.astro';
import TableConverter from './converters/table.astro';
import TextConverter from './converters/text.astro';
import { buildConverters } from './registry.ts';
import { coreNodes } from './schemas/lexical.ts';

// Exhaustive over the core nodes, so a node added to the list cannot ship without a converter
const coreConverters = {
	autolink: LinkConverter,
	code: CodeConverter,
	'code-highlight': CodeHighlightConverter,
	heading: HeadingConverter,
	horizontalrule: HorizontalRuleConverter,
	linebreak: LinebreakConverter,
	link: LinkConverter,
	list: ListConverter,
	listitem: ListItemConverter,
	paragraph: ParagraphConverter,
	quote: BlockquoteConverter,
	tab: TabConverter,
	table: TableConverter,
	tablecell: TableCellConverter,
	tablerow: TableRowConverter,
	text: TextConverter,
} satisfies Record<LexicalNode['type'], AstroComponentFactory>;

// Every node is validated at render; stored content can predate or bypass the editor's own validation
export const corePreset = buildConverters({ nodeConverters: coreConverters, nodes: coreNodes });
