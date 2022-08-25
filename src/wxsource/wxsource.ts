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

	updateCurrentStyle(style: ColorStyleWeak): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		this.CLUT = new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		return this._reloadVisibleTiles();
	}

	getCurrentStyleCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	protected _setURLs(time_?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext }));
	}

	private _getVisibleTiles(): XYZ[] {
		// HACK: The most vulnerable part. The mapboxgl API is not very well documented.
		const style = (this.map as any).style;
		const cache = style?._otherSourceCaches?.[this.id];
		const coords = cache?.getVisibleCoordinates?.();
		return coords?.map((c): XYZ => c.canonical) || [];
	}

	/**
	 *
	 * Reload and Repaint visible tiles. Usefull for changing style and timestep.
	 **/
	private async _reloadVisibleTiles(): Promise<void> {
		const coords = this._getVisibleTiles();
		const results = await Promise.allSettled(coords.map((c) => this.loadTile(c)));
		this.tilesReload = new Map();
		results.forEach((result, i) => this.tilesReload.set(HashXYZ(coords[i]), (result as any).value));

		// Hmmm... let's imagine that we have a lot of tiles to render (impossible), and the browser is slow to update the map.
		// prepareTile() should clean up the tilesReload map, so that the next repaint will not use the old tiles.
		// but! In case map is dragged then not all tile will be deleted by the next repaint, so we need to kclean up everithing...
		const copy = this.tilesReload;
		setTimeout(() => copy.clear(), 10); // let's wait a bit to make sure the map is painted and clean up the rest of tilesReload

		this.map.triggerRepaint();
	}

	async setTime(time_?: string | number | Date): Promise<string> {
		this._setURLs(time_);
		await this._reloadVisibleTiles();
		return this.time;
	}

	getTime(): string {
		return this.time;
	}

	prepareTile(tile: XYZ): wxRaster | undefined {
		if (!this.tilesReload?.size) return;
		const hash = HashXYZ(tile);
		const im = this.tilesReload.get(hash);
		this.tilesReload.delete(hash);
		return im;
	}

	// reload(): void {
	// 	const style = (this.map as any).style;
	// 	const cache = style?._otherSourceCaches?.[this.id];
	// 	cache.clearTiles?.();
	// 	cache.reload?.();
	// }

	// onAdd(map: mapboxgl.Map): void {
	// 	const t = 0;
	// }

	// onRemove(map: mapboxgl.Map): void {
	// 	const t = 0;
	// }

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
