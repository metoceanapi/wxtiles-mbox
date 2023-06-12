import { type WxColorStyleWeak, WxGetColorStyles, type XYZ, type WxColorStyleStrict, WXLOG } from '../utils/wxtools';
import type { WxRequestInit, WxDate, WxLayerVarsNames, WxLngLat, WxTileInfo, TilesCache, WxLayerOptions } from './wxlayer';
import { WxLayer } from './wxlayer';
import type { WxDatasetMeta, WxVariableMeta } from '../wxAPI/WxAPItypes';
import { FrameworkParentClass, type FrameworkOptions } from '../wxsource/wxsourcetypes';
import type { WxDataSetManager } from '../wxAPI/WxDataSetManager';
import { WxTileSource } from '../wxsource/wxsource';

/**
 * Mandatory Interface to be implemented by a {@link WxLayerBaseImplementation}
 */
export interface WxLayerBaseAPI {
	wxdatasetManager: WxDataSetManager;
	getCurrentVariableMeta(): WxVariableMeta;
	getVariablesNames(): WxLayerVarsNames;
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
	// evented methods
	on(type: string, listener: ListenerMethod): this;
	off(type: string, listener: ListenerMethod): this;
	once(type: string, listener: ListenerMethod): this;
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

export type ListenerMethod = <T extends keyof WxEventType>(arg?: WxEventType[T]) => void;

export type WxEventType = {
	changed: void;
};

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
	protected _animation = false;

	/**
	 * @ignore
	 * a seed for the animation
	 * */
	protected _animationSeed = 0;

	/**
	 * @ignore
	 * An instance of the layer
	 * */
	protected readonly _layer: WxLayer;

	/**
	 * @ignore
	 * used to avoid multiple animation requests
	 * */
	protected _redrawRequested?: Promise<void>;

	/**
	 * @ignore
	 * evented listeners
	 * */
	protected _listeners: { [eventName: string]: ListenerMethod[] } = {};

	/**
	 * @internal
	 * Do not use this constructor directly
	 * */
	constructor(wxLayerOptions: WxLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxLayerBaseImplementation.constructor (${frwOptions.id})`);
		super(frwOptions);
		this._layer = new WxLayer(wxLayerOptions);
	} // constructor

	/**
	 * returns the dataset manager of the source
	 * @returns {WxDataSetManager} the dataset manager of the source
	 * */
	get wxdatasetManager(): WxDataSetManager {
		WXLOG(`WxLayerBaseImplementation.wxdatasetManager (${this.id})`);
		return this._layer.wxdatasetManager;
	}

	/**
	 * Get the metadata of the current variable(s).
	 * @returns {WxVariableMeta} - The metadata of the current variable.
	 */
	getCurrentVariableMeta(): WxVariableMeta {
		WXLOG(`WxLayerBaseImplementation.getCurrentVariableMeta (${this.id})`);
		return { ...this._layer.currentVariableMeta };
	}

	getDatasetMeta(): WxDatasetMeta {
		return this._layer.wxdatasetManager.getInstanceMeta(this.getTime());
	}

	/**
	 * Get the metadata of the current variable(s).
	 * @deprecated
	 * @returns {WxVariableMeta} - The metadata of the current variable.
	 */
	getMetadata(): WxVariableMeta {
		WXLOG(`WxLayerBaseImplementation.getMetadata (${this.id})`);
		return { ...this._layer.currentVariableMeta };
	}

	/**
	 * Get current variables (1 or 2) of the source/layer.
	 * @returns {WxLayerVarsNames} variables of the source.
	 */
	getVariablesNames(): WxLayerVarsNames {
		WXLOG(`WxLayerBaseImplementation.getVariables (${this.id})`);
		return [...this._layer.variables];
	}

	/**
	 * Clears the cache of the source.
	 */
	clearCache(): void {
		WXLOG(`WxLayerBaseImplementation.clearCache (${this.id})`);
		this._layer.clearCache();
	}

	getCache(): TilesCache {
		return this._layer.tilesCache;
	}

	/**
	 * Get a copy of the current style of the source.
	 * @returns {WxColorStyleStrict} A copy of the current style of the source.
	 */
	getCurrentStyleObjectCopy(): WxColorStyleStrict {
		WXLOG(`WxLayerBaseImplementation.getCurrentStyleObjectCopy (${this.id})`);
		return this._layer.getCurrentStyleObjectCopy();
	}

	/**
	 * Get the current time of the source.
	 * @returns {string} The current time of the source from array of times.
	 */
	getTime(): string {
		WXLOG(`WxLayerBaseImplementation.getTime (${this.id})`);
		return this._layer.getTime();
	}

	getAllTimes(): string[] {
		WXLOG(`WxLayerBaseImplementation.getTimes (${this.id})`);
		return this._layer.wxdatasetManager.getAllTimes();
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
		this._layer.setURLsAndTime(time);
		await this._reloadVisible(requestInit);
		if (requestInit?.signal?.aborted) this._layer.setURLsAndTime(oldtime); // restore old time and URLs
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
		return this._layer.preloadTime(time, this.coveringTiles(), requestInit);
	}

	/**
	 * Starts the particle animation for wind and currents if sutiable.
	 */
	startAnimation(): void {
		if (this._animation) {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) already started`);
			return;
		}

		if (this._layer.nonanimatable) {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) nonanimatable`);
			return;
		}

		WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id})`);
		this._animation = true;
		const animationStep = async (seed: number) => {
			WXLOG(`WxLayerBaseImplementation.startAnimation (${this.id}) animationStep`);
			if (!this._animation || this._layer.nonanimatable) {
				this._animation = false;
				return;
			}

			this._animationSeed = seed;
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
		this._animation = false;
		return this._redrawTiles();
	}

	/** set coarse maximum zoom level to make tiles load faster during animation */
	async setCoarseLevel(level: number = 2): Promise<void> {
		this._layer.coarseLevel = Math.max(0, Math.min(level, this.wxdatasetManager.getMaxZoom()));
		// return this._reloadVisible(); // NOT needed? Hmmm... ибо used before loading new tile anyway
	}

	/** restores to the dataset's maximum zoom level */
	async unsetCoarseLevel(): Promise<void> {
		this._layer.coarseLevel = 0;
		return this._reloadVisible();
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
		this._layer.updateCurrentStyleObject(style);
		this.startAnimation();
		if (reload) return this._reloadVisible(requestInit);
	}

	/** @ignore */
	protected _redrawTiles(): Promise<void> {
		if (this._redrawRequested) return this._redrawRequested;
		this._redrawRequested = new Promise((resolve) => {
			requestAnimationFrame(() => {
				WXLOG(`WxTileSource _redrawTiles (${this.id})`);

				this.update();

				resolve();
				this._redrawRequested = undefined;
			});
		});

		return this._redrawRequested;
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
	 * Force reload and redraw all tiles.
	 */
	protected update() {}

	// evented methods
	/**
	 * add a listener for the event
	 * @param {string} type - event name
	 * @param {ListenerMethod} listener - listener function
	 * @returns {this}
	 * */
	on<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// push listener to the list of listeners
		(this._listeners[type] ||= []).push(listener);
		return this;
	}

	off<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// remove listener from the list of listeners
		if (this._listeners[type]) {
			this._listeners[type] = this._listeners[type].filter((l) => l !== listener);
		}
		return this;
	}

	once<T extends keyof WxEventType>(type: T, listener: ListenerMethod): this {
		// push listener to the list of listeners
		const onceListener = (...args: any[]) => {
			listener(...args);
			this.off(type, onceListener);
		};
		this.on(type, onceListener);
		return this;
	}

	protected _fire<T extends keyof WxEventType>(type: T, data?: WxEventType[T]) {
		// fire runs all listeners asynchroniously, so my algos don't stuck
		// call all listeners for the type
		if (this._listeners[type]) {
			this._listeners[type].forEach(async (l) => l(data));
		}
	}
}
