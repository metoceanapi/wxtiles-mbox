import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibSetup, WXLOG } from '../utils/wxtools';
import { QTree } from '../utils/qtree';
import { WxDataSetManager } from './WxDataSetManager';
import { WxAllDatasetsManager } from './WxDataSetManager';
import { WxAPIOptions, WxDatasetMeta } from './WxAPItypes';

/**
 * WxAPI is an initialisation object for the library. See {@link WxAPIOptions} for options.
 * @example
 * ```typescript
 * import { WxAPI } from 'wx-tiles';
 * const wxapi = new WxAPI({
 * 	dataServerURL: 'https://server.com/',
 * 	// other options
 * });
 * ```
 */
export class WxAPI {
	/** resolved when {@link WxAPI} is ready to be used */
	readonly initDone: Promise<void>;

	/** see {@link WxAPIOptions}*/
	readonly dataServerURL: string;

	/** see {@link WxAPIOptions}*/
	readonly ext: string;

	/** see {@link WxAPIOptions}*/
	readonly requestInit?: RequestInit;

	/************************/
	/* NO EXPORT PART BEGIN */
	/************************/
	/** @internal see {@link WxAPIOptions}*/
	readonly maskURL: string;

	/** @internal see {@link WxAPIOptions}*/
	readonly maskChannel: number;

	/** @internal see {@link WxAPIOptions}*/
	readonly maskDepth: number;

	/** @internal instance of the qtree object */
	readonly qtree: QTree;

	/** @internal function to load mask tiles */
	readonly loadMaskFunc: ({ x, y, z }: XYZ) => Promise<ImageData>;

	/** @ignore @internal a manager for all datasets. Operates with short datasets*/
	protected readonly _allDatasetsManager: WxAllDatasetsManager;
	/************************/
	/* NO EXPORT PART END */
	/************************/

	/**
	 * Creates a new instance of the WxAPI class.
	 * @param {WxAPIOptions} options - An object {@link WxAPIOptions} containing options for configuring the WxAPI instance.
	 * @returns A new instance of the WxAPI class.
	 */
	constructor({
		dataServerURL,
		ext = 'png',
		maskURL = 'none',
		maskChannel = 'R',
		maskDepth = 11,
		qtreeURL = 'none',
		requestInit,
		colorStyles,
		units,
		colorSchemes,
	}: WxAPIOptions) {
		WXLOG('WxAPI.constructor', dataServerURL);
		WxTilesLibSetup({ colorStyles, units, colorSchemes });

		// compose auto-URLs for qtree and mask
		if (qtreeURL === 'auto') qtreeURL = dataServerURL + 'masks/11+1.seamask.qtree';
		if (maskURL === 'auto') maskURL = dataServerURL + 'masks/{z}/{x}/{y}.png';

		this.dataServerURL = dataServerURL;
		this.ext = ext;
		this.requestInit = requestInit;

		this.maskURL = maskURL;
		this.maskChannel = maskChannel === 'R' ? 0 : maskChannel === 'G' ? 1 : maskChannel === 'B' ? 2 : maskChannel === 'A' ? 3 : 0; // default to R
		this.maskDepth = maskDepth;
		if (this.maskURL !== 'none') {
			const maskloader = cacheUriPromise(loadImageData);
			this.loadMaskFunc = (coord: XYZ) => maskloader(uriXYZ(this.maskURL, coord), requestInit);
		} else {
			this.loadMaskFunc = () => Promise.reject(new Error('maskURL not defined'));
		}

		this._allDatasetsManager = new WxAllDatasetsManager(this);
		this.qtree = new QTree(qtreeURL, requestInit);

		this.initDone = Promise.all([this._allDatasetsManager.ready, this.qtree.ready]).then(() => WXLOG('WxAPI.constructor initDone'));
	}

	/**
	 * Creates a new instance of the WxDataSetManager class {@link WxDataSetManager} for the given dataset name.
	 * @param {string} datasetName - The name of the dataset to create a manager for.
	 * @returns {Promise<WxDataSetManager>} - A new instance of the WxDataSetManager class for the given dataset name.
	 * @throws {Error} - If the dataset or instance is not found.
	 */
	async createDatasetManager(datasetName: string): Promise<WxDataSetManager> {
		await this.initDone;
		await this._allDatasetsManager.updateOne(datasetName);
		WXLOG('WxAPI.createDatasetManager', datasetName);
		const datasetShortMeta = this._allDatasetsManager.allDatasetsShortMetas[datasetName];
		const datasetCurrentInstance = datasetShortMeta?.instance;
		if (!datasetCurrentInstance) throw new Error('Dataset/instance not found:' + datasetName);
		const instanced = datasetShortMeta.instanced;
		const metasArray = await fetchJson<WxDatasetMeta[]>(this.dataServerURL + datasetName + '/metafull.json');
		const datasetCurrentMeta = metasArray[0];
		// const metas = new Map({ // fency way to create a map from an array
		// 	[Symbol.iterator]() {
		// 		const ff = metasArray.values(); // iterator
		// 		return {
		// 			next(): IteratorResult<[string, WxDatasetMeta]> {
		// 				const { value, done } = ff.next();
		// 				return { value: [value.instance, value], done };
		// 			},
		// 		};
		// 	},
		// });
		const metas = instanced && new Map(metasArray.map((meta) => [meta.instance, meta]));
		return new WxDataSetManager({ datasetName, datasetCurrentInstance, datasetCurrentMeta, instanced, metas, wxAPI: this });
	}

	/**
	 * Returns the list of all available variables for the given dataset name.
	 * @param {string} datasetName - The name of the dataset to get the variables for.
	 * @returns {Promise<string[] | undefined>} - A list of all available variables for the given dataset name, or undefined if the dataset is not found.
	 */
	async getDatasetAllVariables(datasetName: string): Promise<string[] | undefined> {
		await this.initDone;
		WXLOG('WxAPI.getDatasetVariables', datasetName);
		return this._allDatasetsManager.allDatasetsShortMetas[datasetName]?.variables;
	}

	/**
	 * Filters the list of all available datasets' names by the given variable name.
	 * @param {string} varName - The variable name to filter by.
	 * @returns {Promise<string[]>} - A list of all available datasets' names that have the given variable name.
	 */
	async filterDatasetsByVariableName(varName: string): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.filterDatasetsByVariableName:', varName);
		const { allDatasetsShortMetas } = this._allDatasetsManager;
		return Object.keys(allDatasetsShortMetas).filter((dsName) => allDatasetsShortMetas[dsName]!.variables.includes(varName));
	}

	/**
	 * Returns a list of all available datasets' names.
	 * @returns {Promise<string[]>} - A list of all available datasets' names.
	 */
	async getAllDatasetsNames(): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.getAllDatasetsNames');
		return Object.keys(this._allDatasetsManager.allDatasetsShortMetas);
	}
}
