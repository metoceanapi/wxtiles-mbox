import mapboxgl from 'mapbox-gl';

import { type wxDataSetManager } from '../wxAPI/wxAPI';
import { type ColorStyleStrict, type ColorStyleWeak, HashXYZ, refineColor, WxGetColorStyles, type XYZ } from '../utils/wxtools';

import { RawCLUT } from '../utils/RawCLUT';
import { Painter } from './painter';
import { Loader, type wxData } from './loader';

type CSIRaster = ImageData; // To shut up TS errors for CustomSourceInterface
type wxRaster = HTMLCanvasElement; // Actual result of a Painter

interface wxRasterData {
	raster: wxRaster;
	data: wxData;
}

export class WxTileSource implements mapboxgl.CustomSourceInterface<CSIRaster> {
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

	animation = false;
	animationFrame = 0;

	painter: Painter;
	loader: Loader;

	tilesReload: Map<string, wxRasterData> = new Map();
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

	async loadTile(tile: XYZ, init?: { signal?: AbortSignal }): Promise<CSIRaster> {
		const raster_data = await this._loadTile(tile, init);
		const raster = this.animation
			? this.painter.imprintVectorAnimationLinesStep(raster_data.data, raster_data.raster, this, this.animationFrame)
			: raster_data.raster;
		return raster as any; // to shut up TS errors
	}

	async _loadTile(tile: XYZ, init?: { signal?: AbortSignal }): Promise<wxRasterData> {
		const tileData = this.tilesReload.get(HashXYZ(tile));
		if (tileData) return tileData;

		let data: wxData | null = null;
		try {
			data = await this.loader.load(tile, init);
		} catch (e) {
			throw { status: 404 }; // happens when tile is not available (does not exist)
		}

		if (!data) {
			throw { status: 404 }; // happens when tile is cut by qTree or by Mask
		}

		const raster_data = { raster: this.painter.paint(data), data };
		this.tilesReload.set(HashXYZ(tile), raster_data); // TODO: cache loaded tiles
		return raster_data;
	}

	setStyleByName(wxstyleName: string, reload = true): void {
		this.wxstyleName = wxstyleName;
		this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	async updateCurrentStyleObject(style: ColorStyleWeak, reload = true, init?: { signal?: AbortSignal }): Promise<void> {
		this.style = Object.assign(this.getCurrentStyleObjectCopy(), style); // deep copy, so could be (and is) changed
		this.style.streamLineColor = refineColor(this.style.streamLineColor);
		const { min, max, units } = this.getCurrentMeta();
		this.CLUT = new RawCLUT(this.style, units, [min, max], this.variables.length === 2);
		reload && (await this.reloadVisible(init));
	}

	getCurrentMeta(): { units: string; min: number; max: number } {
		let { min, max, units } = this.wxdataset.meta.variablesMeta[this.variables[0]];
		if (this.variables.length > 1) {
			// for the verctor field we need to get the min and max of the vectors' length
			// but convert and calculate ALL vector length just for that is too much
			// so we just use estimation based on the max of the vector components
			const metas = this.variables.map((v) => this.wxdataset.meta.variablesMeta[v]);
			// hence min of a vector length can't be less than 0
			min = 0;
			// max of a field can't be less than max of the components multiplied by sqrt(2)
			max = 1.42 * Math.max(-metas[0].min, metas[0].max, -metas[1].min, metas[1].max);
			// tese values arn't real! but they are good enough for the estimation
		}

		return { min, max, units };
	}

	getCurrentStyleObjectCopy(): ColorStyleStrict {
		return Object.assign({}, this.style);
	}

	getTime(): string {
		return this.time;
	}

	async setTime(time_?: string | number | Date, init?: { signal?: AbortSignal }): Promise<string> {
		this._setURLs(time_);
		await this.reloadVisible(init);
		return this.time;
	}

	protected _setURLs(time_?: string | number | Date): void {
		this.time = this.wxdataset.getValidTime(time_);
		const { time, ext } = this;
		this.tilesURIs = this.variables.map((variable) => this.wxdataset.createURI({ variable, time, ext }));
	}

	protected async reloadVisible(init?: { signal?: AbortSignal }): Promise<void> {
		this.tilesReload = new Map(); // clear cache
		await Promise.allSettled(this.coveringTiles().map((c) => this._loadTile(c, init))); // fill up cache
		this.repaintVisible();
	}

	protected repaintVisible(): void {
		this.clearTiles();
		this.update(); // it forces mapbox to reload visible tiles (hopefully from cache)
	}

	startAnimation(): void {
		if (this.animation) return;
		this.animation = true;
		const animationStep = (frame: number) => {
			if (!this.animation || this.style.streamLineStatic || this.style.streamLineColor === 'none') return;
			this.animationFrame = frame;
			this.repaintVisible();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	stopAnimation(): void {
		this.animation = false;
	}

	protected clearTiles() {
		// COMING SOON in a future release
		// but for now, we use the same algorithm as in mapbox-gl-js
		(this.map as any).style?._clearSource?.(this.id);
		// (this.map as any).style?._reloadSource(this.id); // TODO: check if this is needed // seems NOT
	}

	// get assigned by map.addSource
	protected coveringTiles(): XYZ[] {
		return [];
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._coveringTiles?.() || [];
	}

	// get assigned by map.addSource
	protected update() {
		// mapbox-gl-js implementation: return (this.map.getSource(this.id) as any)?._update?.();
	}

	// onAdd(map: mapboxgl.Map): void {}
	// onRemove(map: mapboxgl.Map): void {}
	// unloadTile(tile: XYZ): void { }
	// hasTile(tile: XYZ): boolean { }
}
