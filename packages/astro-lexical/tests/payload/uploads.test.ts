import { describe, expect, it } from 'vitest';

import { describeUpload } from '#payload/uploads.ts';

function size(width: number, height: number, mimeType = 'image/jpeg') {
	return { height, mimeType, url: `/media/photo-${String(width)}.${mimeType.slice(6)}`, width };
}

const photo = { height: 1000, id: 1, mimeType: 'image/jpeg', url: '/media/photo.jpg', width: 1500 };

describe('describeUpload', () => {
	it('lists only the sizes that scale the original, leaving out crops', () => {
		const upload = describeUpload({
			...photo,
			sizes: { card: size(600, 400), square: size(300, 300) },
		});

		expect(upload.kind === 'image' && upload.img.srcset).toBe(
			'/media/photo-600.jpeg 600w, /media/photo.jpg 1500w',
		);
	});

	it('accepts a scaled height Payload rounded to a whole pixel', () => {
		const upload = describeUpload({ ...photo, height: 1001, sizes: { card: size(600, 400) } });

		expect(upload.kind === 'image' && upload.img.srcset).toContain('600w');
	});

	it('moves sizes in another format into a source of their own', () => {
		const upload = describeUpload({
			...photo,
			sizes: { cardWebp: size(600, 400, 'image/webp'), fullWebp: size(1500, 1000, 'image/webp') },
		});

		expect(upload.kind === 'image' && upload.sources).toEqual([
			{ srcset: '/media/photo-600.webp 600w, /media/photo-1500.webp 1500w', type: 'image/webp' },
		]);
	});

	it('drops a format whose sizes stop short of the original, which would cap the resolution', () => {
		const upload = describeUpload({
			...photo,
			sizes: { card: size(600, 400), cardWebp: size(600, 400, 'image/webp') },
		});

		expect(upload.kind === 'image' && upload.sources).toEqual([]);
		expect(upload.kind === 'image' && upload.img.srcset).toBe(
			'/media/photo-600.jpeg 600w, /media/photo.jpg 1500w',
		);
	});

	it('gives the img no sizes attribute when only a source carries a srcset', () => {
		const upload = describeUpload({
			...photo,
			sizes: { fullWebp: size(1500, 1000, 'image/webp') },
		});

		expect(upload.kind === 'image' && upload.img).toMatchObject({
			sizes: undefined,
			srcset: undefined,
		});
		expect(upload.kind === 'image' && upload.sizes).toBe('auto, (max-width: 1500px) 100vw, 1500px');
	});

	it('takes the sizes after `auto` from the site when it gives them', () => {
		const upload = describeUpload(
			{ ...photo, sizes: { card: size(600, 400) } },
			undefined,
			({ width }) => (width < 672 ? `${String(width)}px` : '(min-width: 44rem) 42rem, 100vw'),
		);

		expect(upload.kind === 'image' && upload.img.sizes).toBe(
			'auto, (min-width: 44rem) 42rem, 100vw',
		);
	});

	it('prefers alt text on the upload node over the document', () => {
		const upload = describeUpload({ ...photo, alt: 'Document alt' }, { alt: 'Node alt' });

		expect(upload.kind === 'image' && upload.alt).toBe('Node alt');
	});

	it('falls back to the document alt text when the node has none to give', () => {
		const document = { ...photo, alt: 'Document alt' };

		expect(describeUpload(document, { alt: '' })).toMatchObject({ alt: 'Document alt' });
		expect(describeUpload(document, { alt: 42 })).toMatchObject({ alt: 'Document alt' });
	});

	it('leaves out a size Payload upscaled past the original', () => {
		const upload = describeUpload({
			...photo,
			sizes: { card: size(600, 400), huge: size(3000, 2000) },
		});

		expect(upload.kind === 'image' && upload.img.srcset).toBe(
			'/media/photo-600.jpeg 600w, /media/photo.jpg 1500w',
		);
	});

	it('renders an image with no recorded dimensions at its src alone', () => {
		const upload = describeUpload({
			...photo,
			height: undefined,
			sizes: { card: size(600, 400) },
			width: undefined,
		});

		expect(upload).toEqual({
			alt: '',
			img: {
				height: undefined,
				sizes: undefined,
				src: '/media/photo.jpg',
				srcset: undefined,
				width: undefined,
			},
			kind: 'image',
			sizes: undefined,
			sources: [],
		});
	});

	it('lists a width once when two sizes share it', () => {
		const upload = describeUpload({
			...photo,
			sizes: { card: size(600, 400), teaser: { ...size(600, 400), url: '/media/teaser.jpg' } },
		});

		expect(upload.kind === 'image' && upload.img.srcset).toBe(
			'/media/photo-600.jpeg 600w, /media/photo.jpg 1500w',
		);
	});

	it('gives an image with no usable sizes no srcset or sizes attribute', () => {
		// eslint-disable-next-line unicorn/no-null -- Payload nulls a size it could not generate
		const skipped = { height: null, mimeType: null, url: null, width: null };
		const upload = describeUpload({ ...photo, sizes: { card: skipped } });

		expect(upload).toEqual({
			alt: '',
			img: {
				height: 1000,
				sizes: undefined,
				src: '/media/photo.jpg',
				srcset: undefined,
				width: 1500,
			},
			kind: 'image',
			sizes: undefined,
			sources: [],
		});
	});

	it('passes the original and every size url through the scheme check', () => {
		const upload = describeUpload({
			...photo,
			sizes: { card: { ...size(600, 400), url: 'javascript:alert(1)' } },
			url: 'javascript:alert(2)',
		});

		expect(upload.kind === 'image' && upload.img.src).toBe('#');
		expect(upload.kind === 'image' && upload.img.srcset).toBe('# 600w, # 1500w');
	});

	it('names a file with no filename by its url', () => {
		const upload = describeUpload({
			// eslint-disable-next-line unicorn/no-null -- Payload reads an unset upload field as `null`
			filename: null,
			id: 2,
			mimeType: 'application/pdf',
			url: '/media/a.pdf',
		});

		expect(upload).toEqual({ href: '/media/a.pdf', kind: 'file', label: '/media/a.pdf' });
	});
});
