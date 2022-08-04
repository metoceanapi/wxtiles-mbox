import { fetchJson } from './wxtools';

interface Coords {
	z: number;
	x: number;
	y: number;
}

type QTreeN = QTreeI | null;
type QTSub = QTreeN[] | null; // [QTreeN, QTreeN, QTreeN, QTreeN] | null;
interface QTreeI {
	sub: QTSub;
}

const fullSimbol = 'A'.charCodeAt(0);

export enum TileType {
	Land = 'land',
	Mixed = 'mixed',
	Sea = 'sea',
}

export class QTree {
	qtree: QTreeI = { sub: null };
	qtreedepth: number = 0;

	constructor() {}

	async load(input: RequestInfo, init?: RequestInit | undefined): Promise<void> {
		let _seamask: string;
		try {
			_seamask = await fetchJson<string>(input, init);
		} catch (e) {
			throw new Error(`Failed to load QTree: ${e.message}`);
		}

		this.qtree = qtreeFromString(_seamask, { pos: 0 });
		this.qtreedepth = getTreeDepth(this.qtree);
	}

	check(coord: Coords): TileType {
		if (!this.qtreedepth) return TileType.Mixed;
		const d = coord.z - this.qtreedepth;
		const deepest = d >= 0;
		const c = deepest ? { x: coord.x >> d, y: coord.y >> d, z: this.qtreedepth } : { ...coord /*copy!*/ };
		return qTreeCheckCoord(this.qtree, c, deepest);
	}
}

function qtreeFromString(qtreeString: string, posHolder: { pos: number }): QTreeI {
	const code = qtreeString.charCodeAt(posHolder.pos) - fullSimbol;
	posHolder.pos++;
	const sub = [1, 2, 4, 8].map((i) => (code & i ? qtreeFromString(qtreeString, posHolder) : null));
	return { sub: sub.some((s) => s) ? sub : null };

	// const sub1 = code & 1 ? qtreeFromString(qtreeString, posHolder) : null;
	// const sub2 = code & 2 ? qtreeFromString(qtreeString, posHolder) : null;
	// const sub4 = code & 4 ? qtreeFromString(qtreeString, posHolder) : null;
	// const sub8 = code & 8 ? qtreeFromString(qtreeString, posHolder) : null;
	// const sub: QTSub = sub1 || sub2 || sub4 || sub8 ? [sub1, sub2, sub4, sub8] : null;
	// return { sub };
}

function getTreeDepth(tree: QTreeN): number {
	return tree?.sub ? 1 + Math.max(...tree.sub.map(getTreeDepth)) : 0; // max of all sub trees depths + 1
}

function qTreeCheckCoord(qt: QTreeN, coord: Coords, deepest: boolean): TileType {
	if (qt === null) return TileType.Land;
	if (deepest && coord.z === 0) return TileType.Mixed; // at the deepest tree level can be only mixed
	if (qt.sub === null) return TileType.Sea;
	if (coord.z === 0) return TileType.Mixed;

	coord.z--;
	return qTreeCheckCoord(qt.sub[(((coord.y >> coord.z) & 1) << 1) | ((coord.x >> coord.z) & 1)], coord, deepest);
}
