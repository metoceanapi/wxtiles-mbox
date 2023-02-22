import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { start } from './start';
start();

// /*
import { WxTilesLogging } from '../src/utils/wxtools';
import { WxAPI } from '../src/wxAPI/wxAPI';
import { flyTo, initFrameWork } from './frwrkdeps';
import { CustomTilesetLayer } from '../src/customlayer/customlayer';
import { WxTileLayer } from '../src/customlayer/oldcustlay';
// simpleDemo();

async function simpleDemo() {
	const map = await initFrameWork();
	// const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	const dataServerURL = 'http://localhost:9191/data/';
	// const headers = new Headers();
	// headers.append('x-api-key', '--proper-key-value--'); // If needed in the future
	const requestInit: RequestInit = {
		// headers /
	}; // add more options if needed such as headers, mode, credentials, etc
	// Get the API ready - should be ONE per application
	WxTilesLogging(true); // If needed
	const wxapi = new WxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none', requestInit });
	// Create a dataset manager (may be used for many layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager('wrf-ecmwf.gbr.national');
	const variable = 'wind.speed.northward.at-10m'; // Scalar example
	// const variable = 'wind.speed.eastward.at-10m'; // Vector example
	// create a source layer
	const wxsource = wxdatasetManager.createSourceLayer({ variable }, { id: 'wxsource', attribution: 'WxTiles' }); //new WxTileSource(wxLayerOptions, mboxSourceOptions);
	// add the layer to the map. Framework dependant part
	map.addSource(wxsource.id, wxsource);
	// map.addLayer({
	// 	id: 'wxlayer',
	// 	type: 'raster',
	// 	source: wxsource.id,
	// 	paint: { 'raster-fade-duration': 0 },
	// });

	// await id: 'wxlayer' is loaded
	await new Promise((resolve) => map.once('idle', resolve));

	// map.addLayer(new WxTileLayer(wxsource.id));
	map.addLayer(new CustomTilesetLayer('wxlayerC1', wxsource.id));
	const { zoom, lon, lat } = wxdatasetManager.getCenterAndFitZoom();
	flyTo(map, zoom, lon, lat, 0, 0);
	// const { east, north, south, west } = wxdatasetManager.getBoundaries().boundariesnorm;
	// map.fitBounds([west, south, east, north]);

	// // await 2 seconds
	// await new Promise((resolve) => setTimeout(resolve, 2000));

	// // get the id: 'wxsource'
	// const sourceId = wxsource.id;
	// // get the source
	// const source = map.getSource(sourceId);
	// const ctiles = source._implementation.coveringTiles();
	// // get the layer
	// const layer = map.getLayer('wxlayer');
	// // get the mapbox style
	// const style = map.getStyle();
	// // get the mapbox style layer
	// const styleLayer = style.layers.find((l) => l.id === 'wxlayer');
	// // get the mapbox style source
	// const styleSource = style.sources[sourceId];
}
// */
