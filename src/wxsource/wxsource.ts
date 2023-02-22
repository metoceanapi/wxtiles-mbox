import mapboxgl from 'mapbox-gl';

import { type XYZ, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxTileInfo, type WxLngLat, WxLayerOptions } from '../wxlayer/wxlayer';
import { WxLayerBaseImplementation, type WxLayerAPI } from '../wxlayer/WxImplementation';
import { FrameworkOptions } from './wxsourcetypes';
import { type WxRasterData } from '../wxlayer/painter';
import type { WxDataSetManager, WxSourceLayerOptions } from '../wxAPI/WxDataSetManager';

/**
 * A custom layer source implementation
 * It is used to load and display weather data from the WxTiles server.
 * **NOTE**
 * Dont use this  directly, use {@link WxDataSetManager.createSourceLayer},  {@link WxSourceLayerOptions} and {@link FrameworkOptions} instead
 * @example
 * ```ts
	const wxapi = new WxAPI({ 'http://dataserver.com' });
	
	// Create a dataset manager (may be used for many layers from this dataset)
	const datasetName = 'gfs.global';
	const wxdatasetManager = await wxapi.createDatasetManager(datasetName);
	
	// create a layer source
	// Scalar example.For ve ctor variables use either of the vector components (e.g. 'wind.eastward.at-10m')
	const variable = 'air.temperature.at-2m'; 
	const wxsource = wxdatasetManager.createSourceLayer({ variable }, { id: 'wxsource', attribution: 'WxTiles' }); //new WxTileSource(wxLayerOptions, mboxSourceOptions);
 * ```
 */
export class WxTileSource extends WxLayerBaseImplementation implements WxLayerAPI, mapboxgl.CustomSourceInterface<any> {
	/**
	 *
	 * @param {WxLayerOptions} wxLayerOptions - The options for the {@link WxLayerBaseImplementation}.
	 * @param {FrameworkOptions} frwOptions - The options for the framework.
	 */
	constructor(wxLayerOptions: WxLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxTileSource.constructor (id=${frwOptions.id})`);
		frwOptions.bounds = frwOptions.bounds || wxLayerOptions.wxdatasetManager.getBoundaries180(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.
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
		return this.layer.getTileData({ x: tileCoord.x, y: tileCoord.y, z: zoom }, tilePixel);
	}

	/**
	 * @ignore
	 * Reloads the tiles that are currently visible on the map. Used for time/particles animation.
	 **/
	async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.id})`);
		await this.layer.reloadTiles(this.coveringTiles(), requestInit); // reload tiles with new time
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
	 * @description reload tiles that are currently visible on the map.
	 * 	<MBOX API> get assigned by map.addSource
	 */
	update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	/**
	 * @internal
	 * Used by framework. Creates a representation of a tile for the framework.
	 * @param tile - The tile coordinates to be loaded.
	 * @param requestInit - The request options.
	 * @returns {Promise<Picture>} - A picture of the tile.
	 */
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<any> {
		let raster_data: WxRasterData | null = null;
		try {
			raster_data = await this.layer.loadTile(tile, requestInit);
		} catch (_) {
			// do nothing. Just no tile on the server But we have to catch the case for the mapbox-gl-js
		}

		return raster_data ? this.layer.painter.getPaintedCanvas(raster_data, this.animation, this.animationSeed) : new ImageData(1, 1);
	} // loadTile

	/**
	 * @internal
	 * @description Used by framework. Cleans up resources used by the source.
	 */
	onRemove(map: any): void {
		WXLOG(`WxTileSource onRemove (${this.id})`);
		this.animation = false;
		this.clearCache();
	} // onRemove
}
