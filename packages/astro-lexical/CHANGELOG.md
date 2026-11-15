# @xsynaptic/astro-lexical

## 0.2.0

### Minor Changes

- - `parseRichText` reads a `null` or `undefined` field as no content instead of a malformed root
  - Add `parseRichTextField`, which parses a field and adds the issues to a Zod context when strict or warns when lenient
  - Export `payloadDocumentSchema`, the populated-document check the upload and relationship presets use, so an extended `value` keeps it; the upload preset's document is now loose like the relationship's

## 0.1.0

### Minor Changes

- First release. Renders Lexical rich text in Astro, with a preset for Payload CMS. Content is validated as it loads with `parseRichText`, and the converters you pass the renderer are type-checked against the same definitions.
