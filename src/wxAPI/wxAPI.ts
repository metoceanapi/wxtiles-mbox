import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibOptions, WxTilesLibSetup, WxColorSchemes } from '../utils/wxtools';
import { QTree } from '../utils/qtree';
import { WxDataSetManager } from './WxDataSetManager';

export type WxInstances = Array<string>;
interface DatasetShortMeta {
	instance: string;
	variables: string[];
}

export interface WxDataSetsMetasJSON {
	allDatasetsList: string[];
	[name: string]: DatasetShortMeta | string[] | undefined;
}

export interface WxVariableMeta {
	units: string;
	min: number;
	max: number;
	standard_name?: string;
	vector?: [string, string];
}

export interface WxVariablesMetas {
	[name: string]: WxVariableMeta | undefined;
}

export interface WxBoundaryMeta {
	west: number;
	north: number;
	east: number;
	south: number;
}

/**
 * @interface WxAllBoundariesMeta
 * @description All possible versions of boundaries for the dataset. blocks of [-180,180] if original boundaries cross 180, blocks of [0,360], and original from the NC files.
 */
export interface WxAllBoundariesMeta {
	boundariesnorm: WxBoundaryMeta;
	boundaries180: WxBoundaryMeta[];
	boundaries360: WxBoundaryMeta[];
}

export interface WxDatasetMeta {
	variables: string[];
	variablesMeta: WxVariablesMetas;
	maxZoom: number;
	times: string[];
	boundaries?: WxAllBoundariesMeta;
	sourceID?: string;
	baseAtmosphericModel?: string;
	model?: string;
}

export interface WxAPIOptions extends WxTilesLibOptions {
	dataServerURL: string;
	maskURL?: 'none' | 'auto' | string;
	qtreeURL?: 'none' | 'auto' | string;
	requestInit?: RequestInit;
}

/**
 * WxAPI is a wrapper for WxTilesLib.
 * @class WxAPI
 * @argument {string} dataServerURL - URL of the data server
 * @argument {string} maskURL - URL of the mask server
 * @argument {string} qtreeURL - URL of the qtree data file
 * @argument {RequestInit} requestInit - request init object for fetching data
 * @argument {ColorStylesWeakMixed | undefined} colorStyles - color styles for the rendering
 * @argument {Units | undefined} units - units for the rendering
 * @argument {WxColorSchemes | undefined} colorSchemes - color schemes for the rendering
 * */
export class WxAPI {
	readonly dataServerURL: string;
	readonly maskURL?: string;
	readonly requestInit?: RequestInit;
	readonly datasetsMetas: WxDataSetsMetasJSON = { allDatasetsList: [] };
	readonly initDone: Promise<void>;
	readonly qtree: QTree = new QTree();
	readonly loadMaskFunc: ({ x, y, z }: XYZ) => Promise<ImageData> = () => Promise.reject(new Error('maskURL not defined'));

	constructor({ dataServerURL, maskURL = 'auto', qtreeURL = 'auto', requestInit, colorStyles, units, colorSchemes }: WxAPIOptions) {
		WxTilesLibSetup({ colorStyles, units, colorSchemes });

		this.dataServerURL = dataServerURL;
		this.requestInit = requestInit;
		qtreeURL = qtreeURL === 'auto' ? dataServerURL + 'seamask.qtree' : qtreeURL;

		if (maskURL !== 'none') {
			const maskloader = cacheUriPromise(loadImageData);
			this.maskURL = maskURL = maskURL === 'auto' ? dataServerURL + 'mask/' : maskURL;
			this.loadMaskFunc = (coord: XYZ) => maskloader(uriXYZ(maskURL, coord), requestInit);
		}

		this.initDone = Promise.all([
			fetchJson<WxDataSetsMetasJSON>(dataServerURL + 'datasetsmeta.json', requestInit),
			qtreeURL !== 'none' ? this.qtree.load(qtreeURL, requestInit) : Promise.resolve(),
		]).then(([datasetsMetas, _]): void => {
			datasetsMetas.allDatasetsList || (datasetsMetas.allDatasetsList = Object.keys(datasetsMetas));
			(this as any).datasetsMetas = datasetsMetas; // ovbercome readonly once :/
		});
	}

	protected getDatasetInatance(datasetName: string): string | undefined {
		return (this.datasetsMetas[datasetName] as DatasetShortMeta)?.instance;
	}

	/**
	 * Get all variables for the given dataset name.
	 * @memberof WxAPI
	 * @param {string} datasetName - dataset name
	 * @returns {Promise<string[]>} - list of all available variables for the dataset
	 */
	async getDatasetVariables(datasetName: string): Promise<string[]> {
		await this.initDone;
		return (this.datasetsMetas[datasetName] as DatasetShortMeta)?.variables;
	}

	/**
	 * Create WxDataSetManager object for the given dataset name.
	 * @memberof WxAPI
	 * @param {string} datasetName - dataset name
	 * @returns {Promise<WxDataSetManager>} - WxDataSetManager object for the given dataset name
	 */
	async createDatasetManager(datasetName: string): Promise<WxDataSetManager> {
		await this.initDone;
		const instance = this.getDatasetInatance(datasetName);
		if (!instance) throw new Error('Dataset/instance not found:' + datasetName);
		const meta = await fetchJson<WxDatasetMeta>(this.dataServerURL + datasetName + '/' + instance + '/meta.json', this.requestInit);
		return new WxDataSetManager({ datasetName, instance, meta, wxapi: this });
	}

	/**
	 *  Creates all possible dataset managers
	 * For each dataset in the datasets list, creates WxDataSetManager object.
	 * Requests all datasets meta.json in parallel.
	 * @memberof WxAPI
	 * @returns {Promise<WxDataSetManager[]>} - list of all available dataset managers
	 */
	async createAllDatasetsManagers(): Promise<PromiseSettledResult<WxDataSetManager>[]> {
		await this.initDone;
		const res = Promise.allSettled(this.datasetsMetas.allDatasetsList.map((datasetName: string) => this.createDatasetManager(datasetName)));
		return res;
	}

	/**
	 * Returns datasets names which have given variable
	 * @memberof WxAPI
	 * @argument {string} variableName - variable name to search for in datasets
	 * @returns {Promise<string[]>} - list of datasets' names
	 * */
	async filterDatasetsByVariableName(variableName: string): Promise<string[]> {
		await this.initDone;
		return this.datasetsMetas.allDatasetsList.filter((datasetName) =>
			(this.datasetsMetas[datasetName] as DatasetShortMeta)?.variables?.includes?.(variableName)
		);
	}

	/**
	 * Get the list of all available datasets' names
	 * @memberof WxAPI
	 * @returns {Promise<string[]>} - list of all available datasets' names
	 */
	async getAllDatasetsNames(): Promise<string[]> {
		await this.initDone;
		return this.datasetsMetas.allDatasetsList;
	}
}
