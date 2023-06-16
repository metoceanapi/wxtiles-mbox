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

	//protected async _loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<WxRasterData | null> {}

	needUpdateDSManager: boolean = false;
	needUpdateCycle: number = 0;
	/**
	 * @internal
	 * Used by framework. Creates a representation of a tile for the framework.
	 * @param coords - The tile coordinates to be loaded.
	 * @param requestInit - The request options.
	 * @returns {Promise<Picture>} - A picture of the tile.
	 */
	async loadTile(coords: XYZ, requestInit?: WxRequestInit): Promise<any> {
		let raster_data: WxRasterData | null = null;

		if (!this.needUpdateDSManager) {
			// if we a re not in the middle of updating wxdatasetManager
			// try to  load tile
			try {
				raster_data = await this._layer.loadTile(coords, requestInit);
				this.needUpdateCycle = 0;
			} catch (e) {
				// can be rejected if the tile does not exist or loading aborted
				if (e.name === 'AbortError') throw e; // re-throw abort in case MapBox wants to handle it
				if (e.reason === 'instance-not-found') {
					// process new instances
					if (this.needUpdateCycle > 1) {
						// panic!! we're in the infinite loop
						WXLOG(`WxTileSource loadTile (${this.id}) instance-not-found. Tried to update wxdatasetManager and load again, but failed. Aborting.`);
						throw 'panic';
					}

					if (!this.needUpdateDSManager) {
						// if we a re not in the middle of updating wxdatasetManager (others may initiate update as well)
						this.needUpdateDSManager = true;
						this.needUpdateCycle++;
						WXLOG(`WxTileSource loadTile (${this.id}) instance-not-found. Trying to update wxdatasetManager and load again.`);
						// try to update wxdatasetManager. No need to await for it to finish
						this.wxdatasetManager.update().then(() => {
							this.needUpdateDSManager = false;
							this.setTime(this.getTime()).then(() => this._fire('changed', this)); // reload tiles with new time (instead of this._reloadVisible)
						}); // update wxdatasetManager
					} // if (!this.needUpdateDSManager)
				} // if (e.reason === 'instance-not-found')
			} // catch loadTile error
		} // if (!this.needUpdateDSManager)

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
