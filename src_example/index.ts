import 'mapbox-gl/dist/mapbox-gl.css';

import { start } from './start';
start();

/*
import mapboxgl from 'mapbox-gl';
import { WxTilesLogging } from '../src/utils/wxtools';
import { WxAPI } from '../src/wxAPI/wxAPI';
import { flyTo, initFrameWork } from './frwrkdeps';
import { CustomWxTilesLayer } from '../src/customlayer/customlayer';
import { WxTileLayer } from '../src/customlayer/oldcustlay';
simpleDemo();

async function simpleDemo() {
	//// MAPBOX initialization START
	mapboxgl.accessToken = 'pk.eyJ1IjoibWV0b2NlYW4iLCJhIjoia1hXZjVfSSJ9.rQPq6XLE0VhVPtcD9Cfw6A';
	const map = new mapboxgl.Map({ container: 'map', style: { version: 8, name: 'Empty', sources: {}, layers: [] } });
	// add navigation controls
	map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
	await map.once('load');
	//// MAPBOX initialization END

	//// Helpers
	const addWxLayer = async (wxsource) => {
		map.addSource(wxsource.id, wxsource);
		//// Add wxlayer using CustomWxTilesLayer. Implements GLSL shader for vector field animation
		map.addLayer(new CustomWxTilesLayer('wxlayer', wxsource.id));
		await new Promise((resolve) => map.once('idle', resolve));
	};

	const getCoords = (e) => e.lngLat.wrap();
	//// Helpers END

	//// WXTILES START
	// grab the WxTiles API
	// const { WxTilesLogging, WxAPI, CustomWxTilesLayer } = window.wxtilesmbox;

	WxTilesLogging(true); // log WxTiles info to console if needed

	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// Get the API ready - should be ONE per application
	const wxapi = new WxAPI({ dataServerURL });

	// Define the dataset and variable
	const datasetName = 'gfs.global';
	// const variable = 'air.temperature.at-2m'; // Scalar example
	const variable = 'wind.speed.eastward.at-10m'; // Vector example

	// Create a dataset manager (may be used for many layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager(datasetName);

	// create a layer
	const layerFrameworkOptions = { id: 'wxsource', opacity: 1, attribution: 'WxTiles' };
	const wxsource = wxdatasetManager.createSourceLayer({ variable, time: 0 }, layerFrameworkOptions);

	// add the layer to the map
	await addWxLayer(wxsource);
}
// */
