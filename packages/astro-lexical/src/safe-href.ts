// Stored content may never have passed an editor's validation, so rendering is the last check on a URL
// An allowlist, because a blocklist misses whatever scheme a browser runs next
// One leading slash only; a second, or a backslash browsers read as one, makes the value protocol-relative
// Browsers drop tabs and newlines anywhere in a URL before parsing it
// Framework-free, so an editor can validate links with the same pattern the renderer applies
// Import-free too, since a consumer outside Astro compiles it without `allowImportingTsExtensions`
const safeHrefPattern = /^(?:https?:|mailto:|tel:|\/(?![/\\])|#)/i;
const strippedCharacters = /[\t\n\r]/g;

function normalizeHref(value: string) {
	return value.replaceAll(strippedCharacters, '').trim();
}

export function isSafeHref(value: string): boolean {
	return safeHrefPattern.test(normalizeHref(value));
}

export function toSafeHref(value = ''): string {
	const href = normalizeHref(value);

	return safeHrefPattern.test(href) ? href : '#';
}
