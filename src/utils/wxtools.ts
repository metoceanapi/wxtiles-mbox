import { __units_default_preset } from '../defaults/uconv';
import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';

/** x,y,z */
export interface XYZ {
	x: number;
	y: number;
	z: number;
}

/** type for unit converter */
export type WxUnitTuple = [string, number, number?];

/** Type of an Object with all unit convertion tupels */
export interface WxUnits {
	[unit: string]: WxUnitTuple | undefined;
}

/**
 * Type of an Object with all color schemes,
 * each color scheme is an array of colors evenly distributed between min and max values in a {@link WxLegend} and {@link RawCLUT}*/
export interface WxColorSchemes {
	[name: string]: string[] | undefined;
}

/** A [level,color] tuple */
export type colorMapTuple = [number, string];

/** Weak color style (may not have all fields of {@link WxColorStyleStrict}) */
export interface WxColorStyleWeak extends Partial<WxColorStyleStrict> {}

/** interface of an object with all mixed color styles */
export interface WxColorStylesWeakMixed {
	[name: string]: WxColorStyleWeak | WxColorStyleWeak[] | undefined;
}

/** interface of an object with all weak color styles */
export interface ColorStylesIncomplete {
	[name: string]: WxColorStyleWeak | undefined;
}

/** Strict style interface */
export interface WxColorStyleStrict {
	/** Name of the style */
	name: string;

	/** Name of a parent style to inherit from */
	parent?: string;

	/** Tile filling schema.
	 * - **'none'** means no fill, leave the tile transparent
	 * - **'solid'** means solid fill, no gradient between levels.
	 * - **'gradient'** means gradient fill.
	 * */
	fill: 'none' | 'gradient' | 'solid';

	/**
	 * Color of isolines.
	 * - **'none'** do not render.
	 * - **'fill'** using value of {@link fill} in each pixel.
	 * - **'inverted'** using *inverted* value of {@link fill} in each pixel.
	 * - **'#RGB'** or '**#RRGGBB**' or '**#RRGGBBAA**' - using this WEB-color.
	 * */
	isolineColor: 'none' | 'inverted' | 'fill' | `#${string}`;

	/** if true then render isoline text values */
	isolineText: boolean;

	/**
	 * Representation of the wind/current field.
	 * - **'none'** do not render vectors.
	 * - **'arrows'** use arrows to represent winds/currents.
	 * - **'barbs'** use barbs.
	 * */
	vectorType: 'none' | 'arrows' | 'barbs';

	/**
	 * Color of vectors.
	 * - **'none'** do not render vectors.
	 * - **'fill'** using value of {@link fill} in each pixel.
	 * - **'inverted'** using *inverted* value of {@link fill} in each pixel.
	 * - **'#RGB'** or '**#RRGGBB**' or '**#RRGGBBAA**' - using this WEB-color.
	 * */
	vectorColor: 'none' | 'inverted' | 'fill' | `#${string}`;

	/** Factor for vectors length */
	vectorFactor: number;

	/**
	 * Draw streamlines:
	 * - **'none'** means no streamlines.
	 * - **'fill'** using value of {@link fill} in each pixel.
	 * - **'inverted'** using *inverted* value of {@link fill} in each pixel.
	 * - **'#RGB'** or '**#RRGGBB**' or '**#RRGGBBAA**' - using this WEB-color.
	 * */
	streamLineColor: 'none' | 'inverted' | 'fill' | `#${string}`;

	/** factor to scale streamlines length */
	streamLineSpeedFactor: number;

	/**
	 * Step to seed streamlines. Streamlines spread both ways from seed point.
	 * less value means more streamlines.
	 * */
	streamLineGridStep?: number;

	/** steps in each streamline */
	streamLineSteps?: number;

	/**
	 * - if true then render streamlines as static lines.
	 * - if false then render streamlines as animated lines.
	 * */
	streamLineStatic: boolean;

	/** If true then fill values below style's minimum. */
	showBelowMin: boolean;

	/** If true then fill values above style's maximum. */
	showAboveMax: boolean;

	/** Color scheme name from the default set. May be extended in {@link WxAPI}*/
	colorScheme: string;

	/** Used if presented instead of colorScheme */
	colors?: string[];

	/**
	 * Used if presented instead of levels, colors, colorScheme.
	 * Array of [level,color] tuples. Colors are WEB-colors.
	 */
	colorMap?: [number, string][];

	/** Levels to build legend. Used if presented, otherwise 10 levels are calculated evenly on given data */
	levels?: number[];

	/** radius for the BOX filter */
	blurRadius: number;

	/** Additional rotation of all wind or current's vectors or directions by angle in degrees.*/
	addDegrees: number;

	/** Units of the style (from the default set)*/
	units: string;

	/**
	 * Additional extend of default {@link units}.
	 * @see {@link WxUnits}
	 * */
	extraUnits?: WxUnits;

	/**
	 * masking:
	 * - **'none'** - no masking.
	 * - **'sea'** - make sea transparent.
	 * - **'land'** - make land transparent.
	 * */
	mask?: 'land' | 'sea' | 'none';

	/** If exists then try to use WebGL to render tiles */
	gl?: {
		animationSpeed?: number;
		noiseTexturePow?: number;
		vectorFieldFactor?: number;
		animationIntensity?: number;
		wavesCount?: number;
	};
}

/**
 * @typedef {Object} WxColorStylesStrict
 * @property {string} name - name of the style
 */
export interface WxColorStylesStrict {
	base: WxColorStyleStrict;
	[name: string]: WxColorStyleStrict | undefined;
}

let _units: WxUnits;
let _colorSchemes: WxColorSchemes;
let _colorStylesUnrolled: WxColorStylesStrict;

/** Options for the wxtiles library */
export interface WxTilesLibOptions {
	/** Additional Color styles to use for the library */
	colorStyles?: WxColorStylesWeakMixed;

	/** Additional color schemes to use for the library */
	colorSchemes?: WxColorSchemes;

	/** Additional units to use for the library */
	units?: WxUnits;
}

/**
 * Initialize the wxtiles library
 * @param options - options {@link WxTilesLibOptions} to initialize the library
 */
export function WxTilesLibSetup({ colorStyles = {}, units = {}, colorSchemes = {} }: WxTilesLibOptions = {}): void {
	WXLOG('WxTile lib setup: start');
	_units = Object.assign({}, __units_default_preset, units);
	_colorSchemes = Object.assign({}, colorSchemes, __colorSchemes_default_preset);
	const toUnroll = Object.assign({}, colorStyles, __colorStyles_default_preset);
	_colorStylesUnrolled = unrollStylesParent(toUnroll);
	WXLOG('WxTile lib setup: styles unrolled');

	// Make sure fonts are loaded & ready!
	(async () => {
		try {
			await document.fonts.load('32px barbs');
			await document.fonts.load('32px arrows');
		} catch (e) {
			WXLOG('WxTile lib setup: fonts not loaded');
		}
	})();

	WXLOG('WxTile lib setup is done.');
}

/**
 * Get all {@link WxColorStylesStrict} used by the library
 * */
export function WxGetColorStyles(): WxColorStylesStrict {
	return _colorStylesUnrolled;
}

/**
 * Get all {@link WxColorSchemes} used by the library
 * */
export function WxGetColorSchemes(): WxColorSchemes {
	return _colorSchemes;
}

/** A function type with extra properties. */
export interface Converter extends Function {
	/** interface of a function - unit cinverter*/
	(x: number): number;
	/** true if the converter is a trivial one */
	trivial?: boolean;
}

/**
 * Convert a value from one unit to another
 * @param from - the unit to convert from
 * @param to - the unit to convert to
 * @param customUnits - custom units to use if needed
 * @returns a function that converts a value from one unit to another
 * @example
 * ```ts
 * const convert = makeConverter('m/s', 'km/h');
 * const speed = convert(10); // speed is now 36
 * ```
 * */
export function makeConverter(from: string, to: string, customUnits?: WxUnits): Converter {
	WXLOG('makeConverter: From=', from, ' To=', to);
	const c = (x: number) => x;
	c.trivial = true;
	if (from === to) {
		WXLOG('Trivial converter');
		return c; // trivial
	}

	const localUnitsCopy = Object.assign({}, _units, customUnits);
	const fromUnit = localUnitsCopy[from];
	const toUnit = localUnitsCopy[to];
	if (!fromUnit || !toUnit) {
		WXLOG('Inconvertible units. Trivial converter');
		return c; // Inconvertible
	}

	const [fromUnitBase, fromFactor, fromOffset] = fromUnit;
	const [toUnitBase, toFactor, toOffset] = toUnit;

	if (fromUnitBase !== toUnitBase || !fromFactor || !toFactor) {
		WXLOG('Inconvertible units. Trivial converter');
		return c; // trivial
	}

	const a = fromFactor / toFactor;
	const b = ((fromOffset || 0) - (toOffset || 0)) / toFactor;
	return b ? (x: number) => a * x + b : (x: number) => a * x;
}

/**
 * Unroll color styles with parent references
 * @param stylesArrInc - array of styles, some of them may be incomplete, with inheritence
 * @returns Strict styles array
 */
function unrollStylesParent(stylesArrInc: WxColorStylesWeakMixed): WxColorStylesStrict {
	const stylesInc: ColorStylesIncomplete = Object.assign({}, __colorStyles_default_preset);
	for (const name in stylesArrInc) {
		const styleA = stylesArrInc[name];
		if (Array.isArray(styleA)) {
			for (let i = 0; i < styleA.length; ++i) {
				stylesInc[name + '[' + i + ']'] = Object.assign({}, styleA[i]); // deep copy
			}
		} else {
			stylesInc[name] = Object.assign({}, styleA); // deep copy
		}
	}

	const baseStyleCopy = Object.assign({}, __colorStyles_default_preset.base);
	// recursive function to apply inheritance
	const inherit = (stylesInc: ColorStylesIncomplete, name: string): WxColorStyleStrict => {
		if (name === 'base') return baseStyleCopy; // nothing to inherit
		const style = stylesInc[name]; // there are no arrays by this point
		if (!style) return baseStyleCopy; // nothing to inherit
		if (!style.parent || !(style.parent in stylesInc)) style.parent = 'base';
		const parent = inherit(stylesInc, style.parent); // After inheritance it is FULL ColorStyle
		return Object.assign(style, Object.assign({}, parent, style, { parent: 'base' })); // this ugly construction changes style 'in place' so it is a soft-copy. huray!
	};

	const styles: WxColorStylesStrict = { base: baseStyleCopy };
	for (const name in stylesInc) {
		styles[name] = inherit(stylesInc, name);
	}

	return styles;
}

/** Function type to load image from URL, with additional properties */
// export type UriLoaderPromiseFunc<T> = (url: string, ...props: any) => Promise<T>;
interface UriLoaderPromiseFunc<T> extends Function {
	(url: string, ...props: any): Promise<T>;
}

export interface CachedUriLoaderPromiseFunc<T> extends UriLoaderPromiseFunc<T> {
	(url: string, ...props: any): Promise<T>;
	clearCache: () => void;
}

/** Makes a cachable function that loads image from URL, with additional properties */
export function cacheUriPromise<T>(fn: UriLoaderPromiseFunc<T>): CachedUriLoaderPromiseFunc<T> {
	const cache = new Map<string, Promise<T>>();
	const cachedFunc = (url: string, ...props: any[]): Promise<T> => {
		const cached = cache.get(url);
		if (cached) return cached;
		const promise = fn(url, ...props);
		// cache any result (even falures)
		cache.set(url, promise);
		// except aborted (images), so they could be reloaded
		promise.catch((e) => e.name === 'AbortError' && cache.delete(url));
		return promise;
	};

	cachedFunc.clearCache = () => cache.clear();
	return cachedFunc;
}

/**
 * abortable 'loadImage'
 * @param url - image url
 * @param requestInit - fetch requestInit
 * */
export async function loadImage(url: string, requestInit?: RequestInit): Promise<ImageBitmap> {
	//// Method 0
	const f = await fetch(url, requestInit);
	if (f.status !== 200 && f.status !== 304) {
		throw { name: 'Tile loading failed', reason: f.headers.get('x-reason'), status: f.status };
	}

	return await createImageBitmap(await f.blob(), { premultiplyAlpha: 'none' });

	// //// Method 000
	// const img = new Image();
	// img.src = URL.createObjectURL(await (await fetch(url, requestInit)).blob());
	// await img.decode();
	// URL.revokeObjectURL(img.src);
	// return img;

	// const img = new Image();
	// img.crossOrigin = 'anonymous'; // essential
	// const abortFunc = () => (img.src = ''); // stop loading
	// signal.addEventListener('abort', abortFunc);

	// //// Method 1
	// img.src = url;
	// await img.decode();
	// signal.removeEventListener('abort', abortFunc);
	// return img;

	//// Method 2
	// return new Promise((resolve, reject) => {
	// 	img.onerror = (e) => {
	// 		signal.removeEventListener('abort', abortFunc);
	// 		reject(e);
	// 	};
	// 	img.onload = () => {
	// 		signal.removeEventListener('abort', abortFunc);
	// 		resolve(img);
	// 	};
	// 	img.src = url; // should be after .onload
	// });
}

/** integral pare for fast box blur algorithm */
export interface IntegralPare {
	/** Integral image */
	integral: Uint32Array;
	/** Integral image of ZEROs */
	integralNZ: Uint32Array | null;
}

/** interface of a data read from a PNG tile */
export interface DataPicture {
	raw: Uint16Array;
	dmin: number;
	dmax: number;
	dmul: number;
}

/** One (scalar) or three (vector components + length component) {@link DataPictures} */
export type DataPictures = [DataPicture] | [DataPicture, DataPicture, DataPicture];

/**
 * class implements {@link DataPictures} with lazy calculation of {@link IntegralPare} for fast box blur algorithm
 * */
export class DataIntegral implements DataPicture {
	protected integral_?: IntegralPare;
	radius: number = 0;
	constructor(public raw: Uint16Array, public dmin: number, public dmax: number, public dmul: number) {}
	get integral(): IntegralPare {
		return this.integral_ || (this.integral_ = buildIntegralPare(this.raw));
	}
}

/** One (scalar) or two (vector) {@link DataIntegral} */
export type DataIntegrals = [DataIntegral] | [DataIntegral, DataIntegral];

/**
 * Helper function to create a 2D canvas context
 * @param width - width of the context
 * @param height - height of the context
 * @param willReadFrequently - if true, the context will be read frequently (browser will optimize it)
 * @returns canvas context
 */
export function create2DContext(width: number, height: number, willReadFrequently = true): CanvasRenderingContext2D {
	const context = Object.assign(document.createElement('canvas'), { width, height, imageSmoothingEnabled: false }).getContext('2d', {
		willReadFrequently,
	});
	if (!context) throw new Error('Cannot get canvas context');
	return context;
}

/** Converts an ImageBitmap to ImageData */
function imageToData(image: ImageBitmap): ImageData {
	const { width, height } = image;
	const context = create2DContext(width, height);
	context.drawImage(image, 0, 0);
	return context.getImageData(0, 0, width, height);
}

/**
 * Load ImageData to from URL with RequestInit
 * @param url - image url
 * @param requestInit - fetch requestInit
 * @returns Promise of ImageData
 */
export async function loadImageData(url: string, requestInit?: RequestInit): Promise<ImageData> {
	return imageToData(await loadImage(url, requestInit));
}

/**
 * Calculates integral image of the image
 * @param image - ImageData to calculate integral image of
 * @returns integral image {@link DataIntegral}
 * */
function dataToIntegral(imData: ImageData): DataIntegral {
	if (imData.data[34] < 1) {
		WXLOG('Warning: image is in too old format. Check the version of the Splitter.');
	}

	// picTile contains bytes RGBARGBARGBA ...
	// we need RG and don't need BA, so output is a 16 byte array picData with every second value dropped.
	const imbuf = new Uint16Array(imData.data.buffer);
	const raw = new Uint16Array(imbuf.length / 2);
	for (let i = 0; i < raw.length; i++) {
		raw[i] = imbuf[i * 2];
	}

	// Min and Max values of the data are encoded as two floats saved in the first 8 pixels in Blue channel
	const minmaxbuf = new Uint8Array(8);
	for (let i = 0; i < 8; ++i) {
		minmaxbuf[i] = imData.data[i * 4 + 2];
	}

	const view = new DataView(minmaxbuf.buffer);
	const dmin = view.getFloat32(0, true);
	const dmax = view.getFloat32(4, true);
	const dmul = (dmax - dmin) / 65535;
	// const integral = buildIntegralPare(raw);
	// return new DataIntegral({ raw, dmin, dmax, dmul }, 0);
	return new DataIntegral(raw, dmin, dmax, dmul);
}

/**
 * Load {@link DataIntegral}  from URL with RequestInit
 * @param url - image url
 * @param requestInit - fetch requestInit
 * @returns Promise of {@link DataIntegral}
 * */
export async function loadDataIntegral(url: string, requestInit?: RequestInit): Promise<DataIntegral> {
	return dataToIntegral(await loadImageData(url, requestInit));
}

/**
 * Calculaates {@link IntegralPare} from raw data Uint16Array.
 * Used for fast box-blur algo
 * Integarl image: https://en.wikipedia.org/wiki/Summed-area_table.
 * @param raw - raw data
 * @returns IntegralPare
 * */
export function buildIntegralPare(raw: Uint16Array): IntegralPare {
	const integral = new Uint32Array(258 * 258);
	// The main Idea of integralNZ is to calculate the amount of Non Zero values,
	// so in the Blur algorithm it can be used for 'averaging' instead of actual area of a BoxBlur frame
	const integralNZ = new Uint32Array(258 * 258);

	integral[0] = raw[0]; // upper left value
	integralNZ[0] = raw[0] ? 1 : 0; // upper left value

	// boundaries
	for (let i = 1; i < 258; ++i) {
		integral[i] = raw[i] + integral[i - 1]; // uper boundary
		integralNZ[i] = (raw[i] ? 1 : 0) + integralNZ[i - 1]; // uper boundary
		const yi = 258 * i;
		integral[yi] = raw[yi] + integral[yi - 258]; // left boundary
		integralNZ[yi] = (raw[yi] ? 1 : 0) + integralNZ[yi - 258]; // left boundary
	}

	// the rest picture
	for (let y = 1; y < 258; ++y) {
		for (let x = 1; x < 258; ++x) {
			const i = 258 * y + x;
			integral[i] = raw[i] + integral[i - 258] + integral[i - 1] - integral[i - 259];
			integralNZ[i] = (raw[i] ? 1 : 0) + integralNZ[i - 258] + integralNZ[i - 1] - integralNZ[i - 259];
		}
	}

	// 66564 is the maximum posible value of the integralNZ image, so if all values are not 0, then no need to use it
	return { integral, integralNZ: integralNZ[66563] === 66564 ? null : integralNZ };
}

// restore raw data from integral using zero radius
function restoreRawFromIntegral(im: DataIntegral): DataIntegral {
	// TESTED - works
	/*
	\ 012345
	0 -AB---
	1 -CD---  - (2,1) r=0
	2 ------
	*/
	const { integral: I } = im.integral;
	im.raw[0] = I[0]; // upper left value
	// the rest picture
	for (let y = 1; y < 258; y++) {
		im.raw[y] = I[y] - I[y - 1]; // uper boundary
		im.raw[258 * y] = I[258 * y] - I[258 * (y - 1)]; // left boundary
		for (let x = 1; x < 258; x++) {
			const i = 258 * y + x;
			im.raw[i] = I[i - 259] + I[i] - I[i - 258] - I[i - 1];
		}
	}

	return im;
}

/**
 * BoxBlur implementation based on integral image {@link DataIntegral}.
 * Adaptaion of using in 'tiling' mode. Uses only one boudary line for each tile.
 * Gives decent visual results, but not as good as bluring over the whole image.
 * Sometimes distortion of the image is noticable on the edges of the tiles.
 * Also it doesn't change/blur corners of the tiles.
 * @param data - {@link DataIntegral}
 * @param radius - radius for the box-blur algorithm
 * */
export function blurData(im: DataIntegral, radius: number): DataIntegral {
	if (radius < 0) radius = 0;
	if (radius === im.radius) return im;
	im.radius = radius;
	if (!radius) return restoreRawFromIntegral(im); // radius === 0

	const { integral, integralNZ } = im.integral;

	// process picture excluding two lines of boundaries
	for (let y = 2; y < 256; y++) {
		for (let x = 2; x < 256; x++) {
			const i = 258 * y + x;
			if (!im.raw[i]) {
				continue;
			}

			/*  |
			  012345
			0 A--B--
			1 -+++--
			2 -+o+--  - (2,2) r=1 
			3 C++D--
			4 ------

			       |
			 (25)34567
			253 -A--B-
			254 --+++-
			255 --+o+-  - (255,255) r=1
			256 -C++D-
			257 ------

			*/

			const rx = Math.min(radius, x - 1, 256 - x);
			const ry = Math.min(radius, y - 1, 256 - y);

			const i1 = 258 * (y - ry - 1) + x;
			const i2 = 258 * (y + ry) + x;
			let sumNZ: number;
			if (integralNZ) {
				const ANZ = integralNZ[i1 - rx - 1];
				const BNZ = integralNZ[i1 + rx];
				const CNZ = integralNZ[i2 - rx - 1];
				const DNZ = integralNZ[i2 + rx];
				sumNZ = ANZ + DNZ - BNZ - CNZ; // amount of non Zero values
			} else {
				sumNZ = (2 * rx + 1) * (2 * ry + 1); // all values are non Zero
			}

			const A = integral[i1 - rx - 1];
			const B = integral[i1 + rx];
			const C = integral[i2 - rx - 1];
			const D = integral[i2 + rx];
			const sum = A + D - B - C;

			im.raw[i] = sum / sumNZ;
		}
	}

	// process boundaries
	// Copy the first line from the boundary to the second line, to make life easier
	for (let k = 2; k < 256; k++) {
		// top two lines
		const ti = 258 + k; // start with (2,1)
		if (im.raw[ti]) {
			/*
			    |
			  012345
			  A  B
			0 -+++--
			1 C+oD--  - (2,1) rx=1, A=B=0
			2 ------

			      |
			(25)4567
			    A  B
			0 ---+++
			1 --C+oD  - (256,1) rx=1, A=B=0
			2 ------

			     |
			  012345
			  A    B
			0 -+++++--
			1 C++o+D--  - (3,1) rx=2, A=B=0
			2 --------

			       |
			(25)234567
			    A    B
			0   -+++++
			1   C++o+D  - (255,1) rx=2, A=B=0
			2   ------
			*/

			const x = k;
			const rx = Math.min(radius, x - 1, 256 - x);

			const i2 = 258 + x;
			let sumNZ: number;
			if (integralNZ) {
				const ANZ = 0;
				const BNZ = 0;
				const CNZ = integralNZ[i2 - rx - 1];
				const DNZ = integralNZ[i2 + rx];
				sumNZ = ANZ + DNZ - BNZ - CNZ; // amount of non Zero values
			} else {
				sumNZ = (2 * rx + 1) * 2; // all values are non Zero
			}

			const A = 0;
			const B = 0;
			const C = integral[i2 - rx - 1];
			const D = integral[i2 + rx];
			const sum = A + D - B - C;

			const s = sum / sumNZ;

			im.raw[ti - 258] = s; // 0 line
			im.raw[ti] = s; // 1 line
		} // top

		// bottom two lines
		const bi = 258 * 256 + k;
		if (im.raw[bi]) {
			/*
			       |
			     012345
			254  ------
			255  A--B--
			256  -+o+--  - (2,256) ry=1
			257  C++D--

			        |
			     012345
			254  --------
			255  A----B--
			256  -++o++--  - (3,256) ry=2
			257  C++++D--
			*/
			const x = k;
			const rx = Math.min(radius, x - 1, 256 - x);
			const i1 = 258 * 255 + x;
			const i2 = 258 * 257 + x;
			const A = integral[i1 - rx - 1];
			const B = integral[i1 + rx];
			const C = integral[i2 - rx - 1];
			const D = integral[i2 + rx];
			const sum = A + D - B - C;

			let sumNZ: number;
			if (integralNZ) {
				const ANZ = integralNZ[i1 - rx - 1];
				const BNZ = integralNZ[i1 + rx];
				const CNZ = integralNZ[i2 - rx - 1];
				const DNZ = integralNZ[i2 + rx];
				sumNZ = ANZ + DNZ - BNZ - CNZ; // amount of non Zero values
			} else {
				sumNZ = (2 * rx + 1) * 2; // all values are non Zero
			}

			const s = sum / sumNZ;
			im.raw[bi] = s; // 256 row
			im.raw[bi + 258] = s; // 257 row
		} // bottom

		// left two lines
		const li = 258 * k + 1;
		if (im.raw[li]) {
			const y = k;
			const ry = Math.min(radius, y - 1, 256 - y);
			const i1 = 258 * (y - ry - 1) + 1;
			const i2 = 258 * (y + ry) + 1;

			let sumNZ: number;
			if (integralNZ) {
				const ANZ = 0;
				const BNZ = integralNZ[i1];
				const CNZ = 0;
				const DNZ = integralNZ[i2];
				sumNZ = ANZ + DNZ - BNZ - CNZ; // amount of non Zero values
			} else {
				sumNZ = (2 * ry + 1) * 2; // all values are non Zero
			}

			const A = 0;
			const B = integral[i1];
			const C = 0;
			const D = integral[i2];
			const sum = A + D - B - C;

			const s = sum / sumNZ;
			im.raw[li - 1] = s; // 0 column
			im.raw[li] = s; // 1 column
		} // left

		// right two lines
		const ri = 258 * k + 256;
		if (im.raw[ri]) {
			const y = k;
			const ry = Math.min(radius, y - 1, 256 - y);
			const i1 = 258 * (y - ry - 1) + 256;
			const i2 = 258 * (y + ry) + 256;

			let sumNZ: number;
			if (integralNZ) {
				const ANZ = integralNZ[i1 - 1];
				const BNZ = integralNZ[i1 + 1];
				const CNZ = integralNZ[i2 - 1];
				const DNZ = integralNZ[i2 + 1];
				sumNZ = ANZ + DNZ - BNZ - CNZ; // amount of non Zero values
			} else {
				sumNZ = 2 * (2 * ry + 1); // all values are non Zero
			}

			const A = integral[i1 - 1];
			const B = integral[i1 + 1];
			const C = integral[i2 - 1];
			const D = integral[i2 + 1];
			const sum = A + D - B - C;

			const s = sum / sumNZ;
			im.raw[ri] = s; // 256 column
			im.raw[ri + 1] = s; // 257 column
		} // right
	} // for k

	return im;
}

/**
 * Convert Uin32 RGB color to web color
 * @param color - Uin32 color
 * @returns web color in format '#RRGGBB'
 * */
export function RGBtoHEX(rgb: number): string {
	const r = (rgb >> 0) & 255;
	const g = (rgb >> 8) & 255;
	const b = (rgb >> 16) & 255;
	let rs = r.toString(16);
	let gs = g.toString(16);
	let bs = b.toString(16);
	rs = rs.length === 2 ? rs : '0' + rs;
	gs = gs.length === 2 ? gs : '0' + gs;
	bs = bs.length === 2 ? bs : '0' + bs;
	return '#' + rs + gs + bs;
}

/**
 * Convert Uin32 RGBA color to web color
 * @param color - Uin32 color
 * @returns web color in format '#RRGGBBAA'
 * */
export function RGBAtoHEX(rgba: number): string {
	const r = (rgba >> 0) & 255;
	const g = (rgba >> 8) & 255;
	const b = (rgba >> 16) & 255;
	const a = (rgba >> 24) & 255;
	let rs = r.toString(16);
	let gs = g.toString(16);
	let bs = b.toString(16);
	let as = a.toString(16);
	rs = rs.length === 2 ? rs : '0' + rs;
	gs = gs.length === 2 ? gs : '0' + gs;
	bs = bs.length === 2 ? bs : '0' + bs;
	as = as.length === 2 ? as : '0' + as;
	return '#' + rs + gs + bs + as;
}

/**
 * Convert web color to Uin32 RGB color
 * @param color - web color in format '#RGB' or '#RRGGBB' or '#RRGGBBAA'
 * @returns Uin32 color
 * */
export function HEXtoRGBA(c: string): number {
	if (c[0] === '#') {
		if (c.length === 4) return +('0xff' + c[3] + c[3] + c[2] + c[2] + c[1] + c[1]);
		if (c.length === 7) return +('0xff' + c[5] + c[6] + c[3] + c[4] + c[1] + c[2]);
		if (c.length === 9) return +('0x' + c[7] + c[8] + c[5] + c[6] + c[3] + c[4] + c[1] + c[2]);
	}

	WXLOG('wrong color format', c);

	return 0;
}

/**
 * json loader helper
 * @template {any} T - type of the object to load
 * @param url - url to json file
 * @param requestInit - requestInit for fetch
 * @returns json object
 * */
export async function fetchJson<T = any>(url: RequestInfo, requestInit?: RequestInit): Promise<T> {
	const response = await fetch(url, requestInit);
	if (!response.ok) {
		throw new Error('error:' + url + ' - ' + response.statusText);
	}

	return response.json();
}

/**
 * Create element helper
 * @param tag - tag name
 * @param className - class name
 * @param container - container to append element
 * @returns created element
 * */
export function createEl(tagName: string, className = '', container?: HTMLElement): HTMLElement {
	const el = document.createElement(tagName); // Object.assign(document.createElement(tagName), { className });
	el.className = className;
	container && container.appendChild?.(el);
	return el;
}

/**
 * Color linear mixer
 * @param color1 - color1 Uin32 RGBA
 * @param color2 - color2 Uin32 RGBA
 * @param k - koefficient
 * @returns mixed color Uin32 RGBA
 * */
export function mixColor(c1: number, c2: number, t: number): number {
	const r1 = (c1 >> 0) & 255;
	const g1 = (c1 >> 8) & 255;
	const b1 = (c1 >> 16) & 255;
	const a1 = c1 >>> 24;

	const r2 = (c2 >> 0) & 255;
	const g2 = (c2 >> 8) & 255;
	const b2 = (c2 >> 16) & 255;
	const a2 = c2 >>> 24;

	const r = r1 + t * (r2 - r1);
	const g = g1 + t * (g2 - g1);
	const b = b1 + t * (b2 - b1);
	const a = a1 + t * (a2 - a1);
	return r | (g << 8) | (b << 16) | (a << 24);
}

/**
 * Helper to create array of levels for a style
 * @param min - min value
 * @param max - max value
 * @param n - number of levels
 * @returns array of levels
 * */
export function createLevels(min: number, max: number, n: number): number[] {
	// create 10 levels from min to max
	const levels: number[] = [];
	for (let i = 0; i < n; ++i) {
		levels.push((i * (max - min)) / (n - 1) + min);
	}
	return levels;
}

/**
 * Get closest existing time in array. If time is Date, strings will be converted to number to find closest time
 * @param times - array of times
 * @param time - time to find
 * @returns closest time a value from array
 * */
export function getClosestTimeString(times: string[], time: Date | string | number): string {
	let unixTime: number = typeof time === 'number' ? time : typeof time === 'string' ? new Date(time).getTime() : time.getTime();
	// Take the next times[]'s after unixTime OR the last
	return times.find((stime) => new Date(stime).getTime() >= unixTime) || times[times.length - 1];
}

var wxlogging: boolean = false;
/**
 * Logging helper
 * */
export let WXLOG = (...args: any[]) => {};

/**
 * Set logging on/off
 * @param logging - true to turn on logging
 * */
export function WxTilesLogging(on?: boolean | ((...args: any[]) => void)) {
	wxlogging = !!on;
	console.log('WXLOGing', wxlogging);
	WXLOG = typeof on === 'function' ? on : wxlogging ? console.log : () => {};
}

/**
 * Helper to convert short form of web color from '#RGB' to '#RRGGBB'
 * @param color - web color in format '#RGB' or '#RRGGBB' or '#RRGGBBAA'
 * @returns web color in format '#RRGGBB'
 * */
export function refineColor(c: string): string {
	// convert short form of color into long  #25f => #2255ff
	return c[0] === '#' && c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
}

/**
 * Helper to fill URI template with values
 * @param uri - URI template
 * @param values - {@link XYZ} values to fill template
 * @returns URI with values filled
 * */
export function uriXYZ(uri: string, { x, y, z }: XYZ): string {
	return uri.replace('{x}', `${x}`).replace('{y}', `${y}`).replace('{z}', `${z}`);
	// return uri.replace('{x}', x.toString()).replace('{y}', y.toString()).replace('{z}', z.toString());
}

/**
 * Calculate hash of {@link XYZ}
 * @param xyz - {@link XYZ} to calculate hash
 * @returns string hash
 * */
export function HashXYZ({ x, y, z }: XYZ): string {
	return `${z}-${x}-${y}`;
}
