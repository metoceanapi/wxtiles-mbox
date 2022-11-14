import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { WxTileSource, type WxVars, WxAPI, WxTilesLogging, type WxTileInfo } from '../src/index';
import { WxLegendControl } from '../src/controls/WxLegendControl';
import { WxStyleEditorControl } from '../src/controls/WxStyleEditorControl';
import { WxInfoControl } from '../src/controls/WxInfoControl';
import { WxTimeControl } from '../src/controls/WxTimeControl ';
import { WxAPIControl } from '../src/controls/WxAPIControl';

async function start() {
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
	addRaster(map, 'https://tiles.metoceanapi.com/base-lines/{z}/{x}/{y}', 10);
	// addPoints(map);

	//******* WxTiles stuff *******//
	WxTilesLogging(false);
	// const dataServerURL = 'http://localhost:9191/data/';
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// const dataServerURL = 'http://tiles3.metoceanapi.com/';
	const myHeaders = new Headers();
	// myHeaders.append('x-api-key', 'SpV3J1RypVrv2qkcJE91gG');
	const wxapi = new WxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none', requestInit: { headers: myHeaders } });

	// let datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	// let variables: WxVars = ['air.temperature.at-2m'];
	// let variables: WxVars = ['wind.speed.eastward.at-10m', 'wind.speed.northward.at-10m'];

	let datasetName = 'ww3-ecmwf.global';
	let variables: WxVars = ['wave.direction.mean'];

	// let datasetName = 'obs-radar.rain.nzl.national';
	// let variables: WxVars = ['reflectivity'];

	// get datasetName from URL
	let time = '';
	const urlParams = window.location.toString().split('#')[1];
	if (urlParams) {
		const params = urlParams.split('/');
		if (params.length > 0) datasetName = params[0];
		if (params.length > 1) variables = params[1].split(',') as WxVars;
		if (params.length > 2) time = params[2];
		// then get zoom, lng, lat, bearing, pitch from URL
		if (params.length > 7) {
			const zoom = parseFloat(params[3]);
			const lng = parseFloat(params[4]);
			const lat = parseFloat(params[5]);
			const bearing = parseFloat(params[6]);
			const pitch = parseFloat(params[7]);
			map.jumpTo({ zoom, center: [lng, lat], bearing, pitch });
		}
	}

	const setURL = (time_: string) => {
		time = time_;
		const center = map.getCenter();
		location.href = `#${datasetName}/${variables.join(',')}/${time}/${map.getZoom()}/${center.lng}/${center.lat}/${map.getBearing()}/${map.getPitch()}`;
	};

	map.on('zoom', () => setURL(time));
	map.on('drag', () => setURL(time));
	map.on('rotate', () => setURL(time));
	map.on('pitch', () => setURL(time));

	const frameworkOptions = { id: 'wxsource', opacity: 0.5, attribution: 'WxTiles' };

	let wxsource: WxTileSource | undefined;

	const legendControl = new WxLegendControl();
	map.addControl(legendControl, 'top-right');

	const apiControl = new WxAPIControl(wxapi, datasetName, variables[0]);
	map.addControl(apiControl, 'top-left');
	apiControl.onchange = async (datasetName_: string, variable: string): Promise<void> => {
		// remove existing source and layer
		map.getLayer('wxtiles') && map.removeLayer('wxtiles');
		map.getSource(frameworkOptions.id) && map.removeSource(frameworkOptions.id);
		wxsource = undefined;

		datasetName = datasetName_;
		const wxdatasetManager = await wxapi.createDatasetManager(datasetName);
		const meta = wxdatasetManager.meta.variablesMeta[variable];
		variables = meta?.vector || [variable]; // check if variable is vector and use vector components if so

		if (wxdatasetManager.meta.variablesMeta[variable]?.units === 'RGB') {
			map.addSource(frameworkOptions.id, {
				type: 'raster',
				tiles: [wxdatasetManager.createURI(variables[0], 0)],
				tileSize: 256,
				maxzoom: wxdatasetManager.meta.maxZoom,
			});
			timeControl.setTimes(wxdatasetManager.meta.times);
			legendControl.clear();
		} else {
			wxsource = new WxTileSource({ wxdatasetManager, variables, time }, frameworkOptions);
			map.addSource(wxsource.id, wxsource);
			legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
			customStyleEditorControl.onchange?.(wxsource.getCurrentStyleObjectCopy());
			timeControl.updateSource(wxsource);
		}

		map.addLayer(
			{
				id: 'wxtiles',
				type: 'raster',
				source: frameworkOptions.id,
				paint: { 'raster-fade-duration': 0, 'raster-opacity': 0.6 }, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
			},
			'raster-layer'
		);
	};

	apiControl.onchange(datasetName, variables[0]); // initial load

	const timeControl = new WxTimeControl(10);
	map.addControl(timeControl, 'top-left');
	timeControl.onchange = setURL;

	const customStyleEditorControl = new WxStyleEditorControl();
	map.addControl(customStyleEditorControl, 'top-left');
	customStyleEditorControl.onchange = async (style) => {
		if (!wxsource) return;
		await wxsource.updateCurrentStyleObject(style);
		const nstyle = wxsource.getCurrentStyleObjectCopy();
		legendControl.drawLegend(nstyle);
		customStyleEditorControl.setStyle(nstyle);
	};

	const infoControl = new WxInfoControl();
	map.addControl(infoControl, 'bottom-left');
	map.on('mousemove', (e) => infoControl.update(wxsource, map, e.lngLat.wrap()));

	/*/ DEMO (mapbox): more interactive - additional level and a bit of the red transparentness around the level made from current mouse position
	let busy = false;
	await wxsource.updateCurrentStyleObject({ units: 'C', levels: undefined }); // await always !!
	const levels = wxsource.getCurrentStyleObjectCopy().levels || []; // get current/default/any levels
	const colMap: [number, string][] = levels.map((level) => [level, '#' + Math.random().toString(16).slice(2, 8) + 'ff']);
	map.on('mousemove', async (e) => {
		const pos = e.lngLat; // (mapbox)
		if (busy) return;
		busy = true;
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos.wrap(), map);
		if (tileInfo) {
			await wxsource.updateCurrentStyleObject({ colorMap: [...colMap, [tileInfo.inStyleUnits[0], '#ff000000']] }); // await always !!
			legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
		}
		busy = false;
	}); //*/

	/*/ DEMO: abort
	const abortController = new AbortController();
	console.log('setTime(5)');
	const prom = wxsource.setTime(5, abortController);
	abortController.abort(); // aborts the request
	await prom; // await always !! even if aborted
	console.log('aborted');
	await wxsource.setTime(5); // no abort
	console.log('setTime(5) done'); //*/

	/*/ DEMO: preload a timestep
	map.once('click', async () => {
		console.log('no preload time=5');
		const t = Date.now();
		await wxsource.setTime(5); // await always !! or abort
		console.log(Date.now() - t);
		await wxsource.preloadTime(10); // await always !! even if aborted
		await wxsource.preloadTime(20); // await always !! even if aborted
		console.log('preloaded timesteps 10, 20');
		map.once('click', async () => {
			const t = Date.now();
			await wxsource.setTime(10); // await always !! or abort
			console.log(Date.now() - t, ' step 10');
			map.once('click', async () => {
				const t = Date.now();
				await wxsource.setTime(20); // await always !! or abort
				console.log(Date.now() - t, ' step 20');
			});
		});
	}); //*/

	/*/ DEMO: change style's units
	let i = 0;
	map.on('click', async () => {
		const u = ['knots', 'm/s', 'km/h', 'miles/h'];
		await wxsource.updateCurrentStyleObject({ units: u[i], levels: undefined }); // levels: undefined - to recalculate levels
		legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
		i = (i + 1) % u.length;
	}); //*/

	/*/ DEMO (mapbox): read lon lat data
	let popup: mapboxgl.Popup = new mapboxgl.Popup({ closeOnClick: false, offset: [50, -50] }).addTo(map);
	map.on('mousemove', (e) => {
		const pos = e.lngLat; // (mapbox)
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos.wrap(), map);
		if (tileInfo) {
			const { min, max } = wxsource.getMetadata();
			let content = `lnglat=(${pos.lng.toFixed(2)}, ${pos.lat.toFixed(2)})<br>
			dataset=${wxsource.wxdatasetManager.datasetName}<br>
			variables=${wxsource.getVariables()}<br>
			style=${tileInfo.inStyleUnits.map((d) => d.toFixed(2))} ${tileInfo.styleUnits}<br>
			source=${tileInfo.data.map((d) => d.toFixed(2))} ${tileInfo.dataUnits}<br>
			min=${min.toFixed(2)} ${tileInfo.dataUnits}, max=${max.toFixed(2)} ${tileInfo.dataUnits}<br>
			time=${wxsource.getTime()}`;
			popup.setLngLat(pos).setHTML(content); // (mapbox)
		}
	}); //*/

	/*/ DEMO: timesteps
	const tlength = wxsource.wxdatasetManager.getTimes().length;
	let t = 0;
	const nextTimeStep = async () => {
		await wxsource.setTime(t++ % tlength); // await always !!
		setTimeout(nextTimeStep, 0);
	};
	setTimeout(nextTimeStep, 2000);
	//*/

	/*/ DEMO: Dynamic blur effect /
	let b = 0;
	let db = 1;
	const nextAnim = async () => {
		await wxsource.updateCurrentStyleObject({ blurRadius: b }); // await always !!

		b += db;
		if (b > 16 || b < 0) db = -db;
		setTimeout(nextAnim, 1);
	};
	setTimeout(nextAnim, 2000); //*/
}

start();

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

function addRaster(map: mapboxgl.Map, URL: string, maxZoom: number = 2) {
	map.addSource('raster-source', {
		type: 'raster',
		tiles: [URL],
		tileSize: 256,
		maxzoom: maxZoom,
	});
	map.addLayer({
		id: 'raster-layer',
		type: 'raster',
		source: 'raster-source',
		paint: {
			// 'raster-opacity': 1,
			// 'raster-fade-duration': 1000,
		},
	});
}
