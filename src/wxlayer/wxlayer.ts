import { RawCLUT } from '../utils/RawCLUT';
import { WxGetColorStyles, HashXYZ, RGBtoHEX, create2DContext, WXLOG } from '../utils/wxtools';
import type { WxColorStyleStrict, XYZ, DataPictures, WxColorStyleWeak } from '../utils/wxtools';
import type { WxAllBoundariesMeta, WxVariableMeta } from '../wxAPI/wxAPI';
import type { WxDataSetManager } from '../wxAPI/WxDataSetManager';
import { Loader } from './loader';
import { Painter, type WxRasterData } from './painter';
import type { WxTileSource } from '../wxsource/wxsource';

/** Type used to set a time step for the layer. */
export type WxDate = string | number | Date;

/** Used to make an abortable call to the layer update */
export interface WxRequestInit {
	signal?: AbortSignal;
}

/** Information about the current point on map returned by the  {@link WxLayer} method. */
export interface WxTileInfo {
	/** values of all variables in datasets's units */
	data: number[];

	/** RAW values of all variables in internal representation */
	raw: number[];

	/** **uint32** colors defined by curent values {@link WxTileInfo.data} and the style */
	rgba: number[];

	/** web colors defined by curent values {@link WxTileInfo.data} and the style */
	hexColor: string[];

	/** values of all variables in Style's units */
	inStyleUnits: number[];

	/** The current point on map. */
	tilePoint: { x: number; y: number };

	/** WxUnits defined style */
	styleUnits: string;

	/** WxUnits defined dataset */
	dataUnits: string;
}

/** Array of variable names to be used in {@link WxLayer} */
export type WxVars = [string] | [string, string];

/** @internal Array of URIs to request tiles */
export type WxURIs = [string] | [string, string];

/** Lon/Lat coordinates */
export interface WxLngLat {
	/** Longitude */
	lng: number;

	/** Latitude */
	lat: number;
}

/**
 * Options to construct {@link WxTileSource} object
 * Do not use this type directly, use {@link WxLayerOptions} instead
 * */
export interface WxLayerOptions {
	/** Variables of the layer */
	variables: WxVars;

	/** Dataset Manager */
	wxdatasetManager: WxDataSetManager;

	/** initial time step */
	time: WxDate;

	/** initial style name */
	wxstyleName?: string;

	/** initial style, applyed on top of style passed by name {@link wxstyleName} */
	wxstyle?: WxColorStyleWeak;
}

/**
 * @internal
 * Used in {@link WxLayerBaseImplementation} cache of tiles
 * */
export class TilesCache extends Map<string, WxRasterData> {
	clear(): void {
		WXLOG(`TilesCache.clear()`);
		this.forEach((v) => {
			if (!v.rd) return;
			v.rd.gl.deleteTexture(v.rd.vectorTextureU);
			v.rd.gl.deleteTexture(v.rd.vectorTextureV);
		});

		super.clear();
	}
}

/**
 * @internal
 * Used in {@link WxLayerBaseImplementation} to manipulate the the layer's style, data and time
 * */
export class WxLayer {
	/** @internal Variables to be displayed by the layer */
	readonly variables: WxVars; // variables of the dataset if vector then [eastward, northward]

	/** @internal Data manager created this layer */
	readonly wxdatasetManager: WxDataSetManager;

	/** @internal Current time*/
	protected time: string;

	/** @internal Current variable's Meta data of the layer*/
	currentVariableMeta: WxVariableMeta;

	/** @internal current URIs to fetch tiles */
	tilesURIs: WxURIs;

	/** @internal current Style Object	*/
	style: WxColorStyleStrict;

	/** @internal Current "Color lookup table" object */
	CLUT: RawCLUT;

	/** @internal cahced URI->data */
	tilesCache: TilesCache = new TilesCache();

	/** @internal current coarsing zoom level */
	coarseLevel: number = 0;

	/** @internal Painter object to render tiles */
	readonly painter: Painter = new Painter(this);

	/** @internal Loader object to load and preprocess tiles */
	protected readonly loader: Loader = new Loader(this);

	constructor(wxLayerOptions: WxLayerOptions) {
		WXLOG(`WxLayer.constructor: 
		datasetName: ${wxLayerOptions.wxdatasetManager.datasetName},
		variables: ${wxLayerOptions.variables.join(', ')},
		wxstyleName: ${wxLayerOptions.wxstyleName},
		wxstyle: ${JSON.stringify(wxLayerOptions.wxstyle)},
		time: ${wxLayerOptions.time}`);

		// check variables
		if (!wxLayerOptions.variables?.length || wxLayerOptions.variables.length > 2) {
			throw new Error(
				`datasetName: ${wxLayerOptions.wxdatasetManager.datasetName}: only 1 or 2 variables are supported but ${wxLayerOptions.variables} was given`
			);
		}

		wxLayerOptions.variables.forEach((v) => {
			if (!wxLayerOptions.wxdatasetManager.checkVariableValid(v))
				throw new Error(`datasetName: ${wxLayerOptions.wxdatasetManager.datasetName}: variable ${v} is not valid`);
		});

		this.variables = wxLayerOptions.variables;
		this.wxdatasetManager = wxLayerOptions.wxdatasetManager;
		[this.tilesURIs, this.time] = this._createURLsAndTime(wxLayerOptions.time);

		const styles = WxGetColorStyles();
		const baseStyle = styles['base'];
		const wxOptStyle = wxLayerOptions.wxstyleName && styles[wxLayerOptions.wxstyleName];
		this.currentVariableMeta = this._getCurrentVariableMeta();
		[this.style, this.CLUT] = this._createStyleAndCLUT({ ...baseStyle, ...wxOptStyle, ...wxLayerOptions.wxstyle });
	} // constructor

	/** Check if the layer is vector and may be animated according to style */
	get nonanimatable(): boolean {
		WXLOG(`WxLayer.nonanimatabl()`);
		return this.variables.length < 2 || this.style.streamLineStatic || this.style.streamLineColor === 'none';
	} // animatable

	/**
	 * @internal
	 * Get maximum zoom according to the layer's Dataset manager
	 * @returns {number} maximum zoom
	 */
	getMaxZoom(): number {
		WXLOG(`WxLayer.getMaxZoom`);
		return this.wxdatasetManager.isInstanced() ? this.wxdatasetManager.getInstanceMeta(this.getTime()).maxZoom : this.wxdatasetManager.getMaxZoom();
	} // getMaxZoom

	getCoarseMaxZoom(): number {
		WXLOG(`WxLayer.getCoarseMaxZoom`);
		return this.getMaxZoom() - this.coarseLevel;
	}

	/**
	 * @internal
	 * Get boundaries zoom according to the layer's Dataset manager
	 * @returns {WxAllBoundariesMeta | undefined} boundaries
	 * */
	getBoundaries(): WxAllBoundariesMeta | undefined {
		return this.wxdatasetManager.isInstanced() ? this.wxdatasetManager.getInstanceMeta(this.getTime()).boundaries : this.wxdatasetManager.getBoundaries();
	} // getBoundaries

	/**
	 * @internal
	 * Get the current time step of the layer
	 * @returns {string} time step in the dataset meta's format */
	getTime(): string {
		WXLOG(`WxLayer.getTime`);
		return this.time;
	} // getTime

	/**
	 * @internal
	 * Clear the cache of tiles
	 * Not to use when loading is in progress. */
	clearCache(): void {
		WXLOG(`WxLayer.clearCache`);
		this.tilesCache.clear();
		this.loader.clearCache();
	} // clearCache

	/** @internal */
	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		WXLOG(`WxLayer.getCurrentStyleObjectCopy`);
		return Object.assign({}, this.style);
	} // getCurrentStyleObjectCopy

	/** @internal */
	updateCurrentStyleObject(style?: WxColorStyleWeak): void {
		WXLOG(`WxLayer.updateCurrentStyleObject ${JSON.stringify(style)}`);
		[this.style, this.CLUT] = this._createStyleAndCLUT(style);
	}

	/** @internal Used by {@link WxTileSource.getLayerInfoAtLatLon} */
	getTileData(tileCoord: XYZ, tilePixel: { x: number; y: number }): WxTileInfo | undefined {
		// WXLOG(`WxLayer.getTileData tileCoord: ${tileCoord.x}, ${tileCoord.y}, ${tileCoord.z}, tilePixel: ${tilePixel.x}, ${tilePixel.y}`);
		const tile = this.tilesCache.get(HashXYZ(tileCoord));
		if (!tile) return; // no tile
		const tileData = this._getPixelInfo(tilePixel, tile.data.data);
		if (!tileData) return; // oops! no data at the pixel
		const { raw, data } = tileData;
		const rgba = raw.map((r) => this.CLUT.colorsI[r]);
		const hexColor = rgba.map(RGBtoHEX);
		const inStyleUnits = data.map((d) => this.CLUT.DataToStyle(d));
		return { data, raw, rgba, hexColor, inStyleUnits, tilePoint: tilePixel, styleUnits: this.style.units, dataUnits: this.currentVariableMeta.units };
	} // _getTileData

	/** @internal reassign URIs and a time step with a new given time step */
	setURLsAndTime(time_?: WxDate): void {
		WXLOG(`WxLayer.setURLsAndTime time=${time_}`);
		[this.tilesURIs, this.time] = this._createURLsAndTime(time_);
		if (this.wxdatasetManager.isInstanced()) {
			this.currentVariableMeta = this._getCurrentVariableMeta();
			[this.style, this.CLUT] = this._createStyleAndCLUT();
		}
	} // _setURLsAndTime

	/** @internal load, cache, draw the tile. Abortable */
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<WxRasterData | null> {
		return this._loadCacheDrawTile(tile, this.tilesCache, requestInit).catch((e) => {
			if (e.name === 'AbortError') throw e; // re-throw abort in case MapBox wants to handle it
			// if (e.reason === 'instance-not-found' | 'time-not-found') reload timesteps and instances
			return null; // else NODATA in the tile
		});
	} // _loadTile

	/** @internal cache given time step for faster access when needed. Resolved when done.
	 * @param time_ time step to cache
	 * @param requestInit request options
	 * @returns {Promise<void>} */
	async preloadTime(time_: WxDate, tiles: XYZ[], requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxLayer.preloadTime time=${time_}`);
		const [tilesURIs] = this._createURLsAndTime(time_);
		await Promise.allSettled(tiles.map((tile) => this.loader.cacheLoad(tile, tilesURIs, requestInit))); // fill up cache
	} // _preloadTime

	/**
	 * @description Load all tiles, draw it on canvas, save to cache and return. Resolved when done.
	 * @param tiles
	 * @param requestInit
	 * @returns {Promise<viod>} */
	async reloadTiles(tiles: XYZ[], requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxLayer.reloadTiles`);
		const tilesCache = new TilesCache();
		await Promise.allSettled(tiles.map((tile) => this._loadCacheDrawTile(tile, tilesCache, requestInit))); // fill up cache

		if (!requestInit?.signal?.aborted) {
			this.tilesCache.clear(); // clear old cache
			this.tilesCache = tilesCache; // replace cache
		} else tilesCache.clear(); // clear unneeded cache
	} // _reloadTiles

	/** @ignore */
	protected async _loadCacheDrawTile(tile: XYZ, tilesCache: TilesCache, requestInit?: WxRequestInit): Promise<WxRasterData | null> {
		const tileData = tilesCache.get(HashXYZ(tile));
		if (tileData) return tileData;

		const data = await this.loader.load(tile, requestInit);
		if (!data) return null; // also happens when tile is cut by qTree or by Mask

		const ctxFill = create2DContext(256, 256);
		const ctxText = ctxFill; //  check if some browsers need separate canvas for text
		const ctxStreamLines = this.variables.length === 2 ? create2DContext(256, 256) : ctxFill;
		const raster_data: WxRasterData = { ctxFill, ctxText, ctxStreamLines, data };
		this.painter.paint(raster_data);
		tilesCache.set(HashXYZ(tile), raster_data);
		return raster_data;
	} // _loadCacheDrawTile

	/** @ignore creates/calculates meta data for vector layers */
	protected _getCurrentVariableMeta(): WxVariableMeta {
		const variablesMetas = this.variables.map((v) => {
			const variableMeta = this.wxdatasetManager.getInstanceVariableMeta(v, this.time); // meta <-> instance!!!
			if (!variableMeta) throw new Error(`WxLayer ${this.wxdatasetManager.datasetName}: variable ${v} is not valid`);
			return variableMeta;
		});
		let { min, max, units, vector } = variablesMetas[0];
		if (this.variables.length > 1) {
			// for the verctor field we need to get the min and max of the vectors' length
			// but convert and calculate ALL vector length just for that is too much
			// so we just use estimation based on the max of the vector components
			// hence min of a vector length can't be less than 0
			min = 0;
			// max of a field can't be less than max of the components multiplied by sqrt(2)
			max = 1.42 * Math.max(-variablesMetas[0].min, variablesMetas[0].max, -variablesMetas[1].min, variablesMetas[1].max);
			// tese values arn't real! but they are good enough for the estimation
		}

		return { min, max, units, vector };
	} // _getCurrentMeta

	/** @ignore  x, y - pixel on tile, data - data tile  */
	protected _getPixelInfo({ x, y }: { x: number; y: number }, data: DataPictures): { raw: number[]; data: number[] } | undefined {
		WXLOG(`WxLayer._getPixelInfo x=${x} y=${y}`);
		const index = (y + 1) * 258 + (x + 1);
		if (!data?.[0]?.raw?.[index]) return; // check if data is loaded and the pixel is not empty
		return {
			raw: data.map((data) => data.raw[index]),
			data: data.map((data) => data.raw[index] * data.dmul + data.dmin),
		};
	} // _getPixelInfo

	/** @ignore */
	protected _createStyleAndCLUT(style_?: WxColorStyleWeak): [WxColorStyleStrict, RawCLUT] {
		// don't use {...obj} spread operator! as we need to assign 'undefined' values
		const style = Object.assign({}, this.style, style_); // deep copy, so could be (and is) changed
		const CLUT = this._prepareCLUT(style);
		return [style, CLUT];
	}

	/** @ignore Create a new CLUT for the given style */
	protected _prepareCLUT(style: WxColorStyleStrict): RawCLUT {
		const { min, max, units } = this.currentVariableMeta;
		return new RawCLUT(style, units, [min, max], this.variables.length === 2);
	} // _prepareCLUTf

	/** @ignore calculate valid timestep and URIs */
	protected _createURLsAndTime(time_?: WxDate): [WxURIs, string] {
		const time = this.wxdatasetManager.getValidTime(time_);
		const tilesURIs = <WxURIs>this.variables.map((variable) => this.wxdatasetManager.createURI(variable, time));
		return [tilesURIs, time];
	} // _createURLsAndTime
}
