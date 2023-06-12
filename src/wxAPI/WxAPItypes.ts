/**
 * type array of strings - available instances of a dataset */

import { WxTilesLibOptions } from '../utils/wxtools';
import { WxLayerOptions } from '../wxlayer/wxlayer';
import { WxAPI } from './WxAPI';

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
/** Short description of all available datasets */
export interface WxAllDatasetsShortMetas {
	/** a list of datasets with short description */
	[name: string]: WxDatasetShortMeta | undefined /* | string[] */;
}

/** Meta data of a variable */
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

/** interface of an object with variable names as keys and variable meta data as values */
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
	/** a list of variables in a dataset */
	variables: string[];

	/** metadata of variables */
	variablesMeta: WxVariablesMetas;

	/** max zoom level */
	maxZoom: number;

	/** Instance */
	instance: string;

	/** array of available timesteps */
	times: string[];

	/** boundaries of a dataset */
	boundaries: WxAllBoundariesMeta;

	/** source of the dataset */
	sourceID?: string;

	/** base atmospheric model */
	baseAtmosphericModel?: string;

	/** model used for the dataset*/
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
/**
 * Options to pass to the {@link WxDataSetManager.createSourceLayer} method.
 * */

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
	instanced?: WxInstances;

	/**
	 * @internal
	 * Dataset's meta data
	 * */
	datasetCurrentMeta: WxDatasetMeta;

	/**
	 * @internal
	 * Dataset's metas for an instanced dataset
	 * */
	metas?: Map<string, WxDatasetMeta>;

	/**
	 * @internal
	 * The {@link WxAPI} instance to use to interact with the *WxTiles* API
	 * */
	wxAPI: WxAPI;
}
