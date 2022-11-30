import { HEXtoRGBA, RGBtoHEX, makeConverter, WxGetColorSchemes, mixColor, createLevels, WXLOG } from './wxtools';
import { Converter, WxColorStyleStrict } from './wxtools';

/** classic clamp */
function clamp(val: number, min: number, max: number) {
	return val > max ? max : val < min ? min : val;
}

/** data values of the legend */
export interface WxTick {
	/** the data value */
	data: number;
	/** compact string representation of the data value */
	dataString: string;
	/** the color of the data value in web format */
	color: string;
	/** the position of the data value on the legend in [0, legendSize] */
	pos: number;
}

/**
 * Class contains information about the color style and the legend
 * Based on the idea of CLUT (Color Look Up Table) to fill tiles with colors from the style
 */
export class RawCLUT {
	/** convert data value to level index */
	levelIndex: Uint32Array;
	/** convert data value to color index */
	colorsI: Uint32Array;
	/** convert data value to style value */
	DataToStyle: Converter;
	/** convert data value to knots. Useful for styles for vector data to get the direction of the vector */
	DataToKnots?: Converter;
	/** data values of the legend */
	ticks: WxTick[];

	/**
	 * @param style the color style
	 * @param dUnits the units of the data
	 * @param minmax the array of minimum and maximum data values
	 * @param vector if true, the style is for vector data
	 * */
	constructor(style: WxColorStyleStrict, dUnits: string, [dMin, dMax]: [number, number], vector: boolean) {
		WXLOG(`RawCLUT.constructor`);
		const dDif = dMax - dMin;
		this.levelIndex = new Uint32Array(65536);
		this.colorsI = new Uint32Array(65536);
		const levels: number[] = [];

		this.DataToStyle = makeConverter(dUnits, style.units, style.extraUnits);
		if (this.DataToStyle.trivial) style.units = dUnits; // in case Style doesn't contain unit or incorrect units, use dUnits
		vector && (this.DataToKnots = makeConverter(dUnits, 'knot')); // for `barbs` and `arrows` fonts
		const styleValToData = makeConverter(style.units, dUnits, style.extraUnits);
		const styleValToRAW = (x: number) => ~~(65535 * clamp((styleValToData(x) - dMin) / (dMax - dMin), 0, 1));

		// A MAGIC with colors and levels is happening here
		if (Array.isArray(style.colorMap)) {
			style.colorMap.sort((a: [number, string], b: [number, string]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
			for (const [val] of style.colorMap) {
				// convert style ticks to data ticks, data ticks to indexes [0-65535]
				levels.push(styleValToRAW(val));
			}
		} else {
			// check levels
			if (!style.levels) {
				style.levels = createLevels(this.DataToStyle(dMin), this.DataToStyle(dMax), 10);
			}
			style.levels.sort((a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0));

			if (!style.colors) {
				const colorSchemes = WxGetColorSchemes();
				// try to use colors array first. if nothig here create it from a scheme
				if (style.colorScheme && style.colorScheme in colorSchemes) {
					style.colors = colorSchemes[style.colorScheme];
				} else {
					// if there is no scheme create random scheme
					style.colors = colorSchemes.wb;
				}
			}

			for (const val of style.levels) {
				// convert style ticks to data ticks, data ticks to indexes [0-65535]
				levels.push(styleValToRAW(val));
			}
		}

		const lSize = 65536;
		const legend = WxCreateLegend(lSize, style);
		this.ticks = legend.ticks;
		const lMin = legend.ticks[0].data;
		const lMax = legend.ticks[legend.ticks.length - 1].data;
		const lDif = lMax - lMin;
		for (let i = 0; i < 65536; ++i) {
			const d = (dDif * i) / 65535 + dMin; // index -> data
			const l = this.DataToStyle(d); // data -> style units
			const li = Math.round(((lSize - 1) * (l - lMin)) / lDif); // style units -> legend index
			if (li <= 0) {
				this.colorsI[i] = style.showBelowMin ? legend.colors[0] : 0;
			} else if (li >= lSize) {
				this.colorsI[i] = style.showAboveMax ? legend.colors[lSize - 1] : 0;
			} else {
				this.colorsI[i] = legend.colors[li];
			}
		}

		this.colorsI[0] = 0;

		// fill up 'levelIndex'
		// fill up left part of levelIndex (before the first level)
		for (let i = 0; i < levels[0]; ++i) {
			this.levelIndex[i] = 0;
		}
		for (let li = 0; li < levels.length - 1; li++) {
			for (let i = levels[li]; i < levels[li + 1] + 1; ++i) {
				this.levelIndex[i] = li;
			}
		}
		// fill up the rest of levelIndex after the last colorMap value
		for (let i = levels[levels.length - 1]; i < 65536; ++i) {
			this.levelIndex[i] = levels.length - 1;
		}
	} // constructor
} // class CLUT

/** Build compact string representation of a number */
function numToString(n: number) {
	if (n !== 0 && -0.1 < n && n < 0.1) return n.toExponential(2);
	const ns = n.toString();
	if (ns.split('.')[1]?.length > 2) return n.toFixed(2);
	return ns;
}

/** Legend - data structure that contains information for rendering legends */
export interface WxLegend {
	/** size of the legend in pixels */
	size: number;
	/** show color for values below min */
	showBelowMin: boolean;
	/** show color for values above max */
	showAboveMax: boolean;
	/** units of the legend */
	units: string;
	/** array of colors */
	colors: Uint32Array;
	/** array of ticks */
	ticks: WxTick[];
}

/** Create a legend for a given color style
 * @param size - number of colors in the legend
 * @param style - color style
 * @returns legend
 * */
export function WxCreateLegend(size: number, style: WxColorStyleStrict): WxLegend {
	const legend: WxLegend = {
		size,
		showBelowMin: style.showBelowMin,
		showAboveMax: style.showAboveMax,
		units: style.units,
		colors: new Uint32Array(size),
		ticks: [],
	};
	const { colorMap, levels, colors } = style;
	const gradient = style.fill !== 'solid';

	// use colorMap if presented
	if (colorMap) {
		const dMin = colorMap[0][0];
		const dDif = colorMap[colorMap.length - 1][0] - dMin;
		// fill 'ticks'
		for (const [data, color] of colorMap) {
			const pos = ~~(((data - dMin) / dDif) * (size - 1));
			const tick: WxTick = { data, dataString: numToString(data), color, pos };
			legend.ticks.push(tick);
		}

		// if (style.fill !== 'none') {
		for (let li = 0; li < colorMap.length - 1; li++) {
			const pos0 = legend.ticks[li].pos;
			const pos1 = legend.ticks[li + 1].pos;
			const c0 = HEXtoRGBA(colorMap[li][1]);
			const c1 = gradient ? HEXtoRGBA(colorMap[li + 1][1]) : 0;
			for (let i = pos0; i < pos1; ++i) {
				legend.colors[i] = gradient ? mixColor(c0, c1, (i - pos0) / (pos1 - pos0)) : c0;
			}
		}
		legend.colors[size - 1] = HEXtoRGBA(colorMap[colorMap.length - 1][1]);
		// }
		return legend;
	}

	if (!colors || !levels) return legend;

	let c0 = 0;
	let c1 = 0;
	let ci = -1;
	for (let i = 0; i < size; ++i) {
		const cf = (i * (colors.length - 1)) / size;
		if (ci !== ~~cf) {
			ci = ~~cf;
			c0 = HEXtoRGBA(colors[ci]);
			c1 = colors.length > ci + 1 ? HEXtoRGBA(colors[ci + 1]) : c0;
		}
		legend.colors[i] = gradient ? mixColor(c0, c1, cf - ci) : c0;
	}
	legend.colors[size - 1] = HEXtoRGBA(colors[colors.length - 1]);
	// fill 'ticks'
	const dMin = levels[0];
	const dMul = (size - 1) / (levels[levels.length - 1] - dMin);

	for (const data of levels) {
		const pos = ~~((data - dMin) * dMul);
		const tick: WxTick = { data, dataString: numToString(data), color: RGBtoHEX(legend.colors[pos]), pos };
		legend.ticks.push(tick);
	}

	return legend;
}
