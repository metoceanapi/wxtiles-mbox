/**
 * @fileoverview This file contains the implementation of a hierarchical quad-tree to encode the land/sea mask.
 * Each node in the tree can have up to 4 sub-trees, which can be either full trees or empty nodes.
 * If a node has no sub-trees, it represents a sea tile.
 * If a node has sub-trees, it represents a mixed tile.
 * If a node has no sub-trees and is not a leaf node, it represents a land tile.
 *
 * The file exports the following:
 * - `Tree` interface: A hierarchical quad-tree to encode the land/sea mask.
 * - `TreeN` type: Tree or undefined.
 * - `SubTrees` type: 4 sub-trees of a quad-tree node.
 * - `SubTreesN` type: SubTrees or undefined.
 * - `TileType` enum: Possible type of a tile.
 * - `QTree` class: Utilizes quad-tree structure to get the type of the tile at the given coord.
 * - `qtreeFromString` function: Converts a string to a tree.
 * - `getTreeDepth` function: Gets the depth of the tree.
 * - `qTreeCheckCoord` function: Gets the type of the tile at the given coord.
 */
import { fetchJson, WXLOG, XYZ } from './wxtools';

/** The ASCII code for an empty node in the qtree string */
const codeEmpty = 'A'.charCodeAt(0);

/**
 * A hierarchical quad-tree to encode the land/sea mask.
 * Each node in the tree can have up to 4 sub-trees, which can be either full trees or empty nodes.
 * If a node has no sub-trees, it represents a sea tile.
 * If a node has sub-trees, it represents a mixed tile.
 * If a node has no sub-trees and is not a leaf node, it represents a land tile.
 */
export interface Tree {
	nodes?: SubTreesN;
}

/** Tree or undefined */
export type TreeN = Tree | undefined;

/**  4 sub-trees of a quad-tree node */
export type SubTrees = [TreeN, TreeN, TreeN, TreeN];

/**  SubTrees or undefined */
export type SubTreesN = SubTrees | undefined;

/** possible type of a tile */
export enum TileType {
	Land = 'land',
	Mixed = 'mixed',
	Sea = 'sea',
}

/**  class QTree utilizes quad-tree structure to get the type of the tile at the given coord */
export class QTree {
	protected _qtree: Tree = {}; // by default a tree with no nodes and depth 0 always gives TileType.Mixed
	protected _qtreedepth: number = 0;
	protected _ready: Promise<void>;

	/**
	 * Class constructor for QTree.
	 * @constructor
	 * @param {RequestInfo} input - The request info (e.g. URI) to load the QTree.
	 * @param {RequestInit | undefined} requestInit - The request initialization for loading the QTree. Includes properties such as method, headers, body, etc.
	 */
	constructor(input: RequestInfo, requestInit?: RequestInit | undefined) {
		WXLOG('QTree.constructor');
		this._ready = this._load(input, requestInit);
	}

	/**
	 * A getter that returns a Promise that resolves when the QTree is ready to be used.
	 * @returns {Promise<void>} A Promise that resolves when the QTree is ready to be used.
	 */
	get ready(): Promise<void> {
		return this._ready;
	}

	/**
	 * Loads the QTree from the specified input and request initialization.
	 * @async
	 * @param {RequestInfo} input - The request info (e.g. URI) to load the QTree.
	 * @param {RequestInit | undefined} requestInit - The request initialization for loading the QTree. Includes properties such as method, headers, body, etc.
	 * @returns {Promise<void>} A Promise that resolves when the QTree is loaded.
	 * @throws {Error} If the QTree fails to load.
	 */
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
	} // _load

	/**
	 * Returns the type of the tile at the given coordinates.
	 * @param {XYZ} coord - The coordinates of the tile to check.
	 * @returns {TileType} The type of the tile at the given coordinates.
	 */
	check(coord: XYZ): TileType {
		const d = coord.z - this._qtreedepth;
		const deepest = d >= 0; // if the coord is deeper than the qtree, don't go deeper than the qtree
		const subCoords = deepest ? { x: coord.x >> d, y: coord.y >> d, z: this._qtreedepth } : { ...coord /*copy!*/ };
		return qTreeCheckCoord(this._qtree, subCoords, deepest);
	} // check
} // class QTree

/**
 * Converts a string representation of a quad-tree to a Tree object.
 * @param {string} qtreeString - The string representation of the quad-tree.
 * @param {{ pos: number }} posHolder - An object that holds the current position in the string.
 * @returns {Tree} A Tree object representing the quad-tree.
 */
function qtreeFromString(qtreeString: string, posHolder: { pos: number }): Tree {
	const code = qtreeString.charCodeAt(posHolder.pos) - codeEmpty; // code (node descriptor) of the current node
	posHolder.pos++; // move to the next char-code (node descriptor) in the qtree string
	// for each node we have 4 sub nodes. if (code & i) then the node is a subtree, otherwise empty node - TileType.Land
	const subTrees = [1, 2, 4, 8].map((i) => (code & i ? qtreeFromString(qtreeString, posHolder) : undefined));
	return subTrees.some((s) => s) ? { nodes: subTrees as SubTreesN } : {}; // if some sub != undefined, then the node is a "full tree" - TileType.Sea
	// return { nodes: subTrees.some((s) => s) ? subTrees : undefined }; // if some sub != undefined, then the node is a "full tree" - TileType.Sea
}

/**
 * Returns the depth of the given quad-tree.
 * @param {TreeN} tree - The quad-tree to get the depth of.
 * @returns {number} The depth of the quad-tree.
 */
function getTreeDepth(tree: TreeN): number {
	return tree?.nodes ? 1 + Math.max(...tree.nodes.map(getTreeDepth)) : 0; // max of all sub trees depths + 1
}

/**
 * Checks the type of the tile at the given coordinates in the quad-tree.
 * @param {TreeN} tree - The quad-tree to check.
 * @param {XYZ} coord - The coordinates of the tile to check.
 * @param {boolean} deepest - Whether or not the given coordinates are at the deepest level of the quad-tree.
 * @returns {TileType} The type of the tile at the given coordinates.
 */
function qTreeCheckCoord(tree: TreeN, coord: XYZ, deepest: boolean): TileType {
	// check current sub-tree
	while (tree) {
		if (deepest && coord.z === 0) return TileType.Mixed; // at the top level, for the deepest level of the sub-tree 'coord' can only be mixed
		if (!tree.nodes) return TileType.Sea; // if the tree has no nodes, then it's a sea tile
		if (coord.z === 0) return TileType.Mixed; // if we're at the top level, then it's a mixed tile

		coord.z--;
		tree = tree.nodes[(((coord.y >> coord.z) & 1) << 1) | ((coord.x >> coord.z) & 1)];
	}

	return TileType.Land; // if there is no sub-tree, then the 'coord' is a land tile
} // qTreeCheckCoord

// /**
//  * Recursively checks the type of the tile at the given coordinates in the quad-tree.
//  * @param {TreeN} tree - The quad-tree to check.
//  * @param {XYZ} coord - The coordinates of the tile to check.
//  * @param {boolean} deepest - Whether or not the given coordinates are at the deepest level of the quad-tree.
//  * @returns {TileType} The type of the tile at the given coordinates.
//  */
// function qTreeCheckCoordRecursive(tree: TreeN, coord: XYZ, deepest: boolean): TileType {
// 	if (tree === undefined) return TileType.Land;
// 	if (deepest && !coord.z) return TileType.Mixed; // at the deepest level the tree can only be mixed
// 	if (tree.nodes === undefined) return TileType.Sea;
// 	if (!coord.z) return TileType.Mixed;
// 	coord.z--;
// 	return qTreeCheckCoordRecursive(tree.nodes[(((coord.y >> coord.z) & 1) << 1) | ((coord.x >> coord.z) & 1)], coord, deepest);
// } // qTreeCheckCoordRecursive
