import mapboxgl from 'mapbox-gl';

import { type WxDataSetManager } from '../wxAPI/WxDataSetManager';
import { type WxColorStyleWeak, WxGetColorStyles, type XYZ, type WxColorStyleStrict, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxDate, WxLayer, type WxVars, type WxTileInfo, type WxLngLat, WxLayerOptions } from '../wxlayer/wxlayer';
import { WxVariableMeta } from '../wxAPI/wxAPI';
import { WxImplementation, type WxLayerAPI } from '../wxlayer/WxImplementation';
import { FrameworkOptions } from './wxsourcetypes';
import { type WxRasterData } from '../wxlayer/painter';

/**
 * @class WxTileSource
 * @description WxTileSource is a custom source for mapbox-gl-js.
 * It is used to load and display weather data from the WxTiles server.
 * @param {WxDate} time - Initial Time of the data to load.
 * @param {WxVars} vars - Initial variables to load.
 * @param {WxDataSetManager} datasetManager - WxDataSetManager instance.
 * @param {string} wxstyleName - Initial style of the source.
 * @param {string} id - MAPBOX's Id of the source.
 * @param {number | undefined} maxzoom - MAPBOX's Maximum zoom level of the source.
 * @param {[number, number, number, number] | undefined} bounds - MAPBOX's Bounds of the source.
 * @param {string | undefined} attribution - MAPBOX's Attribution of the source. *
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

	constructor(wxlayeroptions: WxLayerOptions, { id, maxzoom, bounds, attribution }: FrameworkOptions) {
		super(wxlayeroptions);
		WXLOG('WxTileSource constructor: ', wxlayeroptions);
		this.id = id; // MAPBOX API
		this.maxzoom = maxzoom; // MAPBOX API
		this.bounds = bounds || wxlayeroptions.wxdatasetManager.getBoundaries(); // MAPBOX API let mapbox manage boundaries, but not all cases are covered.
		this.attribution = attribution; // MAPBOX API
	} // constructor

	/**
	 * @description Get comprehencive information about the current point on map.
	 * @memberof WxTileSource
	 * @param {WxLngLat} lnglat - Coordinates of the point.
	 * @param {any} anymap - map instance.
	 * @returns {WxTileInfo | undefined } Information about the current point on map. Undefined if NODATA
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

	async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource _reloadVisible (${this.layer.wxdatasetManager.datasetName})`);
		await this.layer.reloadTiles(this.coveringTiles(), requestInit); // reload tiles with new time
		if (requestInit?.signal?.aborted) {
			WXLOG(`WxTileSource _reloadVisible (${this.layer.wxdatasetManager.datasetName}) aborted`);
			return;
		}

		return this._redrawTiles();
	}

	// MBOX API get assigned by map.addSource
	coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	// MBOX API get assigned by map.addSource
	update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	/*MB API*/
	async loadTile(tile: XYZ, requestInit?: WxRequestInit): Promise<any> {
		let raster_data: WxRasterData;
		try {
			raster_data = await this.layer.loadTile(tile, requestInit);
		} catch (error) {
			return new ImageData(1, 1);
		}
		if (!this.animation) return raster_data.ctxFill.canvas;

		this.layer.painter.imprintVectorAnimationLinesStep(raster_data, this.animationSeed);
		return raster_data.ctxStreamLines.canvas; // to shut up TS errors
	} // loadTile
}
