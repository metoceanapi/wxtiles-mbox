import { TileType } from '../utils/qtree';
import {
	blurData,
	cacheUriPromise,
	type DataIntegral,
	type DataIntegrals,
	type DataPictures,
	loadDataIntegral,
	UriLoaderPromiseFunc,
	uriXYZ,
	type XYZ,
	WXLOG,
} from '../utils/wxtools';
import { type WxBoundaryMeta } from '../wxAPI/wxAPI';
import { applyMask, makeBox, splitCoords, subData, subDataDegree, subMask } from './loadertools';
import { WxRequestInit, WxURIs, type WxLayer } from './wxlayer';

/** Point on pixel grid */
export interface SLinePoint {
	x: number;
	y: number;
}

/** Line on pixel grid */
export type SLine = SLinePoint[];

/** Data of a single tile */
export interface WxData {
	/**
	 *  data of the tile one for scalar data, three for vector data (two vars+vector lengths)*/
	data: DataPictures;

	/** streamlines */
	slines: SLine[];
}

/**
 * A class to load and preprocess data from PNG tiles. Used intenally by WxLayer.
 * Do not use directly.
 */
export class Loader {
	/** refference to the Layer {@link WxLayer} in which this loader is used */
	protected readonly layer: WxLayer;

	/** function to load, decode and cache data from URL */
	protected loadDataFunc: UriLoaderPromiseFunc<DataIntegral> = /*loadDataIntegral; //*/ cacheUriPromise(loadDataIntegral);

	/** Do not use constructor directly */
	constructor(layer: WxLayer) {
		this.layer = layer;
	}

	/**
	 * Load and preprocess data for a single tile
	 * @param tile - tile coordinates
	 * @param requestInit - requestInit for fetch
	 * @returns {Promise<WxData | null> } data of the tile
	 * */
	async load(tile: XYZ, requestInit?: WxRequestInit): Promise<WxData | null> {
		const preloaded = await this.cacheLoad(tile, this.layer.tilesURIs, requestInit);
		if (!preloaded) return null; // tile is cut by boundaries or mask QTree
		const { rawdata, subCoords, tileType } = preloaded;
		const { units } = this.layer.currentMeta;
		const interpolator = units === 'degree' ? subDataDegree : subData;
		const processor = (d: DataIntegral) => interpolator(blurData(d, this.layer.style.blurRadius), subCoords);
		const data = <DataPictures>rawdata.map(processor); // preprocess all loaded data
		this._vectorMagnitudesPrepare(data); // if vector data, prepare magnitudes
		await this._applyMask(data, tile, tileType, !subCoords && rawdata.length === 1); // apply mask if needed
		return { data, slines: this._createStreamLines(data) };
	}

	async cacheLoad(
		tile: XYZ,
		uris: WxURIs,
		requestInit?: WxRequestInit
	): Promise<{ rawdata: DataIntegrals; subCoords?: XYZ | undefined; tileType: TileType } | null> {
		// TODO: mapbox can't work with boundaries across lon 180. Once it's fixed, we can remove this check
		if (!this._checkInsideBoundaries(tile)) return null; // tile is cut by boundaries

		const tileType = this._checkTypeAndMask(tile);
		if (!tileType) return null; // tile is cut by mask

		const { upCoords, subCoords } = splitCoords(tile, this.layer.wxdatasetManager.getMaxZoom());
		const URLs = <WxURIs>uris.map((uri) => uriXYZ(uri, upCoords));
		const requestInitCopy = Object.assign({}, this.layer.wxdatasetManager.wxapi.requestInit, { signal: requestInit?.signal }); // make initCopy, copy only signal
		const rawdata = <DataIntegrals>await Promise.all(URLs.map((url: string) => this.loadDataFunc(url, requestInitCopy)));
		return { rawdata, subCoords, tileType };
		// we don't need to process data, as it's for cache preloading only
	}

	/** Clear cache */
	clearCache(): void {
		this.loadDataFunc = cacheUriPromise(loadDataIntegral);
	}

	/** @ignore */
	protected async _applyMask(data: DataPictures, tile: XYZ, tileType: TileType, needCopy: boolean): Promise<void> {
		const { style } = this.layer;
		if ((style.mask === 'land' || style.mask === 'sea') && tileType === TileType.Mixed) {
			if (needCopy) {
				// !!make a copy before masking!! or original data will be spoiled
				// needCopy is false if this is a subTile (already copied from parent)
				const { raw: inRaw, dmin, dmax, dmul } = data[0];
				data[0] = { raw: new Uint16Array(inRaw), dmin, dmax, dmul };
			}

			let maskImage: ImageData;
			try {
				const { upCoords, subCoords } = splitCoords(tile, this.layer.wxdatasetManager.wxapi.maskDepth);
				maskImage = await this.layer.wxdatasetManager.wxapi.loadMaskFunc(upCoords);
				maskImage = subMask(maskImage, subCoords); // preprocess all loaded data
			} catch (e) {
				style.mask = undefined;
				WXLOG("Can't load Mask. Masking is disabled");
				return;
			}

			applyMask(data[0], maskImage, this.layer.wxdatasetManager.wxapi.maskChannel, style.mask);
		}
	}

	/** @ignore */
	protected _vectorMagnitudesPrepare(data: DataPictures): void {
		if (data.length === 1) return; // no need to process
		data.unshift({ raw: new Uint16Array(258 * 258), dmin: 0, dmax: 0, dmul: 0 });
		const [l, u, v] = data; // length, u, v components
		l.dmax = 1.42 * Math.max(-u.dmin, u.dmax, -v.dmin, v.dmax);
		l.dmul = (l.dmax - l.dmin) / 65535;
		for (let i = 0; i < 258 * 258; ++i) {
			if (!u.raw[i] || !v.raw[i]) {
				// l.raw[i] = 0; // by default it's 0
				continue;
			} // NODATA
			const _u = u.dmin + u.dmul * u.raw[i]; // unpack U data
			const _v = v.dmin + v.dmul * v.raw[i]; // unpack V data
			l.raw[i] = Math.sqrt(_v * _v + _u * _u) / l.dmul; // pack data back to use the original rendering approach
		}
	}

	/** @ignore */
	protected _checkTypeAndMask(coords: XYZ): TileType | undefined {
		const { mask } = this.layer.style;
		// Check by QTree
		var tileType: TileType | undefined = TileType.Mixed;
		if (mask === 'land' || mask === 'sea') {
			tileType = this.layer.wxdatasetManager.wxapi.qtree.check(coords); // check 'type' of a tile
			if (mask === tileType) {
				return undefined; // cut by QTree
			}
		}

		return tileType;
	}

	/** @ignore */
	protected _checkInsideBoundaries(coords: XYZ): boolean {
		const boundaries = this.layer.wxdatasetManager.getBoundaries();
		if (boundaries?.boundaries180) {
			const bbox = makeBox(coords);
			const rectIntersect = (b: WxBoundaryMeta) => !(bbox.west > b.east || b.west > bbox.east || bbox.south > b.north || b.south > bbox.north);
			if (!boundaries.boundaries180.some(rectIntersect)) {
				return false; // cut by boundaries
			}
		}

		return true;
	}

	/** @ignore */
	protected _createStreamLines(data: DataPictures): SLine[] {
		if (data.length !== 3) return [];
		const { style } = this.layer;
		if (style.streamLineColor === 'none') return [];
		const streamLines: SLine[] = []; // an array of stremllines. Each section of streamline represents a position and size of a particle.

		// idea is taken from the LIC (linear integral convolution) algorithm and the 'multipartical vector field visualisation'
		// Having the stream lines as precalculated trajectories makes an animation more predictable and (IMHO) representative.
		// Algorithm: use U and V as an increment to build a trajectory. To make trajectory more or less correct the algo
		// does 20 moc steps and stores the point into streamline (sLine).
		// Algo does two passes: forward and backward, to cope boundaries and improve visual effect.
		const [l, u, v] = data;
		const factor = (style.streamLineSpeedFactor || 1) / l.dmax;
		const addDegrees = style.addDegrees ? 0.017453292519943 * style.addDegrees : 0;
		const gridStep = style.streamLineGridStep || 64;
		const steps = style.streamLineSteps || 300;
		for (let y = 0; y <= 256; y += gridStep) {
			for (let x = 0; x <= 256; x += gridStep) {
				if (!l.raw[1 + x + (1 + y) * 258]) continue; // NODATA
				const sLine: SLine = []; // streamline
				let xforw = x;
				let yforw = y;
				let oldDi = -1; // previous di. The first di will never be -1
				let dx = 0;
				let dy = 0;
				for (let i = 0; i <= steps && xforw >= 0 && xforw <= 256 && yforw >= 0 && yforw <= 256; i++) {
					// forward
					if (!(i % (steps / 10))) sLine.push({ x: ~~xforw, y: ~~yforw }); // push each (steps/10)-th point // 7 points max
					const di = ~~xforw + 1 + (~~yforw + 1) * 258;
					if (di !== oldDi) {
						// calc dx, dy only if di changed
						if (!l.raw[di]) break; // NODATA - stop streamline creation
						oldDi = di; // save old di
						const dl = l.dmin + l.raw[di] * l.dmul;
						const du = u.dmin + u.raw[di] * u.dmul;
						const dv = v.dmin + v.raw[di] * v.dmul;
						const ang = Math.atan2(du, dv) + addDegrees;
						dx = factor * dl * Math.sin(ang);
						dy = factor * dl * Math.cos(ang);
					}
					xforw += dx;
					yforw -= dy; // negative - due to Lat goes up but screen's coordinates go down
				} // for i forward
				let xback = x;
				let yback = y;
				oldDi = -1; // previous di. The first di will never be -1
				for (let i = 1; i <= steps && xback >= 0 && xback <= 256 && yback >= 0 && yback <= 256; i++) {
					// backward // i = 1 because otherwise it produces the same first point hence visual artefact! 2 hours debugging!
					if (!(i % (steps / 10))) sLine.unshift({ x: ~~xback, y: ~~yback }); // push each (steps/10)-th point // 6 points max
					const di = ~~xback + 1 + (~~yback + 1) * 258;
					if (di !== oldDi) {
						// calc dx, dy only if di changed
						if (!l.raw[di]) break; // NODATA - stop streamline creation
						oldDi = di; // save old di
						const dl = l.dmin + l.raw[di] * l.dmul;
						const du = u.dmin + u.raw[di] * u.dmul;
						const dv = v.dmin + v.raw[di] * v.dmul;
						const ang = Math.atan2(du, dv) + addDegrees;
						dx = factor * dl * Math.sin(ang);
						dy = factor * dl * Math.cos(ang);
					}
					xback -= dx;
					yback += dy; // positive - due to Lat goes up but screen's coordinates go down
				} // for i backward
				sLine.length > 2 && streamLines.push(sLine);
			} // for x
		} // for y
		return streamLines;
	} // _createSLines
}
