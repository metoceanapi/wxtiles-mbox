/**
 * Leaflet's or Mapbox's class to inherit from when creating a new layer type.
 */
export class FrameworkParentClass {
	/**
	 * @param {FrameworkOptions} options - Framework's basic options to construct the layer.
	 */
	constructor(options?: any) {}
}

/**
 * Framework's basic options to construct the layer.
 */
export interface FrameworkOptions {
	id: string; // MAPBOX API
	maxzoom?: number; // MAPBOX API
	bounds?: [number, number, number, number]; // MAPBOX API
	attribution?: string; // MAPBOX API
} // Leaflet
