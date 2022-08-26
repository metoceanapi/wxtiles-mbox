import mapboxgl from 'mapbox-gl';

import { wxDataSetManager } from '../wxAPI/wxAPI';
import { ColorStyleStrict, ColorStyleWeak, HashXYZ, loadImageData, refineColor, uriXYZ, WxGetColorStyles, XYZ } from '../utils/wxtools';

import { RawCLUT } from '../utils/RawCLUT';
import { Painter } from './painter';
import { Loader } from './loader';

type wxRaster = ImageData;

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

	tilesReload: Map<string, ImageData> = new Map();
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
		this.maxzoom = maxzoom; // || wxdataset.getMaxZoom();
		this.scheme = scheme;
		this.bounds = bounds || wxdataset.getBoundaries(); // let mapbox manage boundaries, but not all cases are covered.
		this._setURLs(time);
		this.setStyleByName(wxstyleName);

		this.painter = new Painter(this);
		this.loader = new Loader(this);
	}

	async loadTile(tile: XYZ, init?: { signal?: AbortSignal }): Promise<wxRaster> {
		if (this.tilesReload?.size) {
			return this.tilesReload.get(HashXYZ(tile))!;
		}

		const data = await this.loader.load(tile, init);
		if (!data.data) {
			return undefined as any; //new ImageData(1, 1);
		}

		const im = this.painter.paint(data.data);
		// this.tilesdata.set(tile.z + '-' + tile.x + '-' + tile.y, im);
		return im;
	}

	setStyleByName(wxstyleName: string): void {
		this.wxstyleName = wxstyleName;
		this.updateCurrentStyle(WxGetColorStyles()[wxstyleName]);
	}

	async updateCurrentStyle(style: ColorStyleWeak): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		this.CLUT = new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		await this.reloadVisible();
	}

	getCurrentStyleCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	protected _setURLs(time_?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext }));
	}

	protected async reloadVisible(): Promise<void> {
		this.tilesReload = new Map();
		await Promise.allSettled(this.coveringTiles().map(async (c) => this.tilesReload.set(HashXYZ(c), await this.loadTile(c))));
		this.clearTiles();
		this.update();
	}

	async setTime(time_?: string | number | Date): Promise<string> {
		this._setURLs(time_);
		await this.reloadVisible();
		return this.time;
	}

	getTime(): string {
		return this.time;
	}

	protected coveringTiles(): XYZ[] {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		const source = this.map.getSource(this.id);
		return (source as any)?._coveringTiles?.() || [];
	}

	protected clearTiles() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		(this.map as any).style?._clearSource?.(this.id);
	}

	protected update() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		(this.map as any).style?._updateSource?.(this.id);
		return (this.map.getSource(this.id) as any)?._update?.();
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
