import { fetchJson, WXLOG } from '../utils/wxtools';
import type { WxDate, WxLayerOptions, WxLayerVarsNames } from '../wxlayer/wxlayer';
import { WxTileSource } from '../wxsource/wxsource';
import type { FrameworkOptions } from '../wxsource/wxsourcetypes';
import type { WxAPI } from './WxAPI';
import type { WxDatasetMeta, WxVariableMeta, WxAllBoundariesMeta, WxAllDatasetsShortMetas, WxDataSetManagerOptions, WxSourceLayerOptions } from './WxAPItypes';

/**
 * Class for managing WX datasets.
 * Do not use constructor directly.
 * Use {@link WxAPI} to create instances of this class.
 * @class WxDataSetManager
 * @example
 * ```ts
 * 	const wxdatasetManager = await wxapi.createDatasetManager('gfs.global');
 * ```
 * */
export class WxDataSetManager {
	/** dataset's name  */
	readonly datasetName: string;

	/**
	 * @internal
	 * a reference to the wxAPI object
	 * */
	readonly wxAPI: WxAPI;

	/** @ignore Get dataset's current instance. */
	protected _datasetCurrentInstance: string;

	/**  @ignore dataset's meta */
	protected _datasetCurrentMeta: WxDatasetMeta;

	/** @ignore if not empty, returns dataset's instances to be used as time steps in the dataset */
	protected _instanced?: string[];

	/**  @ignore dataset's metas for an instanced dataset */
	protected _metas?: Map<string, WxDatasetMeta>;

	/** @internal Do not use this constructor directly, use {@link WxAPI} instead.*/
	constructor({ datasetName, datasetCurrentInstance, instanced, datasetCurrentMeta, metas, wxAPI }: WxDataSetManagerOptions) {
		this.datasetName = datasetName;
		this._instanced = instanced;
		this._datasetCurrentInstance = datasetCurrentInstance;
		this._datasetCurrentMeta = datasetCurrentMeta;
		this._metas = metas;
		this.wxAPI = wxAPI;
		WXLOG(`WxDataSetManager.constructor: ${this.datasetName}`);
	}

	/**
	 * Create a source layer for the dataset.
	 * @param {WxSourceLayerOptions} options - layer options
	 * @param {FrameworkOptions} frwOptions - framework options
	 * @returns {WxTileSource}
	 */
	createSourceLayer(options: WxSourceLayerOptions, frwOptions: FrameworkOptions): WxTileSource {
		WXLOG(`WxDataSetManager.createSourceLayer: ${this.datasetName}`);
		const layerOptions: WxLayerOptions = {
			...options,
			variables: this._checkCombineVariableIfVector(options.variable),
			wxdatasetManager: this,
		};

		return new WxTileSource(layerOptions, frwOptions);
	}

	/**
	 * Get nearest valid time to the given time.
	 * @argument {WxDate} time - time
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getNearestValidTime(time: WxDate = Date()): string {
		WXLOG(`WxDataSetManager.getValidTime: ${this.datasetName}, ${time}`);
		const times = this.getAllTimes();

		if (time === '') return times[times.length - 1]; // for empty string use last time

		if (typeof time === 'string') {
			const index = times.indexOf(time);
			if (index !== -1) return times[index]; // if found use time from array
		}

		if (typeof time === 'number') {
			if (time <= 0) return times[0]; // for negative numbers use first time
			if (time < times.length) return times[time]; // for numbers in range use time from array
		}

		const ms = new Date(time).getTime(); // otherwise convert time as milliseconds
		if (isNaN(ms)) return times[times.length - 1]; // if not valid use first time

		const found = times.find((t) => new Date(t).getTime() >= ms);
		return found || times[times.length - 1];
	}

	/**
	 * Get all times from the dataset.
	 * @returns {string[]} - copy of dataset's time steps
	 * */
	getAllTimes(): string[] {
		WXLOG(`WxDataSetManager.getTimes: ${this.datasetName}`);
		return this._instanced || this._datasetCurrentMeta.times;
	}

	/**
	 * Get all variables from the dataset.
	 * @returns {string[]} - all dataset's variables
	 * */
	getAllVariables(): string[] {
		WXLOG(`WxDataSetManager.getVariables: ${this.datasetName}`);
		return this._datasetCurrentMeta.variables;
	}

	/**
	 * Get the variable's meta from the dataset.
	 * @argument {string} variable - variable name
	 * @returns {WxVariableMeta | undefined} - dataset variable's meta
	 * */
	getVariableCurrentMeta(variable: string): WxVariableMeta | undefined {
		WXLOG(`WxDataSetManager.getVariableCurrentMeta: ${this.datasetName}, ${variable}`);
		return this._datasetCurrentMeta.variablesMeta[variable];
	}

	/**
	 * Get the variable meta from the instanced dataset.
	 * @argument {string} variable - variable name
	 * @argument {string} instance - instance name
	 * @returns {WxVariableMeta | undefined} - dataset variable's meta for the given instance
	 * */
	getInstanceVariableMeta(variable: string, instance?: string): WxVariableMeta | undefined {
		WXLOG(`WxDataSetManager.getInstanceVariableMeta: ${this.datasetName}, ${variable}, ${instance}`);
		return this.getInstanceMeta(instance).variablesMeta[variable];
	}

	/**
	 * Get dataset's native maximum zoom level.
	 * @returns {number} - maximum zoom level of the dataset
	 * */
	getMaxZoom(): number {
		WXLOG(`WxDataSetManager.getMaxZoom: ${this.datasetName}`);
		return this._datasetCurrentMeta.maxZoom;
	}

	/**
	 * Get dataset's boundaries.
	 * @returns {WxAllBoundariesMeta | undefined} - dataset's boundaries
	 * */
	getBoundaries(): WxAllBoundariesMeta | undefined {
		WXLOG(`WxDataSetManager.getBoundaries: ${this.datasetName}`);
		return this._datasetCurrentMeta.boundaries;
	}

	/**
	 * Get dataset's metadata for the given instance.
	 * @param {string} instance
	 * @returns {WxDatasetMeta}
	 */
	getInstanceMeta(instance?: string): WxDatasetMeta {
		WXLOG(`WxDataSetManager.getInstanceMeta: ${this.datasetName}, ${instance}`);
		return (instance && this._metas?.get(instance)) || this._datasetCurrentMeta;
	}

	/**
	 * Createts dataset's current URI ready for fetching tiles.
	 * @argument {string} variable - variable of the dataset
	 * @argument {string} validTime - time step of the dataset
	 * @argument {'png'} ext - must be PNG
	 * @returns {string} - dataset's current URI ready for fetching tiles
	 * */
	createURI(variable: string, validTime: string, ext: 'png' = 'png'): string {
		WXLOG(`WxDataSetManager.createURI: ${this.datasetName}, ${variable}, ${validTime}`);
		if (!this.isVariableValid(variable)) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		const instance = this._instanced ? validTime : this._datasetCurrentInstance;
		return `${this.wxAPI.dataServerURL + this.datasetName}/${instance}/${variable}/${validTime}/{z}/{x}/{y}.${ext}`;
	}

	/**
	 * Check if given variable is available in the dataset.
	 * @argument {string} variable - variable name
	 * @returns {boolean} - true if variable is available in the dataset
	 * */
	isVariableValid(variable: string): boolean {
		WXLOG(`WxDataSetManager.checkVariableValid: ${this.datasetName}, ${variable}`);
		return this._datasetCurrentMeta.variablesMeta[variable] !== undefined;
	}

	/** @internal Update dataset's meta data. */
	async update() {
		const newDsManager = await this.wxAPI.createDatasetManager(this.datasetName);
		this._datasetCurrentInstance = newDsManager._datasetCurrentInstance;
		this._instanced = newDsManager._instanced;
		this._datasetCurrentMeta = newDsManager._datasetCurrentMeta;
		this._metas = newDsManager._metas;
	}

	/** @internal Get dataset's current instance. @returns {boolean} - true if dataset is instanced */
	isInstanced(): boolean {
		return this._instanced !== undefined;
	}

	/**
	 * @internal
	 * Checks if variable is a vector component.
	 * @argument {string} variable - variable name
	 * @returns {WxLayerVarsNames} - [variable] or [variable.eastward, variable.northward]
	 * */
	protected _checkCombineVariableIfVector(variable: string): WxLayerVarsNames {
		WXLOG(`WxDataSetManager.checkCombineVariableIfVector: ${this.datasetName}, ${variable}`);
		const variableMeta = this._datasetCurrentMeta.variablesMeta[variable];
		if (!variableMeta) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		return variableMeta.vector || [variable]; // check if variable is vector and use vector components if so
	}
}

/**
 * Class for managing all datasets metadata.
 * @internal
 */
export class WxAllDatasetsManager {
	allDatasetsShortMetas: WxAllDatasetsShortMetas = {};
	ready: Promise<WxAllDatasetsShortMetas>;

	constructor(protected readonly wxAPI: WxAPI) {
		this.ready = this.updateAll(); // init _ready
	}

	/**
	 * Update all datasets metadata
	 * @returns a promise that resolves when all datasets are loaded
	 */
	updateAll(): Promise<WxAllDatasetsShortMetas> {
		this.ready = fetchJson(this.wxAPI.dataServerURL + 'meta.json', this.wxAPI.requestInit);
		this.ready.then((dms) => (this.allDatasetsShortMetas = dms));
		return this.ready;
	}

	/**
	 * Update one dataset metadata
	 * @param {string} datasetName - name of the dataset to update
	 * @returns {Promise<WxAllDatasetsShortMetas>} a promise that resolves when the dataset is loaded
	 * if the dataset is not found in the list of datasets, it will update all datasets
	 */
	async updateOne(datasetName: string): Promise<WxAllDatasetsShortMetas> {
		try {
			const urlMeta = this.wxAPI.dataServerURL + datasetName + '/meta.json';
			const datasetMeta = await fetchJson(urlMeta, this.wxAPI.requestInit);
			return Object.assign(this.allDatasetsShortMetas, datasetMeta);
		} catch {
			return this.updateAll(); // if failed, update all
		}
	}
}
