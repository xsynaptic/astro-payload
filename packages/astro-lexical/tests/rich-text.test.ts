import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { RenderIssue } from '#issues.ts';
import type { InternalLinkTarget } from '#payload/links.ts';
import type { PayloadRichTextConfig } from '#payload/types.ts';
import type { Converters, LexicalBaseNode, RichTextConfig } from '#types.ts';

import HeadingConverter from '#converters/heading.astro';
import { payloadPreset } from '#payload/presets.ts';
import PayloadRichText from '#payload/rich-text.astro';
import { PayloadUploadNodeSchema } from '#payload/schemas.ts';
import { corePreset } from '#presets.ts';
import { buildConverters, defineNode } from '#registry.ts';
import RenderNode from '#render-node.astro';
import { resolveNode } from '#render-node.ts';
import RichText from '#rich-text.astro';

import depthZero from './payload/fixtures/upload-relationship-depth-0.json' with { type: 'json' };
import depthOne from './payload/fixtures/upload-relationship-depth-1.json' with { type: 'json' };

// eslint-disable-next-line unicorn/no-null -- Lexical serializes an unset direction as `null`
const element = { direction: null, format: '', indent: 0, version: 1 };

function text(value: string) {
	return { text: value, type: 'text', version: 1 };
}

function payloadLink(type: 'autolink' | 'link', url: string) {
	return {
		...element,
		children: [text('Read more')],
		fields: { linkType: 'custom', newTab: false, url },
		type,
		version: 3,
	};
}

function paragraph(...children: Array<unknown>) {
	return { ...element, children, type: 'paragraph' };
}

const payloadConverters: Converters = { ...corePreset, ...payloadPreset };

function webpSize(width: number, height: number) {
	return {
		filename: `fixture-grey-rectangle-${String(width)}.webp`,
		filesize: 900,
		height,
		mimeType: 'image/webp',
		url: `/api/media/file/fixture-grey-rectangle-${String(width)}.webp`,
		width,
	};
}

function root(children: Array<unknown>) {
	return { root: { ...element, children, type: 'root' } };
}

async function renderRichText(
	children: Array<unknown>,
	config: Partial<PayloadRichTextConfig> = {},
	converters: Converters = payloadConverters,
) {
	const container = await AstroContainer.create();

	return container.renderToString(PayloadRichText, {
		props: {
			config: {
				context: undefined,
				internalDocToHref: () => '/internal',
				siteHref: (href: string) => href,
				...config,
			},
			converters,
			data: root(children),
		},
	});
}

async function renderCore(children: Array<unknown>, config: Partial<RichTextConfig> = {}) {
	const container = await AstroContainer.create();

	return container.renderToString(RichText, {
		props: {
			config: { context: undefined, siteHref: (href: string) => href, ...config },
			converters: corePreset,
			data: root(children),
		},
	});
}

describe('heading tag', () => {
	const scriptHeading = {
		...element,
		children: [text('alert(document.domain)')],
		tag: 'script',
		type: 'heading',
	};

	it('drops a heading whose tag is not a heading element and reports it', async () => {
		const invalid: Array<LexicalBaseNode> = [];
		const html = await renderCore([scriptHeading], {
			onIssue: ({ node }) => {
				invalid.push(node);
			},
		});

		expect(html).not.toContain('<script');
		expect(html).not.toContain('alert(document.domain)');
		expect(invalid).toEqual([scriptHeading]);
	});

	it('never takes the element name from the node, even with no schema in front of it', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(HeadingConverter, {
			props: {
				config: { context: undefined, siteHref: (href: string) => href },
				converters: corePreset,
				node: scriptHeading,
				RenderNode,
			},
		});

		expect(html).not.toContain('<script');
		expect(html).toContain('<h2');
	});

	it('renders an allowed tag as authored', async () => {
		const html = await renderCore([{ ...scriptHeading, children: [text('Title')], tag: 'h3' }]);

		expect(html).toMatch(/<h3[^>]*>Title<\/h3>/);
	});
});

describe('payload link href', () => {
	const scriptUrl = 'javascript:alert(document.domain)';

	it('resolves an internal link with the render context', async () => {
		const internal = {
			...payloadLink('link', ''),
			fields: { doc: { relationTo: 'posts', value: 12 }, linkType: 'internal', newTab: false },
		};
		const html = await renderRichText([paragraph(internal)], {
			context: { locale: 'zh' },
			internalDocToHref: ({ id }, context) =>
				`/${(context as { locale: string }).locale}/${String(id)}/`,
		});

		expect(html).toContain('href="/zh/12/"');
	});

	it.each(['javascript:alert(document.domain)', '//evil.example'])(
		'renders an internal link the resolver built as %s as an inert anchor',
		async (href) => {
			const internal = {
				...payloadLink('link', ''),
				fields: { doc: { relationTo: 'posts', value: 12 }, linkType: 'internal', newTab: false },
			};
			const html = await renderRichText([paragraph(internal)], { internalDocToHref: () => href });

			expect(html).not.toContain(href);
			expect(html).toMatch(/<a href="#"[^>]*>Read more<\/a>/);
		},
	);

	it.each(['link', 'autolink'] as const)(
		'renders a %s with a script-scheme url as an inert anchor',
		async (type) => {
			const html = await renderRichText([paragraph(payloadLink(type, scriptUrl))]);

			expect(html).not.toContain('javascript:');
			expect(html).toMatch(/<a href="#"[^>]*>Read more<\/a>/);
		},
	);

	it.each(['link', 'autolink'] as const)(
		'carries a right-to-left direction on a %s',
		async (type) => {
			const html = await renderRichText([
				paragraph({ ...payloadLink(type, 'https://example.com/page'), direction: 'rtl' }),
			]);

			expect(html).toMatch(/<a dir="rtl" href="https:\/\/example\.com\/page"/);
		},
	);

	it.each(['link', 'autolink'] as const)('keeps an https url on a %s', async (type) => {
		const html = await renderRichText([paragraph(payloadLink(type, 'https://example.com/page'))]);

		expect(html).toContain('href="https://example.com/page"');
	});

	it.each(['link', 'autolink'] as const)(
		'hands a %s url to siteHref only once it passes the scheme check',
		async (type) => {
			const seen: Array<string> = [];
			const html = await renderRichText(
				[paragraph(payloadLink(type, scriptUrl)), paragraph(payloadLink(type, '/about'))],
				{
					siteHref: (href) => {
						seen.push(href);
						return `${href}/`;
					},
				},
			);

			expect(seen).toEqual(['#', '/about']);
			expect(html).toContain('href="/about/"');
		},
	);

	it('resolves an internal link whose target was left unpopulated instead of dropping it', async () => {
		const internal = {
			...payloadLink('link', ''),
			fields: { doc: { relationTo: 'posts', value: 12 }, linkType: 'internal', newTab: false },
		};
		const html = await renderRichText([paragraph(internal)]);

		expect(html).toMatch(/<a href="\/internal"[^>]*>Read more<\/a>/);
	});

	it('keeps an internal link whose target Payload populated', async () => {
		const internal = {
			...payloadLink('link', ''),
			fields: {
				doc: { relationTo: 'posts', value: { id: 12, title: 'A post' } },
				linkType: 'internal',
				newTab: false,
			},
		};
		const html = await renderRichText([paragraph(internal)]);

		expect(html).toMatch(/<a href="\/internal"[^>]*>Read more<\/a>/);
	});
});

describe('upstream link', () => {
	it('drops a link in the Payload shape, which the core preset does not accept', async () => {
		const invalid: Array<LexicalBaseNode> = [];
		const html = await renderCore([paragraph(payloadLink('link', '/about'))], {
			onIssue: ({ node }) => {
				invalid.push(node);
			},
		});

		expect(html).not.toContain('<a');
		expect(invalid).toHaveLength(1);
	});
});

function collectIssues() {
	const issues: Array<RenderIssue> = [];

	return {
		issues,
		onIssue: (issue: RenderIssue) => {
			issues.push(issue);
		},
	};
}

describe('payload upload and relationship', () => {
	const [image, file, relationship] = depthOne.root.children;

	it('renders a populated image at its intrinsic size with a srcset from the scaled sizes', async () => {
		const html = await renderRichText([image]);

		expect(html).toMatch(/<img [^>]*alt="A grey test rectangle"/);
		expect(html).toContain('height="600"');
		expect(html).toContain('width="800"');
		expect(html).toContain('src="/api/media/file/fixture-grey-rectangle.png"');
		expect(html).toContain(
			'srcset="/api/media/file/fixture-grey-rectangle-400x300.png 400w, /api/media/file/fixture-grey-rectangle.png 800w"',
		);
		expect(html).toContain('sizes="(max-width: 800px) 100vw, 800px"');
		expect(html).not.toContain('<picture');
	});

	it('wraps an image with a full-width size in another format in a picture', async () => {
		const { value, ...node } = PayloadUploadNodeSchema.parse(image);
		if (!value) throw new Error('fixture image is not populated');
		const withWebp = {
			...node,
			value: {
				...value,
				sizes: { ...value.sizes, full: webpSize(800, 600), half: webpSize(400, 300) },
			},
		};
		const html = await renderRichText([withWebp]);

		expect(html).toContain(
			'<p><picture><source sizes="(max-width: 800px) 100vw, 800px" srcset="/api/media/file/fixture-grey-rectangle-400.webp 400w, /api/media/file/fixture-grey-rectangle-800.webp 800w" type="image/webp"><img ',
		);
	});

	it('carries the editor alignment on the block around an image', async () => {
		const html = await renderRichText([{ ...image, format: 'center' }]);

		expect(html).toMatch(/<p style="text-align:center"><img /);
	});

	it('renders a non-image file as a link named after the file', async () => {
		const html = await renderRichText([file]);

		expect(html).toMatch(
			/<p><a href="\/api\/media\/file\/fixture-schedule\.pdf">fixture-schedule\.pdf<\/a><\/p>/,
		);
		expect(html).not.toContain('<img');
	});

	it('links a relationship through the internal resolver with the populated document and context', async () => {
		const seen: Array<{ context: unknown; target: InternalLinkTarget }> = [];
		const html = await renderRichText([relationship], {
			context: { locale: 'zh' },
			internalDocToHref: (target, context) => {
				seen.push({ context, target });
				return `/${target.relationTo}/${String(target.id)}/`;
			},
		});

		expect(html).toMatch(/<p><a href="\/posts\/40\/">A related test post<\/a><\/p>/);
		expect(seen).toEqual([
			{
				context: { locale: 'zh' },
				target: { doc: relationship?.value, id: 40, relationTo: 'posts' },
			},
		]);
	});

	it('renders a relationship href the resolver built with a script scheme as an inert anchor', async () => {
		const html = await renderRichText([relationship], {
			internalDocToHref: () => 'javascript:alert(document.domain)',
		});

		expect(html).not.toContain('javascript:');
		expect(html).toContain('<a href="#">');
	});

	it.each([{ id: 40 }, { id: 40, title: '' }, { id: 40, title: { en: 'A post' } }])(
		'names a relationship by its id when the document has no usable title (%o)',
		async (value) => {
			const html = await renderRichText([{ ...relationship, value }]);

			expect(html).toMatch(/<a href="\/internal">40<\/a>/);
		},
	);

	it('renders nothing and reports nothing for a target Payload populated as null', async () => {
		const { issues, onIssue } = collectIssues();
		const missing = [image, relationship].map((node) => ({
			...node,
			// eslint-disable-next-line unicorn/no-null -- Payload writes `null` for a deleted or unpublished target
			value: null,
		}));
		const html = await renderRichText(missing, { onIssue });

		expect(html.trim()).toBe('');
		expect(issues).toEqual([]);
	});

	it('reports every unpopulated value as invalid at `value` and renders none of them', async () => {
		const { issues, onIssue } = collectIssues();
		const html = await renderRichText(depthZero.root.children, { onIssue });

		expect(html.trim()).toBe('');
		expect(
			issues.map((issue) => ({
				kind: issue.kind,
				nodeLabel: issue.nodeLabel,
				paths: issue.kind === 'invalid' ? issue.issues.map(({ path }) => path.join('.')) : [],
			})),
		).toEqual([
			{ kind: 'invalid', nodeLabel: 'upload', paths: ['value'] },
			{ kind: 'invalid', nodeLabel: 'upload', paths: ['value'] },
			{ kind: 'invalid', nodeLabel: 'relationship', paths: ['value'] },
		]);
		expect(issues[0]?.kind === 'invalid' && issues[0].issues[0]?.message).toMatch(/depth >= 1/);
	});

	it('keeps the extra upload fields for an app converter under the preset schema', () => {
		if (!image) throw new Error('fixture has no image upload');
		const AppUploadConverter = (() => 'app upload') as unknown as AstroComponentFactory;
		const converters = {
			...payloadConverters,
			upload: { converter: AppUploadConverter, schema: PayloadUploadNodeSchema },
		};

		expect(resolveNode(image, converters, {}).node).toMatchObject({
			fields: { caption: 'A synthetic caption', credit: 'Test credit' },
			relationTo: 'media',
		});
	});

	it('hands an unpopulated value to an app converter spread after the preset, under its own schema', () => {
		const { issues, onIssue } = collectIssues();
		const AppUploadConverter = (() => 'app upload') as unknown as AstroComponentFactory;
		const AppUploadNodeSchema = z.object({
			type: z.literal('upload'),
			value: z.union([z.number(), z.string()]),
		});
		const converters = {
			...payloadConverters,
			...buildConverters({
				nodeConverters: { upload: AppUploadConverter },
				nodes: [defineNode(AppUploadNodeSchema)],
			}),
		};

		const [bareUpload] = depthZero.root.children;
		if (!bareUpload) throw new Error('fixture has no upload node');

		expect(resolveNode(bareUpload, converters, { onIssue })).toEqual({
			converter: AppUploadConverter,
			node: { type: 'upload', value: 274 },
		});
		expect(issues).toEqual([]);
	});
});

describe('defaults', () => {
	const heading = { ...element, children: [text('Title')], tag: 'h2', type: 'heading' };
	const upstreamLink = { ...element, children: [text('About')], type: 'link', url: '/about' };

	it('renders core nodes from the data alone', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: { data: root([heading, paragraph(upstreamLink)]) },
		});

		expect(html).toMatch(/<h2>Title<\/h2>\s*<p><a href="\/about">About<\/a><\/p>/);
	});

	it('falls back to the identity siteHref when a caller passes it as undefined', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: { config: { siteHref: undefined }, data: root([paragraph(upstreamLink)]) },
		});

		expect(html).toContain('<a href="/about">About</a>');
	});

	it('replaces the core preset with a passed map instead of merging into it', async () => {
		const { issues, onIssue } = collectIssues();
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: {
				config: { onIssue },
				converters: { heading: corePreset.heading, text: corePreset.text },
				data: root([heading, paragraph(text('Body'))]),
			},
		});

		expect(html).toMatch(/<h2>Title<\/h2>/);
		expect(html).not.toContain('Body');
		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'paragraph' }]);
	});

	it('renders Payload nodes through the Payload RichText with only its config', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(PayloadRichText, {
			props: {
				config: {
					context: undefined,
					internalDocToHref: () => '/internal',
					siteHref: (href: string) => href,
				},
				data: root([paragraph(payloadLink('link', '/about'))]),
			},
		});

		expect(html).toMatch(/<a href="\/about">Read more<\/a>/);
	});
});
