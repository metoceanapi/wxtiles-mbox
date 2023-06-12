import { fetchJson, WXLOG, XYZ } from './wxtools';

/** a code for an empty node in the qtree string*/
const codeEmpty = 'A'.charCodeAt(0);

/** Hierarchical quad-tree to encode the land/sea mask */
export interface Tree {
	nodes: SubTreesN;
}

/** Tree or null */
export type TreeN = Tree | null;
/**  4 sub-trees of a quad-tree node */
export type SubTrees = [TreeN, TreeN, TreeN, TreeN];
/**  SubTrees or null */
export type SubTreesN = SubTrees | null;

/** possible type of a tile */
export enum TileType {
	Land = 'land',
	Mixed = 'mixed',
	Sea = 'sea',
}

/**  class QTree utilizes quad-tree structure to get the type of the tile at the given coord */
export class QTree {
	protected _qtree: Tree = { nodes: null }; // by default a tree with no nodes and depth 0 always gives TileType.Mixed
	protected _qtreedepth: number = 0;
	protected _ready: Promise<void>;

	constructor(input: RequestInfo, requestInit?: RequestInit | undefined) {
		WXLOG('QTree.constructor');
		this._ready = this._load(input, requestInit);
	}

	get ready() {
		return this._ready;
	}

	protected async _load(input: RequestInfo, requestInit?: RequestInit | undefined): Promise<void> {
		if (input == 'none') return;
		try {
			const _seamask = await fetchJson<string>(input, requestInit);
			this._qtree = qtreeFromString(_seamask, { pos: 0 });
		} catch (e) {
			throw new Error(`Failed to load QTree: ${e.message}`);
		}

		this._qtreedepth = getTreeDepth(this._qtree);
		WXLOG(`QTree.load: qtreedepth=${this._qtreedepth}`);
	}

	check(coord: XYZ): TileType {
		const d = coord.z - this._qtreedepth;
		const deepest = d >= 0; // if the coord is deeper than the qtree, don't go deeper than the qtree
		const subCoords = deepest ? { x: coord.x >> d, y: coord.y >> d, z: this._qtreedepth } : { ...coord /*copy!*/ };
		return qTreeCheckCoord(this._qtree, subCoords, deepest);
	}
}

/** Convert a string to a tree */
function qtreeFromString(qtreeString: string, posHolder: { pos: number }): Tree {
	const code = qtreeString.charCodeAt(posHolder.pos) - codeEmpty; // code (node descriptor) of the current node
	posHolder.pos++; // move to the next char-code (node descriptor) in the qtree string
	// for each node we have 4 sub nodes. if (code & i) then the node is a subtree, otherwise empty node - TileType.Land
	const subTrees = [1, 2, 4, 8].map((i) => (code & i ? qtreeFromString(qtreeString, posHolder) : null)) as SubTrees;
	return { nodes: subTrees.some((s) => s) ? subTrees : null }; // if some sub != null, then the node is a "full tree" - TileType.Sea
}

/** Get the depth of the tree */
function getTreeDepth(tree: TreeN): number {
	return tree?.nodes ? 1 + Math.max(...tree.nodes.map(getTreeDepth)) : 0; // max of all sub trees depths + 1
}

/**  Get type of the tile at the given coord */
function qTreeCheckCoord(tree: TreeN, coord: XYZ, deepest: boolean): TileType {
	if (tree === null) return TileType.Land;
	if (deepest && !coord.z) return TileType.Mixed; // at the deepest level the tree can only be mixed
	if (tree.nodes === null) return TileType.Sea;
	if (!coord.z) return TileType.Mixed;

	coord.z--;
	return qTreeCheckCoord(tree.nodes[(((coord.y >> coord.z) & 1) << 1) | ((coord.x >> coord.z) & 1)], coord, deepest);
}
