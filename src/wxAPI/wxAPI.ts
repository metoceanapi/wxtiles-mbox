import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibOptions, WxTilesLibSetup, WxColorSchemes, WXLOG } from '../utils/wxtools';
import { QTree } from '../utils/qtree';
import { WxDataSetManager } from './WxDataSetManager';

/**
 * type array of strings - available instances of a dataset */
export type WxInstances = string[];

/**
 * Short description of a dataset */
export interface WxDatasetShortMeta {
	/** represents instances as timesteps for some datasets like NZ Radar */
	instanced?: string[];
	/** last instance of a dataset */
	instance: string;
	/** list of variables in a dataset */
	variables: string[];
}

/**
 * Short description of all available datasets */
export interface WxDataSetsMetasJSON {
	/**
	 * a list of datasets */
	allDatasetsList: string[];

	/**
	 * a list of datasets with short description */
	[name: string]: WxDatasetShortMeta | string[] | undefined;
}

/**
 * Meta data of a variable */
export interface WxVariableMeta {
	/** units used for the variable */
	units: string;

	/** min value */
	min: number;

	/** max value */
	max: number;

	/** standard name */
	standard_name?: string;

	/** if the variable is a part of vector data, this contains a proper pare */
	vector?: [string, string];
}

/**
 * interface of an object with variable names as keys and variable meta data as values */
export interface WxVariablesMetas {
	[name: string]: WxVariableMeta | undefined;
}

/** boundaries of a dataset */
export interface WxBoundaryMeta {
	west: number;
	north: number;
	east: number;
	south: number;
}

/**
 * All possible versions of boundaries for the dataset wrapped (0 -> 360) or (180 -> -180)
 * as well as the original boundaries from the dataset */
export interface WxAllBoundariesMeta {
	boundariesnorm: WxBoundaryMeta;
	boundaries180: WxBoundaryMeta[];
	boundaries360: WxBoundaryMeta[];
}

/**
 * Meta data of a dataset */
export interface WxDatasetMeta {
	/**
	 * a list of variables in a dataset */
	variables: string[];

	/**
	 * metadata of variables */
	variablesMeta: WxVariablesMetas;

	/**
	 * max zoom level */
	maxZoom: number;

	/**
	 * array of available timesteps */
	times: string[];

	/**
	 * boundaries of a dataset */
	boundaries?: WxAllBoundariesMeta;

	/**
	 * source of the dataset */
	sourceID?: string;

	/**
	 * base atmospheric model */
	baseAtmosphericModel?: string;

	/**
	 * model used for the dataset*/
	model?: string;
}

/**
 * Options to construct {@link WxAPI} object
 * @example
 * ```typescript
 *	const requestInit: RequestInit = {
 *		headers
 *	}; // add more options if needed such as headers, mode, credentials, etc
 *	const options = {
 *		dataServerURL:'https://tiles.metoceanapi.com/data/',
 *		requestInit: { headers: myHeaders },
 *	}
 *	const wxapi = new WxAPI(options);
 * ```
 *  */
export interface WxAPIOptions extends WxTilesLibOptions {
	/**  base URL of the server*/
	dataServerURL: string;

	/** full masks tiles URL, Example: `https://server.com/masks/{z}/{x}/{y}.png`
	 * @default 'auto' - will be set to `dataServerURL + 'masks/{z}/{x}/{y}.png'`
	 * 'none' - will disable masks */
	maskURL?: 'none' | 'auto' | string;

	/** channel to use for masking from RGBA masks
	 *  0 - for the masks from Sarah (current), 3 - for the masks from Mapbox
	 * @default 'R' */
	maskChannel?: 'R' | 'G' | 'B' | 'A';

	/** maximum zoom level for mask tiles on the server
	 * @default 9 */
	maskDepth?: number;

	/** URL to qtree file.
	 * {@link QTree} is a hierarchical structure, that allows to quickly find tile's belonging to the sea/land.
	 * @default 'auto' - will be set to `dataServerURL + 'masks/9+1.seamask.qtree'`
	 * 'none' - will disable the use of {@link QTree} */
	qtreeURL?: 'none' | 'auto' | string;

	/** parameters to be passed to every fetch() aka _headers, credentials, cors, etc_ for interaction with backend data server */
	requestInit?: RequestInit;
}

/** WxAPI is an initialisation object for the library. See {@link WxAPIOptions} for options.
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
	/** @internal see {@link WxAPIOptions}*/
	readonly dataServerURL: string;

	/** @internal see {@link WxAPIOptions}*/
	readonly maskURL: string = 'auto';

	/** @internal see {@link WxAPIOptions}*/
	readonly maskChannel: number;

	/** @internal see {@link WxAPIOptions}*/
	readonly maskDepth: number;

	/** @internal see {@link WxAPIOptions}*/
	readonly requestInit?: RequestInit;

	/** @internal see {@link WxDataSetsMetasJSON}*/
	readonly datasetsMetas: WxDataSetsMetasJSON = { allDatasetsList: [] };

	/** @internal resolved when {@link WxAPI} is ready to use */
	readonly initDone: Promise<void>;

	/** @internal instance of the qtree object */
	readonly qtree: QTree = new QTree();

	/** @internal function to load mask tiles */
	readonly loadMaskFunc: ({ x, y, z }: XYZ) => Promise<ImageData> = () => Promise.reject(new Error('maskURL not defined'));

	/** @param options - see {@link WxAPIOptions} */
	constructor({
		dataServerURL,
		maskURL = 'auto',
		maskChannel = 'R',
		maskDepth = 9,
		qtreeURL = 'auto',
		requestInit,
		colorStyles,
		units,
		colorSchemes,
	}: WxAPIOptions) {
		WXLOG('WxAPI.constructor', dataServerURL);
		WxTilesLibSetup({ colorStyles, units, colorSchemes });

		this.dataServerURL = dataServerURL;
		this.requestInit = requestInit;
		qtreeURL = qtreeURL === 'auto' ? dataServerURL + 'masks/9+1.seamask.qtree' : qtreeURL;

		if (maskURL !== 'none') {
			const maskloader = cacheUriPromise(loadImageData);
			this.maskURL = maskURL = maskURL === 'auto' ? dataServerURL + 'masks/{z}/{x}/{y}.png' : maskURL;
			this.loadMaskFunc = (coord: XYZ) => maskloader(uriXYZ(maskURL, coord), requestInit);
		}

		this.maskChannel = maskChannel === 'R' ? 0 : maskChannel === 'G' ? 1 : maskChannel === 'B' ? 2 : maskChannel === 'A' ? 3 : 0; // default to R
		this.maskDepth = maskDepth;

		this.initDone = Promise.all([
			fetchJson<WxDataSetsMetasJSON>(dataServerURL + 'datasetsmeta.json', requestInit),
			qtreeURL !== 'none' ? this.qtree.load(qtreeURL, requestInit) : Promise.resolve(),
		]).then(([datasetsMetas, _]): void => {
			datasetsMetas.allDatasetsList || (datasetsMetas.allDatasetsList = Object.keys(datasetsMetas));
			(this as any).datasetsMetas = datasetsMetas; // overcome readonly once :/
			WXLOG('WxAPI.constructor initDone');
		});
	}

	/**
	 * Get short meta for a given dataset name
	 * @param datasetName - name of the dataset
	 * @returns {WxDatasetShortMeta} - short meta for the dataset */
	protected getDatasetShortMeta(datasetName: 'allDatasetsList' | string): WxDatasetShortMeta | undefined {
		WXLOG('WxAPI.getDatasetShortMeta', datasetName);
		if (datasetName === 'allDatasetsList') return;
		return this.datasetsMetas[datasetName] as WxDatasetShortMeta;
	}

	/**
	 * Get all variables for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<string[]>} - list of all available variables for the dataset */
	protected getDatasetInatance(datasetName: string): string | undefined {
		WXLOG('WxAPI.getDatasetInatance', datasetName);
		return this.getDatasetShortMeta(datasetName)?.instance;
	}

	/**
	 * Get all variables for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<string[]>} - list of all available variables for the dataset */
	async getDatasetVariables(datasetName: string): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.getDatasetVariables', datasetName);
		return (this.datasetsMetas[datasetName] as WxDatasetShortMeta)?.variables;
	}

	/**
	 * Create {@link WxDataSetManager} object for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<WxDataSetManager>} - WxDataSetManager object for the given dataset name */
	async createDatasetManager(datasetName: string): Promise<WxDataSetManager> {
		await this.initDone;
		WXLOG('WxAPI.createDatasetManager', datasetName);
		const shortMeta = this.getDatasetShortMeta(datasetName);
		const instance = shortMeta?.instance;
		if (!instance) throw new Error('Dataset/instance not found:' + datasetName);
		const instanced = shortMeta.instanced;
		const meta = await fetchJson<WxDatasetMeta>(this.dataServerURL + datasetName + '/' + instance + '/meta.json', this.requestInit);
		return new WxDataSetManager({ datasetName, instanced, instance, meta, wxapi: this });
	}

	/**
	 *  Creates all possible dataset managers
	 * For each dataset in the datasets list, creates WxDataSetManager object.
	 * Requests all datasets meta.json in parallel.
	 * @returns {Promise<WxDataSetManager[]>} - list of all available dataset managers */
	async createAllDatasetsManagers(): Promise<PromiseSettledResult<WxDataSetManager>[]> {
		await this.initDone;
		WXLOG('WxAPI.createAllDatasetsManagers');
		const res = Promise.allSettled(this.datasetsMetas.allDatasetsList.map((datasetName: string) => this.createDatasetManager(datasetName)));
		return res;
	}

	/**
	 * Returns datasets names which have given variable
	 * @argument {string} variableName - variable name to search for in datasets
	 * @returns {Promise<string[]>} - list of datasets' names */
	async filterDatasetsByVariableName(variableName: string): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.filterDatasetsByVariableName', variableName);
		return this.datasetsMetas.allDatasetsList.filter((datasetName) =>
			(this.datasetsMetas[datasetName] as WxDatasetShortMeta)?.variables?.includes?.(variableName)
		);
	}

	/**
	 * Get the list of all available datasets' names
	 * @returns {Promise<string[]>} - list of all available datasets' names */
	async getAllDatasetsNames(): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.getAllDatasetsNames');
		return this.datasetsMetas.allDatasetsList;
	}
}
