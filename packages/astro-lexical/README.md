# @xsynaptic/astro-lexical

Render [Lexical](https://lexical.dev/) rich text in Astro, with a preset for [Payload CMS](https://payloadcms.com/). Content is validated node by node as it loads, so a build catches bad data in every document, not just the pages it happens to render. Authored links are checked against a scheme allowlist before they reach the page.

```sh
pnpm add @xsynaptic/astro-lexical zod
```

Requires Astro 7 and Zod 4.

## Usage

There are four steps: define the nodes your documents can contain, parse each document in a content schema, map nodes to converters, and render the parsed data.

### Define the nodes

Put the definitions in a plain TypeScript module. Your content config imports it, so it can't import any `.astro` files.

```ts
// src/lib/rich-text.ts
import { defineNode } from '@xsynaptic/astro-lexical';
import {
	defineBlock,
	definePayloadRichText,
	PayloadUploadNodeSchema,
} from '@xsynaptic/astro-lexical/payload';
import { z } from 'zod';

export const CalloutBlockFieldsSchema = z.object({
	blockType: z.literal('callout'),
	body: z.string(),
});

const CaptionedUploadNodeSchema = PayloadUploadNodeSchema.extend({
	fields: z.object({ caption: z.string().optional() }),
});

export const richText = definePayloadRichText({
	blocks: [defineBlock(CalloutBlockFieldsSchema)],
	nodes: [defineNode(CaptionedUploadNodeSchema)],
});
```

`definePayloadRichText` starts from the core Lexical nodes plus Payload's text, link, autolink, upload and relationship nodes. `defineRichText` (from `@xsynaptic/astro-lexical`) starts from the core nodes alone. A node you pass replaces the default with the same `type`. Blocks and inline blocks (`inlineBlocks`) are matched by `fields.blockType`.

Node and block schemas must be synchronous `z.object` schemas with a literal `type` (or `blockType`). The built-in schemas (`LexicalHeadingNodeSchema`, `PayloadUploadNodeSchema` and the rest) are exported so you can extend them. To extend an upload or relationship `value`, build it with `payloadDocumentSchema` so it still rejects an unpopulated document.

### Parse in a content schema

```ts
// src/content.config.ts
import { parseRichTextField } from '@xsynaptic/astro-lexical/payload';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

import { richText } from './lib/rich-text.ts';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.json' }),
	schema: z
		.object({ content: z.unknown(), slug: z.string(), title: z.string() })
		.transform((entry, context) => {
			const content = parseRichTextField(richText, entry.content, {
				context,
				documentLabel: `posts/${entry.slug}`,
				path: ['content'],
				strict: import.meta.env.PROD,
			});

			return { ...entry, content };
		}),
});

export const collections = { posts };
```

`parseRichText` walks the whole tree. A node that fails its schema, or has no definition, is dropped along with its children, while its siblings and parent are kept. Each dropped node becomes an issue with a label (`block:callout`) and a path (`root.children.3.children.1`). With `strict`, the issues fail the build; without it, they warn:

- **Strict:** each issue becomes a Zod issue, so Astro fails the build and lists every bad node across all entries. The `path` option prefixes each issue; leave it out when the transform is on the `content` field itself, since Zod adds the key there.
- **Lenient:** each issue logs a warning naming `documentLabel`, once per kind of bad node in each document.

The result is `undefined` when the field is `null`, when the root is malformed or when nothing in the document would render (no nodes, only blank paragraphs, or everything dropped). So `if (!entry.data.content)` means "no content".

A blank paragraph (only line breaks and whitespace) stays in the parsed data but doesn't render, and a header cell holding only blank paragraphs renders as `<td>`.

The type of the parsed data records which definitions it was parsed with, and `astro:content` keeps that in the entry type. That is how the renderer knows which converters to expect.

### Map the converters

```ts
// src/lib/rich-text-converters.ts
import type { ConverterMap } from '@xsynaptic/astro-lexical/payload';

import type { richText } from './rich-text.ts';

import CalloutConverter from '#components/callout.astro';
import CaptionedUploadConverter from '#components/captioned-upload.astro';

export const converters = {
	blocks: { callout: CalloutConverter },
	nodes: { upload: CaptionedUploadConverter },
} satisfies ConverterMap<typeof richText>;
```

`ConverterMap` requires a converter for every block, every inline block, and every node you added or replaced, since a default converter may not handle your schema's shape. Defaults you left alone can be overridden but don't have to be. With `satisfies`, a misspelled or extra key is a type error. To keep a default converter for a node whose schema you replaced, pass it back from `coreConverters` (`@xsynaptic/astro-lexical/presets`) or `payloadConverters` (`@xsynaptic/astro-lexical/payload/presets`).

A converter is an Astro component typed by its own node. A node's children arrive in its default slot:

```astro
---
// src/components/pull-quote.astro
import type { ConverterProps, LexicalQuoteNode } from '@xsynaptic/astro-lexical';

type Props = ConverterProps<LexicalQuoteNode>;

const { dir, style } = Astro.props;
---

<blockquote class="pull-quote" dir={dir} style={style}>
	<slot />
</blockquote>
```

A leaf, such as a block, reads `node`:

```astro
---
// src/components/callout.astro
import type { ConverterProps } from '@xsynaptic/astro-lexical';
import type { LexicalBlockNode } from '@xsynaptic/astro-lexical/payload';
import type { z } from 'zod';

import type { CalloutBlockFieldsSchema } from '#lib/rich-text.ts';

type Props = ConverterProps<LexicalBlockNode<z.infer<typeof CalloutBlockFieldsSchema>>>;

const { node, style } = Astro.props;
---

<aside style={style}>{node.fields.body}</aside>
```

To adjust a default converter, wrap it and forward its props and slot:

```astro
---
// src/components/link.astro
import type { ConverterProps } from '@xsynaptic/astro-lexical';
import type { PayloadLinkNode, PayloadRichTextConfig } from '@xsynaptic/astro-lexical/payload';

import { payloadConverters } from '@xsynaptic/astro-lexical/payload/presets';

type Props = ConverterProps<PayloadLinkNode> & { config: PayloadRichTextConfig };

const { link: LinkConverter } = payloadConverters;
---

<span class="link">
	<LinkConverter {...Astro.props}>
		<slot />
	</LinkConverter>
</span>
```

To walk the children yourself, skip the slot and render `node.children` through `RenderNode`:

```astro
{node.children.map((child) => (
	<RenderNode config={config} converters={converters} node={child} />
))}
```

### Render

```astro
---
import PayloadRichText from '@xsynaptic/astro-lexical/payload/rich-text.astro';
import { getEntry } from 'astro:content';

import { converters } from '#lib/rich-text-converters.ts';

const post = await getEntry('posts', Astro.params.slug);
---

{post?.data.content ? (
	<PayloadRichText
		config={{
			context: undefined,
			internalDocToHref: (target) => `/${target.relationTo}/${String(target.id)}/`,
			siteHref: (href) => href,
		}}
		converters={converters}
		data={post.data.content}
	/>
) : undefined}
```

The renderer only accepts parsed data and doesn't validate anything itself. Its types follow `data`, so `astro check` catches a raw editor state, a converter map with gaps, or core data passed to the Payload renderer. At runtime it still throws on a node with no converter, in case a cast slipped past the types. When rendering outside the content layer (a preview route, say), call `parseRichText` yourself first.

If your content column is narrower than your images, pass `uploadSizes` in the config. It gets each image's `width` and `height` and returns the `sizes` value for the upload converter, such as `(min-width: 44rem) 42rem, 100vw`.

## Plain Lexical

```astro
---
import { defineRichText, parseRichText } from '@xsynaptic/astro-lexical';
import RichText from '@xsynaptic/astro-lexical/rich-text.astro';

const { data } = parseRichText(defineRichText(), editorState);
---

{data ? <RichText data={data} /> : undefined}
```

With only the core nodes defined, `converters` is optional.

## Caveats

- **Stale data after changing definitions.** Astro's `glob` loader skips entries that haven't changed, and only a change to the content config file itself makes it parse them again. After editing definitions in another module, clear the content store or touch the config file.
- **Nested rich text isn't walked.** Rich text inside a block's or an upload's `fields` is left as the fields schema parses it. To validate it, add a `parseRichText` transform to that field in the fields schema.

## TypeScript

The package ships TypeScript and `.astro` source, which your Astro build compiles.

- Running plain `tsc` (outside `astro check`) needs a `declare module '*.astro'` in your project, because the presets import `.astro` files. That declaration erases component props, so only `astro check` type-checks the props you pass to `<RichText>`.
- Outside Astro, only `@xsynaptic/astro-lexical/safe-href` works without transpiling the package.

## License

MIT
