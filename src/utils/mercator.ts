const tileSize = 256;
const initialResolution = (2 * Math.PI * 6378137) / tileSize;
const originShift = (2 * Math.PI * 6378137) / 2;

// LatLonToMeters converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:900913
function LatLonToMeters(lat: number, lon: number): [number, number] {
	let x = (lon * originShift) / 180;
	let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
	y = (y * originShift) / 180;
	return [x, y];
}

// MetersToLatLon converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum
function MetersToLatLon(x: number, y: number): [number, number] {
	let lon = (x / originShift) * 180;
	let lat = (y / originShift) * 180;
	lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
	return [lat, lon];
}

// PixelsToMeters converts Pixel coordinates in given zoom level of pyramid to EPSG:900913
function PixelsToMeters(px: number, py: number, zoom: number): [number, number] {
	const res = Resolution(zoom);
	const x = px * res - originShift;
	const y = py * res - originShift;
	return [x, y];
}

// MetersToPixels converts EPSG:900913 to Pixel coordinates in given zoom level
function MetersToPixels(x: number, y: number, zoom: number): [number, number] {
	const res = Resolution(zoom);
	const px = (x + originShift) / res;
	const py = (y + originShift) / res;
	return [px, py];
}

// Resolution calculates the resolution (meters/Pixel) for given zoom level (measured at Equator)
function Resolution(zoom: number): number {
	return initialResolution / Math.pow(2, zoom);
}

// LatLonToPixels converts given lat/lon in WGS84 Datum to Pixel coordinates in given zoom level
export function LatLonToPixels(lat: number, lon: number, zoom: number): [number, number] {
	const [x, y] = LatLonToMeters(lat, lon);
	return MetersToPixels(x, y, zoom);
}

// PixelsToLatLon converts Pixel coordinates in given zoom level to lat/lon in WGS84 Datum
export function PixelsToLatLon(px: number, py: number, zoom: number): [number, number] {
	const [x, y] = PixelsToMeters(px, py, zoom);
	return MetersToLatLon(x, y);
}

// PixelsToLonLat converts Pixel coordinates in given zoom level to lat/lon in WGS84 Datum
export function PixelsToLonLat(px: number, py: number, zoom: number): [number, number] {
	const [lat, lon] = MetersToLatLon(...PixelsToMeters(px, py, zoom));
	return [lon, -lat];
}

export function coordToPixel(x: number, y: number) {
	return [x * tileSize, y * tileSize];
}
