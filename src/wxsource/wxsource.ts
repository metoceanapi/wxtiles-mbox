import mapboxgl from 'mapbox-gl';
import { wxDataSet } from '../wxAPI/wxAPI';
import {
	AbortableCacheableURILoaderPromiseFunc,
	cacheUriPromise,
	loadDataIntegral,
	ColorStyleStrict,
	ColorStyleWeak,
	DataIntegral,
	loadDataIntegralCachedAbortable,
	loadImageData,
	refineColor,
	WxGetColorStyles,
	UriLoaderPromiseFunc,
} from '../utils/wxtools';
import { RawCLUT } from '../utils/RawCLUT';

type TileData = ImageData;

export class WxTileSource implements mapboxgl.CustomSourceInterface<TileData> {
	type: 'custom' = 'custom';
	dataType: 'raster' = 'raster';

	id: string;
	variable: string;
	wxdataset: wxDataSet;
	ext: string;

	map: mapboxgl.Map;

	time!: string; // set in constructor by setTime()
	tilesURI!: string; // set in constructor by setTime()

	tileSize?: number;
	minzoom?: number;
	maxzoom?: number;
	scheme?: string;
	bounds?: [number, number, number, number];
	attribution?: string;

	tilesdata: Map<string, ImageData> = new Map();
	loadDataFunc: UriLoaderPromiseFunc<TileData>;

	wxstyleName!: string; // set in constructor by setStyleName()
	style: ColorStyleStrict = WxGetColorStyles()['base']; // set in constructor by setStyleName()
	CLUT!: RawCLUT; // set in constructor by setStyleName()

	constructor({
		id,
		time,
		variable,
		wxdataset,
		ext = 'png',
		wxstyleName = 'base',
		map,
		tileSize = 256,
		minzoom,
		maxzoom,
		scheme,
		bounds,
		attribution = 'wxTiles',
	}: {
		id: string;
		time?: string | number | Date;
		variable: string;
		wxdataset: wxDataSet;
		ext?: string;
		map: mapboxgl.Map;
		wxstyleName?: string;
		tileSize?: number;
		minzoom?: number;
		maxzoom?: number;
		scheme?: string;
		bounds?: [number, number, number, number];
		attribution?: string;
	}) {
		this.id = id;
		this.variable = variable;
		this.wxdataset = wxdataset;
		this.ext = ext;

		this.map = map;

		this.tileSize = tileSize;
		this.attribution = attribution;
		this.minzoom = minzoom;
		this.maxzoom = maxzoom;
		this.scheme = scheme;
		this.bounds = bounds;

		// this.loadDataFunc = /* cacheUriPromise */ loadDataIntegral;
		this.loadDataFunc = cacheUriPromise(loadImageData);

		this.setTime(time);
		this.setStyleByName(wxstyleName);
	}

	async loadTile(tile: { z: number; x: number; y: number }, init?: { signal?: AbortSignal }): Promise<ImageData> {
		const url = this.tilesURI.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
		// const im = await createImageBitmap(await (await fetch(url, options)).blob());
		const initcopy = Object.assign({}, this.wxdataset.wxapi.init, { signal: init?.signal });
		// const im = await loadImageData(url, initcopy);
		const im = await this.loadDataFunc(url, initcopy);
		this.tilesdata.set(tile.z + '-' + tile.x + '-' + tile.y, im);
		return im;
	}

	setStyleByName(wxstyleName: string): void {
		this.wxstyleName = wxstyleName;
		this.updateCurrentStyle(WxGetColorStyles()[wxstyleName]);
	}

	updateCurrentStyle(style: ColorStyleWeak): void {
		this.style = Object.assign(this.getCurrentStyleCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.wxdataset.meta.variablesMeta[this.variable];
		this.CLUT = new RawCLUT(this.style, units, [min, max], false);
		this.repaint();
	}

	getCurrentStyleCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	setTime(time?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time);
		this.tilesURI = this.wxdataset.getURI(this); //{ variable: this.variable, time: this.time });
		this.repaint();
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
	onAdd(map: mapboxgl.Map): void {
		const t = 0;
	}

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
	onRemove(map: mapboxgl.Map): void {
		const t = 0;
	}

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
	unloadTile(tile: { z: number; x: number; y: number }): void {
		// const sourceCache = this.map.style._otherSourceCaches[this.id];
		// const coords = sourceCache.getVisibleCoordinates();
		// const tiles = coords.map((tileid: any) => sourceCache.getTile(tileid));

		this.tilesdata.delete(tile.z + '-' + tile.x + '-' + tile.y);
	}

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
	// hasTile(tileID: { z: number; x: number; y: number }): boolean {
	// 	return this.tilesdata.has(tileID.z + '-' + tileID.x + '-' + tileID.y);
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
	// prepareTile(tileID: { z: number; x: number; y: number }): ImageBitmap | undefined {
	// 	return this.tilesdata.get(tileID.z + '-' + tileID.x + '-' + tileID.y);
	// }
}
