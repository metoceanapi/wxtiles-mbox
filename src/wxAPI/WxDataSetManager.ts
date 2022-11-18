import { fetchJson } from '../utils/wxtools';
import type { WxDate, WxVars } from '../wxlayer/wxlayer';
import type { WxDatasetMeta, WxAPI, WxVariableMeta, WxInstances, WxAllBoundariesMeta } from './wxAPI';

/**
 * @class WxDataSetManager
 * @description Class for managing WX datasets.
 * @param {string} dataSetsName - Name of the dataset.
 * @param {string} instance - current instance (instance or data time creataion in NC-file) of the dataset.
 * @param {WxDatasetMeta} meta - metadata.
 * @param {WxAPI} wxapi - Wx API control object.
 * */

export class WxDataSetManager {
	readonly datasetName: string;
	readonly instanced?: string[];
	readonly instance: string;
	readonly meta: WxDatasetMeta;
	readonly wxapi: WxAPI;

	constructor({
		datasetName,
		instance,
		instanced,
		meta,
		wxapi,
	}: {
		datasetName: string;
		instance: string;
		instanced?: string[];
		meta: WxDatasetMeta;
		wxapi: WxAPI;
	}) {
		if (!wxapi.datasetsMetas.allDatasetsList.includes(datasetName)) throw new Error(`Dataset ${datasetName} not found`);
		this.datasetName = datasetName;
		this.instanced = instanced;
		this.instance = instance;
		this.meta = meta;
		this.wxapi = wxapi;
	}

	/**
	 * Get closets valid time to the given time.
	 * @memberof WxDataSetManager
	 * @argument {WxDate} time - either a number of a step in dataset's time array or seconds since epoch or  a Date object
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getValidTime(time: WxDate = Date()): string {
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
	 * @memberof WxDataSetManager
	 * @returns {string[]} - copy of dataset's times
	 * */
	getTimes(): string[] {
		return this.instanced || this.meta.times;
	}

	/**
	 * Get dataset's variables.
	 * @memberof WxDataSetManager
	 * @returns {string[]} - copy of dataset's variables
	 * */
	getVariables(): string[] {
		return this.meta.variables;
	}

	/**
	 * Get dataset's variable meta.
	 * @memberof WxDataSetManager
	 * @argument {string} variable - variable name
	 * @returns {units, min, max} - some of dataset's variable meta
	 * unit - unit of the variable
	 * min - minimum value of the variable
	 * max - maximum value of the variable
	 * */
	getVariableMeta(variable: string): WxVariableMeta | undefined {
		return this.meta.variablesMeta[variable];
	}

	/**
	 * Get dataset's native maximum zoom level.
	 * @memberof WxDataSetManager
	 * @returns {number} - maximum zoom level of the dataset
	 * */
	getMaxZoom(): number {
		return this.meta.maxZoom;
	}

	/**
	 * Get dataset's boundaries.
	 * @memberof WxDataSetManager
	 * @returns {[west, north, east, south]} - dataset's boundaries
	 * */
	getBoundaries180(): [number, number, number, number] | undefined {
		const b180a = this.meta.boundaries?.boundaries180;
		if (!(b180a?.length === 1)) return; // TODO can't make lon = [170 to 190] as mapBox uses -180 to 180, so need to check for that in loader
		const b180 = b180a[0]; // else let mapbox manage boundaries
		return [b180.west, b180.south, b180.east, b180.north];
	}

	/**
	 * Get dataset's boundaries.
	 * @memberof WxDataSetManager
	 * @returns {[west, north, east, south]} - dataset's boundaries
	 * */
	getBoundaries(): WxAllBoundariesMeta | undefined {
		return this.meta.boundaries;
	}

	/**
	 * Createts dataset's current URI ready for fetching tiles.
	 * @memberof WxDataSetManager
	 * @argument {string} variable - variable of the dataset
	 * @argument {WxDate} time - time of the dataset
	 * @argument {string} ext - zoom level of the dataset
	 * @returns {string} - dataset's current URI ready for fetching tiles
	 * */
	createURI(variable: string, time?: WxDate, ext: string = 'png'): string {
		if (!this.checkVariableValid(variable)) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		const validTime = this.getValidTime(time);
		const instance = this.instanced ? validTime : this.instance;
		return `${this.wxapi.dataServerURL + this.datasetName}/${instance}/${variable}/${validTime}/{z}/{x}/{y}.${ext}`;
	}

	/**
	 * Check if given variable is available in the dataset.
	 * @memberof WxDataSetManager
	 * @argument {string} variable - variable name
	 * @returns {boolean} - true if variable is available in the dataset
	 * */
	checkVariableValid(variable: string): boolean {
		return this.getVariableMeta(variable) !== undefined;
	}

	checkCombineVariableIfVector(variable: string): WxVars {
		const meta = this.getVariableMeta(variable);
		if (!meta) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		return meta.vector || [variable]; // check if variable is vector and use vector components if so
	}

	/**
	 * Check if dataset's instance updated (fresh data is arrived) since datasset object was created
	 * @memberof WxDataSetManager
	 * @returns {boolean} - true if dataset's instance updated since datasset object was created
	 * */
	async checkDatasetOutdated(): Promise<boolean> {
		await this.wxapi.initDone;
		return (await this.getDatasetInstance()) === this.instance;
	}

	protected async getDatasetInstance(): Promise<string> {
		const instances = await this.getDatasetInstances();
		return instances[instances.length - 1];
	}

	protected async getDatasetInstances(): Promise<string[]> {
		try {
			const instances = await fetchJson<WxInstances>(this.wxapi.dataServerURL + this.datasetName + '/instances.json', this.wxapi.requestInit);
			if (instances.length === 0) throw new Error(`No instances found for dataset ${this.datasetName}`);
			return instances;
		} catch (e) {
			throw new Error(`getting dataset instances failure  message: ${e.message} datasetName: ${this.datasetName}`);
		}
	}
}
