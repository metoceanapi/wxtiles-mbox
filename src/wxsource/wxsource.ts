import mapboxgl from 'mapbox-gl';

import { wxDataSet } from '../wxAPI/wxAPI';
import { ColorStyleStrict, ColorStyleWeak, HashXYZ, loadImageData, refineColor, uriXYZ, WxGetColorStyles, XYZ } from '../utils/wxtools';

import { RawCLUT } from '../utils/RawCLUT';
import { Painter } from './painter';
import { Loader } from './loader';

export class WxTileSource implements mapboxgl.CustomSourceInterface<ImageData> {
	type: 'custom' = 'custom';
	dataType: 'raster' = 'raster';

	id: string;
	variables: string[];
	wxdataset: wxDataSet;
	ext: string;

	map: mapboxgl.Map;

	time!: string; // is set in constructor by setTime()
	tilesURIs!: string[]; // is set in constructor by setTime()

	tileSize: number;
	maxzoom?: number;
	scheme?: string;
	bounds?: [number, number, number, number];
	attribution?: string;

	tilesdata: Map<string, ImageData> = new Map();

	wxstyleName!: string; // is set in constructor by setStyleName()
	style: ColorStyleStrict = WxGetColorStyles()['base'];
	CLUT!: RawCLUT; // is set in constructor by setStyleName()

	painter: Painter;
	loader: Loader;

	constructor({
		id,
		time,
		variables,
		wxdataset,
		ext = 'png',
		wxstyleName = 'base',
		map,
		tileSize = 256,
		maxzoom,
		scheme,
		bounds,
		attribution = 'wxTiles',
	}: {
		id: string;
		time?: string | number | Date;
		variables: string[];
		wxdataset: wxDataSet;
		ext?: string;
		map: mapboxgl.Map;
		wxstyleName?: string;
		tileSize?: number;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		// check variables
		if (!variables?.length || variables.length > 2) {
			throw new Error(`wxTileSource ${wxdataset.name}: only 1 or 2 variables are supported but ${variables.length} were given`);
		}

		variables.forEach((v) => {
			if (!wxdataset.checkVariableValid(v)) throw new Error(`wxTileSource ${wxdataset.name}: variable ${v} is not valid`);
		});

		this.id = id;
		this.variables = variables;
		this.wxdataset = wxdataset;
		this.ext = ext;

		this.map = map;

		this.tileSize = tileSize;
		this.attribution = attribution;
		this.maxzoom = maxzoom; // || wxdataset.getMaxZoom();
		this.scheme = scheme;
		this.bounds = bounds || wxdataset.getBoundaries(); // let mapbox manage boundaries, but not all cases are covered.
		this.setTime(time);
		this.setStyleByName(wxstyleName);

		this.painter = new Painter(this);
		this.loader = new Loader(this);
	}

	async loadTile(tile: XYZ, init?: { signal?: AbortSignal }): Promise<ImageData> {
		// return loadImageData(uriXYZ(this.tilesURIs[0], tile), init);
		const data = await this.loader.load(tile, init);
		if (!data) {
			return new ImageData(1, 1);
		}

		const im = this.painter.paint(data, tile);
		// this.tilesdata.set(tile.z + '-' + tile.x + '-' + tile.y, im);
		return im;
	}

	setStyleByName(wxstyleName: string): void {
		this.wxstyleName = wxstyleName;
		this.updateCurrentStyle(WxGetColorStyles()[wxstyleName]);
	}

	updateCurrentStyle(style: ColorStyleWeak): void {
		this.style = Object.assign(this.getCurrentStyleCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		this.CLUT = new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		this.repaint();
	}

	getCurrentStyleCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	setTime(time_?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.getURI({ variable, time, ext })); //{ variable: this.variable, time: this.time });
		this.repaint();
	}

	reload(): void {
		const style = (this.map as any).style;
		const cache = style?._otherSourceCaches?.[this.id];
		cache.clearTiles?.();
		cache.reload?.();
	}

	getTime(): string {
		return this.time;
	}

	repaint(): void {}

	/**
	 * Optional method called when the source has been added to the Map with {@link Map#addSource}.
	 * This gives the source a chance to initialize resources and register event listeners.
	 *
	 * @function
	 * @memberof CustomSourceInterface
	 * @instance
	 * @name onAdd
	 * @param {Map} map The Map this custom source was just added to.
	 */
	// onAdd(map: mapboxgl.Map): void {
	// 	const t = 0;
	// }

	/**
	 * Optional method called when the source has been removed from the Map with {@link Map#removeSource}.
	 * This gives the source a chance to clean up resources and event listeners.
	 *
	 * @function
	 * @memberof CustomSourceInterface
	 * @instance
	 * @name onRemove
	 * @param {Map} map The Map this custom source was added to.
	 */
	// onRemove(map: mapboxgl.Map): void {
	// 	const t = 0;
	// }

	/**
	 * Optional method called after the tile is unloaded from the map viewport. This
	 * gives the source a chance to clean up resources and event listeners.
	 *
	 * @function
	 * @memberof CustomSourceInterface
	 * @instance
	 * @name unloadTile
	 * @param {{ z: number, x: number, y: number }} tile Tile name to unload in the XYZ scheme format.
	 */
	// unloadTile(tile: XYZ): void {
	// 	// const sourceCache = this.map.style._otherSourceCaches[this.id];
	// 	// const coords = sourceCache.getVisibleCoordinates();
	// 	// const tiles = coords.map((tileid: any) => sourceCache.getTile(tileid));

	// 	this.tilesdata.delete(HashXYZ(tile));
	// }

	/**
	 * Optional method called during a render frame to check if there is a tile to render.
	 *
	 * @function
	 * @memberof CustomSourceInterface
	 * @instance
	 * @name hasTile
	 * @param {{ z: number, x: number, y: number }} tile Tile name to prepare in the XYZ scheme format.
	 * @returns {boolean} True if tile exists, otherwise false.
	 */
	// hasTile(tile: XYZ): boolean {
	// 	return this.tilesdata.has(HashXYZ(tile));
	// }

	/**
	 * Optional method called during a render frame to allow a source to prepare and modify a tile texture if needed.
	 *
	 * @function
	 * @memberof CustomSourceInterface
	 * @instance
	 * @name prepareTile
	 * @param {{ z: number, x: number, y: number }} tile Tile name to prepare in the XYZ scheme format.
	 * @returns {TextureImage} The tile image data as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`.
	 */
	// prepareTile(tile: XYZ): ImageData | undefined {
	// 	return this.tilesdata.get(HashXYZ(tile));
	// }
}
