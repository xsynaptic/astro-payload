import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import type { ConverterMapShape } from '#definitions.ts';
import type { InternalLinkTarget } from '#payload/links.ts';
import type { PayloadRichTextConfig } from '#payload/types.ts';

import HeadingConverter from '#converters/heading.astro';
import { parseRichText } from '#parse.ts';
import { definePayloadRichText } from '#payload/definitions.ts';
import PayloadRichText from '#payload/rich-text.astro';
import { PayloadUploadNodeSchema } from '#payload/schemas.ts';
import { coreConverters } from '#presets.ts';
import RenderNode from '#render-node.astro';
import RichText from '#rich-text.astro';
import { coreRichText, renderCore } from '#tests/render-test-utils.ts';
import ShikiCodeConverter from '#tests/test-converters/shiki-code.astro';

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

const payloadRichText = definePayloadRichText();

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

function parsed(definitions: Parameters<typeof parseRichText>[0], children: Array<unknown>) {
	const { data, issues } = parseRichText(definitions, root(children));
	if (!data || issues.length > 0)
		throw new Error(`fixture failed to parse: ${JSON.stringify(issues)}`);

	return data;
}

async function renderRichText(
	children: Array<unknown>,
	config: Partial<PayloadRichTextConfig> = {},
	converters?: ConverterMapShape,
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
			data: parsed(payloadRichText, children),
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

	it('never takes the element name from the node, even with no schema in front of it', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(HeadingConverter, {
			props: {
				config: { context: undefined, siteHref: (href: string) => href },
				converters: { dispatch: {}, nodes: coreConverters },
				node: scriptHeading,
				RenderNode,
			},
		});

		expect(html).not.toContain('<script');
		expect(html).toContain('<h2');
	});

	it('renders an allowed tag as authored', async () => {
		const { html } = await renderCore([{ ...scriptHeading, children: [text('Title')], tag: 'h3' }]);

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

	it('renders nothing for a target Payload populated as null', async () => {
		const missing = [image, relationship].map((node) => ({
			...node,
			// eslint-disable-next-line unicorn/no-null -- Payload writes `null` for a deleted or unpublished target
			value: null,
		}));
		const html = await renderRichText(missing);

		expect(html.trim()).toBe('');
	});
});

describe('defaults', () => {
	const heading = { ...element, children: [text('Title')], tag: 'h2', type: 'heading' };
	const upstreamLink = { ...element, children: [text('About')], type: 'link', url: '/about' };

	it('renders core nodes from the data alone', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: { data: parsed(coreRichText, [heading, paragraph(upstreamLink)]) },
		});

		expect(html).toMatch(/<h2>Title<\/h2>\s*<p><a href="\/about">About<\/a><\/p>/);
	});

	it('falls back to the identity siteHref when a caller passes it as undefined', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: {
				config: { siteHref: undefined },
				data: parsed(coreRichText, [paragraph(upstreamLink)]),
			},
		});

		expect(html).toContain('<a href="/about">About</a>');
	});

	it('lays a passed converter over the defaults rather than replacing them', async () => {
		const codeBlock = { ...element, children: [], language: 'javascript', type: 'code' };
		const { html } = await renderCore(
			[heading, codeBlock],
			{},
			{ nodes: { code: ShikiCodeConverter } },
		);

		expect(html).toMatch(/<h2>Title<\/h2>/);
		expect(html).toContain('astro-code');
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
				data: parsed(payloadRichText, [paragraph(payloadLink('link', '/about'))]),
			},
		});

		expect(html).toMatch(/<a href="\/about">Read more<\/a>/);
	});
});
