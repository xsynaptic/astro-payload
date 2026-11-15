import type { LexicalBaseNode } from './types.ts';

// Several variants can share one node type (Payload's blocks all share `block`), told apart by a key on the node
export interface DispatchEntry<TEntry> {
	key: (node: LexicalBaseNode) => string | undefined;
	variants: Readonly<Record<string, TEntry>>;
}

export interface NodeTable<TEntry> {
	dispatch: Readonly<Record<string, DispatchEntry<TEntry>>>;
	nodes: Readonly<Record<string, TEntry>>;
}

export function selectEntry<TEntry>(
	node: LexicalBaseNode,
	table: NodeTable<TEntry>,
): { entry: TEntry | undefined; label: string } {
	const dispatch = getOwn(table.dispatch, node.type);

	if (!dispatch) return { entry: getOwn(table.nodes, node.type), label: node.type };

	const key = dispatch.key(node);

	if (key === undefined) return { entry: undefined, label: node.type };

	return { entry: getOwn(dispatch.variants, key), label: `${node.type}:${key}` };
}

// An own-key check, so a node type such as `constructor` never reaches the prototype
function getOwn<TValue>(record: Readonly<Record<string, TValue>>, key: string) {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}
