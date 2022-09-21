import mapboxgl from 'mapbox-gl';

import { type wxDataSetManager } from '../wxAPI/wxAPI';
import { type ColorStyleStrict, type ColorStyleWeak, HashXYZ, refineColor, WxGetColorStyles, type XYZ, type DataPicture, RGBtoHEX } from '../utils/wxtools';

import { RawCLUT } from '../utils/RawCLUT';
import { Painter } from './painter';
import { Loader, type wxData } from './loader';

type CSIRaster = ImageData; // To shut up TS errors for CustomSourceInterface
type wxRaster = HTMLCanvasElement; // Actual result of a Painter
type wxDate = string | number | Date;
interface RInit {
	signal?: AbortSignal;
}

interface wxRasterData {
	raster: wxRaster;
	data: wxData;
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

export class WxTileSource implements mapboxgl.CustomSourceInterface<CSIRaster> {
	type: 'custom' = 'custom'; // MAPBOX API
	dataType: 'raster' = 'raster'; // MAPBOX API
	id: string; // MAPBOX API

	variables: string[]; // vaariables of the dataset
	wxdataset: wxDataSetManager;
	ext: string; // tiles extension. png by default

	map: mapboxgl.Map; // current map

	time: string = ''; // current time. is set in constructor by _setURLs()
	tilesURIs: string[] = []; // current URIs. is set in constructor by _setURLs()

	tileSize: number; // MAPBOX API default 256
	maxzoom?: number; // MAPBOX API
	scheme?: string; // MAPBOX API
	bounds?: [number, number, number, number]; // MAPBOX API
	attribution?: string; // MAPBOX API

	style!: ColorStyleStrict;
	CLUT!: RawCLUT; // is set in constructor by setStyleName()

	animation = false;
	animationFrame = 0;

	painter: Painter = new Painter(this);
	loader: Loader = new Loader(this);

	tilesCache: Map<string, wxRasterData> = new Map();

	constructor({
		id,
		time,
		variables,
		wxdataset,
		ext = 'png',
		wxstyleName = 'base',
		map,
		tileSize = 256,
		maxzoom,
		scheme,
		bounds,
		attribution = 'wxTiles',
	}: {
		id: string;
		time?: wxDate;
		variables: string[];
		wxdataset: wxDataSetManager;
		ext?: string;
		map: mapboxgl.Map;
		wxstyleName?: string;
		tileSize?: number;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		// check variables
		if (!variables?.length || variables.length > 2) {
			throw new Error(`wxTileSource ${wxdataset.datasetName}: only 1 or 2 variables are supported but ${variables.length} were given`);
		}

		variables.forEach((v) => {
			if (!wxdataset.checkVariableValid(v)) throw new Error(`wxTileSource ${wxdataset.datasetName}: variable ${v} is not valid`);
		});

		this.id = id; // MAPBOX API
		this.variables = variables;
		this.wxdataset = wxdataset;
		this.ext = ext;

		this.map = map;

		this.tileSize = tileSize; // MAPBOX API
		this.attribution = attribution; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.scheme = scheme; // MAPBOX API
		this.bounds = bounds || wxdataset.getBoundaries(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.
		this._setURLsAndTime(time);
		this.setStyleByName(wxstyleName, false);
	}

	// Beter to use when loading is not in progress
	// I beleive you don't need it, but it is here just in case
	clearCache(): void {
		this.loader = new Loader(this);
	}

	async loadTile(tile: XYZ, requestInit?: RInit): Promise<CSIRaster> {
		const raster_data = await this._loadTile(tile, this.tilesCache, requestInit);
		const raster = this.animation
			? this.painter.imprintVectorAnimationLinesStep(raster_data.data, raster_data.raster, this, this.animationFrame)
			: raster_data.raster;
		return raster as any; // to shut up TS errors
	}

	protected async _loadTile(tile: XYZ, tilesCache: Map<string, wxRasterData>, requestInit?: RInit): Promise<wxRasterData> {
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

		const raster_data = { raster: this.painter.paint(data), data };
		tilesCache.set(HashXYZ(tile), raster_data);
		return raster_data;
	}

	setStyleByName(wxstyleName: string, reload = true): void {
		this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	protected _prepareCLUTfromCurrentStyle(): RawCLUT {
		const { min, max, units } = this.getCurrentMeta();
		return new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
	}

	async updateCurrentStyleObject(style: ColorStyleWeak, reload = true, requestInit?: RInit): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleObjectCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		this.CLUT = this._prepareCLUTfromCurrentStyle(); //new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		reload && (await this._reloadVisible(requestInit));
	}

	getCurrentMeta(): { units: string; min: number; max: number } {
		let { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		if (this.variables.length > 1) {
			// for the verctor field we need to get the min and max of the vectors' length
			// but convert and calculate ALL vector length just for that is too much
			// so we just use estimation based on the max of the vector components
			const metas = this.variables.map((v) => this.wxdataset.meta.variablesMeta[v]);
			// hence min of a vector length can't be less than 0
			min = 0;
			// max of a field can't be less than max of the components multiplied by sqrt(2)
			max = 1.42 * Math.max(-metas[0].min, metas[0].max, -metas[1].min, metas[1].max);
			// tese values arn't real! but they are good enough for the estimation
		}

		return { min, max, units };
	}

	getCurrentStyleObjectCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	getTime(): string {
		return this.time;
	}

	async preloadTime(time_: wxDate, requestInit?: RInit): Promise<void> {
		const time = this.wxdataset.getValidTime(time_);
		const tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext: this.ext }));
		await Promise.allSettled(this.coveringTiles().map((tile) => this.loader.cacheLoad(tile, tilesURIs, requestInit))); // fill up cache
	}

	// NOTE: even if repaint is false, time and URL are still set!!
	// so, might be confusing when getTime() returns a new time, but the tiles are not repainted
	async setTime(time_?: wxDate, requestInit?: RInit): Promise<string> {
		const oldtime = this.time;
		this._setURLsAndTime(time_);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this._setURLsAndTime(oldtime); // restore old time and URLs
		return this.time;
	}

	protected _setURLsAndTime(time_?: wxDate): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext }));
	}

	protected async _reloadVisible(requestInit?: { signal?: AbortSignal }): Promise<void> {
		const tilesCache = new Map();
		await Promise.allSettled(this.coveringTiles().map((tile) => this._loadTile(tile, tilesCache, requestInit))); // fill up cache
		if (requestInit?.signal?.aborted) return; // if we don't need to repaint, we are just need to cache the tiles inside the 'loader'
		this.tilesCache = tilesCache; // replace cache
		this._repaintVisible();
	}

	protected _repaintVisible(): void {
		this.clearTiles();
		this.update(); // it forces mapbox to reload visible tiles (hopefully from cache)
	}

	startAnimation(): void {
		if (this.animation) return;
		this.animation = true;
		const animationStep = (frame: number) => {
			if (!this.animation || this.variables.length < 2 || this.style.streamLineStatic || this.style.streamLineColor === 'none') return;
			this.animationFrame = frame;
			this._repaintVisible();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	stopAnimation(): void {
		this.animation = false;
	}

	getLayerInfoAtLatLon(lnglat: mapboxgl.LngLat) {
		const anymap = this.map as any;
		const worldsize = anymap.transform.worldSize as number;
		const zoom = Math.round(Math.log2(worldsize) - 8);
		const tilesize = worldsize / (2 << (zoom - 1));
		const mapPixCoord = anymap.transform.project(lnglat) as mapboxgl.Point;
		const tileCoord = mapPixCoord.div(tilesize);
		tileCoord.x = Math.floor(tileCoord.x);
		tileCoord.y = Math.floor(tileCoord.y);
		const tilePixel_ = mapPixCoord.sub(tileCoord.mult(tilesize)); // tile pixel coordinates
		const tilePixel = tilePixel_.mult(255 / tilesize).round(); // convert to 256x256 pixel coordinates
		return this.getTileData({ x: tileCoord.x, y: tileCoord.y, z: zoom }, tilePixel);
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
		return { data, raw, rgba, hexColor, inStyleUnits, tilePoint: tilePixel, styleUnits: this.style.units, dataUnits: this.getCurrentMeta().units };
	}

	// x, y - pixel on tile
	protected _getPixelInfo({ x, y }: { x: number; y: number }, data: DataPicture[]): { raw: number[]; data: number[] } | undefined {
		const index = (y + 1) * 258 + (x + 1);
		if (!data?.[0]?.raw?.[index]) return; // check if data is loaded and the pixel is not empty
		return {
			raw: data.map((data) => data.raw[index]),
			data: data.map((data) => data.raw[index] * data.dmul + data.dmin),
		};
	} // getData

	// MBOX API
	protected clearTiles() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		(this.map as any).style?._clearSource?.(this.id);
		// (this.map as any).style?._reloadSource(this.id); // TODO: check if this is needed // seems NOT
	}

	// MBOX API get assigned by map.addSource
	protected coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	// MBOX API get assigned by map.addSource
	protected update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	// onAdd(map: mapboxgl.Map): void {}
	// onRemove(map: mapboxgl.Map): void {}
	// unloadTile(tile: XYZ): void { }
	// hasTile(tile: XYZ): boolean { }
}
