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
	instance: string;

	/**
	 * @internal
	 * Array of instanced time steps
	 * */
	instanced?: string[];

	/**
	 * @internal
	 * Dataset's meta data
	 * */
	meta: WxDatasetMeta;

	/**
	 * @internal
	 * The {@link WxAPI} instance to use to interact with the *WxTiles* API
	 * */
	wxapi: WxAPI;
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

	/** if not empty, returns dataset's instances to be used as time steps in the dataset */
	readonly instanced?: string[];

	/** Get dataset's current instance. */
	readonly instance: string;

	/**  dataset's meta */
	readonly meta: WxDatasetMeta;

	/**  a reference to the wxAPI object */
	readonly wxapi: WxAPI;

	/** Do not use this constructor directly, use {@link WxAPI.createDatasetManager} instead. */
	constructor({ datasetName, instance, instanced, meta, wxapi }: WxDataSetManagerOptions) {
		if (!wxapi.datasetsMetas.allDatasetsList.includes(datasetName)) throw new Error(`Dataset ${datasetName} not found`);
		this.datasetName = datasetName;
		this.instanced = instanced;
		this.instance = instance;
		this.meta = meta;
		this.wxapi = wxapi;
		WXLOG(`WxDataSetManager.constructor: ${this.datasetName}`);
	}

	/**
	 * Get closets valid time to the given time.
	 * @argument {WxDate} time - either a number of a step in dataset's time array or seconds since epoch or  a Date object
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getValidTime(time: WxDate = Date()): string {
		WXLOG(`WxDataSetManager.getValidTime: ${this.datasetName}, ${time}`);
		const times = this.getTimes();
		if (typeof time === 'number') {
			if (time <= 0) return times[0]; // for negative numbers use first time
			if (time < times.length) return times[time]; // for numbers in range use time from array
		}

		const ms = new Date(time).getTime(); // otherwise convert time as milliseconds
		const found = times.find((t) => new Date(t).getTime() >= ms);
		if (isNaN(ms) || !found) {
			// try regular serch on strings
			const index = times.indexOf(time as string);
			if (index === -1) return times[times.length - 1]; // if not found use first time
			return times[index];
		}

		return found;
	}

	/**
	 * Get dataset's times.
	 * @returns {string[]} - copy of dataset's time steps
	 * */
	getTimes(): string[] {
		WXLOG(`WxDataSetManager.getTimes: ${this.datasetName}`);
		return this.instanced || this.meta.times;
	}

	/**
	 * Get dataset's variables.
	 * @returns {string[]} - all dataset's variables
	 * */
	getVariables(): string[] {
		WXLOG(`WxDataSetManager.getVariables: ${this.datasetName}`);
		return this.meta.variables;
	}

	/**
	 * Get dataset's variable meta.
	 * @argument {string} variable - variable name
	 * @returns {WxVariableMeta} - some of dataset's variable meta
	 * */
	getVariableMeta(variable: string): WxVariableMeta | undefined {
		WXLOG(`WxDataSetManager.getVariableMeta: ${this.datasetName}, ${variable}`);
		return this.meta.variablesMeta[variable];
	}

	/**
	 * Get dataset's native maximum zoom level.
	 * @returns {number} - maximum zoom level of the dataset
	 * */
	getMaxZoom(): number {
		return this.meta.maxZoom;
	}

	/**
	 * Get dataset's boundaries.
	 * @returns {[west, north, east, south] | undefined} - dataset's boundaries
	 * */
	getBoundaries180(): [number, number, number, number] | undefined {
		const b180a = this.meta.boundaries?.boundaries180;
		if (!(b180a?.length === 1)) return; // TODO can't make lon = [170 to 190] as mapBox uses -180 to 180, so need to check for that in loader
		const b180 = b180a[0]; // else let mapbox manage boundaries
		return [b180.west, b180.south, b180.east, b180.north];
	}

	/**
	 * Get dataset's boundaries.
	 * @returns {WxAllBoundariesMeta | undefined} - dataset's boundaries
	 * */
	getBoundaries(): WxAllBoundariesMeta | undefined {
		return this.meta.boundaries;
	}

	/**
	 * Createts dataset's current URI ready for fetching tiles.
	 * @argument {string} variable - variable of the dataset
	 * @argument {WxDate} time - time step of the dataset
	 * @argument {'png'} ext - must be PNG
	 * @returns {string} - dataset's current URI ready for fetching tiles
	 * */
	createURI(variable: string, time?: WxDate, ext: 'png' = 'png'): string {
		WXLOG(`WxDataSetManager.createURI: ${this.datasetName}, ${variable}, ${time}`);
		if (!this.checkVariableValid(variable)) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		const validTime = this.getValidTime(time);
		const instance = this.instanced ? validTime : this.instance;
		return `${this.wxapi.dataServerURL + this.datasetName}/${instance}/${variable}/${validTime}/{z}/{x}/{y}.${ext}`;
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
		const meta = this.getVariableMeta(variable);
		if (!meta) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		return meta.vector || [variable]; // check if variable is vector and use vector components if so
	}

	createSourceLayer(options: WxSourceLayerOptions, frwOptions: FrameworkOptions) {
		WXLOG(`WxDataSetManager.createSourceLayer: ${this.datasetName}`);
		const layerOptions: WxLayerOptions = {
			...options,
			variables: this.checkCombineVariableIfVector(options.variable),
			wxdatasetManager: this,
		};

		return new WxTileSource(layerOptions, frwOptions);
	}

	/**
	 * Check if dataset's instance updated (fresh data is arrived) since datasset object was created
	 * @returns {boolean} - true if dataset's instance updated since datasset object was created
	 * */
	async checkDatasetOutdated(): Promise<boolean> {
		WXLOG(`WxDataSetManager.checkDatasetOutdated: ${this.datasetName}`);
		await this.wxapi.initDone;
		return (await this.getDatasetInstance()) === this.instance;
	}

	/**
	 * Get dataset's instance.
	 * @returns {Promise<string>} - dataset's instance
	 * */
	protected async getDatasetInstance(): Promise<string> {
		WXLOG(`WxDataSetManager.getDatasetInstance: ${this.datasetName}`);
		const instances = await this.getDatasetInstances();
		return instances[instances.length - 1];
	}

	/**
	 * Get dataset's instances.
	 * @returns {Promise<string[]>} - dataset's all instances
	 * */
	protected async getDatasetInstances(): Promise<string[]> {
		WXLOG(`WxDataSetManager.getDatasetInstances: ${this.datasetName}`);
		try {
			const instances = await fetchJson<WxInstances>(this.wxapi.dataServerURL + this.datasetName + '/instances.json', this.wxapi.requestInit);
			if (instances.length === 0) throw new Error(`No instances found for dataset ${this.datasetName}`);
			return instances;
		} catch (e) {
			throw new Error(`getting dataset instances failure  message: ${e.message} datasetName: ${this.datasetName}`);
		}
	}
}
