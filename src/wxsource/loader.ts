import { coordToPixel, PixelsToLonLat } from '../utils/mercator';
import { TileType } from '../utils/qtree';
import { blurData, DataIntegral, DataPicture, loadDataIntegral, UriLoaderPromiseFunc, uriXYZ, XYZ } from '../utils/wxtools';
import { BoundaryMeta } from '../wxAPI/wxAPI';
import { applyMask, makeBox, splitCoords, subData, subDataDegree } from './loadertools';
import { WxTileSource } from './wxsource';

export class Loader {
	wxsource: WxTileSource;
	loadDataFunc: UriLoaderPromiseFunc<DataIntegral>;

	constructor(wxsource: WxTileSource) {
		this.wxsource = wxsource;
		this.loadDataFunc = /* cacheUriPromise */ loadDataIntegral;
		wxsource.wxdataset.wxapi.loadMaskFunc;
	}

	async load(coords: XYZ, init?: { signal?: AbortSignal }): Promise<DataPicture[] | null> {
		// TODO: test if needed this check, or it is already done by the Source.bounds
		if (!this._checkInsideBoundaries(coords)) return null; // tile is cut by boundaries

		const tileType = this._checkTypeAndMask(coords);
		if (!tileType) return null; // tile is cut by mask

		const { upCoords, subCoords } = splitCoords(coords, this.wxsource.wxdataset.meta.maxZoom);
		const URLs = this.wxsource.tilesURIs.map((uri) => uriXYZ(uri, upCoords));
		const initcopy = Object.assign({}, this.wxsource.wxdataset.wxapi.init, { signal: init?.signal }); // make initCopy, copy only signal
		const loadDataFunc = (url: string) => this.loadDataFunc(url, initcopy);
		const data = await Promise.all(URLs.map(loadDataFunc));

		const { units } = this.wxsource.wxdataset.meta.variablesMeta[this.wxsource.variables[0]];
		const interpolator = units === 'degree' ? subDataDegree : subData;
		const processor = (d: DataIntegral) => interpolator(blurData(d, this.wxsource.style.blurRadius), subCoords);
		const processedData = data.map(processor); // preprocess all loaded data
		this._vectorMagnitudesPrepare(processedData); // if vector data, prepare magnitudes

		await this._applyMask(processedData, coords, tileType, !subCoords && data.length === 1); // apply mask if needed

		// if (processedData.length > 1) {
		// 	this._createStreamLines();
		// }

		return processedData;
	}

	protected async _applyMask(data: DataPicture[], tile: XYZ, tileType: TileType, needCopy: boolean): Promise<void> {
		const { style } = this.wxsource;
		if ((style.mask === 'land' || style.mask === 'sea') && tileType === TileType.Mixed) {
			if (needCopy) {
				// !!make a copy before masking!! or original data will be spoiled
				// needCopy is false if this is a subTile (already copied from parent)
				const { raw: inRaw, dmin, dmax, dmul } = data[0];
				data[0] = { raw: new Uint16Array(inRaw), dmin, dmax, dmul };
			}

			let maskImage: ImageData;
			try {
				maskImage = await this.wxsource.wxdataset.wxapi.loadMaskFunc(tile);
			} catch (e) {
				style.mask = undefined;
				console.log("Can't load Mask. Masking is Turned OFF");
				return;
			}

			applyMask(data[0], maskImage, style.mask);
		}
	}

	protected _vectorMagnitudesPrepare(data: DataPicture[]): void {
		if (data.length === 1) return; // no need to process
		data.unshift({ raw: new Uint16Array(258 * 258), dmin: 0, dmax: 0, dmul: 0 });
		const [l, u, v] = data; // length, u, v components
		l.dmax = 1.42 * Math.max(-u.dmin, u.dmax, -v.dmin, v.dmax);
		l.dmul = (l.dmax - l.dmin) / 65535;
		for (let i = 0; i < 258 * 258; ++i) {
			if (!u.raw[i] || !v.raw[i]) {
				l.raw[i] = 0;
				continue;
			} // NODATA
			const _u = u.dmin + u.dmul * u.raw[i]; // unpack U data
			const _v = v.dmin + v.dmul * v.raw[i]; // unpack V data
			l.raw[i] = Math.sqrt(_v * _v + _u * _u) / l.dmul; // pack data back to use the original rendering approach
		}
	}

	protected _checkTypeAndMask(coords: XYZ): TileType | undefined {
		const { mask } = this.wxsource.style;
		// Check by QTree
		var tileType: TileType | undefined = TileType.Mixed;
		if (mask === 'land' || mask === 'sea') {
			tileType = this.wxsource.wxdataset.wxapi.qtree.check(coords); // check 'type' of a tile
			if (mask === tileType) {
				return undefined; // cut by QTree
			}
		}

		return tileType;
	}

	protected _checkInsideBoundaries(coords: XYZ): boolean {
		const { boundaries } = this.wxsource.wxdataset.meta;
		if (boundaries?.boundaries180) {
			const bbox = makeBox(coords);
			const rectIntersect = (b: BoundaryMeta) => !(bbox.west > b.east || b.west > bbox.east || bbox.south > b.north || b.south > bbox.north);
			if (!boundaries.boundaries180.some(rectIntersect)) {
				return false; // cut by boundaries
			}
		}

		return true;
	}
}
