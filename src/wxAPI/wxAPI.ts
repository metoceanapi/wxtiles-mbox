import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibOptions, WxTilesLibSetup, WXLOG } from '../utils/wxtools';
import { QTree } from '../utils/qtree';
import { WxDataSetManager } from './WxDataSetManager';

/**
 * type array of strings - available instances of a dataset */
export type WxInstances = string[];

/**
 * Short description of a dataset */
export interface WxDatasetShortMeta {
	/** represents instances as timesteps for some datasets like NZ Radar */
	instanced?: WxInstances;
	/** last instance of a dataset */
	instance: string;
	/** list of variables in a dataset */
	variables: string[];
}

/**
 * Short description of all available datasets */
export interface WxAllDatasetsShortMetas {
	/**
	 * a list of datasets with short description */
	[name: string]: WxDatasetShortMeta | undefined /* | string[] */;
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
	boundaries: WxAllBoundariesMeta;

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

class WxAllDatasetsManager {
	private _allDatasetsShortMetas: WxAllDatasetsShortMetas = {};
	private _ready: Promise<WxAllDatasetsShortMetas>;
	constructor(private readonly wxAPI: WxAPI) {
		this._ready = this.updateAll(); // init _ready
	}

	updateAll(): Promise<WxAllDatasetsShortMetas> {
		this._ready = fetchJson(this.wxAPI.dataServerURL + 'datasetsmeta.json', this.wxAPI.requestInit);
		this._ready.then((dms) => (this._allDatasetsShortMetas = dms));
		return this._ready;
	}

	async updateOne(datasetName: string): Promise<WxAllDatasetsShortMetas> {
		try {
			const r = await fetchJson(this.wxAPI.dataServerURL + datasetName + '.meta.json', this.wxAPI.requestInit);
			return Object.assign(this._allDatasetsShortMetas, r);
		} catch {
			return this.updateAll(); // if failed, update all
		}
	}

	get ready(): Promise<WxAllDatasetsShortMetas> {
		return this._ready;
	}

	get datasetsMetas(): WxAllDatasetsShortMetas {
		return this._allDatasetsShortMetas;
	}
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
	/** resolved when {@link WxAPI} is ready to be used */
	readonly initDone: Promise<void>;

	/** see {@link WxAPIOptions}*/
	readonly dataServerURL: string;

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

	/** @internal a manager for all datasets. Operates with short datasets*/
	protected readonly _allDatasetsManager: WxAllDatasetsManager;
	/************************/
	/* NO EXPORT PART END */
	/************************/

	/** @param options - see {@link WxAPIOptions} */
	constructor({
		dataServerURL,
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
	 * Create {@link WxDataSetManager} object for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<WxDataSetManager>} - WxDataSetManager object for the given dataset name */
	async createDatasetManager(datasetName: string): Promise<WxDataSetManager> {
		await this.initDone;
		await this._allDatasetsManager.updateOne(datasetName);
		WXLOG('WxAPI.createDatasetManager', datasetName);
		const datasetShortMeta = this.getDatasetShortMeta(datasetName);
		const datasetCurrentInstance = datasetShortMeta?.instance;
		if (!datasetCurrentInstance) throw new Error('Dataset/instance not found:' + datasetName);
		const instanced = datasetShortMeta.instanced;
		const fetchMeta = (i: string) => fetchJson<WxDatasetMeta>(this.dataServerURL + datasetName + '/' + i + '/meta.json', this.requestInit);
		const fetchMeta2 = async (i: string) => <[string, WxDatasetMeta]>[i, await fetchMeta(i)];
		const datasetCurrentMeta = await fetchMeta(datasetCurrentInstance);
		const metas = new Map(instanced ? await Promise.all(instanced.map(fetchMeta2)) : [[datasetCurrentInstance, datasetCurrentMeta]]);
		return new WxDataSetManager({ datasetName, datasetCurrentInstance, datasetCurrentMeta, instanced, metas, wxAPI: this });
	}

	/**
	 * Get all variables for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<string[]>} - list of all available variables for the dataset */
	async getDatasetAllVariables(datasetName: string): Promise<string[] | undefined> {
		await this.initDone;
		WXLOG('WxAPI.getDatasetVariables', datasetName);
		return this.datasetsMetas[datasetName]?.variables;
	}

	/**
	 * Returns datasets names which have given variable
	 * @argument {string} varName - variable name to search for in datasets
	 * @returns {Promise<string[]>} - list of datasets' names */
	async filterDatasetsByVariableName(varName: string): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.filterDatasetsByVariableName:', varName);
		return Object.keys(this.datasetsMetas).filter((dsName) => this.datasetsMetas[dsName]!.variables.includes(varName));
	}

	/**
	 * Get the list of all available datasets' names
	 * @returns {Promise<string[]>} - list of all available datasets' names
	 * */
	async getAllDatasetsNames(): Promise<string[]> {
		await this.initDone;
		WXLOG('WxAPI.getAllDatasetsNames');
		return Object.keys(this.datasetsMetas);
	}

	/**
	 * @internal
	 * Get the list of all available datasets' names with short description
	 * @returns {WxAllDatasetsShortMetas} - list of all available datasets' names with short description
	 * */
	protected get datasetsMetas(): WxAllDatasetsShortMetas {
		return this._allDatasetsManager.datasetsMetas;
	}

	/**
	 * @internal
	 * Get short meta for a given dataset name
	 * @param datasetName - name of the dataset
	 * @returns {WxDatasetShortMeta} - short meta for the dataset
	 * */
	protected getDatasetShortMeta(datasetName: string): WxDatasetShortMeta | undefined {
		WXLOG('WxAPI.getDatasetShortMeta', datasetName);
		return this.datasetsMetas[datasetName];
	}

	/**
	 * @internal
	 * Get all variables for the given dataset name.
	 * @param datasetName - dataset name
	 * @returns {Promise<string[]>} - list of all available variables for the dataset
	 * */
	protected getDatasetInatance(datasetName: string): string | undefined {
		WXLOG('WxAPI.getDatasetInatance', datasetName);
		return this.getDatasetShortMeta(datasetName)?.instance;
	}
}
