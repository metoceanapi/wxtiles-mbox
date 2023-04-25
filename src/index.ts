/**
 * Main classes and interfaces to use in your application are:
 * - {@link WxAPIOptions} options to pass to the constructor of {@link WxAPI}.
 * - {@link WxAPI} the main class to use to interact with the *WxTiles* API and to create {@link WxDataSetManager} instances
 * - {@link WxDataSetManager} class for managing WX datasets and create {@link WxTileSource}.
 * * {@link FrameworkOptions} framework specific options to pass to the constructor of {@link WxTileSource}.
 * - {@link WxLayerOptions} options to pass to the constructor of {@link WxTileSource}.
 * - {@link WxTileSource} class for managing WX tiles sources.
 * - {@link WxColorStyleWeak} interface for color styles.
 * - {@link WxDate} type for dates.
 * - {@link WxVars} type for variables.
 * - {@link WxDatasetMeta} interface for dataset's meta data.
 * - {@link WxVariableMeta} interface for variable's meta data.
 * - {@link WxAllBoundariesMeta} interface for boundaries of a dataset.
 * - {@link WxTileInfo} interface for tile's information.
 *
 * ### Note
 * In case of use **async** member functions, you must use the **await** syntax.
 * @module
 */

export { WxAPI } from './wxAPI/wxAPI';
export type {
	WxAPIOptions,
	WxDatasetMeta,
	WxDatasetShortMeta,
	WxDataSetsMetasJSON,
	WxVariableMeta,
	WxVariablesMetas,
	WxBoundaryMeta,
	WxAllBoundariesMeta,
} from './wxAPI/wxAPI';

export { WxDataSetManager, type WxDataSetManagerOptions, type WxSourceLayerOptions } from './wxAPI/WxDataSetManager';

export { WxTileSource } from './wxsource/wxsource';

export { type FrameworkOptions, FrameworkParentClass } from './wxsource/wxsourcetypes';

export type { WxLayerOptions, WxDate, WxRequestInit, WxTileInfo, WxVars, WxLngLat, WxURIs } from './wxlayer/wxlayer';
export { WxLayer } from './wxlayer/wxlayer';

export type { WxLayerBaseAPI, WxLayerBaseImplementation, WxLayerAPI } from './wxlayer/WxImplementation';

export { WxCreateLegend, RawCLUT, type WxLegend, type WxTick } from './utils/RawCLUT';

export { WxGetColorStyles, WxGetColorSchemes, WxTilesLogging, WXLOG } from './utils/wxtools';
export type {
	XYZ,
	WxUnits,
	WxUnitTuple,
	WxColorSchemes,
	WxColorStyleWeak,
	WxColorStyleStrict,
	WxColorStylesStrict,
	WxColorStylesWeakMixed,
	WxTilesLibOptions,
	ColorStylesIncomplete,
	Converter,
	IntegralPare,
	DataIntegral,
	DataIntegrals,
	DataPicture,
	DataPictures,
	UriLoaderPromiseFunc,
} from './utils/wxtools';

export { Painter, type WxRasterData } from './wxlayer/painter';
export { Loader, type WxData, type SLine, type SLinePoint } from './wxlayer/loader';

export { QTree } from './utils/qtree';
export type { TileType, Tree, SubTrees, SubTreesN, TreeN } from './utils/qtree';

export { CustomWxTilesLayer } from './customlayer/customlayer';
