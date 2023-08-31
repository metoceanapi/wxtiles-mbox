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
	 * Creates a new instance of the `WxTileSource` class.
	 * @internal
	 * @constructor
	 * @param {WxLayerOptions} wxLayerOptions - The options for the {@link WxLayerBaseImplementation}.
	 * @param {FrameworkOptions} frwOptions - The options for the framework.
	 */
	constructor(wxLayerOptions: WxLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxTileSource.constructor (id=${frwOptions.id})`);
		super(wxLayerOptions, frwOptions);
	} // constructor

	/**
	 * Get comprehensive information about the current point on the map.
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
	 * Reloads the visible tiles with new data. Used for time/particles animation.
	 * @ignore
	 * @param {WxRequestInit} requestInit The request options.
	 * @returns {Promise<void>} A promise that resolves when the tiles have been reloaded and redrawn.
	 */
	async _reloadVisible(requestInit?: WxRequestInit, redraw: boolean = true): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.id})`);
		await this._layer.reloadTiles(this.coveringTiles(), requestInit); // reload tiles with new time
		if (requestInit?.signal?.aborted) {
			WXLOG(`WxTileSource _reloadVisible (${this.id}) aborted`);
			return;
		}

		return redraw ? this._redrawTiles() : Promise.resolve();
	}

	/**
	 * Returns an array of tile coordinates that cover the visible portion of the map.
	 * **Note**: MBOX API reassign this func in "map.addSource"
	 * @ignore
	 * @returns {XYZ[]} - An array of tile coordinates.
	 */
	coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	/**
	 * Updates/reloads the source layer with new data.
	 * **Note**: MBOX API reassign this func in "map.addSource"
	 * @ignore
	 * @returns {void}
	 */
	update(): void {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	/**
	 * Loads a tile with the given coordinates and request options.
	 * Used by framework. Creates a representation of a tile for the framework.
	 * It rethrows 'AbortError' errors.
	 * It returns empty tile during datasetManager update or in case of any other error (e.g. network error, not found, etc.)
	 * It tries to update datasetManager if e.reason === 'instance-not-found' and update the layer
	 *
	 * @internal
	 * @param {XYZ} coords - The tile coordinates to be loaded.
	 * @param {WxRequestInit} requestInit - The request options.
	 * @returns {Promise<any>} - A promise that resolves with the loaded tile.
	 */
	async loadTile(coords: XYZ, requestInit?: WxRequestInit): Promise<any> {
		const raster_data = await this._loadTileHelper(coords, requestInit);
		return raster_data ? this._layer.getPaintedCanvas(raster_data, this._animation, this._animationSeed) : new ImageData(1, 1);
	} // loadTile

	/**
	 * Called when the layer is removed from the map.
	 * @internal
	 * @param {any} map - The map instance.
	 * @returns {void}
	 */
	onRemove(map: any): void {
		WXLOG(`WxTileSource onRemove (${this.id})`);
		this._animation = false;
		this.clearCache();
	} // onRemove
}
