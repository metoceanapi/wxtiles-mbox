import { RawCLUT } from '../utils/RawCLUT';
import {
	type WxColorStyleStrict,
	WxGetColorStyles,
	refineColor,
	type XYZ,
	HashXYZ,
	RGBtoHEX,
	type DataPicture,
	create2DContext,
	type WxColorStyleWeak,
	WXLOG,
} from '../utils/wxtools';
import { type WxVariableMeta } from '../wxAPI/wxAPI';
import { WxDataSetManager } from '../wxAPI/WxDataSetManager';
import { Loader, type WxData } from './loader';
import { Painter, type WxRasterData } from './painter';

export type WxDate = string | number | Date;
export interface WxRequestInit {
	signal?: AbortSignal;
}

export interface WxTileInfo {
	data: number[];
	raw: number[];
	rgba: number[];
	hexColor: string[];
	inStyleUnits: number[];
	tilePoint: { x: number; y: number };
	styleUnits: string;
	dataUnits: string;
}

export type WxVars = [string] | [string, string];

export interface WxLngLat {
	lng: number;
	lat: number;
}


export interface WxLayerOptions {
	variables: WxVars;
	wxdatasetManager: WxDataSetManager;
	time?: WxDate;
	ext?: 'png';
	wxstyleName?: string;
}

export class WxLayer {
	protected readonly ext: string; // tiles extension. png by default
	readonly variables: WxVars; // variables of the dataset if vector then [eastward, northward]
	readonly wxdatasetManager: WxDataSetManager;
	readonly currentMeta: WxVariableMeta;

	protected time: string;
	tilesURIs: string[];

	style: WxColorStyleStrict;
	CLUT: RawCLUT;

	protected tilesCache: Map<string, WxRasterData> = new Map();

	readonly painter: Painter = new Painter(this);
	protected readonly loader: Loader = new Loader(this);

	constructor({ time, variables, wxdatasetManager, ext = 'png', wxstyleName = 'base' }: WxLayerOptions) {
		// check variables
		if (!variables?.length || variables.length > 2) {
			throw new Error(`WxTileSource ${wxdatasetManager.datasetName}: only 1 or 2 variables are supported but ${variables.length} were given`);
		}

		variables.forEach((v) => {
			if (!wxdatasetManager.checkVariableValid(v)) throw new Error(`WxTileSource ${wxdatasetManager.datasetName}: variable ${v} is not valid`);
		});

		this.variables = variables;
		this.wxdatasetManager = wxdatasetManager;
		this.ext = ext;
		this.currentMeta = this._getCurrentMeta();
		[this.tilesURIs, this.time] = this._createURLsAndTime(time);
		[this.style, this.CLUT] = this._createCurrentStyleObject(WxGetColorStyles()[wxstyleName]);
		WXLOG(`WxTileSource created ${wxdatasetManager.datasetName}, ${variables.join(', ')}, ${wxstyleName}`);
	} // constructor

	get nonanimatable(): boolean {
		return this.variables.length < 2 || this.style.streamLineStatic || this.style.streamLineColor === 'none';
	} // animatable

	getTime(): string {
		return this.time;
	} // getTime

	// Beter to use when loading is not in progress // I beleive you don't need it, but it is here just in case
	clearCache(): void {
		this.tilesCache.clear();
		this.loader.clearCache();
	} // clearCache

	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		return Object.assign({}, this.style);
	} // getCurrentStyleObjectCopy

	updateCurrentStyleObject(style?: WxColorStyleWeak): void {
		[this.style, this.CLUT] = this._createCurrentStyleObject(style);
	}

	getTileData(tileCoord: XYZ, tilePixel: { x: number; y: number }): WxTileInfo | undefined {
		const tile = this.tilesCache.get(HashXYZ(tileCoord));
		if (!tile) return; // no tile
		const tileData = this._getPixelInfo(tilePixel, tile.data.data);
		if (!tileData) return; // oops! no data at the pixel
		const { raw, data } = tileData;
		const rgba = raw.map((r) => this.CLUT.colorsI[r]);
		const hexColor = rgba.map(RGBtoHEX);
		const inStyleUnits = data.map((d) => this.CLUT.DataToStyle(d));
		return { data, raw, rgba, hexColor, inStyleUnits, tilePoint: tilePixel, styleUnits: this.style.units, dataUnits: this.currentMeta.units };
	} // _getTileData

	setURLsAndTime(time_?: WxDate): void {
		[this.tilesURIs, this.time] = this._createURLsAndTime(time_);
	} // _setURLsAndTime

	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<WxRasterData> {
		return this._loadCacheDrawTile(tile, this.tilesCache, requestInit);
	} // _loadTile

	async preloadTime(time_: WxDate, tiles: XYZ[], requestInit?: WxRequestInit): Promise<void> {
		const [tilesURIs] = this._createURLsAndTime(time_);
		await Promise.allSettled(tiles.map((tile) => this.loader.cacheLoad(tile, tilesURIs, requestInit))); // fill up cache
	} // _preloadTime

	/**
	 * @description Load all tiles, draw it on canvas, save to cache and return
	 * @param tiles
	 * @param requestInit
	 */
	async reloadTiles(tiles: XYZ[], requestInit?: WxRequestInit): Promise<void> {
		const tilesCache = new Map<string, WxRasterData>();
		await Promise.allSettled(tiles.map((tile) => this._loadCacheDrawTile(tile, tilesCache, requestInit))); // fill up cache

		if (!requestInit?.signal?.aborted) this.tilesCache = tilesCache; // replace cache
	} // _reloadTiles

	protected async _loadCacheDrawTile(tile: XYZ, tilesCache: Map<string, WxRasterData>, requestInit?: WxRequestInit): Promise<WxRasterData> {
		const tileData = tilesCache.get(HashXYZ(tile));
		if (tileData) return tileData;

		let data: WxData | null = null;
		try {
			data = await this.loader.load(tile, requestInit);
		} catch (e) {
			throw { status: 404 }; // happens when tile is not available (does not exist)
		}

		if (!data) {
			throw { status: 404 }; // happens when tile is cut by qTree or by Mask
		}

		const ctxFill = create2DContext(256, 256);
		const ctxText = ctxFill; //  check if some browsers need separate canvas for text
		const ctxStreamLines = this.variables.length === 2 ? create2DContext(256, 256) : ctxFill;
		const raster_data: WxRasterData = { ctxFill, ctxText, ctxStreamLines, data };
		this.painter.paint(raster_data);
		tilesCache.set(HashXYZ(tile), raster_data);
		return raster_data;
	} // _loadCacheDrawTile

	protected _createCurrentStyleObject(style_?: WxColorStyleWeak): [WxColorStyleStrict, RawCLUT] {
		const style = Object.assign(this.getCurrentStyleObjectCopy(), style_); // deep copy, so could be (and is) changed
		style.streamLineColor = refineColor(style.streamLineColor);
		const CLUT = this._prepareCLUT(style); //new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		return [style, CLUT];
	}

	protected _getCurrentMeta(): WxVariableMeta {
		const metas = this.variables.map((v) => {
			const meta = this.wxdatasetManager.meta.variablesMeta[v];
			if (!meta) throw new Error(`WxTileSource ${this.wxdatasetManager.datasetName}: variable ${v} is not valid`);
			return meta;
		});
		let { min, max, units } = metas[0];
		if (this.variables.length > 1) {
			// for the verctor field we need to get the min and max of the vectors' length
			// but convert and calculate ALL vector length just for that is too much
			// so we just use estimation based on the max of the vector components
			// hence min of a vector length can't be less than 0
			min = 0;
			// max of a field can't be less than max of the components multiplied by sqrt(2)
			max = 1.42 * Math.max(-metas[0].min, metas[0].max, -metas[1].min, metas[1].max);
			// tese values arn't real! but they are good enough for the estimation
		}

		return { min, max, units };
	} // _getCurrentMeta

	// x, y - pixel on tile
	protected _getPixelInfo({ x, y }: { x: number; y: number }, data: DataPicture[]): { raw: number[]; data: number[] } | undefined {
		const index = (y + 1) * 258 + (x + 1);
		if (!data?.[0]?.raw?.[index]) return; // check if data is loaded and the pixel is not empty
		return {
			raw: data.map((data) => data.raw[index]),
			data: data.map((data) => data.raw[index] * data.dmul + data.dmin),
		};
	} // _getPixelInfo

	protected _prepareCLUT(style: WxColorStyleStrict): RawCLUT {
		const { min, max, units } = this.currentMeta;
		return new RawCLUT(style, units, [min, max], this.variables.length === 2);
	} // _prepareCLUTf

	protected _createURLsAndTime(time_?: WxDate): [string[], string] {
		const time = this.wxdatasetManager.getValidTime(time_);
		const tilesURIs = this.variables.map((variable) => this.wxdatasetManager.createURI(variable, time, this.ext));
		return [tilesURIs, time];
	} // _createURLsAndTime
}
