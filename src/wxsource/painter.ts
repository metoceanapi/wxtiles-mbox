import { create2DContext, type DataPicture, HEXtoRGBA, RGBtoHEX } from '../utils/wxtools';
import { type wxData } from './loader';
import { type WxTileSource } from './wxsource';

interface IsoInfo {
	x: number;
	y: number;
	d: number;
	dr: number;
	db: number;
	mli: number;
}

export class Painter {
	protected wxsource: WxTileSource;

	constructor(wxsource: WxTileSource) {
		this.wxsource = wxsource;
	}

	paint(data: wxData): HTMLCanvasElement {
		const { wxsource } = this;
		const { tileSize } = wxsource;
		const imageData = new ImageData(tileSize, tileSize);
		const imageBuffer = new Uint32Array(imageData.data.buffer); // a usefull representation of image's bytes (same memory)

		this._fill(data.data[0], imageBuffer, wxsource);
		const isoInfo = this._fillIsolines(imageBuffer, data.data[0], wxsource);

		const context = create2DContext({ width: 256, height: 256 });
		context.putImageData(imageData, 0, 0);
		this._fillIsolineText(isoInfo, context, wxsource);
		this._drawVectorsStatic(data.data, context, wxsource);
		this._drawDegreesStatic(data.data[0], context, wxsource);
		this._drawStreamLinesStatic(data, context, wxsource);

		return context.canvas;
	}

	imprintVectorAnimationLinesStep(data: wxData, background: HTMLCanvasElement, wxsource: WxTileSource, step: number): HTMLCanvasElement {
		if (data.slines.length === 0 || wxsource.style.streamLineStatic || wxsource.style.streamLineColor === 'none') return background;

		const ctxSlines = create2DContext({ width: 256, height: 256 });
		ctxSlines.drawImage(background, 0, 0);
		this._drawVectorAnimationLinesStep(data, ctxSlines, wxsource, step);
		return ctxSlines.canvas;
	}

	protected _fill(data: DataPicture, imageBuffer: Uint32Array, { CLUT, style }: WxTileSource) {
		const { raw } = data; // scalar data
		const { colorsI } = CLUT;
		// fill: none, gradient, solid
		if (style.fill !== 'none') {
			for (let y = 0, i = 0, di = 259; y < 256; ++y, di += 2) {
				for (let x = 0; x < 256; ++x, ++i, ++di) {
					imageBuffer[i] = colorsI[raw[di]];
				}
			}
		} else {
			imageBuffer.fill(0);
		}
	}

	protected _fillIsolines(imageBuffer: Uint32Array, data: DataPicture, { CLUT, style }: WxTileSource): IsoInfo[] {
		const { raw } = data; // scalar data
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
								imageBuffer[ii] = ~colorsI[md] | 0xff000000; // invert color and make alfa = 255
								break;
							case 'fill':
								imageBuffer[ii] = colorsI[md] | 0xff000000; // make alfa = 255
								break;
							default:
								imageBuffer[ii] = flatColor;
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

	protected _drawDegreesStatic(data: DataPicture, ctx: CanvasRenderingContext2D, { CLUT, style }: WxTileSource): void {
		const { units } = this.wxsource.getCurrentMeta();
		if (units !== 'degree') return;
		const addDegrees = 0.017453292519943 * style.addDegrees;

		ctx.font = '50px arrows';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const vecChar = 'L';

		// const zdif = Math.max(this.coords.z - this.layer.dataSource.meta.maxZoom, 0);
		const gridStep = 32; //Math.min(2 ** (zdif + 5), 128);
		for (let y = gridStep / 2; y < 256; y += gridStep) {
			for (let x = gridStep / 2; x < 256; x += gridStep) {
				const di = x + 1 + (y + 1) * 258;
				if (!data.raw[di]) continue; // NODATA
				const angDeg = data.dmin + data.raw[di] * data.dmul + 180;
				const ang = angDeg * 0.01745329251; // pi/180
				switch (style.vectorColor) {
					case 'inverted':
						ctx.fillStyle = RGBtoHEX(~CLUT.colorsI[data.raw[di]]); // alfa = 255
						break;
					case 'fill':
						ctx.fillStyle = RGBtoHEX(CLUT.colorsI[data.raw[di]]); // alfa = 255
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

	protected _drawStreamLinesStatic(wxdata: wxData, ctx: CanvasRenderingContext2D, { CLUT, style }: WxTileSource): void {
		const { data, slines } = wxdata;
		if (!slines.length || !style.streamLineStatic || style.streamLineColor === 'none') return;
		// const { canvasVectorAnimationCtx: ctx } = this;

		const l = data[0];
		ctx.lineWidth = 1;
		for (let i = slines.length; i--; ) {
			const sLine = slines[i];
			for (let k = 0; k < sLine.length - 1; ++k) {
				const p0 = sLine[k];
				const p1 = sLine[k + 1];
				const di = p0.x + 1 + (p0.y + 1) * 258;

				switch (style.streamLineColor) {
					case 'inverted':
						ctx.strokeStyle = RGBtoHEX(~CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					case 'fill':
						ctx.strokeStyle = RGBtoHEX(CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					default: // put color directly from vectorColor
						ctx.strokeStyle = style.streamLineColor;
						break;
				} // switch isoline_style

				ctx.beginPath();
				ctx.moveTo(p0.x, p0.y);
				ctx.lineTo(p1.x, p1.y);
				ctx.stroke();
			}
		}
	} // _drawStreamLinesStatic

	protected _drawVectorAnimationLinesStep(wxdata: wxData, ctx: CanvasRenderingContext2D, { CLUT, style }: WxTileSource, timeStemp: number): void {
		// 'timeStemp' is a time tick given by the browser's scheduller
		const { data, slines } = wxdata;
		// if (!slines.length || !style.streamLineStatic || style.streamLineColor === 'none') return; // done by the caller!!!
		const l = data[0];

		timeStemp = timeStemp >> 5;
		for (let i = 0; i < slines.length; ++i) {
			const sLine = slines[i];
			const sSize = sLine.length - 1;
			// seed - is the most opaque piece // TODO:improve?
			let seed = (timeStemp + (1 + sLine[0].x) * (1 + sLine[0].y)) % 30;
			for (let k = 0; k < sSize; ++k) {
				const p0 = sLine[k];
				const p1 = sLine[k + 1];
				let t = 1 - (seed - k) / sSize; // TODO: improve?
				if (t < 0 || t > 1) t = 0;
				const col = (~~(t * 255)).toString(16).padStart(2, '0');
				const w = 1 + ~~((1.2 - t) * 5);
				ctx.lineWidth = w;

				const di = p0.x + 1 + (p0.y + 1) * 258;
				let baseColor;
				switch (style.streamLineColor) {
					case 'inverted':
						baseColor = RGBtoHEX(~CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					case 'fill':
						baseColor = RGBtoHEX(CLUT.colorsI[l.raw[di]]); // alfa = 255
						break;
					default: // put color directly from vectorColor
						baseColor = style.streamLineColor;
						break;
				} // switch isoline_style

				ctx.strokeStyle = baseColor + col; //(col.length < 2 ? '0' + col : col);

				ctx.beginPath();
				ctx.moveTo(p0.x, p0.y);
				ctx.lineTo(p1.x, p1.y);
				ctx.stroke();
			} // for k
		} // for i
	} // _drawVectorAnimationLinesStep
}
