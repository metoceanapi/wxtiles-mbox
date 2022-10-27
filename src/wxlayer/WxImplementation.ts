import { type WxColorStyleWeak, WxGetColorStyles, type XYZ, type WxColorStyleStrict, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxDate, WxLayer, type WxVars, type WxLayerOptions, WxLngLat, WxTileInfo } from './wxlayer';
import { WxVariableMeta } from '../wxAPI/wxAPI';
import { FrameworkParentClass, FrameworkOptions } from '../wxsource/wxsourcetypes';
import { WxDataSetManager } from '../wxAPI/WxDataSetManager';

export interface WxImplementationAPI {
	wxdatasetManager: WxDataSetManager;
	getMetadata(): WxVariableMeta;
	getVariables(): WxVars;
	clearCache(): void;
	getCurrentStyleObjectCopy(): WxColorStyleStrict;
	getTime(): string;
	setTime(time?: WxDate, requestInit?: WxRequestInit): Promise<string>;
	preloadTime(time: WxDate, requestInit?: WxRequestInit): Promise<void>;
	startAnimation(): void;
	stopAnimation(): Promise<void>;
	setCoarseLevel(level: number): Promise<void>;
	unsetCoarseLevel(): Promise<void>;
	setStyleByName(wxstyleName: string, reload: boolean): Promise<void>;
	updateCurrentStyleObject(style?: WxColorStyleWeak, reload?: boolean, requestInit?: WxRequestInit): Promise<void>;
}

export interface WxLayerAPI extends WxImplementationAPI {
	// Requires framework specific implementation
	getLayerInfoAtLatLon(lnglat: WxLngLat, anymap: any): WxTileInfo | undefined;
	_reloadVisible(requestInit?: WxRequestInit): Promise<void>;
	update(): void;
	coveringTiles(): XYZ[];
}

export class WxImplementation extends FrameworkParentClass implements WxImplementationAPI {
	protected animation = false;
	protected animationSeed = 0;
	protected oldMaxZoom?: number; /* to restore coarse maximum zoom level to make tiles load faster during animation */
	protected readonly layer: WxLayer;
	protected redrawRequested?: Promise<void>;

	constructor(wxlayeroptions: WxLayerOptions, options?: FrameworkOptions) {
		super(options);
		this.layer = new WxLayer(wxlayeroptions);
	} // constructor

	get wxdatasetManager() {
		return this.layer.wxdatasetManager;
	}

	/**
	 * @description Get the metadata of the current variable.
	 * @memberof WxTileSource
	 * @returns {WxVariableMeta} - The metadata of the current variable.
	 */
	getMetadata(): WxVariableMeta {
		WXLOG(`WxTileSource getMetadata (${this.layer.wxdatasetManager.datasetName})`);
		return { ...this.layer.currentMeta };
	}

	/**
	 * @description Get current variables of the source.
	 * @memberof WxTileSource
	 * @returns {WxVars} variables of the source.
	 */
	getVariables(): WxVars {
		WXLOG(`WxTileSource getVariables (${this.layer.wxdatasetManager.datasetName})`);
		return [...this.layer.variables];
	}

	/**
	 * @description Clears the cache of the source.
	 * @memberof WxTileSource
	 */
	clearCache(): void {
		WXLOG(`WxTileSource clearCache (${this.layer.wxdatasetManager.datasetName})`);
		this.layer.clearCache();
	}

	/**
	 * @description Get a copy of the current style of the source.
	 * @memberof WxTileSource
	 * @returns {WxColorStyleStrict} A copy of the current style of the source.
	 */
	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		WXLOG(`WxTileSource getCurrentStyleObjectCopy (${this.layer.wxdatasetManager.datasetName})`);
		return this.layer.getCurrentStyleObjectCopy();
	}

	/**
	 * @description Get the current time of the source.
	 * @memberof WxTileSource
	 * @returns {string} The current time of the source.
	 */
	getTime(): string {
		WXLOG(`WxTileSource getTime (${this.layer.wxdatasetManager.datasetName})`);
		return this.layer.getTime();
	}

	/**
	 * @description Set time and render the source. If the time is not available, the closest time will be used.
	 * @memberof WxTileSource
	 * @param  {WxDate} time - Time to set.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when the time is set.
	 */
	async setTime(time?: WxDate, requestInit?: WxRequestInit): Promise<string> {
		WXLOG(`WxTileSource setTime (${this.layer.wxdatasetManager.datasetName}) `, { time });
		const oldtime = this.getTime();
		this.layer.setURLsAndTime(time);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this.layer.setURLsAndTime(oldtime); // restore old time and URLs
		return this.getTime();
	}

	/**
	 * @description Cache tiles for faster rendering for {setTime}. If the time is not available, the closest time will be used.
	 * @memberof WxTileSource
	 * @param  {WxDate} time - Time to preload.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when finished preload.
	 */
	async preloadTime(time: WxDate, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource preloadTime (${this.layer.wxdatasetManager.datasetName}) `, { time });
		return this.layer.preloadTime(time, this.coveringTiles(), requestInit);
	}

	/**
	 * @description Starts the animation of the source (wind, currents).
	 * @memberof WxTileSource
	 */
	startAnimation(): void {
		if (this.animation) {
			WXLOG(`WxTileSource startAnimation (${this.layer.wxdatasetManager.datasetName}) already started`);
			return;
		}

		if (this.layer.nonanimatable) {
			WXLOG(`WxTileSource startAnimation (${this.layer.wxdatasetManager.datasetName}) nonanimatable`);
			return;
		}

		WXLOG(`WxTileSource startAnimation (${this.layer.wxdatasetManager.datasetName})`);
		this.animation = true;
		const animationStep = async (seed: number) => {
			WXLOG(`WxTileSource animationStep (${this.layer.wxdatasetManager.datasetName})`);
			if (!this.animation || this.layer.nonanimatable) {
				this.animation = false;
				return;
			}

			this.animationSeed = seed;
			await this._redrawTiles();
			requestAnimationFrame(animationStep);
		};

		requestAnimationFrame(animationStep);
	}

	/**
	 * @description Stops the animation.
	 * @memberof WxTileSource
	 */
	async stopAnimation(): Promise<void> {
		WXLOG(`WxTileSource stopAnimation (${this.layer.wxdatasetManager.datasetName})`);
		this.animation = false;
		return this._redrawTiles();
	}

	/** set coarse maximum zoom level to make tiles load faster during animation */
	async setCoarseLevel(level: number = 2): Promise<void> {
		WXLOG(`WxTileSource setCoarseLevel (${this.layer.wxdatasetManager.datasetName})`, { level });
		this.oldMaxZoom = this.layer.wxdatasetManager.meta.maxZoom;
		this.layer.wxdatasetManager.meta.maxZoom = Math.max(this.oldMaxZoom - level, 1);
		return this._reloadVisible();
	}

	/** restore maximum zoom level */
	async unsetCoarseLevel(): Promise<void> {
		WXLOG(`WxTileSource unsetCoarseLevel (${this.layer.wxdatasetManager.datasetName})`);
		if (this.oldMaxZoom) {
			this.layer.wxdatasetManager.meta.maxZoom = this.oldMaxZoom;
			return this._reloadVisible();
		}
	}

	/**
	 * @description Set the style of the source by its name from default styles.
	 * @memberof WxTileSource
	 * @param {string} wxstyleName - Name of the new style to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async setStyleByName(wxstyleName: string, reload: boolean = true): Promise<void> {
		WXLOG(`WxTileSource setStyleByName (${this.layer.wxdatasetManager.datasetName})`);
		return this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	/**
	 * @description
	 * @memberof WxTileSource
	 * @param {WxColorStyleWeak | undefined} style - Style's fields to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async updateCurrentStyleObject(style?: WxColorStyleWeak, reload: boolean = true, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxTileSource updateCurrentStyleObject (${this.layer.wxdatasetManager.datasetName})`, { style });
		this.layer.updateCurrentStyleObject(style);
		this.startAnimation();
		if (reload) return this._reloadVisible(requestInit);
	}

	_redrawTiles(): Promise<void> {
		if (this.redrawRequested) return this.redrawRequested;
		this.redrawRequested = new Promise((resolve) => {
			requestAnimationFrame(() => {
				WXLOG(`WxTileSource _redrawTiles (${this.layer.wxdatasetManager.datasetName})`);

				this.update();

				resolve();
				this.redrawRequested = undefined;
			});
		});

		return this.redrawRequested;
	} // _redrawTiles

	/* dummy */ protected async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {}
	/* dummy */ protected coveringTiles(): XYZ[] {
		return [];
	}
	/* dummy */ protected update() {}
}
