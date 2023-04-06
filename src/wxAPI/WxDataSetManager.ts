import { fetchJson, WXLOG } from '../utils/wxtools';
import type { WxDate, WxLayerOptions, WxVars } from '../wxlayer/wxlayer';
import { WxTileSource } from '../wxsource/wxsource';
import { FrameworkOptions } from '../wxsource/wxsourcetypes';
import type { WxDatasetMeta, WxAPI, WxVariableMeta, WxInstances, WxAllBoundariesMeta } from './wxAPI';

export interface WxSourceLayerOptions extends Omit<WxLayerOptions, 'variables' | 'wxdatasetManager'> {
	variable: string;
}

/**
 * Options to pass to the constructor of {@link WxDataSetManager}
 */
export interface WxDataSetManagerOptions {
	/**
	 * @internal
	 *  Dataset name
	 * */
	datasetName: string;

	/**
	 * @internal
	 * current instance of the dataset
	 * */
	datasetCurrentInstance: string;

	/**
	 * @internal
	 * Array of instanced time steps
	 * */
	instanced?: string[];

	/**
	 * @internal
	 * Dataset's meta data
	 * */
	datasetCurrentMeta: WxDatasetMeta;

	/**
	 * @internal
	 * Dataset's metas for an instanced dataset
	 * */
	metas: Map<string, WxDatasetMeta>;

	/**
	 * @internal
	 * The {@link WxAPI} instance to use to interact with the *WxTiles* API
	 * */
	wxAPI: WxAPI;
}

/**
 * Class for managing WX datasets.
 * @class WxDataSetManager
 * @example
 * ```ts
 * 	const wxdatasetManager = await wxapi.createDatasetManager('gfs.global');
 * ```
 * */
export class WxDataSetManager {
	/** dataset's name  */
	readonly datasetName: string;

	/** Get dataset's current instance. */
	private readonly datasetCurrentInstance: string;

	/**  dataset's meta */
	private readonly datasetCurrentMeta: WxDatasetMeta;

	/** if not empty, returns dataset's instances to be used as time steps in the dataset */
	private readonly instanced?: string[];

	/**  dataset's metas for an instanced dataset */
	private readonly metas: Map<string, WxDatasetMeta>;

	/**  a reference to the wxAPI object */
	readonly wxAPI: WxAPI;

	/** Do not use this constructor directly, use {@link WxAPI.createDatasetManager} instead. */
	constructor({ datasetName, datasetCurrentInstance, instanced, datasetCurrentMeta, metas, wxAPI }: WxDataSetManagerOptions) {
		if (!wxAPI.datasetsMetas.allDatasetsList.includes(datasetName)) throw new Error(`Dataset ${datasetName} not found`);
		this.datasetName = datasetName;
		this.instanced = instanced;
		this.datasetCurrentInstance = datasetCurrentInstance;
		this.datasetCurrentMeta = datasetCurrentMeta;
		this.metas = metas;
		this.wxAPI = wxAPI;
		WXLOG(`WxDataSetManager.constructor: ${this.datasetName}`);
	}

	isInstanced(): boolean {
		return !!this.instanced;
	}

	/**
	 * Get closets valid time to the given time.
	 * @argument {WxDate} time - either a number of a step in dataset's time array or seconds since epoch or  a Date object
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getValidTime(time: WxDate = Date()): string {
		WXLOG(`WxDataSetManager.getValidTime: ${this.datasetName}, ${time}`);
		const times = this.getTimes();

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
	 * Get dataset's times.
	 * @returns {string[]} - copy of dataset's time steps
	 * */
	getTimes(): string[] {
		WXLOG(`WxDataSetManager.getTimes: ${this.datasetName}`);
		return this.instanced || this.datasetCurrentMeta.times;
	}

	/**
	 * Get dataset's variables.
	 * @returns {string[]} - all dataset's variables
	 * */
	getVariables(): string[] {
		WXLOG(`WxDataSetManager.getVariables: ${this.datasetName}`);
		return this.datasetCurrentMeta.variables;
	}

	/**
	 * Get dataset's variable meta.
	 * @argument {string} variable - variable name
	 * @returns {WxVariableMeta | undefined} - dataset variable's meta
	 * */
	getVariableMeta(variable: string): WxVariableMeta | undefined {
		WXLOG(`WxDataSetManager.getVariableMeta: ${this.datasetName}, ${variable}`);
		return this.datasetCurrentMeta.variablesMeta[variable];
	}

	/**
	 * For instanced dataset, get variable's meta.
	 * @argument {string} variable - variable name
	 * @argument {string} instance - instance name
	 * @returns {WxVariableMeta | undefined} - dataset variable's meta for the given instance
	 * */
	getInstanceVariableMeta(variable: string, instance: string): WxVariableMeta | undefined {
		WXLOG(`WxDataSetManager.getInstanceVariableMeta: ${this.datasetName}, ${variable}, ${instance}`);
		return this.getInstanceMeta(instance).variablesMeta[variable];
	}

	/**
	 * Get dataset's native maximum zoom level.
	 * @returns {number} - maximum zoom level of the dataset
	 * */
	getMaxZoom(): number {
		WXLOG(`WxDataSetManager.getMaxZoom: ${this.datasetName}`);
		return this.datasetCurrentMeta.maxZoom;
	}

	/**
	 * Get dataset's boundaries.
	 * @returns {WxAllBoundariesMeta | undefined} - dataset's boundaries
	 * */
	getBoundaries(): WxAllBoundariesMeta | undefined {
		WXLOG(`WxDataSetManager.getBoundaries: ${this.datasetName}`);
		return this.datasetCurrentMeta.boundaries;
	}

	/**
	 * Get dataset's metadata for the given instance.
	 * @param {string} instance
	 * @returns {WxDatasetMeta}
	 */
	getInstanceMeta(instance: string): WxDatasetMeta {
		WXLOG(`WxDataSetManager.getInstanceMeta: ${this.datasetName}, ${instance}`);
		return (this.instanced && this.metas.get(instance)) || this.datasetCurrentMeta;
	}

	/**
	 * Createts dataset's current URI ready for fetching tiles.
	 * @argument {string} variable - variable of the dataset
	 * @argument {WxDate} time - time step of the dataset
	 * @argument {'png'} ext - must be PNG
	 * @returns {string} - dataset's current URI ready for fetching tiles
	 * */
	createURI(variable: string, validTime: string, ext: 'png' = 'png'): string {
		WXLOG(`WxDataSetManager.createURI: ${this.datasetName}, ${variable}, ${validTime}`);
		if (!this.checkVariableValid(variable)) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		const instance = this.instanced ? validTime : this.datasetCurrentInstance;
		return `${this.wxAPI.dataServerURL + this.datasetName}/${instance}/${variable}/${validTime}/{z}/{x}/{y}.${ext}`;
	}

	/**
	 * Check if given variable is available in the dataset.
	 * @argument {string} variable - variable name
	 * @returns {boolean} - true if variable is available in the dataset
	 * */
	checkVariableValid(variable: string): boolean {
		WXLOG(`WxDataSetManager.checkVariableValid: ${this.datasetName}, ${variable}`);
		return this.getVariableMeta(variable) !== undefined;
	}

	/**
	 * Checks if variable is a vector component.
	 * @argument {string} variable - variable name
	 * @returns {WxVars} - [variable] or [variable.eastward, variable.northward]
	 * */
	checkCombineVariableIfVector(variable: string): WxVars {
		WXLOG(`WxDataSetManager.checkCombineVariableIfVector: ${this.datasetName}, ${variable}`);
		const variableMeta = this.getVariableMeta(variable);
		if (!variableMeta) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		return variableMeta.vector || [variable]; // check if variable is vector and use vector components if so
	}

	/**
	 * @param {WxSourceLayerOptions} options - layer options
	 * @param {WxSourceLayerOptions} frwOptions - framework options
	 * @returns {WxTileSource}
	 */
	createSourceLayer(options: WxSourceLayerOptions, frwOptions: FrameworkOptions): WxTileSource {
		WXLOG(`WxDataSetManager.createSourceLayer: ${this.datasetName}`);
		const layerOptions: WxLayerOptions = {
			...options,
			variables: this.checkCombineVariableIfVector(options.variable),
			wxdatasetManager: this,
		};

		return new WxTileSource(layerOptions, frwOptions);
	}

	/**
	 * A part of WxAPI (is not used internally)
	 * Check if dataset's instance updated (fresh data is arrived) since datasset object was created
	 * @returns {boolean} - true if dataset's instance updated since datasset object was created
	 * */
	async checkDatasetOutdated(): Promise<boolean> {
		WXLOG(`WxDataSetManager.checkDatasetOutdated: ${this.datasetName}`);
		await this.wxAPI.initDone;
		return (await this.getDatasetInstance()) === this.datasetCurrentInstance;
	}

	/**
	 * A part of WxAPI (is not used internally)
	 * Get dataset's instance.
	 * @returns {Promise<string>} - dataset's instance
	 * */
	protected async getDatasetInstance(): Promise<string> {
		WXLOG(`WxDataSetManager.getDatasetInstance: ${this.datasetName}`);
		const instances = await this.getDatasetInstances();
		return instances[instances.length - 1];
	}

	/**
	 * A part of WxAPI (is not used internally)
	 * Get dataset's instances.
	 * @returns {Promise<string[]>} - dataset's all instances
	 * */
	protected async getDatasetInstances(): Promise<string[]> {
		WXLOG(`WxDataSetManager.getDatasetInstances: ${this.datasetName}`);
		try {
			const instances = await fetchJson<WxInstances>(this.wxAPI.dataServerURL + this.datasetName + '/instances.json', this.wxAPI.requestInit);
			if (instances.length === 0) throw new Error(`No instances found for dataset ${this.datasetName}`);
			return instances;
		} catch (e) {
			throw new Error(`getting dataset instances failure message: ${e.message} datasetName: ${this.datasetName} (they are likely removed from API)`);
		}
	}
}
