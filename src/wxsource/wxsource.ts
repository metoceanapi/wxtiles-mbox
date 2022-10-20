import mapboxgl from 'mapbox-gl';

import { type WxDataSetManager } from '../wxAPI/WxDataSetManager';
import { type WxColorStyleWeak, WxGetColorStyles, type XYZ, type WxColorStyleStrict, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxDate, WxLayer, type WxVars, type WxTileInfo, type WxLayerAPI } from '../wxlayer/wxlayer';
import { WxVariableMeta } from '../wxAPI/wxAPI';

/**
 * @class WxTileSource
 * @description WxTileSource is a custom source for mapbox-gl-js.
 * It is used to load and display weather data from the WxTiles server.
 * @param {WxDate} time - Initial Time of the data to load.
 * @param {WxVars} vars - Initial variables to load.
 * @param {WxDataSetManager} datasetManager - WxDataSetManager instance.
 * @param {string} wxstyleName - Initial style of the source.
 * @param {'png' | undefined} ext - Tiles extension. png by default
 * @param {string} id - MAPBOX's Id of the source.
 * @param {number | undefined} maxzoom - MAPBOX's Maximum zoom level of the source.
 * @param {string | undefined} scheme - MAPBOX's Scheme of the source.
 * @param {[number, number, number, number] | undefined} bounds - MAPBOX's Bounds of the source.
 * @param {string | undefined} attribution - MAPBOX's Attribution of the source. *
 */
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
	protected readonly layer: WxLayer;
	protected oldMaxZoom?: number = 0;
	protected redrawRequested?: Promise<void>;

	constructor({
		time,
		variables,
		wxdatasetManager,
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
		wxdatasetManager: WxDataSetManager;
		ext?: 'png';
		wxstyleName?: string;

		id: string;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		WXLOG(`WxTileSource constructor (${wxdatasetManager.datasetName})`, { time, variables });
		this.id = id; // MAPBOX API
		this.attribution = attribution; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.scheme = scheme; // MAPBOX API
		this.bounds = bounds || wxdatasetManager.getBoundaries(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.

		this.layer = new WxLayer({ time, variables, wxdatasetManager, ext, wxstyleName });
	} // constructor

	/**
	 * @description Get the metadata of the current variable.
	 * @memberof WxTileSource
	 * @returns {WxVariableMeta} - The metadata of the current variable.
	 */
	getMetadata(): WxVariableMeta {
		WXLOG(`WxTileSource getMetadata (${this.layer.wxdatasetManager.datasetName})`);
		return { ...this.layer.currentMeta };
	}

	/**
	 * @description Get current variables of the source.
	 * @memberof WxTileSource
	 * @returns {WxVars} variables of the source.
	 */
	getVariables(): WxVars {
		WXLOG(`WxTileSource getVariables (${this.layer.wxdatasetManager.datasetName})`);
		return [...this.layer.variables];
	}

	/**
	 * @description Clears the cache of the source.
	 * @memberof WxTileSource
	 */
	clearCache(): void {
		WXLOG(`WxTileSource ${this.layer.wxdatasetManager.datasetName} clearCache`);
		this.layer.clearCache();
	}

	/**
	 * @description Get a copy of the current style of the source.
	 * @memberof WxTileSource
	 * @returns {WxColorStyleStrict} A copy of the current style of the source.
	 */
	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		WXLOG(`WxTileSource getCurrentStyleObjectCopy (${this.layer.wxdatasetManager.datasetName})`);
		return this.layer.getCurrentStyleObjectCopy();
	}

	/**
	 * @description Get the current time of the source.
	 * @memberof WxTileSource
	 * @returns {string} The current time of the source.
	 */
	getTime(): string {
		WXLOG(`WxTileSource ${this.layer.wxdatasetManager.datasetName} getTime `);
		return this.layer.getTime();
	}

	/**
	 * @description Set time and render the source. If the time is not available, the closest time will be used.
	 * @memberof WxTileSource
	 * @param  {WxDate} time - Time to set.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when the time is set.
	 */
	async setTime(time?: WxDate, requestInit?: WxRequestInit): Promise<string> {
		WXLOG(`WxTileSource ${this.layer.wxdatasetManager.datasetName} setTime: ${time}`);
		const oldtime = this.layer.getTime();
		this.layer.setURLsAndTime(time);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this.layer.setURLsAndTime(oldtime); // restore old time and URLs
		return this.layer.getTime();
	}

	/**
	 * @description Cache tiles for faster rendering for {setTime}. If the time is not available, the closest time will be used.
	 * @memberof WxTileSource
	 * @param  {WxDate} time - Time to preload.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when finished preload.
	 */
	async preloadTime(time: WxDate, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource ${this.layer.wxdatasetManager.datasetName} preloadTime: ${time}`);
		return this.layer.preloadTime(time, this.coveringTiles(), requestInit);
	}

	/**
	 * @description Get comprehencive information about the current point on map.
	 * @memberof WxTileSource
	 * @param {WxLngLat} lnglat - Coordinates of the point.
	 * @param {any} anymap - map instance.
	 * @returns {WxTileInfo | undefined } Information about the current point on map. Undefined if NODATA
	 */
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

	/**
	 * @description Starts the animation of the source (wind, currents).
	 * @memberof WxTileSource
	 */
	startAnimation(): void {
		if (this.animation) return;
		WXLOG(`WxTileSource startAnimation (${this.layer.wxdatasetManager.datasetName})`);
		this.animation = true;
		const animationStep = async (seed: number) => {
			WXLOG(`WxTileSource animationStep (${this.layer.wxdatasetManager.datasetName})`);
			if (!this.animation || this.layer.nonanimatable) {
				this.animation = false;
				return;
			}

			this.animationSeed = seed;
			await this._redrawTiles();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	/**
	 * @description Stops the animation.
	 * @memberof WxTileSource
	 */
	async stopAnimation(): Promise<void> {
		WXLOG(`WxTileSource stopAnimation (${this.layer.wxdatasetManager.datasetName})`);
		this.animation = false;
		return this._redrawTiles();
	}

	/** set coarse maximum zoom level to make tiles load faster during animation */
	async setCoarseLevel(level: number = 2): Promise<void> {
		WXLOG(`WxTileSource setCoarseLevel (${this.layer.wxdatasetManager.datasetName})`, { level });
		this.oldMaxZoom = this.layer.wxdatasetManager.meta.maxZoom;
		this.layer.wxdatasetManager.meta.maxZoom = Math.max(this.oldMaxZoom - level, 1);
		return this._reloadVisible();
	}

	/** restore maximum zoom level */
	async unsetCoarseLevel(): Promise<void> {
		WXLOG(`WxTileSource unsetCoarseLevel (${this.layer.wxdatasetManager.datasetName})`);
		if (this.oldMaxZoom) {
			this.layer.wxdatasetManager.meta.maxZoom = this.oldMaxZoom;
			return this._reloadVisible();
		}
	}

	/**
	 * @description Set the style of the source by its name from default styles.
	 * @memberof WxTileSource
	 * @param {string} wxstyleName - Name of the new style to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async setStyleByName(wxstyleName: string, reload: boolean = true): Promise<void> {
		WXLOG(`WxTileSource ${this.layer.wxdatasetManager.datasetName} setStyleByName: ${wxstyleName}`);
		return this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	/**
	 * @description
	 * @memberof WxTileSource
	 * @param {WxColorStyleWeak | undefined} style - Style's fields to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async updateCurrentStyleObject(style?: WxColorStyleWeak, reload = true, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource updateCurrentStyleObject(${this.layer.wxdatasetManager.datasetName})`, { style });
		this.layer.updateCurrentStyleObject(style);
		if (reload) return this._reloadVisible(requestInit);
	}

	protected async _reloadVisible(requestInit?: { signal?: AbortSignal }): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.layer.wxdatasetManager.datasetName})`);
		await this.layer.reloadTiles(this.coveringTiles(), requestInit);
		
		if (!requestInit?.signal?.aborted) this._redrawTiles();
	}

	protected _redrawTiles(): Promise<void> {
		if (this.redrawRequested) return this.redrawRequested;
		this.redrawRequested = new Promise((resolve) => {
			requestAnimationFrame(() => {
				WXLOG(`WxTilesLayer _redrawTiles (${this.layer.wxdatasetManager.datasetName})`);

				this.update();

				resolve();
				this.redrawRequested = undefined;
			});
		});

		return this.redrawRequested;
	} // _redrawTiles

	// MBOX API get assigned by map.addSource
	protected coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	// MBOX API get assigned by map.addSource
	protected update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	/*MB API*/
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<any> {
		const raster_data = await this.layer.loadTile(tile, requestInit);
		if (!this.animation) return raster_data.ctxFill.canvas;

		this.layer.painter.imprintVectorAnimationLinesStep(raster_data, this.animationSeed);
		return raster_data.ctxStreamLines.canvas; // to shut up TS errors
	} // loadTile
}
