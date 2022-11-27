/**
 * Framework dependent source type to be inherited by the framework dependent custom source type.
 * Mapbox does not provide a parent type for the custom source.
 * Leaflet provides a parent type for the custom layer to inherit from L.GridLayer.
 * Used as universal type for the custom source parent class. see {@link WxTileSource}
 */
export class FrameworkParentClass {
	/**
	 * @param {FrameworkOptions} options - Framework's basic options to construct the layer.
	 */
	constructor(options?: any) {}
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
