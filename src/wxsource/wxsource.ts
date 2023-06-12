import mapboxgl from 'mapbox-gl';

import { type XYZ, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxTileInfo, type WxLngLat, type WxLayerOptions } from '../wxlayer/wxlayer';
import { WxLayerBaseImplementation, type WxLayerAPI } from '../wxlayer/WxImplementation';
import { type FrameworkOptions } from './wxsourcetypes';
import { type WxRasterData } from '../wxlayer/painter';
import { WxDataSetManager } from '../wxAPI/WxDataSetManager';

export type ListenerMethod = <T extends keyof WxEventType>(arg?: WxEventType[T]) => void;

export type WxEventType = {
	changed: void;
};

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
	protected _listeners: { [eventName: string]: ListenerMethod[] } = {};

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
	 * @param map - map instance.
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
	 * Reloads the tiles that are currently visible on the map. Used for time/particles animation.
	 **/
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
	 * Get the tiles that are currently visible on the map.
	 * <MBOX API> get assigned by map.addSource
	 * */
	coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	/**
	 * @ignore
	 * reload tiles that are currently visible on the map.
	 * 	<MBOX API> get assigned by map.addSource
	 */
	update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	loadTileReady?: Promise<any>;
	/**
	 * @internal
	 * Used by framework. Creates a representation of a tile for the framework.
	 * @param tile - The tile coordinates to be loaded.
	 * @param requestInit - The request options.
	 * @returns {Promise<Picture>} - A picture of the tile.
	 */
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<any> {
		if (this.loadTileReady) await this.loadTileReady;
		let raster_data: WxRasterData | null = null;
		try {
			// try to  load tile
			raster_data = await this._layer.loadTile(tile, requestInit);
		} catch (e) {
			if (e.name === 'AbortError') throw e; // re-throw abort in case MapBox wants to handle it
			if (e.reason === 'instance-not-found') {
				this.loadTileReady = new Promise((resolve) => {});
				// TODO: finish processing new instances 'instance-not-found'
				WXLOG(`WxTileSource loadTile (${this.id}) instance-not-found. Trying to update wxdatasetManager and load again.`);
				try {
					await this.wxdatasetManager.update(); // try to update wxdatasetManager
					this.clearCache();
					raster_data = await this._layer.loadTile(tile, requestInit); // try to load again
					this._fire('changed');
				} catch (e) {
					if (e.name === 'AbortError') throw e; // re-throw abort in case MapBox wants to handle it
					if (e.reason === 'instance-not-found') {
						// this time we a re sure that the something is wrong with the dataset
						WXLOG(`WxTileSource loadTile (${this.id}) instance-not-found. Failed to load tile.`, e);
					}
					// this time return AKA null tile
				}
			}
		} finally {
		}

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
	on<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// push listener to the list of listeners
		(this._listeners[type] ||= []).push(listener);
		return this;
	}

	off<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// remove listener from the list of listeners
		if (this._listeners[type]) {
			this._listeners[type] = this._listeners[type].filter((l) => l !== listener);
		}
		return this;
	}

	once<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// push listener to the list of listeners
		const onceListener = (...args: any[]) => {
			listener(...args);
			this.off(type, onceListener);
		};
		this.on(type, onceListener);
		return this;
	}

	protected _fire<T extends keyof WxEventType>(type: T, data?: WxEventType[T]) {
		// fire runs all listeners asynchroniously, so my algos don't stuck
		// call all listeners for the type
		if (this._listeners[type]) {
			this._listeners[type].forEach(async (l) => l(data));
		}
	}
}
