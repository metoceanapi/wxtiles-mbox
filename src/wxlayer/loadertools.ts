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
	return (interpolatorDegreeLinear(u, l, dyt) - dmin) / dmul || 1; // 0 is NaN, we don't need NaN here!
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

function subDataPicture(interpolator: InterpolatorSquare, inputData: DataPicture, subCoords?: XYZ): DataPicture {
	if (!subCoords) return inputData;
	const s = 0.9999999 / Math.pow(2, subCoords.z); // a subsize of a tile // 0.99999 - a dirty trick to never cross the bottom and rigth edges of the original tile.
	const sx = subCoords.x * 256 * s; // upper left point of a subtile
	const sy = subCoords.y * 256 * s;
	const { raw: inRaw, dmin, dmax, dmul } = inputData;
	const subData: DataPicture = { raw: new Uint16Array(258 * 258), dmin, dmax, dmul };
	const { raw: outRaw } = subData;
	for (let y = -1, i = 0; y <= 256; y++) {
		const dy = sy + y * s; // `y` projection of the subtile onto the original tile
		const dyi = Math.floor(dy); // don't use `~~` because of negatives on left and upper borders
		const dyt = dy - dyi; // [0, 1] - `y` interpolation coeff
		for (let x = -1; x <= 256; x++, i++) {
			const dx = sx + x * s;
			const dxi = Math.floor(dx); // don't use ~~ because of negatives
			const dxt = dx - dxi;
			const di = dxi + 1 + (dyi + 1) * 258; // data index

			// interpolation inside a rectangular
			const a = inRaw[di]; // upper left corner
			const b = inRaw[di + 1]; // upper right
			const c = inRaw[di + 258]; // lower left
			const d = inRaw[di + 258 + 1]; // lower right
			outRaw[i] = interpolator(a, b, c, d, dxt, dyt, dmin, dmul);
		} // for x
	} // for y
	return subData;
}

export function subData(inputData: DataPicture, subCoords?: XYZ): DataPicture {
	return subDataPicture(interpolatorSquare, inputData, subCoords);
}

export function subDataDegree(inputData: DataPicture, subCoords?: XYZ): DataPicture {
	return subDataPicture(interpolatorSquareDegree, inputData, subCoords);
}

export function applyMask2(data: DataPicture, mask: ImageData, maskType: 'land' | 'sea'): DataPicture {
	const t = maskType === 'land' ? 1 : 0;
	for (let maskIndex = 3, y = 0; y < 256; y++) {
		for (let x = 0; x < 256; x++, maskIndex += 4) {
			const m = mask.data[maskIndex] ? 1 : 0; // 0 - land
			if (t ^ m) {
				data.raw[(y + 1) * 258 + (x + 1)] = 0;
			}
		}
	}

	return data;
}

// if mask.data[] === 0(land) or 255(sea) strictly wthout any intermediate values
export function applyMask1(data: DataPicture, mask: ImageData, maskType: 'land' | 'sea'): DataPicture {
	if (maskType === 'sea') {
		for (let maskIndex = 3, y = 0; y < 256; y++) {
			for (let x = 0; x < 256; x++, maskIndex += 4) {
				data.raw[(y + 1) * 258 + (x + 1)] &= mask.data[maskIndex]; // zeroing data if mask is zero (land)
			}
		}
	} else {
		for (let maskIndex = 3, y = 0; y < 256; y++) {
			for (let x = 0; x < 256; x++, maskIndex += 4) {
				data.raw[(y + 1) * 258 + (x + 1)] &= ~mask.data[maskIndex]; // zeroing data if mask is 255 (sea)
			}
		}
	}

	return data;
}

export function applyMask(data: DataPicture, mask: ImageData, maskType: 'land' | 'sea'): DataPicture {
	const sea = maskType === 'sea';
	for (let i = 3, y = 0; y < 256; y++) for (let x = 0, j = (y + 1) * 258 + 1; x < 256; x++, j++, i += 4) sea === !mask.data[i] && (data.raw[j] = 0);

	//// equal to
	// for (let y = 0; y < 256; y++) {
	// 	for (let x = 0; x < 256; x++) {
	// 		const land = !mask.data[(y*256+x)*4+3];
	// 		if (sea === land) {
	// 			data.raw[(y + 1) * 258 + (x + 1)] = 0; // zeroing data if mask doesn't match the maskType
	// 		}
	// 	}
	// }

	return data;
}

export function makeBox(coords: XYZ): WxBoundaryMeta {
	const [px, py] = coordToPixel(coords.x, coords.y);
	const [west, north] = PixelsToLonLat(px, py, coords.z);
	const [east, south] = PixelsToLonLat(px + 256, py + 256, coords.z);
	return { west, north, east, south };
}

export function splitCoords(coords: XYZ, maxZoom: number): { upCoords: XYZ; subCoords?: XYZ } {
	const zDif = coords.z - maxZoom;
	if (zDif <= 0) {
		return { upCoords: coords };
	}

	const upCoords = { x: coords.x >>> zDif, y: coords.y >>> zDif, z: maxZoom };
	const subCoords = { x: coords.x & ((1 << zDif) - 1), y: coords.y & ((1 << zDif) - 1), z: zDif };
	return { upCoords, subCoords };
} // _splitCoords
