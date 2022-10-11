import { RawCLUT } from '../utils/RawCLUT';
import { type ColorStyleStrict, WxGetColorStyles, refineColor, type XYZ, HashXYZ, RGBtoHEX, type DataPicture, create2DContext } from '../utils/wxtools';
import { wxDataSetManager, type VariableMeta } from '../wxAPI/wxAPI';
import { Loader, type wxData } from './loader';
import { Painter, type wxRasterData } from './painter';

export type wxDate = string | number | Date;
export interface RInit {
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

export type wxVars = [string] | [string, string];

export class WxLayer {
	protected readonly variables: wxVars; // variables of the dataset if vector then [eastward, northward]
	protected readonly ext: string; // tiles extension. png by default
	readonly wxdataset: wxDataSetManager;
	readonly currentMeta: VariableMeta;

	protected time: string; // current time. is set in constructor by _setURLs()
	tilesURIs: string[]; // current URIs. is set in constructor by _setURLs()

	style: ColorStyleStrict;
	CLUT: RawCLUT; // is set in constructor by setStyleName()

	protected animation = false;
	protected animationSeed = 0;

	protected tilesCache: Map<string, wxRasterData> = new Map();

	protected readonly painter: Painter = new Painter(this);
	protected readonly loader: Loader = new Loader(this);

	constructor({
		time,
		variables,
		wxdataset,
		ext = 'png',
		wxstyleName = 'base',
	}: {
		time?: wxDate;
		variables: wxVars;
		wxdataset: wxDataSetManager;
		ext?: string;
		wxstyleName?: string;
	}) {
		// check variables
		if (!variables?.length || variables.length > 2) {
			throw new Error(`wxTileSource ${wxdataset.datasetName}: only 1 or 2 variables are supported but ${variables.length} were given`);
		}

		variables.forEach((v) => {
			if (!wxdataset.checkVariableValid(v)) throw new Error(`wxTileSource ${wxdataset.datasetName}: variable ${v} is not valid`);
		});

		this.variables = variables;
		this.wxdataset = wxdataset;
		this.ext = ext;
		this.currentMeta = this._getCurrentMeta();
		[this.tilesURIs, this.time] = this._createURLsAndTime(time);
		this.style = Object.assign(this.getCurrentStyleObjectCopy(), WxGetColorStyles()[wxstyleName]); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		this.CLUT = this._prepareCLUTfromCurrentStyle(); //new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
	} // constructor

	getLayerInfoAtLatLon(lnglat: mapboxgl.LngLat, anymap: any): WxTileInfo | undefined {
		const worldsize = anymap.transform.worldSize as number;
		const zoom = Math.round(Math.log2(worldsize) - 8);
		const tilesize = worldsize / (2 << (zoom - 1));
		const mapPixCoord = anymap.transform.project(lnglat) as mapboxgl.Point;
		const tileCoord = mapPixCoord.div(tilesize);
		tileCoord.x = Math.floor(tileCoord.x);
		tileCoord.y = Math.floor(tileCoord.y);
		const tilePixel_ = mapPixCoord.sub(tileCoord.mult(tilesize)); // tile pixel coordinates
		const tilePixel = tilePixel_.mult(255 / tilesize).round(); // convert to 256x256 pixel coordinates
		return this._getTileData({ x: tileCoord.x, y: tileCoord.y, z: zoom }, tilePixel);
	} // getLayerInfoAtLatLon

	// Beter to use when loading is not in progress // I beleive you don't need it, but it is here just in case
	clearCache(): void {
		this.tilesCache.clear();
		this.loader.clearCache();
	} // clearCache

	getCurrentStyleObjectCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	} // getCurrentStyleObjectCopy

	getTime(): string {
		return this.time;
	} // getTime

	protected async _loadCacheDrawTile(tile: XYZ, tilesCache: Map<string, wxRasterData>, requestInit?: RInit): Promise<wxRasterData> {
		const tileData = tilesCache.get(HashXYZ(tile));
		if (tileData) return tileData;

		let data: wxData | null = null;
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
		const ctxStreamLines = this.variables.length === 2 ? create2DContext(256, 256, false) : ctxFill;
		const raster_data: wxRasterData = { ctxFill, ctxText, ctxStreamLines, data };
		this.painter.paint(raster_data);
		tilesCache.set(HashXYZ(tile), raster_data);
		return raster_data;
	} // _loadCacheDrawTile

	protected async _preloadTime(time_: wxDate, tiles: XYZ[], requestInit?: RInit): Promise<void> {
		const [tilesURIs] = this._createURLsAndTime(time_);
		await Promise.allSettled(tiles.map((tile) => this.loader.cacheLoad(tile, tilesURIs, requestInit))); // fill up cache
	} // _preloadTime

	protected _getCurrentMeta(): VariableMeta {
		const metas = this.variables.map((v) => {
			const meta = this.wxdataset.meta.variablesMeta[v];
			if (!meta) throw new Error(`wxTileSource ${this.wxdataset.datasetName}: variable ${v} is not valid`);
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

	protected _getTileData(tileCoord: XYZ, tilePixel: { x: number; y: number }): WxTileInfo | undefined {
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

	// x, y - pixel on tile
	protected _getPixelInfo({ x, y }: { x: number; y: number }, data: DataPicture[]): { raw: number[]; data: number[] } | undefined {
		const index = (y + 1) * 258 + (x + 1);
		if (!data?.[0]?.raw?.[index]) return; // check if data is loaded and the pixel is not empty
		return {
			raw: data.map((data) => data.raw[index]),
			data: data.map((data) => data.raw[index] * data.dmul + data.dmin),
		};
	} // _getPixelInfo

	protected _prepareCLUTfromCurrentStyle(): RawCLUT {
		const { min, max, units } = this.currentMeta;
		return new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
	} // _prepareCLUTfromCurrentStyle

	protected _createURLsAndTime(time_?: wxDate): [string[], string] {
		const time = this.wxdataset.getValidTime(time_);
		const tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext: this.ext }));
		return [tilesURIs, time];
	} // _createURLsAndTime

	protected _setURLsAndTime(time_?: wxDate): void {
		[this.tilesURIs, this.time] = this._createURLsAndTime(time_);
	} // _setURLsAndTime
}
