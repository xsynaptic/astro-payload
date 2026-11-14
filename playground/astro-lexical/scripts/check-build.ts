import { readFileSync } from 'node:fs';

// One marker per entry point, each only that entry's converters can produce, so an export resolving to the wrong module fails
const expectations = [
	{
		file: 'dist/index.html',
		markers: [
			'<strong>Synthetic bold</strong>',
			'<a href="https://example.com/attributes" rel="noopener noreferrer" target="_blank">',
			'<a href="#">Unsafe</a>',
			'<code class="language-javascript">const answer = 42;\n\tanswer;</code>',
			'<a href="#">Unsafe literal</a>',
		],
	},
	{
		file: 'dist/payload/index.html',
		markers: [
			'<mark data-tone="info">Synthetic badge</mark>',
			'srcset="/api/media/file/fixture-grey-rectangle-400x300.png 400w',
			'<a href="/posts/40/">A related test post</a>',
		],
	},
];

const failures = expectations.flatMap(({ file, markers }) => {
	const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

	return markers.filter((marker) => !html.includes(marker)).map((marker) => `${file}: ${marker}`);
});

if (failures.length > 0) throw new Error(`Missing from the build output:\n${failures.join('\n')}`);

console.log(`astro-lexical playground: ${String(expectations.length)} pages rendered as expected`);
