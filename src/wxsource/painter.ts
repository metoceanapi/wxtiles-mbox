import { RawCLUT } from '../utils/RawCLUT';
import { ColorStyleStrict, DataIntegral, DataPicture, HEXtoRGBA, XYZ } from '../utils/wxtools';
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
		const imageData = this._fill(data[0], this.wxsource);
		const isoInfo = this._fillIsolines(data[0], imageData, this.wxsource);

		return imageData;
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

	protected _fillIsolines(data: DataPicture, imageData: ImageData, { CLUT, style, tileSize }: WxTileSource): IsoInfo[] {
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

	protected _fillIsolineText(info: IsoInfo[], imageData: ImageData, { style }: WxTileSource): void {
		const imageFillBuffer = new Uint32Array(imageData.data.buffer); // a usefull representation of image's bytes (same memory)
		const { fontSize, fontColor } = style;
		const { x, y, d, dr, db, mli } = info[0];
		const text = `${d} ${dr} ${db}`;
		const textWidth = text.length * fontSize;
		const textHeight = fontSize;
		const textX = x - textWidth / 2;
		const textY = y - textHeight / 2;
		const textColor = fontColor[0] === '#' ? HEXtoRGBA(fontColor) : 0;
		for (let i = 0; i < text.length; ++i) {
			const c = text.charCodeAt(i);
			const x = textX + i * fontSize;
			const y = textY;
			for (let j = 0; j < fontSize; ++j) {
				const ii = (y + j) * 256 + x;
				imageFillBuffer[ii] = textColor;
			}
		}
	}

	/* 
		protected _drawFillAndIsolines(): void {
		const { imageDataForFillCtx } = this;

		const { canvasFillCtx } = this;
		// canvasFillCtx.clearRect(0, 0, 256, 256); // transfered to this.draw
		const imageFillBuffer = new Uint32Array(imageDataForFillCtx.data.buffer); // a usefull representation of image's bytes (same memory)
		const { raw } = this.data[0]; // scalar data
		const { clut, style } = this.layer;
		const { levelIndex, colorsI } = clut;

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

		const info: {
			x: number;
			y: number;
			d: number;
			dr: number;
			db: number;
			mli: number;
		}[] = []; // numbers on isolines

		// isolineColor: none, #bbaa88ff - "solid color", fill, inverted
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

		canvasFillCtx.putImageData(imageDataForFillCtx, 0, 0);

		// drawing Info
		if (info.length) {
			canvasFillCtx.font = '1.1em Sans-serif';
			canvasFillCtx.lineWidth = 2;
			canvasFillCtx.strokeStyle = 'white'; // RGBtoHEX(p.c); // alfa = 255
			canvasFillCtx.fillStyle = 'black';
			canvasFillCtx.textAlign = 'center';
			canvasFillCtx.textBaseline = 'middle';
			for (const { x, y, d, dr, db, mli } of info) {
				const val = this.layer.clut.ticks[mli].dataString; // select value from levels/colorMap
				const angle = Math.atan2(d - dr, db - d); // rotate angle: we can use RAW d, dd, and dr for atan2!
				canvasFillCtx.save();
				canvasFillCtx.translate(x, y);
				canvasFillCtx.rotate(angle < -1.57 || angle > 1.57 ? angle + 3.14 : angle); // so text is always up side up
				canvasFillCtx.strokeText(val, 0, 0);
				canvasFillCtx.fillText(val, 0, 0);
				canvasFillCtx.restore();
			}
		} // if info.length
	} // drawIsolines
 //*/
}
