import { RawCLUT } from '../utils/RawCLUT';
import { ColorStyleStrict, create2DContext, DataIntegral, DataPicture, HEXtoRGBA, RGBtoHEX, XYZ } from '../utils/wxtools';
import { WxTileSource } from './wxsource';

interface IsoInfo {
	x: number;
	y: number;
	d: number;
	dr: number;
	db: number;
	mli: number;
}

export class Painter {
	wxsource: WxTileSource;

	constructor(wxsource: WxTileSource) {
		this.wxsource = wxsource;
	}

	paint(data: DataPicture[], tile: XYZ): ImageData {
		const { wxsource } = this;
		const imageData = this._fill(data[0], wxsource);
		const isoInfo = this._fillIsolines(imageData, data[0], wxsource);

		const context = create2DContext({ width: 256, height: 256 });
		context.putImageData(imageData, 0, 0);
		this._fillIsolineText(isoInfo, context, wxsource);
		this._drawVectorsStatic(data, context, wxsource);
		this._drawDegreesStatic(data, context, wxsource);

		// this._drawStreamLinesStatic(); // TODO!

		return context.getImageData(0, 0, 256, 256); // copy data back to imageData;
	}

	protected _fill(data: DataPicture, { CLUT, style, tileSize }: WxTileSource): ImageData {
		const imageData = new ImageData(tileSize, tileSize);
		const imageFillBuffer = new Uint32Array(imageData.data.buffer); // a usefull representation of image's bytes (same memory)
		const { raw } = data; // scalar data
		const { colorsI } = CLUT;
		// fill: none, gradient, solid
		if (style.fill !== 'none') {
			for (let y = 0, i = 0, di = 259; y < 256; ++y, di += 2) {
				for (let x = 0; x < 256; ++x, ++i, ++di) {
					imageFillBuffer[i] = colorsI[raw[di]];
				}
			}
		} else {
			imageFillBuffer.fill(0);
		}

		return imageData;
	}

	protected _fillIsolines(imageData: ImageData, data: DataPicture, { CLUT, style }: WxTileSource): IsoInfo[] {
		const { raw } = data; // scalar data
		const imageFillBuffer = new Uint32Array(imageData.data.buffer); // a usefull representation of image's bytes (same memory)
		const { levelIndex, colorsI } = CLUT;
		const info: IsoInfo[] = []; // numbers on isolines
		if (style.isolineColor !== 'none') {
			const flatColor = style.isolineColor[0] === '#' ? HEXtoRGBA(style.isolineColor) : 0;
			for (let y = 0, t = 0; y < 256; y += 1) {
				for (let x = 0; x < 256; x += 1) {
					const i = (y + 1) * 258 + (x + 1);
					const d = raw[i]; // central data
					const dr = raw[i + 1]; // right
					const db = raw[i + 258]; // bottom
					if (!d || !dr || !db) continue; // do not check isoline for NaN pixels (0)

					const lic = levelIndex[d]; // check level index aroud the current pixel
					const lir = levelIndex[dr]; // check level index aroud the current pixel
					const lib = levelIndex[db]; // check level index aroud the current pixel
					if (lic !== lir || lic !== lib) {
						const mli = Math.max(lic, lir, lib); // max level index out of three possible
						const md = Math.max(d, dr, db); // max data index out of three possible
						const ii = y * 256 + x;
						switch (style.isolineColor) {
							case 'inverted':
								imageFillBuffer[ii] = ~colorsI[md] | 0xff000000; // invert color and make alfa = 255
								break;
							case 'fill':
								imageFillBuffer[ii] = colorsI[md] | 0xff000000; // make alfa = 255
								break;
							default:
								imageFillBuffer[ii] = flatColor;
								break;
						} // switch isoline_style

						if (style.isolineText && !(++t % 255) && x > 20 && x < 235 && y > 20 && y < 235) {
							info.push({ x, y, d, dr, db, mli });
						}
					} // if isoline
				} // for x
			} // for y
		} // if (style.isolineColor != 'none')

		return info;
	}

	protected _fillIsolineText(info: IsoInfo[], ctx: CanvasRenderingContext2D, { CLUT }: WxTileSource): void {
		// drawing Info
		if (info.length) {
			ctx.font = '1.1em Sans-serif';
			ctx.lineWidth = 2;
			ctx.strokeStyle = 'white'; // RGBtoHEX(p.c); // alfa = 255
			ctx.fillStyle = 'black';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			for (const { x, y, d, dr, db, mli } of info) {
				const val = CLUT.ticks[mli].dataString; // select value from levels/colorMap
				const angle = Math.atan2(d - dr, db - d); // rotate angle: we can use RAW d, dd, and dr for atan2!
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(angle < -1.57 || angle > 1.57 ? angle + 3.14 : angle); // so text is always up side up
				ctx.strokeText(val, 0, 0);
				ctx.fillText(val, 0, 0);
				ctx.restore();
			}
		} // if info.length
	}

	protected _drawVectorsStatic(data: DataPicture[], ctx: CanvasRenderingContext2D, { CLUT, style }: WxTileSource): void {
		if (!CLUT.DataToKnots || style.vectorColor === 'none' || style.vectorType === 'none') return;
		if (data.length !== 3) throw new Error('this.data.length !== 3');
		const [l, u, v] = data;

		switch (style.vectorType) {
			case 'barbs':
				ctx.font = '40px barbs';
				break;
			case 'arrows':
				ctx.font = '50px arrows';
				break;
			default:
				ctx.font = style.vectorType;
		}

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const addDegrees = style.addDegrees ? 0.017453292519943 * style.addDegrees : 0;

		const gridStep = 32; //Math.min(2 ** (zdif + 5), 128);
		for (let y = gridStep / 2; y < 256; y += gridStep) {
			for (let x = gridStep / 2; x < 256; x += gridStep) {
				const di = x + 1 + (y + 1) * 258;
				if (!l.raw[di]) continue; // NODATA

				const ang = Math.atan2(u.dmin + u.raw[di] * u.dmul, v.dmin + v.raw[di] * v.dmul);
				const vecLen = l.dmin + l.raw[di] * l.dmul;
				const sm = style.vectorType !== 'barbs' ? style.vectorFactor * 0.2 : 0.2; /*0.2 to fit font*/
				const vecCode = Math.min(CLUT.DataToKnots(vecLen) * sm, 25 /* to fit .ttf */) + 65; /* A */
				const vecChar = String.fromCharCode(vecCode);
				switch (style.vectorColor) {
					case 'inverted':
						ctx.fillStyle = RGBtoHEX(~CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					case 'fill':
						ctx.fillStyle = RGBtoHEX(CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					default: // put color directly from vectorColor
						ctx.fillStyle = style.vectorColor;
						break;
				} // switch isoline_style

				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(ang + addDegrees);
				ctx.fillText(vecChar, 0, 0);
				ctx.restore();
			} // for x
		} // for y
	} // _drawVector

	protected _drawDegreesStatic(data: DataPicture[], ctx: CanvasRenderingContext2D, { CLUT, style, wxdataset, variables }: WxTileSource): void {
		const { min, max, units } = wxdataset.meta.variablesMeta[variables[0]];
		if (units !== 'degree') return;
		const addDegrees = 0.017453292519943 * style.addDegrees;

		ctx.font = '50px arrows';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		// ctx.clearRect(0, 0, 256, 256);
		const l = data[0];
		const vecChar = 'L';

		// const zdif = Math.max(this.coords.z - this.layer.dataSource.meta.maxZoom, 0);
		const gridStep = 32; //Math.min(2 ** (zdif + 5), 128);
		for (let y = gridStep / 2; y < 256; y += gridStep) {
			for (let x = gridStep / 2; x < 256; x += gridStep) {
				const di = x + 1 + (y + 1) * 258;
				if (!l.raw[di]) continue; // NODATA
				const angDeg = l.dmin + l.raw[di] * l.dmul + 180;
				const ang = angDeg * 0.01745329251; // pi/180
				switch (style.vectorColor) {
					case 'inverted':
						ctx.fillStyle = RGBtoHEX(~CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					case 'fill':
						ctx.fillStyle = RGBtoHEX(CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					default: // put color directly from vectorColor
						ctx.fillStyle = style.vectorColor;
						break;
				} // switch isoline_style

				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(ang + addDegrees);
				ctx.fillText(vecChar, 0, 0);
				ctx.restore();
			} // for x
		} // for y
	} // _drawDegree
}
