import mapboxgl from 'mapbox-gl';

import { type wxDataSetManager } from '../wxAPI/wxAPI';
import { type ColorStyleWeak, refineColor, WxGetColorStyles, type XYZ } from '../utils/wxtools';
import { type RInit, type wxDate, WxLayer, type wxVars, type WxTileInfo } from '../wxlayer/wxlayer';

export { type wxDate, type wxVars, type WxTileInfo, type RInit, type ColorStyleWeak, type XYZ };

export class WxTileSource extends WxLayer implements mapboxgl.CustomSourceInterface<any> {
	readonly id: string; // MAPBOX API
	readonly type: 'custom' = 'custom'; // MAPBOX API
	readonly dataType: 'raster' = 'raster'; // MAPBOX API
	readonly tileSize: number = 256; // MAPBOX API only 256
	readonly maxzoom?: number; // MAPBOX API
	readonly scheme?: string; // MAPBOX API
	readonly bounds?: [number, number, number, number]; // MAPBOX API
	readonly attribution?: string; // MAPBOX API

	constructor({
		time,
		variables,
		wxdataset,
		ext = 'png',
		wxstyleName = 'base',

		id,
		maxzoom,
		scheme,
		bounds,
		attribution = 'wxTiles',
	}: {
		time?: wxDate;
		variables: wxVars;
		wxdataset: wxDataSetManager;
		ext?: string;
		wxstyleName?: string;

		id: string;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		super({ time, variables, wxdataset, ext, wxstyleName });

		this.id = id; // MAPBOX API
		this.attribution = attribution; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.scheme = scheme; // MAPBOX API
		this.bounds = bounds || wxdataset.getBoundaries(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.

		this.setStyleByName(wxstyleName, false);
	}

	stopAnimation(): void {
		this.animation = false;
	}

	startAnimation(): void {
		if (this.animation) return;
		this.animation = true;
		const animationStep = (seed: number) => {
			if (!this.animation || this.variables.length < 2 || this.style.streamLineStatic || this.style.streamLineColor === 'none') {
				this.animation = false;
				return;
			}
			this.animationSeed = seed;
			this._repaintVisible();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	async preloadTime(time_: wxDate, requestInit?: RInit): Promise<void> {
		return this._preloadTime(time_, this.coveringTiles(), requestInit);
	}

	async setTime(time_?: wxDate, requestInit?: RInit): Promise<string> {
		const oldtime = this.time;
		this._setURLsAndTime(time_);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this._setURLsAndTime(oldtime); // restore old time and URLs
		return this.time;
	}

	async updateCurrentStyleObject(style?: ColorStyleWeak, reload = true, requestInit?: RInit): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleObjectCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		this.CLUT = this._prepareCLUTfromCurrentStyle(); //new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		reload && (await this._reloadVisible(requestInit));
	}

	async setStyleByName(wxstyleName: string, reload = true): Promise<void> {
		return this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	protected async _reloadVisible(requestInit?: { signal?: AbortSignal }): Promise<void> {
		const tilesCache = new Map();
		await Promise.allSettled(this.coveringTiles().map((tile) => this._loadCacheDrawTile(tile, tilesCache, requestInit))); // fill up cache
		if (requestInit?.signal?.aborted) return; // if we don't need to repaint, we are just need to cache the tiles inside the 'loader'
		this.tilesCache = tilesCache; // replace cache
		this._repaintVisible();
	}

	protected _repaintVisible(): void {
		this.update(); // it forces mapbox to reload visible tiles (hopefully from cache)
	}

	/*MB API*/
	async loadTile(tile: XYZ, requestInit?: RInit): Promise<any> {
		const raster_data = await this._loadCacheDrawTile(tile, this.tilesCache, requestInit);
		if (!this.animation) return raster_data.ctxFill.canvas;

		this.painter.imprintVectorAnimationLinesStep(raster_data, this.animationSeed);
		return raster_data.ctxStreamLines.canvas; // to shut up TS errors
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

	// // MBOX API
	// protected clearTiles() {
	// 	// COMING SOON in a future release
	// 	// but for now, we use the same algorithm as in mapbox-gl-js
	// 	(this.map as any).style?._clearSource?.(this.id);
	// 	// (this.map as any).style?._reloadSource(this.id); // TODO: check if this is needed // seems NOT
	// }

	// onAdd(map: mapboxgl.Map): void {}
	// onRemove(map: mapboxgl.Map): void {}
	// unloadTile(tile: XYZ): void { }
	// hasTile(tile: XYZ): boolean { }
}
