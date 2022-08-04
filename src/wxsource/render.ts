import { RawCLUT } from '../utils/RawCLUT';
import { ColorStyleStrict, DataIntegral } from '../utils/wxtools';
import { WxTileSource } from './wxsource';

export class Painter {
	wxsource: WxTileSource;

	constructor(wxsource: WxTileSource) {
		this.wxsource = wxsource;
	}

	paint(data: DataIntegral[], tile: { z: number; x: number; y: number }): ImageData {

		const imageData = new ImageData(this.wxsource.tileSize, this.wxsource.tileSize);
		const dataArray = new Uint8ClampedArray(imageData.data.buffer);
		const dataArrayLength = dataArray.length;
		// const dataArrayIndex = (x: number, y: number) => {
		// 	return (y * tile.width + x) * 4;
		// };
		// for (let y = 0; y < tile.height; y++) {
		// 	for (let x = 0; x < tile.width; x++) {
		// 		const index = dataArrayIndex(x, y);
		// 		const value = data.getValue(x, y);
		// 		const color = this.style.getColor(value);
		// 		dataArray[index] = color.r;
		// 		dataArray[index + 1] = color.g;
		// 		dataArray[index + 2] = color.b;
		// 		dataArray[index + 3] = 255;
		// 	}
		// }
		return imageData;
	}
}
