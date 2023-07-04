import mapboxgl from 'mapbox-gl';

import { type XYZ, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxTileInfo, type WxLngLat, type WxLayerOptions } from '../wxlayer/wxlayer';
import { WxLayerBaseImplementation, type WxLayerAPI } from '../wxlayer/WxImplementation';
import { type FrameworkOptions } from './wxsourcetypes';
import { type WxRasterData } from '../wxlayer/painter';
import { WxDataSetManager } from '../wxAPI/WxDataSetManager';
import type { ListenerMethod, WxEventType } from '../wxlayer/WxImplementation';

/**
 * A custom layer source implementation
 * It is used to load and display weather data from the WxTiles server.
 * **NOTE**
 * Dont use this  directly, use {@link WxDataSetManager.createSourceLayer} instead
 * @example
 * ```ts
	const wxapi = new WxAPI({ 'http://dataserver.com' });
	
	// Create a dataset manager (may be used for many layers from this dataset)
	const datasetName = 'gfs.global';
	const wxdatasetManager = await wxapi.createDatasetManager(datasetName);
	
	// create a layer source
	// Scalar example.For vector variables use either of the vector components (e.g. 'wind.eastward.at-10m')
	const variable = 'air.temperature.at-2m'; 
	const wxsource = wxdatasetManager.createSourceLayer({ variable }, { id: 'wxsource', attribution: 'WxTiles' }); //new WxTileSource(wxLayerOptions, mboxSourceOptions);
 * ```
 */
export class WxTileSource extends WxLayerBaseImplementation implements WxLayerAPI, mapboxgl.CustomSourceInterface<any> {
	/**
	 * @ignore
	 * evented listeners
	 * */
	protected _listeners: { [eventName: string]: ListenerMethod[] | undefined } = {};

	/**
	 * @internal
	 * @param {WxLayerOptions} wxLayerOptions - The options for the {@link WxLayerBaseImplementation}.
	 * @param {FrameworkOptions} frwOptions - The options for the framework.
	 */
	constructor(wxLayerOptions: WxLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxTileSource.constructor (id=${frwOptions.id})`);
		super(wxLayerOptions, frwOptions);
	} // constructor

	/**
	 * Get comprehensive information about the current point on map.
	 * @param {WxLngLat} lnglat - Coordinates of the point.
	 * @param {any} anymap - map instance.
	 * @returns {WxTileInfo | undefined }
	 * */
	getLayerInfoAtLatLon(lnglat: WxLngLat, anymap: any): WxTileInfo | undefined {
		// WXLOG(`WxTileSource getLayerInfoAtLatLon (${this.id})`, lnglat);
		const worldsize = anymap.transform.worldSize as number;
		const zoom = Math.round(Math.log2(worldsize) - 8);
		const tilesize = worldsize / (2 << (zoom - 1));
		const mapPixCoord = anymap.transform.project(lnglat) as mapboxgl.Point;
		const tileCoord = mapPixCoord.div(tilesize);
		tileCoord.x = Math.floor(tileCoord.x);
		tileCoord.y = Math.floor(tileCoord.y);
		const tilePixel_ = mapPixCoord.sub(tileCoord.mult(tilesize)); // tile pixel coordinates
		const tilePixel = tilePixel_.mult(255 / tilesize).round(); // convert to 256x256 pixel coordinates
		return this._layer.getTileData({ x: tileCoord.x, y: tileCoord.y, z: zoom }, tilePixel);
	}

	/**
	 * @ignore
	 * Reloads the visible tiles with new data. Used for time/particles animation.
	 * @param {WxRequestInit} requestInit The request options.
	 * @returns {Promise<void>} A promise that resolves when the tiles have been reloaded and redrawn.
	 */
	async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.id})`);
		await this._layer.reloadTiles(this.coveringTiles(), requestInit); // reload tiles with new time
		if (requestInit?.signal?.aborted) {
			WXLOG(`WxTileSource _reloadVisible (${this.id}) aborted`);
			return;
		}

		return this._redrawTiles();
	}

	/**
	 * @ignore
	 * Returns an array of tile coordinates that cover the visible portion of the map.
	 * **Note**: MBOX API reassign this func in "map.addSource"
	 * @returns {XYZ[]} - An array of tile coordinates.
	 */
	coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	/**
	 * @ignore
	 * Updates/reloads the source layer with new data.
	 * **Note**: MBOX API reassign this func in "map.addSource"
	 * @returns {void}
	 */
	update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	needUpdateDSManager: boolean = false;

	/**
	 * @internal
	 * Loads a tile with the given coordinates and request options.
	 * Used by framework. Creates a representation of a tile for the framework.
	 * It rethrows 'AbortError' errors.
	 * It returns empty tile during datasetManager update or in case of any other error (e.g. network error, not found, etc.)
	 * It tries to update datasetManager if e.reason === 'instance-not-found' and update the layer
	 *
	 * @param {XYZ} coords - The tile coordinates to be loaded.
	 * @param {WxRequestInit} requestInit - The request options.
	 * @returns {Promise<any>} - A promise that resolves with the loaded tile.
	 */
	async loadTile(coords: XYZ, requestInit?: WxRequestInit): Promise<any> {
		if (this.needUpdateDSManager) {
			// return empty tile during datasetManager update
			// After update is complete, the framework will try to reload all tiles again
			return new ImageData(1, 1);
		}

		let raster_data: WxRasterData | null = null;

		try {
			raster_data = await this._layer.loadTile(coords, requestInit);
		} catch (e) {
			// it's ok if the tile is not found. Just return empty tile, or...

			// ...or, rethrow 'AbortError' errors to the framework to handle
			if (e.name === 'AbortError') {
				throw e;
			}

			// ...or, if the loadImage throws with 'reason' is 'instance-not-found', try to update wxdatasetManager, then update the layer
			if (e.reason === 'instance-not-found') {
				// if we a re in the middle of updating wxdatasetManager (others may initiate update as well)
				if (this.needUpdateDSManager) {
					// return empty tile
					return new ImageData(1, 1);
				}

				this.needUpdateDSManager = true;
				WXLOG(`WxTileSource.loadTile (${this.id}) instance-not-found. Trying to update wxdatasetManager and load again.`);
				// try to update wxdatasetManager. No need to await for it to finish
				this.wxdatasetManager
					.update() // attempt to update wxdatasetManager
					.then(() => {
						this.needUpdateDSManager = false;
						this.setTime(this.getTime()) // reload tiles with new time close to the current time
							.then(() => this._fire('changed', this)); // and fire 'changed' event
					}) // update wxdatasetManager
					.catch((e) => {
						// it leaves needUpdateDSManager = true, so the layer will appear empty after failed update.
						WXLOG(`WxTileSource.loadTile (${this.id}) instance-not-found. wxdatasetManager update failed.`, e);
					});
			} // if (e.reason === 'instance-not-found')
		} // catch loadTile error

		return raster_data ? this._layer.getPaintedCanvas(raster_data, this._animation, this._animationSeed) : new ImageData(1, 1);
	} // loadTile

	/**
	 * @internal
	 * Used by framework. Cleans up resources used by the source.
	 */
	onRemove(map: any): void {
		WXLOG(`WxTileSource onRemove (${this.id})`);
		this._animation = false;
		this.clearCache();
	} // onRemove

	// evented methods
	/**
	 * add a listener for the event
	 * @param {string} type - event name
	 * @param {ListenerMethod} listener - listener function
	 * @returns {this}
	 * */
	on<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// push listener to the list of listeners
		(this._listeners[type] ||= []).push(listener);
	}

	off<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// remove listener from the list of listeners
		this._listeners[type] = this._listeners[type]?.filter((l) => l !== listener);
	}

	once<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// push listener to the list of listeners
		const onceListener = (...args: any[]) => {
			listener(...args);
			this.off(type, onceListener);
		};

		this.on(type, onceListener);
	}

	protected _fire<T extends keyof WxEventType>(type: T, data: WxEventType[T]) {
		// fire runs all listeners asynchroniously, so my algos don't stuck
		// call all listeners for the type
		this._listeners[type]?.forEach(async (l) => l(data));
	}
}
