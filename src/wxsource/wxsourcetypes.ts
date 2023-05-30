import { WXLOG } from '../utils/wxtools';

/**
 * Framework dependent source type to be inherited by the framework dependent custom source type.
 * Mapbox does not provide a parent type for the custom source.
 * Leaflet provides a parent type for the custom layer to inherit from L.GridLayer.
 * Used as universal type for the custom source parent class. see {@link WxTileSource}
 */
export class FrameworkParentClass {
	/** MAPBOX API required */
	readonly id: string;
	/** MAPBOX API required */
	readonly type: 'custom' = 'custom';
	/** MAPBOX API required */
	readonly dataType: 'raster' = 'raster';
	/** MAPBOX API required. only 256 */
	readonly tileSize: number = 256;
	/** MAPBOX API */
	readonly maxzoom?: number;
	/** MAPBOX API */
	readonly bounds?: [number, number, number, number];
	/** MAPBOX API */
	readonly attribution?: string;

	/**
	 * @param {FrameworkOptions} frwOptions - Framework's basic options to construct the layer.
	 */
	constructor(frwOptions: FrameworkOptions) {
		WXLOG(`FrameworkParentClass.constructor frwOptions: ${JSON.stringify(frwOptions)}`);
		this.id = frwOptions.id;
		this.maxzoom = frwOptions.maxzoom;
		this.bounds = frwOptions.bounds;
		this.attribution = frwOptions.attribution;
	}
}

/**
 * Framework's basic options to construct the layer.
 * @example
 * ```ts
 *  const options = {
 * 	id: 'wxlayer',
 * 	bounds: [ -180, -90, 180, 90 ],
 * 	attribution: 'WxTiles',
 * };
 * ```
 */
export interface FrameworkOptions {
	id: string; // MAPBOX API
	maxzoom?: number; // MAPBOX API
	bounds?: [number, number, number, number]; // MAPBOX API
	attribution?: string; // MAPBOX API
}
