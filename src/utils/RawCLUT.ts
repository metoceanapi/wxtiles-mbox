import { HEXtoRGBA, RGBtoHEX, makeConverter, WxGetColorSchemes, mixColor, createLevels, WXLOG } from './wxtools';
import type { Converter, WxColorStyleStrict } from './wxtools';

/** classic clamp */
function clamp(val: number, min: number, max: number): number {
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
 * @internal
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
	 * @param {WxColorStyleStrict} style the color style
	 * @param {string} dUnits the units of the data
	 * @param {[number, number]} minmax the array of minimum and maximum data values
	 * @param {boolean} vector if true, the style is for vector data
	 * */
	constructor(style: WxColorStyleStrict, dUnits: string, [dataMin, dataMax]: [number, number], vector: boolean) {
		WXLOG(`RawCLUT.constructor`);
		this.levelIndex = new Uint32Array(65536);
		this.colorsI = new Uint32Array(65536);
		let levels: number[]; // data values of the legend

		this.DataToStyle = makeConverter(dUnits, style.units, style.extraUnits);
		if (this.DataToStyle.trivial) style.units = dUnits; // in case Style doesn't contain unit or incorrect units, use dUnits
		vector && (this.DataToKnots = makeConverter(dUnits, 'knot')); // for `barbs` and `arrows` fonts
		const styleValToData = makeConverter(style.units, dUnits, style.extraUnits);
		const styleValToRAW = (x: number) => ~~(65535 * clamp((styleValToData(x) - dataMin) / (dataMax - dataMin), 0, 1));

		// A MAGIC with colors and levels is happening here
		if (style.colorMap?.length) {
			/** convert style ticks to data ticks, data ticks to indexes [0-65535]
			 * used for filling {@link levelIndex} */
			levels = style.colorMap.sort((a, b) => a[0] - b[0]).map(([val]) => styleValToRAW(val));
		} else {
			// check levels, if empty - create them
			style.levels ||= createLevels(this.DataToStyle(dataMin), this.DataToStyle(dataMax), 10);
			style.levels.sort((a: number, b: number) => a - b);

			// if no colors in the style, try predefined color schemes
			const colorSchemes = WxGetColorSchemes();
			style.colors ||= colorSchemes[(style.colorScheme && style.colorScheme in colorSchemes && style.colorScheme) || 'wb'];

			levels = style.levels.map(styleValToRAW);
		}

		const dataDifMul = dataMax - dataMin;
		const legend = WxCreateLegend(65536, style);
		this.ticks = legend.ticks;
		const legendDataMin = legend.ticks[0].data;
		const legendDataMax = legend.ticks[legend.ticks.length - 1].data;
		const legendDataDif = legendDataMax - legendDataMin;
		const colorBelowMin = style.showBelowMin ? legend.colors[0] : 0;
		const colorAboveMax = style.showAboveMax ? legend.colors[65535] : 0;
		// fill up 'colorsI' (is the actual color look up table)
		// legend.colors and colorsI are different as legend.colors contains only colors from the legend
		// colorsI contains colors for all possible data values
		// for each index in [0, 65535] for the packed data value
		// find the corresponding color index in the legend
		this.colorsI[0] = 0; // set color for NODATA
		for (let i = 1; i < 65536; ++i) {
			const dataInStyleUnits = this.DataToStyle((dataDifMul * i) / 65535 + dataMin); // index -> data -> style units
			const legendIndex = Math.round((65535 * (dataInStyleUnits - legendDataMin)) / legendDataDif); // style units -> legend index
			this.colorsI[i] = legendIndex <= 0 ? colorBelowMin : legendIndex > 65535 ? colorAboveMax : legend.colors[legendIndex];
		}

		// fill up 'levelIndex'
		// 1. fill up left part of levelIndex (before the first level)
		for (let i = 0; i < levels[0]; ++i) {
			this.levelIndex[i] = 0;
		}
		// 2. fill up middle part of levelIndex
		for (let li = 0; li < levels.length - 1; li++) {
			for (let i = levels[li]; i < levels[li + 1] + 1; ++i) {
				this.levelIndex[i] = li;
			}
		}
		// 3. fill up the rest of levelIndex after the last colorMap value
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
 * @param legendSize - number of colors in the legend
 * @param style - color style
 * @returns legend
 * */
export function WxCreateLegend(legendSize: number, style: WxColorStyleStrict): WxLegend {
	const legend: WxLegend = {
		size: legendSize,
		showBelowMin: style.showBelowMin,
		showAboveMax: style.showAboveMax,
		units: style.units,
		colors: new Uint32Array(legendSize),
		ticks: [],
	};
	const { colorMap, levels, colors } = style;
	const gradient = style.fill !== 'solid';

	// use colorMap if presented
	if (colorMap) {
		const mapsDataMin = colorMap[0][0];
		const mapsDataDifMul = (legendSize - 1) / (colorMap[colorMap.length - 1][0] - mapsDataMin);
		// fill 'ticks'
		legend.ticks = colorMap.map(([data, color]) => <WxTick>{ data, dataString: numToString(data), color, pos: ~~((data - mapsDataMin) * mapsDataDifMul) });

		// fill 'colors'
		for (let li = 0; li < colorMap.length - 1; li++) {
			const pos0 = legend.ticks[li].pos;
			const pos1 = legend.ticks[li + 1].pos;
			const c0 = HEXtoRGBA(colorMap[li][1]);
			const c1 = gradient ? HEXtoRGBA(colorMap[li + 1][1]) : 0;
			for (let i = pos0; i < pos1; ++i) {
				legend.colors[i] = gradient ? mixColor(c0, c1, (i - pos0) / (pos1 - pos0)) : c0;
			}
		}

		// fill the last of 'colors' with the exact last colorMap's color value
		legend.colors[legendSize - 1] = HEXtoRGBA(colorMap[colorMap.length - 1][1]);
		return legend;
	}

	if (!colors || !levels) return legend; // empty

	let c0 = 0;
	let c1 = 0;
	let ci = -1;
	for (let i = 0; i < legendSize; ++i) {
		const cf = (i * (colors.length - 1)) / legendSize; // float index in colors for the current legend.colors index
		if (ci !== ~~cf) {
			ci = ~~cf;
			c0 = HEXtoRGBA(colors[ci]);
			c1 = colors.length > ci + 1 ? HEXtoRGBA(colors[ci + 1]) : c0;
		}

		legend.colors[i] = gradient ? mixColor(c0, c1, cf - ci) : c0;
	}

	legend.colors[legendSize - 1] = HEXtoRGBA(colors[colors.length - 1]);

	// fill 'ticks'
	const levelsDataMin = levels[0];
	const levelsDataMul = (legendSize - 1) / (levels[levels.length - 1] - levelsDataMin);

	legend.ticks = levels.map((data) => {
		const pos = ~~((data - levelsDataMin) * levelsDataMul);
		return { data, dataString: numToString(data), pos, color: RGBtoHEX(legend.colors[pos]) };
	});

	return legend;
}
