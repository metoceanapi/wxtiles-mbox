import { fetchJson, XYZ } from './wxtools';

const codeEmpty = 'A'.charCodeAt(0);

type TreeN = Tree | null;
type SubTrees = TreeN[] | null; // [QTreeN, QTreeN, QTreeN, QTreeN] | null;
interface Tree {
	nodes: SubTrees;
}

export enum TileType {
	Land = 'land',
	Mixed = 'mixed',
	Sea = 'sea',
}

export class QTree {
	qtree: Tree = { nodes: null }; // by default a tree with no nodes and depth 0 always gives TileType.Mixed
	qtreedepth: number = 0;

	constructor() {}

	async load(input: RequestInfo, requestInit?: RequestInit | undefined): Promise<void> {
		let _seamask: string;
		try {
			_seamask = await fetchJson<string>(input, requestInit);
		} catch (e) {
			throw new Error(`Failed to load QTree: ${e.message}`);
		}

		this.qtree = qtreeFromString(_seamask, { pos: 0 });
		this.qtreedepth = getTreeDepth(this.qtree);
	}

	check(coord: XYZ): TileType {
		const d = coord.z - this.qtreedepth;
		const deepest = d >= 0; // if the coord is deeper than the qtree, don't gi deeper than the qtree
		const subCoords = deepest ? { x: coord.x >> d, y: coord.y >> d, z: this.qtreedepth } : { ...coord /*copy!*/ };
		return qTreeCheckCoord(this.qtree, subCoords, deepest);
	}
}

function qtreeFromString(qtreeString: string, posHolder: { pos: number }): Tree {
	const code = qtreeString.charCodeAt(posHolder.pos) - codeEmpty; // code (node descriptor) of the current node
	posHolder.pos++; // move to the next char-code (node descriptor) in the qtree string
	// for each node we have 4 sub nodes. if (code & i) then the node is a subtree, otherwise empty node - TileType.Land
	const subTrees = [1, 2, 4, 8].map((i) => (code & i ? qtreeFromString(qtreeString, posHolder) : null));
	return { nodes: subTrees.some((s) => s) ? subTrees : null }; // if some sub != null, then the node is a "full tree" - TileType.Sea
}

function getTreeDepth(tree: TreeN): number {
	return tree?.nodes ? 1 + Math.max(...tree.nodes.map(getTreeDepth)) : 0; // max of all sub trees depths + 1
}

function qTreeCheckCoord(tree: TreeN, coord: XYZ, deepest: boolean): TileType {
	if (tree === null) return TileType.Land;
	if (deepest && !coord.z) return TileType.Mixed; // at the deepest level the tree can only be mixed
	if (tree.nodes === null) return TileType.Sea;
	if (!coord.z) return TileType.Mixed;

	coord.z--;
	return qTreeCheckCoord(tree.nodes[(((coord.y >> coord.z) & 1) << 1) | ((coord.x >> coord.z) & 1)], coord, deepest);
}
