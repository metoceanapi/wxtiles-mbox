/**
 * Main classes and interfaces to use in your application are:
 * - {@link WxAPIOptions} options to pass to the constructor of {@link WxAPI}.
 * - {@link WxAPI} the main class to use to interact with the *WxTiles* API and to create {@link WxDataSetManager} instances
 * - {@link WxDataSetManagerOptions} options to pass to the constructor of {@link WxDataSetManager}.
 * - {@link WxDataSetManager} class for managing WX datasets and create {@link WxTileSource}.
 * * {@link FrameworkOptions} framework specific options to pass to the constructor of {@link WxTileSource}.
 * - {@link WxLayerOptions} options to pass to the constructor of {@link WxTileSource}.
 * - {@link WxTileSource} class for managing WX tiles sources.
 * - {@link WxColorStyleWeak} interface for color styles.
 * - {@link WxDate} type for dates.
 * - {@link WxVars} type for variables.
 * - {@link WxDatasetMeta} interface for dataset's metadata.
 * - {@link WxVariableMeta} interface for variable's meta data.
 * - {@link WxAllBoundariesMeta} interface for boundaries of a dataset.
 * - {@link WxTileInfo} interface for tile's information.
 * ### Note
 * In case of use **async** member functions, you must use the **await** syntax.
 * @module
 */

export {
	WxAPI,
	type WxAPIOptions,
	type WxDatasetMeta,
	type WxVariableMeta,
	type WxVariablesMetas,
	type WxBoundaryMeta,
	type WxAllBoundariesMeta,
} from './wxAPI/wxAPI';

export {
	//
	type WxDataSetManager,
	type WxSourceLayerOptions,
} from './wxAPI/WxDataSetManager';

export {
	//
	type WxTileSource,
} from './wxsource/wxsource';

export {
	//
	type FrameworkOptions,
} from './wxsource/wxsourcetypes';

export {
	//
	type WxLayerOptions,
	type WxDate,
	type WxRequestInit,
	type WxTileInfo,
	type WxLayerVarsNames,
	type WxLngLat,
	// type WxURIs,
} from './wxlayer/wxlayer';

export {
	//
	type WxEventType,
	type ListenerMethod,
} from './wxlayer/WxImplementation';

export {
	//
	WxCreateLegend,
	type WxLegend,
	type WxTick,
} from './utils/RawCLUT';

export {
	//
	WxGetColorStyles,
	WxGetColorSchemes,
	WxTilesLogging,
	WXLOG,
} from './utils/wxtools';
export {
	// XYZ,
	type WxUnits,
	type WxUnitTuple,
	type WxColorSchemes,
	type WxColorStyleWeak,
	type WxColorStyleStrict,
	type WxColorStylesStrict,
	type WxColorStylesWeakMixed,
	type ColorStylesIncomplete,
	type Converter,
} from './utils/wxtools';

export {
	//
	CustomWxTilesLayer,
} from './customlayer/customlayer';
