import { WxCreateLegend, type WxColorStyleStrict } from '../index';

// // Leaflet
// const legendControl = new WxLegendControl();
// 	map.addControl(new (L.Control.extend(legendControl.extender()))({ position: 'topright' }));

// // MBox
// const legendControl = new WxLegendControl();
// map.addControl(legendControl, 'top-right');

export class WxLegendControl {
	private readonly _canvas: HTMLCanvasElement;
	constructor() {
		const canvas = document.createElement('canvas');
		canvas.className = 'mapboxgl-ctrl';
		canvas.width = 600;
		canvas.height = 40;
		canvas.style.borderStyle = 'solid';
		canvas.style.borderColor = '#000';
		canvas.style.backgroundColor = '#fff';
		this._canvas = canvas;
	}

	onAdd(/* map */) {
		return this._canvas;
	}

	onRemove() {
		this._canvas.parentNode?.removeChild(this._canvas);
	}

	drawLegend(style: WxColorStyleStrict) {
		const { _canvas } = this;
		const { width, height } = _canvas;
		const halfHeight = (16 + height) >> 2;
		const legend = WxCreateLegend(width - 50, style);

		// draw legend
		const ctx = _canvas.getContext('2d')!;
		const imData = ctx.createImageData(width, height);
		const im = new Uint32Array(imData.data.buffer);
		im.fill(-1);

		const startX = 2;
		const startY = 2;
		const startXY = startX + width * startY;

		const trSize = halfHeight >> 1;
		// left triangle
		if (legend.showBelowMin) {
			const c = legend.colors[0];
			if (c) {
				for (let x = 0; x < trSize; ++x) {
					for (let y = trSize; y < trSize + x; ++y) {
						im[startXY + x + y * width] = c;
						im[startXY + x + (trSize * 2 - y) * width] = c;
					}
				}
			}
		}

		for (let x = 0; x < legend.size; ++x) {
			for (let y = 0; y < halfHeight; ++y) {
				if (legend.colors[0]) {
					im[startX + x + trSize + (y + startY + 1) * width] = legend.colors[x];
				}
			}
		}

		// right triangle
		if (legend.showAboveMax) {
			const c = legend.colors[legend.colors.length - 1];
			if (c) {
				for (let x = 0; x <= trSize; ++x) {
					for (let y = trSize; y < trSize + x; ++y) {
						im[startXY + trSize * 2 + legend.size - x + y * width] = c;
						im[startXY + trSize * 2 + legend.size - x + (trSize * 2 - y) * width] = c;
					}
				}
			}
		}

		ctx.putImageData(imData, 0, 0);

		// draw ticks
		ctx.font = '8px sans-serif';
		ctx.beginPath();
		for (const tick of legend.ticks) {
			ctx.strokeStyle = '#000';
			ctx.moveTo(tick.pos + trSize + startX + 1, startY + 3);
			ctx.lineTo(tick.pos + trSize + startX + 1, halfHeight);
			ctx.fillText(tick.dataString, tick.pos + trSize + startX + 1, halfHeight + 11);
		}

		ctx.font = '12px sans-serif';
		ctx.fillText(`(${legend.units})`, 13, height - 5);
		ctx.stroke();

		ctx.strokeStyle = '#888';
		ctx.strokeRect(1, 1, width - 3, height - 2); //for white background
	}

	// for Leaflet
	extender() {
		return { onAdd: () => this.onAdd(), onRemove: () => this.onRemove() };
	}
}
