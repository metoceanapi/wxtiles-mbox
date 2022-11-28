import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl, { IControl } from 'mapbox-gl';

import { WxTileSource, type WxVars, WxAPI, WxTilesLogging, type WxTileInfo, WxColorStyleWeak, WxGetColorStyles } from '../src/index';
import { WxLegendControl } from '../src/controls/WxLegendControl';
import { WxStyleEditorControl } from '../src/controls/WxStyleEditorControl';
import { WxInfoControl } from '../src/controls/WxInfoControl';
import { WxTimeControl } from '../src/controls/WxTimeControl ';
import { WxAPIControl } from '../src/controls/WxAPIControl';

start();
// simpleDemo();

const OPACITY = 1;

// this is universal function for Leaflet and Mapbox.
// Functions below are just framework specific wrappers for this universal function
// start() is the fully interchangable function for Leaflet and Mapbox
async function start() {
	const map = await initFrameWork();
	addRaster(map, 'baseS', 'baseL', 'https://tiles.metoceanapi.com/base-lines/{z}/{x}/{y}', 5);
	WxTilesLogging(false);
	// const dataServerURL = 'http://localhost:9191/data/';
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// const dataServerURL = 'http://tiles3.metoceanapi.com/';
	const myHeaders = new Headers();
	// myHeaders.append('x-api-key', 'SpV3J1RypVrv2qkcJE91gG');
	const wxapi = new WxAPI({
		dataServerURL,
		maskURL: dataServerURL + 'masks/{z}/{x}/{y}.png',
		maskChannel: 'R',
		maskDepth: 9, // currently only max 9 is supported
		qtreeURL: dataServerURL + 'masks/9+1.seamask.qtree',
		requestInit: { headers: myHeaders },
	});

	// const bs = WxGetColorStyles()['base'];
	// let ns: WxColorStyleWeak = {};
	// let nstyle = { mask: 'none' };
	// for (const i in nstyle) {
	// 	if (nstyle[i] !== bs[i]) ns[i] = nstyle[i];
	// }

	// const ds = JSON.stringify(ns).replace(/"/g, "'");
	// ns = JSON.parse(ds.replace(/'/g, '"'));
	// console.log(ns);

	let datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	let variables: WxVars = ['air.temperature.at-2m'];
	// let variables: WxVars = ['wind.speed.eastward.at-10m', 'wind.speed.northward.at-10m'];

	// let datasetName = 'ww3-ecmwf.global';
	// let variables: WxVars = ['wave.direction.mean'];

	// let datasetName = 'obs-radar.rain.nzl.national';
	// let variables: WxVars = ['reflectivity'];

	// get datasetName from URL
	const urlParams = window.location.toString().split('##')[1];
	const params = urlParams?.split('/');
	datasetName = params?.[0] || datasetName;
	if (params?.[1]) variables = params[1].split(',') as WxVars;
	let time = params?.[2] || '';
	const zoom = (params && parseFloat(params[3])) || 0;
	const lng = (params && parseFloat(params[4])) || 0;
	const lat = (params && parseFloat(params[5])) || 0;
	const bearing = (params && parseFloat(params[6])) || 0;
	const pitch = (params && parseFloat(params[7])) || 0;
	const str = params?.[8] && params[8];
	flyTo(map, zoom, lng, lat, bearing, pitch);

	const sth = { style: {} };
	map.on('zoom', () => setURL(map, time, datasetName, variables, sth.style));
	map.on('drag', () => setURL(map, time, datasetName, variables, sth.style));
	map.on('rotate', () => setURL(map, time, datasetName, variables, sth.style));
	map.on('pitch', () => setURL(map, time, datasetName, variables, sth.style));

	const frameworkOptions = { id: 'wxsource', opacity: OPACITY, attribution: 'WxTiles' };

	let wxsource: WxTileSource | undefined;

	const legendControl = new WxLegendControl();
	addControl(map, legendControl, 'top-right');

	const apiControl = new WxAPIControl(wxapi, datasetName, variables[0]);
	addControl(map, apiControl, 'top-left');

	const timeControl = new WxTimeControl(10);
	addControl(map, timeControl, 'top-left');
	timeControl.onchange = (time_) => setURL(map, (time = time_), datasetName, variables);

	const customStyleEditorControl = new WxStyleEditorControl();
	addControl(map, customStyleEditorControl, 'top-left');
	customStyleEditorControl.onchange = async (style) => {
		if (!wxsource) return;
		await wxsource.updateCurrentStyleObject(style);
		const nstyle = wxsource.getCurrentStyleObjectCopy();
		legendControl.drawLegend(nstyle);
		nstyle.levels = style?.levels; // keep levels empty if they are not defined
		nstyle.colors = style?.colors; // keep colors empty if they are not defined
		customStyleEditorControl.setStyle(nstyle);
		sth.style = nstyle;
		setURL(map, time, datasetName, variables, sth.style);
	};

	const infoControl = new WxInfoControl();
	addControl(map, infoControl, 'bottom-left');
	map.on('mousemove', (e) => infoControl.update(wxsource, map, position(e)));

	apiControl.onchange = async (datasetName_: string, variable: string): Promise<void> => {
		// remove existing source and layer
		removeLayer(map, frameworkOptions.id, wxsource);
		//
		wxsource = undefined;
		datasetName = datasetName_;
		const wxdatasetManager = await wxapi.createDatasetManager(datasetName);
		const meta = wxdatasetManager.getVariableMeta(variable);
		variables = wxdatasetManager.checkCombineVariableIfVector(variable); // check if variable is vector and use vector components if so
		if (meta?.units === 'RGB') {
			addRaster(map, frameworkOptions.id, 'wxtiles', wxdatasetManager.createURI(variables[0], 0), wxdatasetManager.getMaxZoom());
			timeControl.setTimes(wxdatasetManager.getTimes());
			legendControl.clear();
		} else {
			wxsource = new WxTileSource({ wxdatasetManager, variables }, frameworkOptions);
			await addLayer(map, frameworkOptions.id, 'wxtiles', wxsource);
			const styleCopy = wxsource.getCurrentStyleObjectCopy();
			legendControl.drawLegend(styleCopy); // first draw legend with current style
			timeControl.updateSource(wxsource);
			styleCopy.levels = undefined; // no need to show defaults it in the editor and URL
			styleCopy.colors = undefined; // no need to show defaults it in the editor and URL
			await customStyleEditorControl.onchange?.(styleCopy);
		}
	};

	await apiControl.onchange(datasetName, variables[0]); // initial load

	try {
		// apply style from URL
		const style = str && { ...{ levels: undefined }, ...JSON.parse(decodeURI(str)) }; // reset levels if change units
		await customStyleEditorControl.onchange?.(style); // apply style and refresh legend
		// wxsource?.updateCurrentStyleObject(style);
	} catch (e) {
		/* ignore errors silently */
		console.log(e);
	}
	/*/ DEMO: more interactive - additional level and a bit of the red transparentness around the level made from current mouse position
	if (wxsource) {
		let busy = false;
		await wxsource.updateCurrentStyleObject({ levels: undefined }); // await always !!
		const levels = wxsource.getCurrentStyleObjectCopy().levels || []; // get current/default/any levels
		const colMap: [number, string][] = levels.map((level) => [level, '#' + Math.random().toString(16).slice(2, 8) + 'ff']);
		map.on('mousemove', async (e) => {
			if (!wxsource || busy) return;
			busy = true;
			const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(position(e), map);
			if (tileInfo) {
				await customStyleEditorControl.onchange?.({ colorMap: [...colMap, [tileInfo.inStyleUnits[0], '#ff000000']] }); // await always !!
			}
			busy = false;
		});
	} //*/

	/*/ DEMO: abort
	if (wxsource) {
		const abortController = new AbortController();
		console.log('setTime(5)');
		const prom = wxsource.setTime(5, abortController);
		abortController.abort(); // aborts the request
		await prom; // await always !! even if aborted
		console.log('aborted');
		await wxsource.setTime(5); // no abort
		console.log('setTime(5) done'); 
	}//*/

	/*/ DEMO: preload a timestep
	map.once('click', async () => {
		if (!wxsource) return;
		console.log('no preload time=5');
		const t = Date.now();
		await wxsource.setTime(5); // await always !! or abort
		console.log(Date.now() - t);
		await wxsource.preloadTime(10); // await always !! even if aborted
		await wxsource.preloadTime(20); // await always !! even if aborted
		console.log('preloaded timesteps 10, 20');
		map.once('click', async () => {
			if (!wxsource) return;
			const t = Date.now();
			await wxsource.setTime(10); // await always !! or abort
			console.log(Date.now() - t, ' step 10');
			map.once('click', async () => {
				if (!wxsource) return;
				const t = Date.now();
				await wxsource.setTime(20); // await always !! or abort
				console.log(Date.now() - t, ' step 20');
			});
		});
	}); //*/

	/*/ DEMO: change style's units
	let i = 0;
	map.on('click', async () => {
		if (!wxsource) return;
		const u = ['knots', 'm/s', 'km/h', 'miles/h'];
		await wxsource.updateCurrentStyleObject({ units: u[i], levels: undefined }); // levels: undefined - to recalculate levels
		legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
		i = (i + 1) % u.length;
	}); //*/

	/*/ DEMO : read lon lat data
	map.on('mousemove', (e) => {
		if (!wxsource) return;
		const pos = position(e); //
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos.wrap(), map);
		if (tileInfo) {
			console.log(tileInfo);
		}
	}); //*/

	/*/ DEMO: timesteps
	let t = 0;
	const nextTimeStep = async () => {
		if (!wxsource) return;
		await wxsource.setTime(t++ % wxsource.wxdatasetManager.getTimes().length); // await always !!
		setTimeout(nextTimeStep, 0);
	};
	setTimeout(nextTimeStep, 2000);
	//*/

	/*/ DEMO: Dynamic blur effect /
	wxsource &&
		(async function step(n: number = 0) {
			await wxsource.updateCurrentStyleObject({ isolineText: false, blurRadius: ~~(10 * Math.sin(n / 500) + 10) }); // await always !!
			requestAnimationFrame(step);
		})();
		//*/
}

function flyTo(map: mapboxgl.Map, zoom: number, lng: number, lat: number, bearing: number, pitch: number) {
	map.flyTo({ zoom, center: [lng, lat], bearing, pitch });
}

function setURL(map: mapboxgl.Map, time: string, datasetName: string, variables: string[], nstyle?: any) {
	const getStyle = () => {
		const bs = WxGetColorStyles()['base'];
		let ns: WxColorStyleWeak = {};
		for (const i in nstyle) {
			if (nstyle[i] !== bs[i]) ns[i] = nstyle[i];
		}

		return ns;
	};

	const ds = nstyle ? '/' + JSON.stringify(getStyle()) : '';
	const center = map.getCenter();
	const href =
		`##${datasetName}/${variables.join(',')}/${time}/${map.getZoom().toFixed(2)}/${center.lng.toFixed(2)}/${center.lat.toFixed(2)}/${map
			.getBearing()
			.toFixed(2)}/${map.getPitch().toFixed(2)}` + ds;

	history.replaceState(null, '', href);
}

async function initFrameWork() {
	mapboxgl.accessToken = 'pk.eyJ1IjoibWV0b2NlYW4iLCJhIjoia1hXZjVfSSJ9.rQPq6XLE0VhVPtcD9Cfw6A';
	const map = new mapboxgl.Map({
		container: 'map',
		// style: 'mapbox://styles/mapbox/light-v10',
		// style: 'mapbox://styles/mapbox/satellite-v9',
		style: { version: 8, name: 'Empty', sources: {}, layers: [] },
		center: [174.5, -40.75],
		zoom: 3,
		// projection: { name: 'globe' },
	});

	map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
	// map.showTileBoundaries = true;
	await map.once('load');

	// addSkyAndTerrain(map);
	// addPoints(map);

	return map;
}

function position(e: mapboxgl.MapMouseEvent): mapboxgl.LngLat {
	return e.lngLat.wrap(); // (mapbox)
}

function addPoints(map: mapboxgl.Map) {
	map.addSource('point', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'Point',
						coordinates: [-209.2, -34.26],
					},
				},
			],
		},
	});

	map.addLayer({
		id: 'point',
		type: 'circle',
		source: 'point',
		paint: {
			'circle-radius': 30,
			'circle-color': '#F84C4C', // red color
		},
	});
}

function addSkyAndTerrain(map: mapboxgl.Map) {
	map.setFog({ color: 'rgb(186, 210, 235)', 'horizon-blend': 0.02 });
	map.addSource('mapbox-dem', {
		type: 'raster-dem',
		url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
		tileSize: 512,
		maxzoom: 14,
	});
	// add the DEM source as a terrain layer with exaggerated height
	map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

	// add a sky layer that will show when the map is highly pitched
	map.addLayer({
		id: 'sky',
		type: 'sky',
		paint: {
			'sky-type': 'atmosphere',
			'sky-atmosphere-sun': [0.0, 0.0],
			'sky-atmosphere-sun-intensity': 15,
		},
	});
}

function addControl(map: mapboxgl.Map, control: IControl, position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') {
	map.addControl(control, position);
}

function removeLayer(map: mapboxgl.Map, layerId: string, source?: any) {
	map.getLayer('wxtiles') && map.removeLayer('wxtiles');
	map.getSource(layerId) && map.removeSource(layerId);
}

function addRaster(map: mapboxgl.Map, idS: string, idL: string, URL: string, maxZoom: number) {
	map.addSource(idS, {
		type: 'raster',
		tiles: [URL],
		tileSize: 256,
		maxzoom: maxZoom,
	});
	map.addLayer(
		{
			id: idL,
			type: 'raster',
			source: idS,
		},
		idL !== 'baseL' ? 'baseL' : undefined
	);
}

async function addLayer(map: mapboxgl.Map, idS: string, idL: string, source?: any) {
	map.addSource(idS, source);
	map.addLayer(
		{
			id: idL,
			type: 'raster',
			source: idS,
			paint: {
				'raster-fade-duration': 0, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
				'raster-opacity': OPACITY,
			},
		},
		'baseL'
	);
}

async function simpleDemo() {
	const map = await initFrameWork();

	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// const headers = new Headers();
	// headers.append('x-api-key', '--proper-key-value--'); // If needed in the future
	const requestInit: RequestInit = {
		/* headers */
	}; // add more options if needed such as headers, mode, credentials, etc

	// Get the API ready - should be ONE per application
	WxTilesLogging(true); // If needed
	const wxapi = new WxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none', requestInit });

	const datasetName = 'gfs.global';
	const variable = 'air.temperature.at-2m'; // Scalar example
	// const variable = 'wind.speed.eastward.at-10m'; // Vector example

	// Create a dataset manager (may be used for many layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager(datasetName);

	// Usefull to automatically get the vector component variables from the dataset manager if given variable is northward or eastward
	// if not a vector component, then just return the variable itself
	const variables = wxdatasetManager.checkCombineVariableIfVector(variable);

	// create a layer
	const mboxSourceOptions = { id: 'wxsource', attribution: 'WxTiles' };
	const wxsource = new WxTileSource({ wxdatasetManager, variables }, mboxSourceOptions);

	// add the layer to the map
	map.addSource(wxsource.id, wxsource);
	map.addLayer({
		id: 'wxlayer',
		type: 'raster',
		source: wxsource.id,
		paint: { 'raster-fade-duration': 0 },
	});
}
