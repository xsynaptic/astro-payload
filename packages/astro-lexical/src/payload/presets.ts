import { buildConverters } from '#registry.ts';

import AutolinkConverter from './converters/autolink.astro';
import LinkConverter from './converters/link.astro';
import RelationshipConverter from './converters/relationship.astro';
import TextConverter from './converters/text.astro';
import UploadConverter from './converters/upload.astro';
import { payloadNodes } from './schemas.ts';

// Spread over the core preset; its text, link and autolink replace the upstream ones
export const payloadPreset = buildConverters({
	nodeConverters: {
		autolink: AutolinkConverter,
		link: LinkConverter,
		relationship: RelationshipConverter,
		text: TextConverter,
		upload: UploadConverter,
	},
	nodes: payloadNodes,
});
