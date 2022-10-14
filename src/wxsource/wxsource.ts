import mapboxgl from 'mapbox-gl';

import { type WxDataSetManager } from '../wxAPI/wxAPI';
import { type ColorStyleWeak, WxGetColorStyles, type XYZ, type ColorStyleStrict } from '../utils/wxtools';
import { type RInit, type WxDate, WxLayer, type WxVars, type WxTileInfo, type WxLayerAPI } from '../wxlayer/wxlayer';

export class WxTileSource implements WxLayerAPI, mapboxgl.CustomSourceInterface<any> {
	readonly id: string; // MAPBOX API
	readonly type: 'custom' = 'custom'; // MAPBOX API
	readonly dataType: 'raster' = 'raster'; // MAPBOX API
	readonly tileSize: number = 256; // MAPBOX API only 256
	readonly maxzoom?: number; // MAPBOX API
	readonly scheme?: string; // MAPBOX API
	readonly bounds?: [number, number, number, number]; // MAPBOX API
	readonly attribution?: string; // MAPBOX API

	// Wx implementation
	protected animation = false;
	protected animationSeed = 0;
	readonly layer: WxLayer;

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
		time?: WxDate;
		variables: WxVars;
		wxdataset: WxDataSetManager;
		ext?: string;
		wxstyleName?: string;

		id: string;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		this.id = id; // MAPBOX API
		this.attribution = attribution; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.scheme = scheme; // MAPBOX API
		this.bounds = bounds || wxdataset.getBoundaries(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.

		this.layer = new WxLayer({ time, variables, wxdataset, ext, wxstyleName });
	}

	// Layer wrap
	clearCache(): void {
		this.layer.clearCache();
	}

	// Layer wrap
	getCurrentStyleObjectCopy(): ColorStyleStrict {
		return this.layer.getCurrentStyleObjectCopy();
	}

	// Layer wrap
	getTime(): string {
		return this.layer.getTime();
	}

	async setTime(time_?: WxDate, requestInit?: RInit): Promise<string> {
		const oldtime = this.layer.getTime();
		this.layer.setURLsAndTime(time_);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this.layer.setURLsAndTime(oldtime); // restore old time and URLs
		return this.layer.getTime();
	}

	async preloadTime(time_: WxDate, requestInit?: RInit): Promise<void> {
		return this.layer.preloadTime(time_, this.coveringTiles(), requestInit);
	}

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
		return this.layer.getTileData({ x: tileCoord.x, y: tileCoord.y, z: zoom }, tilePixel);
	}

	stopAnimation(): void {
		this.animation = false;
	}

	startAnimation(): void {
		if (this.animation) return;
		this.animation = true;
		const animationStep = (seed: number) => {
			if (!this.animation || this.layer.variables.length < 2 || this.layer.style.streamLineStatic || this.layer.style.streamLineColor === 'none') {
				this.animation = false;
				return;
			}

			this.animationSeed = seed;
			this.update();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	async setStyleByName(wxstyleName: string, reload = true): Promise<void> {
		return this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	async updateCurrentStyleObject(style?: ColorStyleWeak, reload = true, requestInit?: RInit): Promise<void> {
		this.layer.updateCurrentStyleObject(style);
		if (reload) return this._reloadVisible(requestInit);
	}

	protected async _reloadVisible(requestInit?: { signal?: AbortSignal }): Promise<void> {
		await this.layer.reloadTiles(this.coveringTiles(), requestInit);
		if (!requestInit?.signal?.aborted) this.update();
	}

	/*MB API*/
	async loadTile(tile: XYZ, requestInit?: RInit): Promise<any> {
		const raster_data = await this.layer.loadTile(tile, requestInit);
		if (!this.animation) return raster_data.ctxFill.canvas;

		this.layer.painter.imprintVectorAnimationLinesStep(raster_data, this.animationSeed);
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
