import AutolinkConverter from './converters/autolink.astro';
import LinkConverter from './converters/link.astro';
import RelationshipConverter from './converters/relationship.astro';
import TextConverter from './converters/text.astro';
import UploadConverter from './converters/upload.astro';

export const payloadConverters = {
	autolink: AutolinkConverter,
	link: LinkConverter,
	relationship: RelationshipConverter,
	text: TextConverter,
	upload: UploadConverter,
};
