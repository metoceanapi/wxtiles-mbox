import { coordToPixel, PixelsToLonLat } from '../utils/mercator';
import { DataPicture, XYZ } from '../utils/wxtools';
import { WxBoundaryMeta } from '../wxAPI/wxAPI';

function interpolatorDegreeLinear(start: number, end: number, amount: number): number {
	const shortestAngle = ((((end - start) % 360) + 540) % 360) - 180;
	return (start + shortestAngle * amount + 360) % 360;
}

type InterpolatorSquare = (a: number, b: number, c: number, d: number, dxt: number, dyt: number, dmin: number, dmul: number) => number;

function interpolatorSquareDegree(a: number, b: number, c: number, d: number, dxt: number, dyt: number, dmin: number, dmul: number): number {
	// a----b
	// |    |
	// |    |
	// c----d

	// 16 possible variants for a,b,c,d != 0 ( != NaN)
	const sq = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
	switch (sq) {
		case 0b0000:
			return 0; // NaN
		case 0b0001: // only a != NaN
			return a;
		case 0b0010: // only b != NaN
			return b;
		case 0b0011: // a, b != NaN
			c = a;
			d = b;
			break;
		case 0b0100: // ... etc
			return c;
		case 0b0101:
			b = a;
			d = c;
			break;
		case 0b0110:
			d = (b + c) >> 1;
			a = d;
			break;
		case 0b0111:
			d = (b + c) >> 1;
			break;
		case 0b1000:
			return d;
		case 0b1001:
			b = (a + d) >> 1;
			c = b;
			break;
		case 0b1010:
			a = b;
			c = d;
			break;
		case 0b1011:
			c = (a + d) >> 1;
			break;
		case 0b1100:
			a = c;
			b = d;
			break;
		case 0b1101:
			b = (a + d) >> 1;
			break;
		case 0b1110:
			a = (b + c) >> 1;
			break;
	}

	// decode Data
	a = dmin + dmul * a;
	b = dmin + dmul * b;
	c = dmin + dmul * c;
	d = dmin + dmul * d;

	// 2) bilinear
	const u = interpolatorDegreeLinear(a, b, dxt); // upper line
	const l = interpolatorDegreeLinear(c, d, dxt); // lower line
	// Encode Data back before returning
	const ul = (interpolatorDegreeLinear(u, l, dyt) - dmin) / dmul;
	if (ul < 1) return 1; // As 0 is NaN, we don't need NaN here! so return 1 instead of NaN
	return ul;
}

function interpolatorSquare(a: number, b: number, c: number, d: number, dxt: number, dyt: number, dmin: number, dmul: number): number {
	// 0       1
	//  a --- b   default version            a --- b    flipped version
	//  |   / |                              | \   |
	//  | / x | - pyt                        |   \ |
	//  c --- d                              c --- d
	// 2    |  3
	//     pxt
	//
	// x - point to interpolate
	// a, b, c, d - corners of the square
	// 16 possible variants for a,b,c,d != 0 ( != NaN)
	const sq = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
	switch (sq) {
		case 0b0111: // -cba   -default version
			return dxt + dyt < 1 ? dxt * (b - a) + dyt * (c - a) + a : 0;
		case 0b1110: // dcb-   -default version
			return dxt + dyt < 1 ? 0 : dxt * (d - c) + dyt * (d - b) + b + c - d;
		case 0b1011: // d-ba   - flipped version
			return dyt < dxt ? (1 - dxt) * (a - b) + dyt * (d - b) + b : 0;
		case 0b1101: // dc-a   - flipped version
			return dyt < dxt ? 0 : (1 - dxt) * (c - d) + dyt * (c - a) + a + d - c;
		case 0b1111: // dcba   - default version
			return dxt + dyt < 1 ? dxt * (b - a) + dyt * (c - a) + a : dxt * (d - c) + dyt * (d - b) + b + c - d;
		default:
			return 0;
	}
}

function subDataPicture(interpolator: InterpolatorSquare, inputData: DataPicture, subCoords: XYZ): DataPicture {
	const subTileSize = 1 / 2 ** subCoords.z; // a size of a subtile
	const subTileStartX = subCoords.x * 256 * subTileSize - 0.5; // upper left point of a subtile Shifted by 0.5 to get the center of the pixel
	const subTileStartY = subCoords.y * 256 * subTileSize - 0.5;
	const { raw: inRaw, dmin, dmax, dmul } = inputData;
	const subData: DataPicture = { raw: new Uint16Array(258 * 258), dmin, dmax, dmul };
	const { raw: outRaw } = subData;
	for (let outY = -1, outIndex = 0, inYf = subTileStartY - subTileSize + 1 /*+1 to shift index */; outY <= 256; outY++, inYf += subTileSize) {
		const inYi = Math.floor(inYf); // don't use `~~` because of negatives on left and upper borders
		const yt = inYf - inYi; // [0, 1] - `y` interpolati`on coeff
		const inYi258 = inYi * 258;
		for (let outX = -1, inXf = subTileStartX - subTileSize + 1 /*+1 to shift index */; outX <= 256; outX++, outIndex++, inXf += subTileSize) {
			const inXi = Math.floor(inXf); // don't use ~~ because of negatives
			const xt = inXf - inXi;
			const inIndex = inXi + inYi258; // data index
			// interpolation inside a rectangular
			const a = inRaw[inIndex]; // upper left corner
			const b = inRaw[inIndex + 1]; // upper right
			const c = inRaw[inIndex + 258]; // lower left
			const d = inRaw[inIndex + 258 + 1]; // lower right
			outRaw[outIndex] = interpolator(a, b, c, d, xt, yt, dmin, dmul);
		} // for x
	} // for y

	return subData;
}

/**
 * Get sub-tile of a mask via baricemrtric interpolation
 * @param {ImageData} inputData - input data
 * @param {XYZ | undefined} subCoords - subtile coordinates
 * @returns {ImageData} subtile data
 * */
export function subMask(inputData: ImageData, subCoords: XYZ | undefined, channel: number): ImageData {
	if (!subCoords) return inputData;

	const clamp = (v: number) => (v < 0 ? 0 : v > 254 ? 254 : v);
	const subTileSize = 1 / 2 ** subCoords.z; // a size of a subtile
	const subTileStartX = subCoords.x * 256 * subTileSize - 0.5; // upper left point of a subtile Shifted by 0.5 to get the center of the pixel
	const subTileStartY = subCoords.y * 256 * subTileSize - 0.5;
	const { data: inData } = inputData;
	const subData: ImageData = new ImageData(256, 256);
	const { data: outData } = subData;
	for (let outY = 0, outIndex = channel, inYf = subTileStartY; outY < 256; outY++, inYf += subTileSize) {
		const inYi = ~~clamp(inYf);
		const yt = inYf - inYi; // [0, 1] - `y` interpolation coeff
		const inYi256 = inYi * 256;
		for (let outX = 0, inXf = subTileStartX; outX < 256; outX++, outIndex += 4, inXf += subTileSize) {
			const inXi = ~~clamp(inXf);
			const xt = inXf - inXi;
			const inIndex = (inXi + inYi256) * 4 + channel; // data index to pixel/channel used as a mask
			// interpolation inside a rectangular
			const a = inData[inIndex]; // upper left corner
			const b = inData[inIndex + 4]; // upper right
			const c = inData[inIndex + 4 * 256]; // lower left
			const d = inData[inIndex + 4 * 256 + 4]; // lower right
			const r = interpolatorSquare(a, b, c, d, xt, yt, 0, 0);
			// const r = xt + yt < 1 ? xt * (b - a) + yt * (c - a) + a : xt * (d - c) + yt * (d - b) + b + c - d; // baricentric interpolation
			// const r = xt + yt < 1 ? xt * (b - a) + yt * (c - a) + a : xt * (d - c) + yt * (d - b) + b + c - d; // baricentric interpolation
			outData[outIndex] = r > 127 ? 255 : 0;
		} // for x
	} // for y

	return subData;
}

/**
 * Get sub-tile of a regular data via baricemrtric interpolation
 * @param {DataPicture} inputData - input data
 * @param {XYZ | undefined} subCoords - subtile coordinates
 * @returns {DataPicture} subtile data
 * */
export function subData(inputData: DataPicture, subCoords?: XYZ): DataPicture {
	if (!subCoords) return inputData;
	return subDataPicture(interpolatorSquare, inputData, subCoords);
}

/**
 * Get sub-tile of a degree data tile via bilinear degree interpolation, so middle of 350..10 degree is 0 degree.
 * @param {DataPicture} inputData - input data
 * @param {XYZ | undefined} subCoords - subtile coordinates
 * @returns {DataPicture} subtile data
 * */
export function subDataDegree(inputData: DataPicture, subCoords?: XYZ): DataPicture {
	if (!subCoords) return inputData;
	return subDataPicture(interpolatorSquareDegree, inputData, subCoords);
}

/**
 *  Upply sea/land mask to a data tile
 * 0 - for the masks from Sarah (current), 3 - for the masks from Mapbox
 * @param {DataPicture} dataIn - data tile
 * @param {ImageData} mask - sea/land mask
 * @param {number} mc - mask channel of the mask picture to use (0 - Red, 1 - Green, 2 - Blue, 3 - Alpha)
 * @param {'sea' | 'land'} maskType - sea or land masking to apply
 * @returns {DataPicture} - masked data tile
 *  */
export function applyMask(dataIn: DataPicture, { data }: ImageData, mc: number, maskType: 'land' | 'sea'): DataPicture {
	const sea = maskType === 'sea';
	const { raw } = dataIn;
	for (let i = mc, j = 259, y = 0; y < 256; j += 2, y++) for (let x = 0; x < 256; x++, j++, i += 4) sea === !data[i] && (raw[j] = 0);

	//// equal to
	// for (let y = 0; y < 256; y++) {
	// 	for (let x = 0; x < 256; x++) {
	// 		const land = !mask.data[(y*256+x)*4+mc];
	// 		if (sea === land) {
	// 			data.raw[(y + 1) * 258 + (x + 1)] = 0; // zeroing data if mask doesn't match the maskType
	// 		}
	// 	}
	// }

	return dataIn;
}

/**
 * Create a bounding box for a tile
 * @param coords - tile coordinates
 * @returns {WxBoundaryMeta} [minLon, minLat, maxLon, maxLat]
 *  */
export function makeBox(coords: XYZ): WxBoundaryMeta {
	const [px, py] = coordToPixel(coords.x, coords.y);
	const [west, north] = PixelsToLonLat(px, py, coords.z);
	const [east, south] = PixelsToLonLat(px + 256, py + 256, coords.z);
	return { west, north, east, south };
}

/**
 *  Splits tile coordinates into a tile coords at maximum zoom and a subtile coords.
 * If the tile is below maximum zoom, the subtile coords are undefined.
 * @param coords - tile coordinates
 * @param maxZoom - maximum zoom
 * @returns [tile coords, subtile coords (or undefined)]
 * */
export function splitCoords(coords: XYZ, maxZoom: number): { upCoords: XYZ; subCoords?: XYZ } {
	const zDif = coords.z - maxZoom;
	if (zDif <= 0) {
		return { upCoords: coords };
	}

	const upCoords = { x: coords.x >>> zDif, y: coords.y >>> zDif, z: maxZoom };
	const subCoords = { x: coords.x & ((1 << zDif) - 1), y: coords.y & ((1 << zDif) - 1), z: zDif };
	return { upCoords, subCoords };
} // _splitCoords
