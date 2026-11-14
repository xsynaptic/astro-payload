import { describe, expect, it } from 'vitest';

import type { InternalLinkTarget } from '#payload/links.ts';

import { resolvePayloadLinkHref, toInternalLinkTarget } from '#payload/links.ts';

describe('toInternalLinkTarget', () => {
	it('reads a bare numeric id', () => {
		expect(toInternalLinkTarget({ relationTo: 'posts', value: 12 })).toEqual({
			id: 12,
			relationTo: 'posts',
		});
	});

	it('reads a bare string id', () => {
		expect(toInternalLinkTarget({ relationTo: 'posts', value: 'abc' })).toEqual({
			id: 'abc',
			relationTo: 'posts',
		});
	});

	it('takes the id off a populated target and keeps the document', () => {
		const doc = { id: 12, slug: 'a-post' };

		expect(toInternalLinkTarget({ relationTo: 'posts', value: doc })).toEqual({
			doc,
			id: 12,
			relationTo: 'posts',
		});
	});

	it('has no target when the link names none', () => {
		expect(toInternalLinkTarget(undefined)).toBeUndefined();
		// eslint-disable-next-line unicorn/no-null -- Payload stores a cleared target as `null`
		expect(toInternalLinkTarget(null)).toBeUndefined();
	});
});

function createConfig() {
	const seen: Array<{ context: unknown; target: InternalLinkTarget }> = [];
	const config = {
		context: { locale: 'zh' },
		internalDocToHref: (target: InternalLinkTarget, context: unknown) => {
			seen.push({ context, target });
			return `/${target.relationTo}/${String(target.id)}/`;
		},
		siteHref: (href: string) => `site:${href}`,
	};

	return { config, seen };
}

describe('resolvePayloadLinkHref', () => {
	it('hands an internal link the normalized target and the render context', async () => {
		const { config, seen } = createConfig();
		const fields = {
			doc: { relationTo: 'posts', value: { id: 7 } },
			linkType: 'internal' as const,
		};

		expect(await resolvePayloadLinkHref(fields, config)).toBe('/posts/7/');
		expect(seen).toEqual([
			{ context: { locale: 'zh' }, target: { doc: { id: 7 }, id: 7, relationTo: 'posts' } },
		]);
	});

	it('renders an internal link with no target as an inert anchor without asking the resolver', async () => {
		const { config, seen } = createConfig();

		expect(await resolvePayloadLinkHref({ linkType: 'internal' }, config)).toBe('#');
		expect(seen).toEqual([]);
	});

	it('passes a custom url through the scheme check before siteHref', async () => {
		const { config } = createConfig();

		expect(await resolvePayloadLinkHref({ linkType: 'custom', url: 'javascript:x' }, config)).toBe(
			'site:#',
		);
		expect(await resolvePayloadLinkHref({ url: '/about' }, config)).toBe('site:/about');
	});
});
