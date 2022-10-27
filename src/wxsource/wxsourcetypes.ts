export class FrameworkParentClass {
	constructor(options?: any) {}
}
export interface FrameworkOptions {
	id: string; // MAPBOX API
	maxzoom?: number; // MAPBOX API
	bounds?: [number, number, number, number]; // MAPBOX API
	attribution?: string; // MAPBOX API
} // Leaflet
