import { type WxColorStyleWeak, WxGetColorStyles, type XYZ, type WxColorStyleStrict, WXLOG } from '../utils/wxtools';
import { type WxRequestInit, type WxDate, WxLayer, type WxVars, type WxLayerOptions, WxLngLat, WxTileInfo } from './wxlayer';
import { WxVariableMeta } from '../wxAPI/wxAPI';
import { FrameworkParentClass, FrameworkOptions } from '../wxsource/wxsourcetypes';
import { WxDataSetManager } from '../wxAPI/WxDataSetManager';

/**
 * Mandatory Interface to be implemented by a {@link WxLayerBaseImplementation}
 */
export interface WxLayerBaseAPI {
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

/**
 * Mandatory Interface to be implemented by a {@link WxTileSource} implementation
 * These methods *Requires* framework specific implementation
 * */
export interface WxLayerAPI extends WxLayerBaseAPI {
	getLayerInfoAtLatLon(lnglat: WxLngLat, anymap: any): WxTileInfo | undefined;
	_reloadVisible(requestInit?: WxRequestInit): Promise<void>;
	update(): void;
	coveringTiles(): XYZ[];
}

/**
 * Implementation of universal methods for the layer (for Mapbox and Leaflet)
 * To be extended by framework specific implementation
 * Wrapps some methods of {@link WxLayer}
 */
export class WxLayerBaseImplementation extends FrameworkParentClass implements WxLayerBaseAPI {
	/**
	 * @ignore
	 * if true, the source is animating
	 * */
	protected animation = false;

	/**
	 * @ignore
	 * a seed for the animation
	 * */
	protected animationSeed = 0;

	/**
	 * @ignore
	 * Used to make coarse level requests for time animation
	 * */
	protected readonly oldMaxZoom: number; /* to restore coarse maximum zoom level to make tiles load faster during animation */

	/**
	 * @ignore
	 * An instance of the layer
	 * */
	protected readonly layer: WxLayer;

	/**
	 * @ignore
	 * used to avoid multiple animation requests
	 * */
	protected redrawRequested?: Promise<void>;

	/**
	 * @internal
	 * Do not use this constructor directly
	 * */
	constructor(wxLayerOptions: WxLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxLayerBaseImplementation.constructor (${frwOptions.id})`);
		super(frwOptions);
		this.layer = new WxLayer(wxLayerOptions);
		this.oldMaxZoom = this.layer.wxdatasetManager.meta.maxZoom;
	} // constructor

	/**
	 * returns the dataset manager of the source
	 * @returns {WxDataSetManager} the dataset manager of the source
	 * */
	get wxdatasetManager(): WxDataSetManager {
		WXLOG(`WxLayerBaseImplementation.wxdatasetManager (${this.id})`);
		return this.layer.wxdatasetManager;
	}

	/**
	 * Get the metadata of the current variable(s).
	 * @returns {WxVariableMeta} - The metadata of the current variable.
	 */
	getMetadata(): WxVariableMeta {
		WXLOG(`WxLayerBaseImplementation.getMetadata (${this.id})`);
		return { ...this.layer.currentMeta };
	}

	/**
	 * Get current variables of the source.
	 * @returns {WxVars} variables of the source.
	 */
	getVariables(): WxVars {
		WXLOG(`WxLayerBaseImplementation.getVariables (${this.id})`);
		return [...this.layer.variables];
	}

	/**
	 * Clears the cache of the source.
	 */
	clearCache(): void {
		WXLOG(`WxLayerBaseImplementation.clearCache (${this.id})`);
		this.layer.clearCache();
	}

	/**
	 * Get a copy of the current style of the source.
	 * @returns {WxColorStyleStrict} A copy of the current style of the source.
	 */
	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		WXLOG(`WxLayerBaseImplementation.getCurrentStyleObjectCopy (${this.id})`);
		return this.layer.getCurrentStyleObjectCopy();
	}

	/**
	 * Get the current time of the source.
	 * @returns {string} The current time of the source from array of times.
	 */
	getTime(): string {
		WXLOG(`WxLayerBaseImplementation.getTime (${this.id})`);
		return this.layer.getTime();
	}

	/**
	 * Set time and render the source. If the time is not available, the closest time will be used.
	 * @param  {WxDate} time - Time to set.
	 * @param {WxRequestInit | undefined} requestInit - Request options for fetch.
	 * @returns {Promise<string>} A promise that resolves with current time step when the time is set and the source is loaded and rendered.
	 */
	async setTime(time?: WxDate, requestInit?: WxRequestInit): Promise<string> {
		WXLOG(`WxLayerBaseImplementation.setTime (${this.id}) time=${time}`);
		const oldtime = this.getTime();
		this.layer.setURLsAndTime(time);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this.layer.setURLsAndTime(oldtime); // restore old time and URLs
		return this.getTime();
	}

	/**
	 * Cache tiles for faster rendering for {@link setTime}. If the time is not available, the closest time will be used.
	 * @param time - Time to preload.
	 * @param requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when finished preload.
	 */
	async preloadTime(time: WxDate, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.preloadTime (${this.id}) time=${time}`);
		return this.layer.preloadTime(time, this.coveringTiles(), requestInit);
	}

	/**
	 * Starts the particle animation for wind and currents if sutiable.
	 */
	startAnimation(): void {
		if (this.animation) {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) already started`);
			return;
		}

		if (this.layer.nonanimatable) {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) nonanimatable`);
			return;
		}

		WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id})`);
		this.animation = true;
		const animationStep = async (seed: number) => {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) animationStep`);
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
	 * Stops the particle animation.
	 */
	async stopAnimation(): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.stopAnimation (${this.id})`);
		this.animation = false;
		return this._redrawTiles();
	}

	/** set coarse maximum zoom level to make tiles load faster during animation */
	async setCoarseLevel(level: number = 2): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.setCoarseLevel (${this.id}) level=${level}`);
		const desLevel = Math.max(this.oldMaxZoom - level, 0);
		if (this.layer.wxdatasetManager.meta.maxZoom !== desLevel) {
			this.layer.wxdatasetManager.meta.maxZoom = desLevel;
			return this._reloadVisible();
		}
	}

	/** restores to the dataset's maximum zoom level */
	async unsetCoarseLevel(): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.unsetCoarseLevel (${this.id})`);
		if (this.layer.wxdatasetManager.meta.maxZoom !== this.oldMaxZoom) {
			this.layer.wxdatasetManager.meta.maxZoom = this.oldMaxZoom;
			return this._reloadVisible();
		}
	}

	/**
	 * Set the style of the source by its name from default styles.
	 * @param {string} wxstyleName - Name of the new style to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async setStyleByName(wxstyleName: string, reload: boolean = true): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.setStyleByName (${this.id}) wxstyleName=${wxstyleName} reload=${reload}`);
		return this.updateCurrentStyleObject(WxGetColorStyles()[wxstyleName], reload);
	}

	/**
	 * Update the current style object of the source partially or completely.
	 * @param {WxColorStyleWeak | undefined} style - Style's fields to set.
	 * @param {boolean} reload - If true, the source will be reloaded and rerendered.
	 * @param {WxRequestInit | undefined} requestInit - Request options.
	 * @returns {Promise<void>} A promise that resolves when the style is set.
	 */
	async updateCurrentStyleObject(style?: WxColorStyleWeak, reload: boolean = true, requestInit?: WxRequestInit): Promise<void> {
		WXLOG(`WxLayerBaseImplementation.updateCurrentStyleObject (${this.id}) style=${style} reload=${reload}`);
		this.layer.updateCurrentStyleObject(style);
		this.startAnimation();
		if (reload) return this._reloadVisible(requestInit);
	}

	/** @ignore */
	protected _redrawTiles(): Promise<void> {
		if (this.redrawRequested) return this.redrawRequested;
		this.redrawRequested = new Promise((resolve) => {
			requestAnimationFrame(() => {
				WXLOG(`WxTileSource _redrawTiles (${this.id})`);

				this.update();

				resolve();
				this.redrawRequested = undefined;
			});
		});

		return this.redrawRequested;
	} // _redrawTiles

	/**
	 * @ignore
	 * A dummy function to be replaced by ancestor classes.
	 */
	protected async _reloadVisible(requestInit?: WxRequestInit): Promise<void> {}

	/**
	 * @ignore
	 * A dummy function to be replaced by ancestor classes.
	 */
	protected coveringTiles(): XYZ[] {
		return [];
	}

	/**
	 * @ignore
	 * A dummy function to be replaced by ancestor classes.
	 */
	protected update() {}
}
