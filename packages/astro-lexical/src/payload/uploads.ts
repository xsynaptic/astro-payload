import { toSafeHref } from '#safe-href.ts';

import type { PayloadUploadNode } from './schemas.ts';

interface ImageCandidate {
	mimeType: string;
	url: string;
	width: number;
}

type UploadDoc = NonNullable<PayloadUploadNode['value']>;

export function describeUpload(doc: UploadDoc) {
	const src = toSafeHref(doc.url);

	if (!doc.mimeType.startsWith('image/')) {
		return { href: src, kind: 'file' as const, label: doc.filename || doc.url };
	}

	return { alt: doc.alt ?? '', kind: 'image' as const, ...describeImage(doc, src) };
}

function describeImage({ height, mimeType, sizes, url, width }: UploadDoc, src: string) {
	const img = {
		height: height ?? undefined,
		sizes: undefined,
		src,
		srcset: undefined,
		width: width ?? undefined,
	};

	if (!width || !height) return { img, sizes: undefined, sources: [] };

	const { sources, srcset } = toCandidateSets(
		{ mimeType, url, width },
		toScaledSizes(sizes, width, height),
	);

	if (!srcset && sources.length === 0) return { img, sizes: undefined, sources };

	// Capped at the intrinsic width, which the content column may well be wider than
	const sizesAttribute = `(max-width: ${String(width)}px) 100vw, ${String(width)}px`;

	return {
		img: { ...img, sizes: srcset ? sizesAttribute : undefined, srcset },
		sizes: sizesAttribute,
		sources,
	};
}

// A browser that supports a source never falls back to the img, so a source must reach the original's width
function toCandidateSets(original: ImageCandidate, scaled: Array<ImageCandidate>) {
	const byType = new Map<string, Array<ImageCandidate>>();

	for (const candidate of [original, ...scaled]) {
		byType.set(candidate.mimeType, [...(byType.get(candidate.mimeType) ?? []), candidate]);
	}

	const own = byType.get(original.mimeType) ?? [];
	byType.delete(original.mimeType);

	const sources = [...byType]
		.filter(([, group]) => group.some((candidate) => candidate.width >= original.width))
		.map(([type, group]) => ({ srcset: toSrcset(group), type }));

	return { sources, srcset: own.length > 1 ? toSrcset(own) : undefined };
}

function toScaledSizes(sizes: UploadDoc['sizes'], width: number, height: number) {
	return Object.values(sizes ?? {}).flatMap((size) => {
		const candidate = toScaledCandidate(size, width, height);

		return candidate ? [candidate] : [];
	});
}

function toScaledCandidate(
	size: NonNullable<UploadDoc['sizes']>[string],
	width: number,
	height: number,
): ImageCandidate | undefined {
	if (!size.url || !size.mimeType || !size.width || !size.height) return undefined;

	if (size.width > width) return undefined;

	// A crop to another aspect ratio is art direction, which a default renderer has no rule to choose
	// Payload rounds a resized height to whole pixels
	if (Math.abs(size.height - (size.width * height) / width) > 1) return undefined;

	return { mimeType: size.mimeType, url: size.url, width: size.width };
}

// A width listed twice makes the whole srcset invalid
function toSrcset(candidates: Array<ImageCandidate>) {
	const byWidth = new Map<number, ImageCandidate>();

	for (const candidate of candidates) {
		if (!byWidth.has(candidate.width)) byWidth.set(candidate.width, candidate);
	}

	return [...byWidth.values()]
		.toSorted((first, second) => first.width - second.width)
		.map((candidate) => `${toSafeHref(candidate.url)} ${String(candidate.width)}w`)
		.join(', ');
}
