import mapboxgl from 'mapbox-gl';

import { type XYZ, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxDate, type WxVars, type WxTileInfo, type WxLngLat, WxLayerOptions } from '../wxlayer/wxlayer';
import { WxImplementation, type WxLayerAPI } from '../wxlayer/WxImplementation';
import { FrameworkOptions } from './wxsourcetypes';
import { type WxRasterData } from '../wxlayer/painter';

/**
 * A custom source implementation.
 * It is used to load and display weather data from the WxTiles server.
 */
export class WxTileSource extends WxImplementation implements WxLayerAPI, mapboxgl.CustomSourceInterface<any> {
	readonly id: string; // MAPBOX API
	readonly type: 'custom' = 'custom'; // MAPBOX API
	readonly dataType: 'raster' = 'raster'; // MAPBOX API
	readonly tileSize: number = 256; // MAPBOX API only 256
	readonly maxzoom?: number; // MAPBOX API
	readonly bounds?: [number, number, number, number]; // MAPBOX API
	readonly attribution?: string; // MAPBOX API

	// Wx implementation
	protected redrawRequested?: Promise<void>;

	/**
	 *
	 * @param wxlayeroptions - The options for the WxTileSource.
	 * @param frameworkOptions - The options for the framework.
	 */
	constructor(wxlayeroptions: WxLayerOptions, { id, maxzoom, bounds, attribution }: FrameworkOptions) {
		super(wxlayeroptions);
		WXLOG('WxTileSource constructor: ', wxlayeroptions);
		this.id = id; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.bounds = bounds || wxlayeroptions.wxdatasetManager.getBoundaries180(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.
		this.attribution = attribution; // MAPBOX API
	} // constructor

	/**
	 * @description Get comprehensive information about the current point on map.
	 * @param lnglat - Coordinates of the point.
	 * @param  anymap - map instance.
	 * @returns {WxTileInfo | undefined } 
	 */
	getLayerInfoAtLatLon(lnglat: WxLngLat, anymap: any): WxTileInfo | undefined {
		WXLOG(`WxTileSource getLayerInfoAtLatLon (${this.layer.wxdatasetManager.datasetName})`, lnglat);
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
	 * @internal
	 * @description Reloads the tiles that are currently visible on the map. Used for time/particles animation.
	 **/
	async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.layer.wxdatasetManager.datasetName})`);
		await this.layer.reloadTiles(this.coveringTiles(), requestInit); // reload tiles with new time
		if (requestInit?.signal?.aborted) {
			WXLOG(`WxTileSource _reloadVisible (${this.layer.wxdatasetManager.datasetName}) aborted`);
			return;
		}

		return this._redrawTiles();
	}

	/**
	 * @internal
	 * @description Get the tiles that are currently visible on the map.
	 * <MBOX API> get assigned by map.addSource */
	coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	/**
	 * @internal
	 * @description reload tiles that are currently visible on the map.
	 * 	<MBOX API> get assigned by map.addSource
	 */
	update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	/**
	 * @internal
	 * @description Used by framework. Creates a representation of a tile for the framework.
	 * @param tile - The tile coordinates to be loaded.
	 * @param requestInit - The request options.
	 * @returns {Promise<Picture>} - A picture of the tile.
	 */
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<any> {
		let raster_data: WxRasterData;
		// try {
		raster_data = await this.layer.loadTile(tile, requestInit);
		// } catch (error) {
		// 	return new ImageData(1, 1);
		// }
		if (!this.animation) return raster_data.ctxFill.canvas;

		this.layer.painter.imprintVectorAnimationLinesStep(raster_data, this.animationSeed);
		return raster_data.ctxStreamLines.canvas; // to shut up TS errors
	} // loadTile

	/**
	 * @internal
	 * @description Used by framework. Cleans up resources used by the source.
	 */
	onRemove(map: any): void {
		WXLOG(`WxTileSource onRemove (${this.layer.wxdatasetManager.datasetName})`);
		this.animation = false;
		this.clearCache();
	} // onRemove
}
