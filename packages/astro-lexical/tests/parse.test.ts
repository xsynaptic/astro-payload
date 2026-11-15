import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import type { ParsedEditorState } from '#definitions.ts';
import type { RichTextIssue } from '#issues.ts';
import type { LexicalBaseNode } from '#types.ts';

import { coreNodes, defineNode, defineRichText } from '#definitions.ts';
import { addRichTextIssues } from '#issues.ts';
import { parseRichText } from '#parse.ts';
import { definePayloadRichText } from '#payload/definitions.ts';
import { payloadDocumentSchema, PayloadRelationshipNodeSchema } from '#payload/schemas.ts';
import { elementFields } from '#schemas/lexical.ts';
import checkList from '#tests/fixtures/check-list.json' with { type: 'json' };
import code from '#tests/fixtures/code.json' with { type: 'json' };
import direction from '#tests/fixtures/direction.json' with { type: 'json' };
import links from '#tests/fixtures/links.json' with { type: 'json' };
import textFormats from '#tests/fixtures/text-formats.json' with { type: 'json' };
import textStyles from '#tests/fixtures/text-styles.json' with { type: 'json' };
import depthZero from '#tests/payload/fixtures/upload-relationship-depth-0.json' with { type: 'json' };
import depthOne from '#tests/payload/fixtures/upload-relationship-depth-1.json' with { type: 'json' };
import { coreRichText, editorState, element } from '#tests/render-test-utils.ts';

function text(value: string) {
	return { text: value, type: 'text', version: 1 };
}

function paragraph(...children: Array<unknown>) {
	return { ...element, children, type: 'paragraph' };
}

function heading(...children: Array<unknown>) {
	return { ...element, children, tag: 'h2', type: 'heading' };
}

function parseCore(children: Array<unknown>) {
	return parseRichText(coreRichText, editorState(children));
}

describe('parseRichText', () => {
	it('returns a valid document unchanged', () => {
		const value = editorState([
			heading(text('Title')),
			paragraph(text('Body '), { type: 'linebreak', version: 1 }, text('text')),
		]);

		expect(parseRichText(coreRichText, value)).toEqual({ data: value, issues: [] });
	});

	it.each([
		['check list', checkList],
		['code', code],
		['direction', direction],
		['links', links],
		['text formats', textFormats],
		['text styles', textStyles],
	])('parses the captured %s document without an issue', (_name, fixture) => {
		const { data, issues } = parseRichText(coreRichText, fixture);

		expect(issues).toEqual([]);
		expect(data?.root.children).toHaveLength(fixture.root.children.length);
	});

	it('carries the schema transforms into the output', () => {
		const cell = {
			...element,
			children: [paragraph(text('Cell'))],
			// eslint-disable-next-line unicorn/no-null -- Payload saves a cleared span as `null`
			colSpan: null,
			headerState: 7,
			rowSpan: 0,
			type: 'tablecell',
		};
		const table = {
			...element,
			children: [{ ...element, children: [cell], type: 'tablerow' }],
			type: 'table',
		};
		const [parsedTable] = parseCore([table]).data?.root.children ?? [];

		expect(parsedTable).toMatchObject({
			children: [{ children: [{ colSpan: 1, headerState: 3, rowSpan: 1 }] }],
		});
	});

	it('drops an invalid node with its subtree and keeps its siblings', () => {
		const brokenLink = { ...element, children: [text('Hidden')], type: 'link' };
		const { data, issues } = parseCore([
			paragraph(text('Before '), brokenLink, text(' after')),
			paragraph(text('Next')),
		]);

		expect(data?.root.children).toEqual([
			paragraph(text('Before '), text(' after')),
			paragraph(text('Next')),
		]);
		expect(issues).toMatchObject([
			{
				issues: [{ path: ['url'] }],
				kind: 'invalid',
				nodeLabel: 'link',
				path: ['root', 'children', 0, 'children', 1],
			},
		]);
	});

	it('drops a child that lacks a version while its parent survives', () => {
		const list = {
			...element,
			children: [
				{ ...element, children: [text('Kept')], type: 'listitem' },
				// eslint-disable-next-line unicorn/no-null -- Lexical serializes an unset direction as `null`
				{ children: [text('Dropped')], direction: null, format: '', indent: 0, type: 'listitem' },
			],
			listType: 'bullet',
			type: 'list',
		};
		const { data, issues } = parseCore([list]);

		expect(data?.root.children).toMatchObject([
			{ children: [{ children: [{ text: 'Kept' }] }], type: 'list' },
		]);
		const [parsedList] = data?.root.children ?? [];
		expect(parsedList?.children).toHaveLength(1);
		expect(issues).toMatchObject([
			{ kind: 'invalid', nodeLabel: 'listitem', path: ['root', 'children', 0, 'children', 1] },
		]);
	});

	it('drops a node whose schema carries a refinement without failing on its children', () => {
		const CalloutNodeSchema = z
			.object({ type: z.literal('callout'), ...elementFields })
			.refine((node) => node.indent >= 0);
		const richText = defineRichText({ nodes: [defineNode(CalloutNodeSchema)] });
		const callout = { ...element, children: [text('Kept'), { type: 'mystery' }], type: 'callout' };
		const { data, issues } = parseRichText(richText, editorState([callout]));

		expect(data?.root.children).toEqual([{ ...callout, children: [text('Kept')] }]);
		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'mystery' }]);
	});

	it('drops a node of an unknown type and reports it', () => {
		const { data, issues } = parseCore([paragraph(text('Kept')), { type: 'mystery', version: 1 }]);

		expect(data?.root.children).toEqual([paragraph(text('Kept'))]);
		expect(issues).toEqual([
			{
				kind: 'unknown',
				node: { type: 'mystery', version: 1 },
				nodeLabel: 'mystery',
				path: ['root', 'children', 1],
			},
		]);
	});

	it('never resolves a node type through the prototype', () => {
		const { issues } = parseCore([paragraph(text('Kept')), { type: 'constructor' }]);

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'constructor' }]);
	});

	it('drops a child that is not a node at all', () => {
		const { data, issues } = parseCore([paragraph(text('Kept'), 'stray', { text: 'untyped' })]);

		expect(data?.root.children).toEqual([paragraph(text('Kept'))]);
		expect(issues).toMatchObject([
			{ kind: 'malformed', path: ['root', 'children', 0, 'children', 1] },
			{ kind: 'malformed', path: ['root', 'children', 0, 'children', 2] },
		]);
	});

	it('drops a heading whose tag is not a heading element', () => {
		const scriptHeading = { ...heading(text('alert(document.domain)')), tag: 'script' };
		const { data, issues } = parseCore([scriptHeading, paragraph(text('Kept'))]);

		expect(data?.root.children).toEqual([paragraph(text('Kept'))]);
		expect(issues).toMatchObject([{ issues: [{ path: ['tag'] }], node: scriptHeading }]);
	});

	it('drops a link in the Payload shape, which the core definitions do not accept', () => {
		const payloadLink = {
			...element,
			children: [text('About')],
			fields: { linkType: 'custom', url: '/about' },
			type: 'link',
		};
		const { issues } = parseCore([paragraph(text('Kept'), payloadLink)]);

		expect(issues).toMatchObject([{ kind: 'invalid', nodeLabel: 'link' }]);
	});

	it('returns no data for a root that fails its own shape', () => {
		const value = { root: { ...element, children: [], format: 'sideways', type: 'root' } };
		const { data, issues } = parseRichText(coreRichText, value);

		expect(data).toBeUndefined();
		expect(issues).toMatchObject([
			{ issues: [{ path: ['root', 'format'] }], kind: 'invalid', nodeLabel: 'root', path: [] },
		]);
	});

	it.each([
		// eslint-disable-next-line unicorn/no-null -- an untouched editor field is stored as `null`
		['null', null],
		['undefined', undefined],
	])('reads a %s field as no content rather than a malformed root', (_name, value) => {
		expect(parseRichText(coreRichText, value)).toEqual({ data: undefined, issues: [] });
	});

	it('returns no data for a value that is not an editor state', () => {
		expect(parseRichText(coreRichText, 'plain text')).toMatchObject({
			data: undefined,
			issues: [{ kind: 'invalid', nodeLabel: 'root' }],
		});
	});

	it('returns no data for a document emptied by dropped nodes', () => {
		const { data, issues } = parseCore([{ type: 'mystery' }, paragraph({ type: 'mystery' })]);

		expect(data).toBeUndefined();
		expect(issues).toHaveLength(2);
	});

	it.each([
		['no children', []],
		['an empty paragraph', [paragraph()]],
		[
			'blank paragraphs',
			[paragraph(text('  ')), paragraph({ type: 'linebreak', version: 1 }, text('\n'))],
		],
	])('returns no data and no issue for a document holding %s', (_name, children) => {
		expect(parseCore(children)).toEqual({ data: undefined, issues: [] });
	});

	it('keeps a document whose only content is a non-paragraph node', () => {
		const rule = { type: 'horizontalrule', version: 1 };

		expect(parseCore([paragraph(), rule]).data?.root.children).toEqual([paragraph(), rule]);
	});

	it('brands the parsed data with the definitions it was parsed against', () => {
		const schema = z.unknown().transform((value) => parseRichText(coreRichText, value).data);

		expectTypeOf(schema.parse(editorState([]))).toEqualTypeOf<
			ParsedEditorState<typeof coreRichText> | undefined
		>();
	});
});

describe('parseRichText with the Payload definitions', () => {
	const payloadRichText = definePayloadRichText();

	it('reports every unpopulated value as invalid at `value` and keeps none of them', () => {
		const { data, issues } = parseRichText(payloadRichText, depthZero);

		expect(data).toBeUndefined();
		expect(
			issues.map((issue) => ({
				nodeLabel: issue.nodeLabel,
				paths: issue.kind === 'invalid' ? issue.issues.map(({ path }) => path.join('.')) : [],
			})),
		).toEqual([
			{ nodeLabel: 'upload', paths: ['value'] },
			{ nodeLabel: 'upload', paths: ['value'] },
			{ nodeLabel: 'relationship', paths: ['value'] },
		]);
		expect(issues[0]?.kind === 'invalid' && issues[0].issues[0]?.message).toMatch(/depth >= 1/);
	});

	it('keeps the populated check on a value extended through payloadDocumentSchema', () => {
		const titled = definePayloadRichText({
			nodes: [
				defineNode(
					PayloadRelationshipNodeSchema.extend({
						value: payloadDocumentSchema({ id: z.number(), title: z.string() }).nullable(),
					}),
				),
			],
		});
		const relationship = depthZero.root.children.find((node) => node.type === 'relationship');
		const { issues } = parseRichText(titled, editorState([relationship]));

		expect(issues[0]?.kind === 'invalid' && issues[0].issues[0]?.message).toMatch(/depth >= 1/);
	});

	it('reports nothing for a target Payload populated as null', () => {
		// eslint-disable-next-line unicorn/no-null -- Payload writes `null` for a deleted or unpublished target
		const missing = depthOne.root.children.map((node) => ({ ...node, value: null }));

		expect(parseRichText(payloadRichText, editorState(missing)).issues).toEqual([]);
	});

	it('keeps the extra upload fields a site converter reads its caption from', () => {
		const [image] = parseRichText(payloadRichText, depthOne).data?.root.children ?? [];

		expect(image).toMatchObject({
			fields: { caption: 'A synthetic caption', credit: 'Test credit' },
			relationTo: 'media',
		});
	});
});

describe('addRichTextIssues', () => {
	const strictContent = z.object({ content: z.unknown() }).transform((entry, context) => {
		const { data, issues } = parseRichText(coreRichText, entry.content);
		addRichTextIssues(context, issues, { path: ['content'] });

		return { content: data };
	});

	it('adds one issue per dropped node at the path joined onto the tree path', () => {
		const result = strictContent.safeParse({
			content: editorState([paragraph(text('Kept'), { type: 'mystery' }), { type: 'video' }]),
		});

		expect(result.error?.issues).toMatchObject([
			{
				code: 'custom',
				message: expect.stringContaining('"mystery"'),
				path: ['content', 'root', 'children', 0, 'children', 1],
			},
			{
				code: 'custom',
				message: expect.stringContaining('"video"'),
				path: ['content', 'root', 'children', 1],
			},
		]);
	});

	it('names each failing field of an invalid node in its message', () => {
		const result = strictContent.safeParse({
			content: editorState([{ ...heading(text('Title')), tag: 'script' }]),
		});

		expect(result.error?.issues).toMatchObject([
			{ message: expect.stringMatching(/"heading" at root\.children\.0 .*tag: /) },
		]);
	});

	it('leaves the prefix to Zod in a transform on the field itself', () => {
		const fieldContent = z.object({
			content: z.unknown().transform((value, context) => {
				const { data, issues } = parseRichText(coreRichText, value);
				addRichTextIssues(context, issues);

				return data;
			}),
		});
		const result = fieldContent.safeParse({ content: editorState([{ type: 'video' }]) });

		expect(result.error?.issues).toMatchObject([{ path: ['content', 'root', 'children', 0] }]);
	});

	it('adds nothing for a clean document', () => {
		expect(strictContent.safeParse({ content: editorState([paragraph(text('Kept'))]) })).toEqual({
			data: { content: expect.any(Object) },
			success: true,
		});
	});
});

const registeredTypes = new Set<string>(coreNodes.map((node) => node.type));

const leaf = fc.oneof(
	fc.string().map((value) => text(value)),
	fc.constant({ type: 'linebreak', version: 1 }),
	fc.constant({ text: 5, type: 'text', version: 1 }),
	fc.constant({ type: 'mystery', version: 1 }),
	fc.constant('not a node'),
);

const { node: treeNode } = fc.letrec<{ element: unknown; node: unknown }>((tie) => ({
	element: fc
		.record({
			children: fc.array(tie('node'), { maxLength: 4 }),
			kind: fc.constantFrom('paragraph', 'quote', 'tablecell', 'unversioned', 'misaligned'),
		})
		.map(({ children, kind }) => toElement(kind, children)),
	node: fc.oneof({ depthSize: 'small' }, leaf, tie('element')),
}));

function toElement(kind: string, children: Array<unknown>) {
	if (kind === 'tablecell') {
		return { ...element, children, colSpan: 0, headerState: 7, rowSpan: 0, type: kind };
	}
	if (kind === 'unversioned') return { ...element, children, type: 'quote', version: undefined };
	if (kind === 'misaligned') return { ...element, children, format: 'sideways', type: 'paragraph' };

	return { ...element, children, type: kind };
}

// A leading heading keeps the document from ever reading as empty, so every run has output to compare
const treeDocument = fc
	.array(treeNode, { maxLength: 5 })
	.map((children) => editorState([heading(text('Anchor')), ...children]));

function toPathKey(path: ReadonlyArray<number | string>) {
	return path.join('.');
}

function hasChildren(value: unknown): value is { children: Array<unknown> } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'children' in value &&
		Array.isArray(value.children)
	);
}

function expectAccounted(
	input: ReadonlyArray<unknown>,
	output: ReadonlyArray<LexicalBaseNode>,
	path: Array<number | string>,
	dropped: ReadonlySet<string>,
) {
	const kept = [...input.entries()].filter(([index]) => !dropped.has(toPathKey([...path, index])));

	expect(output).toHaveLength(kept.length);

	for (const [position, [index, child]] of kept.entries()) {
		const outputChild = output[position];
		if (!outputChild || !hasChildren(child)) continue;

		expectAccounted(
			child.children,
			outputChild.children as Array<LexicalBaseNode>,
			[...path, index, 'children'],
			dropped,
		);
	}
}

function collectTypes(nodes: ReadonlyArray<LexicalBaseNode>): Array<string> {
	return nodes.flatMap((node) => [
		node.type,
		...(hasChildren(node) ? collectTypes(node.children as Array<LexicalBaseNode>) : []),
	]);
}

function droppedPaths(issues: ReadonlyArray<RichTextIssue>) {
	return new Set(issues.map((issue) => toPathKey(issue.path)));
}

describe('parseRichText properties', () => {
	propertyTest.prop([treeDocument])('accounts for every input node', (value) => {
		const { data, issues } = parseRichText(coreRichText, value);

		expectAccounted(
			value.root.children,
			data?.root.children ?? [],
			['root', 'children'],
			droppedPaths(issues),
		);
	});

	propertyTest.prop([treeDocument])('outputs no node of an unregistered type', (value) => {
		const types = collectTypes(parseRichText(coreRichText, value).data?.root.children ?? []);

		expect(types.filter((type) => !registeredTypes.has(type))).toEqual([]);
	});

	// Holds because every transform in the core schemas is idempotent: `span || 1` and the header-state mask
	propertyTest.prop([treeDocument])('is idempotent', (value) => {
		const { data } = parseRichText(coreRichText, value);

		expect(parseRichText(coreRichText, data)).toEqual({ data, issues: [] });
	});
});
