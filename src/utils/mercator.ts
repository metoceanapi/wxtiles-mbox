/**
 * @fileoverview This file contains utility functions for converting between different coordinate systems.
 * It includes functions for converting between latitude/longitude coordinates in the WGS84 Datum and XY coordinates in the Spherical Mercator EPSG:900913 projection.
 * It also includes functions for converting between pixel coordinates in a given zoom level of a pyramid and EPSG:900913 coordinates.
 * Finally, it includes functions for converting between pixel coordinates in a given zoom level and latitude/longitude coordinates in the WGS84 Datum.
 */
const tileSize = 256;
const initialResolution = (2 * Math.PI * 6378137) / tileSize;
const originShift = (2 * Math.PI * 6378137) / 2;

/**
 * Converts given latitude and longitude in WGS84 Datum to the X and Y values in meters.
 * @param lat - The latitude value in degrees.
 * @param lon - The longitude value in degrees.
 * @returns An array of two numbers representing the X and Y values in meters.
 */
function LatLonToMeters(lat: number, lon: number): [number, number] {
	let x = (lon * originShift) / 180;
	let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
	y = (y * originShift) / 180;
	return [x, y];
}

/**
 * Converts given XY point in meters to latitude and longitude in WGS84 Datum.
 * @param x - The X value in meters.
 * @param y - The Y value in meters.
 * @returns An array of two numbers representing the latitude and longitude values in degrees.
 */
function MetersToLatLon(x: number, y: number): [number, number] {
	let lon = (x / originShift) * 180;
	let lat = (y / originShift) * 180;
	lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
	return [lat, lon];
}

/**
 * Converts pixel coordinates in a given zoom level of a pyramid to EPSG:900913.
 * @param px - The X value in pixels.
 * @param py - The Y value in pixels.
 * @param zoom - The zoom level.
 * @returns An array of two numbers representing the X and Y values in meters.
 */
function PixelsToMeters(px: number, py: number, zoom: number): [number, number] {
	const res = Resolution(zoom);
	const x = px * res - originShift;
	const y = py * res - originShift;
	return [x, y];
}

/**
 * Converts meters to pixel coordinates in a given zoom level.
 * @param x - The X value in meters.
 * @param y - The Y value in meters.
 * @param zoom - The zoom level.
 * @returns An array of two numbers representing the X and Y values in pixels.
 */
function MetersToPixels(x: number, y: number, zoom: number): [number, number] {
	const res = Resolution(zoom);
	const px = (x + originShift) / res;
	const py = (y + originShift) / res;
	return [px, py];
}

/**
 * Calculates the resolution (meters/pixel) for a given zoom level (measured at Equator).
 * @param zoom - The zoom level.
 * @returns The resolution in meters/pixel.
 */
function Resolution(zoom: number): number {
	return initialResolution / 2 ** zoom;
}

/**
 * Converts given latitude and longitude in WGS84 Datum to pixel coordinates in a given zoom level.
 * @param lat - The latitude value in degrees.
 * @param lon - The longitude value in degrees.
 * @param zoom - The zoom level.
 * @returns An array of two numbers representing the X and Y values in pixels.
 */
export function LatLonToPixels(lat: number, lon: number, zoom: number): [number, number] {
	const [x, y] = LatLonToMeters(lat, lon);
	return MetersToPixels(x, y, zoom);
}

/**
 * Converts pixel coordinates in a given zoom level to latitude and longitude in WGS84 Datum.
 * @param px - The X value in pixels.
 * @param py - The Y value in pixels.
 * @param zoom - The zoom level.
 * @returns An array of two numbers representing the latitude and longitude values in degrees.
 */
export function PixelsToLatLon(px: number, py: number, zoom: number): [number, number] {
	const [x, y] = PixelsToMeters(px, py, zoom);
	return MetersToLatLon(x, y);
}

/**
 * Converts pixel coordinates in a given zoom level to longitude and latitude in WGS84 Datum.
 * @param px - The X value in pixels.
 * @param py - The Y value in pixels.
 * @param zoom - The zoom level.
 * @returns An array of two numbers representing the longitude and latitude values in degrees.
 */
export function PixelsToLonLat(px: number, py: number, zoom: number): [number, number] {
	const [lat, lon] = MetersToLatLon(...PixelsToMeters(px, py, zoom));
	return [lon, -lat];
}

/**
 * Converts given coordinates to pixel coordinates.
 * @param x - The X value.
 * @param y - The Y value.
 * @returns An array of two numbers representing the X and Y values in pixels.
 */
export function coordToPixel(x: number, y: number) {
	return [x * tileSize, y * tileSize];
}
