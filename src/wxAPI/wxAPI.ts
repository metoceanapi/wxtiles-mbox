import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibOptions, WxTilesLibSetup, Units, ColorSchemes } from '../utils/wxtools';
import { QTree } from '../utils/qtree';

type wxDataSetsNames = Array<string>;

type wxInstances = Array<string>;

interface wxProcessed {
	[datasetName: string]: [string, string];
}

export interface VariableMeta {
	[name: string]: {
		units: string;
		min: number;
		max: number;
	};
}

export interface BoundaryMeta {
	west: number;
	north: number;
	east: number;
	south: number;
}

/**
 * @interface AllBoundariesMeta
 * @description All possible versions of boundaries for the dataset. blocks of [-180,180] if original boundaries cross 180, blocks of [0,360], and original from the NC files.
 */
export interface AllBoundariesMeta {
	boundariesnorm: BoundaryMeta;
	boundaries180: BoundaryMeta[];
	boundaries360: BoundaryMeta[];
}

export interface Meta {
	variables: string[];
	variablesMeta: VariableMeta;
	maxZoom: number;
	times: string[];
	boundaries?: AllBoundariesMeta;
}

/**
 * @class wxDataSetManager
 * @description Class for managing WX datasets.
 * @param {string} dataSetsName - Name of the dataset.
 * @param {string} instance - current instance (instance or data time creataion in NC-file) of the dataset.
 * @param {Meta} meta - metadata.
 * @param {[string, string]} processed - timestemp and filename of the dataset.
 * @param {wxAPI} wxapi - Wx API control object.
 * */
export class wxDataSetManager {
	datasetName: string;
	instance: string;
	meta: Meta;
	processed: [string, string];
	wxapi: wxAPI;

	constructor({
		datasetName,
		instance,
		meta,
		processed,
		wxapi,
	}: {
		datasetName: string;
		instance: string;
		meta: Meta;
		processed: [string, string];
		wxapi: wxAPI;
	}) {
		this.datasetName = datasetName;
		this.instance = instance;
		this.meta = meta;
		this.processed = processed;
		this.wxapi = wxapi;
	}

	/**
	 * Get closets valid time to the given time.
	 * @memberof wxDataSetManager
	 * @argument {number} time - either a number of a step in dataset's time array or seconds since epoch
	 * @argument {string} time - time convertable to a Date object
	 * @argument {Date} time - Date object
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getValidTime(time: string | number | Date = Date()): string {
		const { times } = this.meta;
		if (typeof time === 'number') {
			if (time <= 0) return times[0]; // for negative numbers use first time
			if (time < times.length) return times[time]; // for numbers in range use time from array
		}

		const ms = new Date(time).getTime(); // otherwise convert time as milliseconds
		const found = times.find((t) => new Date(t).getTime() >= ms);
		return found || times[times.length - 1];
	}

	/**
	 * Get dataset's times.
	 * @memberof wxDataSetManager
	 * @returns {string[]} - copy of dataset's times
	 * */
	getTimes(): string[] {
		return [...this.meta.times];
	}

	/**
	 * Get dataset's variables.
	 * @memberof wxDataSetManager
	 * @returns {string[]} - copy of dataset's variables
	 * */
	getVariables(): string[] {
		return [...this.meta.variables];
	}

	/**
	 * Get dataset's variable meta.
	 * @memberof wxDataSetManager
	 * @argument {string} variable - variable name
	 * @returns {units, min, max} - some of dataset's variable meta
	 * unit - unit of the variable
	 * min - minimum value of the variable
	 * max - maximum value of the variable
	 * */
	getVariableMeta(variable: string): { units: string; min: number; max: number } | undefined {
		return this.meta.variablesMeta[variable];
	}

	/**
	 * Get dataset's native maximum zoom level.
	 * @memberof wxDataSetManager
	 * @returns {number} - maximum zoom level of the dataset
	 * */
	getMaxZoom(): number {
		return this.meta.maxZoom;
	}

	/**
	 * Get dataset's boundaries.
	 * @memberof wxDataSetManager
	 * @returns {[west, north, east, south]} - dataset's boundaries
	 * */
	getBoundaries(): [number, number, number, number] | undefined {
		const b180a = this.meta.boundaries?.boundaries180;
		if (!(b180a?.length === 1)) return; // TODO can't make lon = [170 to 190] as mapBox uses -180 to 180, so need to check for that in loader
		const b180 = b180a[0]; // else let mapbox manage boundaries
		return [b180.west, b180.south, b180.east, b180.north];
	}

	/**
	 * Createts dataset's current URI ready for fetching tiles.
	 * @memberof wxDataSetManager
	 * @argument {string} variable - variable of the dataset
	 * @argument {string | number | Date} time - time of the dataset
	 * @argument {string} ext - zoom level of the dataset
	 * @returns {string} - dataset's current URI ready for fetching tiles
	 * */
	createURI({ variable, time, ext = 'png' }: { variable: string; time?: string | number | Date; ext?: string }): string {
		if (!this.meta.variablesMeta?.[variable]) throw new Error(`in dataset ${this.datasetName} variable ${variable} not found`);
		time = this.getValidTime(time);
		return `${this.wxapi.dataServerURL + this.datasetName}/${this.instance}/${variable}/${time}/{z}/{x}/{y}.${ext}`;
	}

	/**
	 * Check if given variable is available in the dataset.
	 * @memberof wxDataSetManager
	 * @argument {string} variable - variable name
	 * @returns {boolean} - true if variable is available in the dataset
	 * */
	checkVariableValid(variable: string): boolean {
		return this.meta.variablesMeta?.[variable] !== undefined;
	}

	/**
	 * Check if dataset's instance updated (fresh data is arrived) since datasset object was created
	 * @memberof wxDataSetManager
	 * @returns {boolean} - true if dataset's instance updated since datasset object was created
	 * */
	async checkDatasetOutdated(): Promise<boolean> {
		await this.wxapi.initDone;
		if (!this.wxapi.datasetsNames.includes(this.datasetName)) throw new Error(`Dataset ${this.datasetName} not found`);
		return (await this.wxapi.getDatasetInstance(this.datasetName)) === this.instance;
	}
}

export interface wxAPIOptions extends WxTilesLibOptions {
	dataServerURL: string;
	maskURL?: 'none' | 'auto' | string;
	qtreeURL?: 'none' | 'auto' | string;
	requestInit?: RequestInit;
}

/**
 * wxAPI is a wrapper for WxTilesLib.
 * @class wxAPI
 * @argument {string} dataServerURL - URL of the data server
 * @argument {string} maskURL - URL of the mask server
 * @argument {string} qtreeURL - URL of the qtree data file
 * @argument {RequestInit} requestInit - request init object for fetching data
 * @argument {ColorStylesWeakMixed | undefined} colorStyles - color styles for the rendering
 * @argument {Units | undefined} unnits - units for the rendering
 * @argument {ColorSchemes | undefined} colorSchemes - color schemes for the rendering
 * */
export class wxAPI {
	readonly dataServerURL: string;
	readonly maskURL?: string;
	readonly requestInit?: RequestInit;
	readonly datasetsNames: wxDataSetsNames = [];
	readonly processed: wxProcessed = {};
	readonly initDone: Promise<void>;
	readonly qtree: QTree = new QTree();
	readonly loadMaskFunc: ({ x, y, z }: XYZ) => Promise<ImageData>;

	constructor({ dataServerURL, maskURL = 'auto', qtreeURL = 'auto', requestInit, colorStyles, units, colorSchemes }: wxAPIOptions) {
		WxTilesLibSetup({ colorStyles, units, colorSchemes });

		this.dataServerURL = dataServerURL;
		maskURL = maskURL === 'auto' ? dataServerURL + 'mask/' : maskURL;
		this.maskURL = maskURL;
		qtreeURL = qtreeURL === 'auto' ? dataServerURL + 'seamask.qtree' : qtreeURL;
		this.requestInit = requestInit;

		const maskloader = cacheUriPromise(loadImageData);
		this.loadMaskFunc =
			maskURL !== 'none'
				? async (coord: XYZ) => {
						try {
							return await maskloader(uriXYZ(maskURL, coord), requestInit);
						} catch (e) {
							throw new Error(`loading mask failure  message: ${e.message} maskURL: ${maskURL}`);
						}
				  }
				: () => Promise.reject(new Error('maskURL not defined'));

		this.initDone = Promise.all([
			fetchJson<string[]>(dataServerURL + 'datasets.json', requestInit),
			fetchJson<wxProcessed>(dataServerURL + 'processed.json', requestInit),
			qtreeURL !== 'none' ? this.qtree.load(qtreeURL, requestInit) : Promise.resolve(),
		]).then(([datasets, processed, _]): void => {
			this.datasetsNames.push(...datasets);
			// in 'processed.json' we need to get rid of the 'path' after datasets names
			Object.keys(processed).forEach((datasetName): void => {
				this.processed[datasetName.split(':')[0]] = processed[datasetName];
			});
		});
	}

	async getDatasetInstance(datasetName: string): Promise<string> {
		try {
			const instances = await fetchJson<wxInstances>(this.dataServerURL + datasetName + '/instances.json', this.requestInit);
			if (instances.length === 0) throw new Error(`No instances found for dataset ${datasetName}`);
			return instances[instances.length - 1];
		} catch (e) {
			throw new Error(`getting dataset instances failure  message: ${e.message} datasetName: ${datasetName}`);
		}
	}

	async createDatasetManager(datasetName: string): Promise<wxDataSetManager> {
		await this.initDone;
		if (!this.datasetsNames.includes(datasetName)) throw new Error('Dataset not found:' + datasetName);
		const instance = await this.getDatasetInstance(datasetName);
		const meta = await fetchJson<Meta>(this.dataServerURL + datasetName + '/' + instance + '/meta.json', this.requestInit);
		const processed = this.processed[datasetName];
		return new wxDataSetManager({ datasetName, instance, meta, processed, wxapi: this });
	}

	async createAllDatasetsManagers(): Promise<wxDataSetManager[]> {
		await this.initDone;
		return Promise.all(this.datasetsNames.map((datasetName: string) => this.createDatasetManager(datasetName)));
	}

	static filterDatasetsByVariableName(datasets: wxDataSetManager[], variableName: string): wxDataSetManager[] {
		return datasets.filter((dataset) => dataset.meta.variables?.includes?.(variableName));
	}
}
