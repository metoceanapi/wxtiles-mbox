import mapboxgl from 'mapbox-gl';

import { wxDataSetManager } from '../wxAPI/wxAPI';
import { ColorStyleStrict, ColorStyleWeak, HashXYZ, loadImageData, refineColor, uriXYZ, WxGetColorStyles, XYZ } from '../utils/wxtools';

import { RawCLUT } from '../utils/RawCLUT';
import { Painter } from './painter';
import { CoordPicture, Loader } from './loader';

type wxRaster = HTMLCanvasElement; //ImageData;

export class WxTileSource implements mapboxgl.CustomSourceInterface<wxRaster> {
	type: 'custom' = 'custom';
	dataType: 'raster' = 'raster';

	id: string;
	variables: string[];
	wxdataset: wxDataSetManager;
	ext: string;

	map: mapboxgl.Map;

	time!: string; // is set in constructor by _setURLs()
	tilesURIs!: string[]; // is set in constructor by _setURLs()

	tileSize: number;
	maxzoom?: number;
	scheme?: string;
	bounds?: [number, number, number, number];
	attribution?: string;

	// tilesdata: Map<string, ImageData> = new Map();

	wxstyleName!: string; // is set in constructor by setStyleName()
	style: ColorStyleStrict = WxGetColorStyles()['base'];
	CLUT!: RawCLUT; // is set in constructor by setStyleName()

	painter: Painter;
	loader: Loader;

	tilesReload: Map<string, wxRaster> = new Map();
	setTimeInProgress: boolean = false;

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
		wxdataset: wxDataSetManager;
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
			throw new Error(`wxTileSource ${wxdataset.datasetName}: only 1 or 2 variables are supported but ${variables.length} were given`);
		}

		variables.forEach((v) => {
			if (!wxdataset.checkVariableValid(v)) throw new Error(`wxTileSource ${wxdataset.datasetName}: variable ${v} is not valid`);
		});

		this.id = id;
		this.variables = variables;
		this.wxdataset = wxdataset;
		this.ext = ext;

		this.map = map;

		this.tileSize = tileSize;
		this.attribution = attribution;
		this.maxzoom = maxzoom;
		this.scheme = scheme;
		this.bounds = bounds || wxdataset.getBoundaries(); // let mapbox manage boundaries, but not all cases are covered.
		this._setURLs(time);
		this.setStyleByName(wxstyleName, false);

		this.painter = new Painter(this);
		this.loader = new Loader(this);
	}

	// Beter to use when loading is not in progress
	// I beleive you don't need it, but it is here just in case
	clearCache(): void {
		this.loader = new Loader(this);
	}

	async loadTile(tile: XYZ, init?: { signal?: AbortSignal }): Promise<wxRaster> {
		if (this.tilesReload?.size) {
			const tileData = this.tilesReload.get(HashXYZ(tile));
			if (tileData) return tileData;
		}

		let data: CoordPicture;
		try {
			data = await this.loader.load(tile, init);
		} catch (e) {
			throw { status: 404 };
			// return new ImageData(1, 1); // happens when tile is not available (does not exist)
			// throw new Error(`Can't load ${tile.z}/${tile.x}/${tile.y}`);
		}

		if (!data.data) {
			throw { status: 404 };
			// return new ImageData(1, 1); // happens when tile is cut by qTree or by Mask
		}

		const im = this.painter.paint(data.data);
		// this.tilesdata.set(tile.z + '-' + tile.x + '-' + tile.y, im);
		return im;
	}

	setStyleByName(wxstyleName: string, reload = true): void {
		this.wxstyleName = wxstyleName;
		this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	async updateCurrentStyleObject(style: ColorStyleWeak, reload = true, init?: { signal?: AbortSignal }): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleObjectCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		this.CLUT = new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		reload && (await this.reloadVisible(init));
	}

	getCurrentStyleObjectCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	protected _setURLs(time_?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext }));
	}

	protected async reloadVisible(init?: { signal?: AbortSignal }): Promise<void> {
		this.tilesReload = new Map();
		await Promise.allSettled(this.coveringTiles().map(async (c) => this.tilesReload.set(HashXYZ(c), await this.loadTile(c, init))));
		this.clearTiles();
		this.update();
	}

	async setTime(time_?: string | number | Date, init?: { signal?: AbortSignal }): Promise<string> {
		this._setURLs(time_);
		await this.reloadVisible(init);
		return this.time;
	}

	getTime(): string {
		return this.time;
	}

	protected clearTiles() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		(this.map as any).style?._clearSource?.(this.id);
		(this.map as any).style?._reloadSource(this.id);
	}

	protected coveringTiles(): XYZ[] {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		// return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
		return [];
	}

	protected update() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		// (this.map as any).style?._updateSource?.(this.id);
		// return (this.map.getSource(this.id) as any)?._update?.();
	}

	// prepareTile(tile: XYZ): wxRaster | undefined {}

	// onAdd(map: mapboxgl.Map): void {}

	// onRemove(map: mapboxgl.Map): void {}

	// unloadTile(tile: XYZ): void {
	// 	// const sourceCache = this.map.style._otherSourceCaches[this.id];
	// 	// const coords = sourceCache.getVisibleCoordinates();
	// 	// const tiles = coords.map((tileid: any) => sourceCache.getTile(tileid));

	// 	this.tilesdata.delete(HashXYZ(tile));
	// }

	// hasTile(tile: XYZ): boolean {
	// 	return this.tilesdata.has(HashXYZ(tile));
	// }
}
