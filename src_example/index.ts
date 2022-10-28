import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { WxTileSource, type WxVars, WxAPI, WxTilesLogging, type WxTileInfo } from '../src/index';
import { WxLegendControl } from '../src/controls/WxLegendControl';
import { WxStyleEditorControl } from '../src/controls/WxStyleEditorControl';
import { WxInfoControl } from '../src/controls/WxInfoControl';
import { WxTimeControl } from '../src/controls/WxTimeControl ';
import { WxAPIControl } from '../src/controls/WxAPIControl';

async function start() {
	// mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';
	mapboxgl.accessToken = 'pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA';
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
	// addRaster(map, wxmanager.createURI({ variable: variables[0] }), wxmanager.getMaxZoom());
	// addPoints(map);

	//******* WxTiles stuff *******//
	WxTilesLogging(false);
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// const dataServerURL = 'http://tiles3.metoceanapi.com/';
	const myHeaders = new Headers();
	// myHeaders.append('x-api-key', 'SpV3J1RypVrv2qkcJE91gG');
	const wxapi = new WxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none', requestInit: { headers: myHeaders } });

	const datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	// const variables: WxVars = ['air.temperature.at-2m'];
	const variables: WxVars = ['wind.speed.eastward.at-10m', 'wind.speed.northward.at-10m'];

	// const datasetName = 'ww3-ecmwf.global';
	// const variables: WxVars = ['wave.direction.mean'];

	// const datasetName = 'obs-radar.rain.nzl.national';
	// const variables: WxVars = ['reflectivity'];

	const frameworkOptions = { id: 'wxsource', opacity: 0.5, attribution: 'WxTiles' };

	let wxsource = new WxTileSource({ wxdatasetManager: await wxapi.createDatasetManager(datasetName), variables }, frameworkOptions);
	map.addSource(wxsource.id, wxsource);
	map.addLayer({
		id: 'wxtiles',
		type: 'raster',
		source: wxsource.id,
		paint: { 'raster-fade-duration': 0, 'raster-opacity': 0.5 },
	});

	const legendControl = new WxLegendControl();
	map.addControl(legendControl, 'top-right');
	legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());

	const apiControl = new WxAPIControl(wxapi, datasetName, variables[0]);
	map.addControl(apiControl, 'top-left');
	apiControl.onchange = async (datasetName: string, variable: string): Promise<void> => {
		const variables: WxVars = [variable];
		(variable.includes('eastward') && variables.push(variable.replace('eastward', 'northward'))) || // add northward variable for wind and current
			(variable.includes('northward') && variables.unshift(variable.replace('northward', 'eastward'))); // add eastward variable for wind and current
		map.removeLayer('wxtiles');
		map.removeSource(wxsource.id);
		wxsource = new WxTileSource({ wxdatasetManager: await wxapi.createDatasetManager(datasetName), variables }, frameworkOptions);
		map.addSource(wxsource.id, wxsource);
		map.addLayer({
			id: 'wxtiles',
			type: 'raster',
			source: wxsource.id,
			paint: { 'raster-fade-duration': 0, 'raster-opacity': 0.5 }, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
		});

		timeControl.updateSource(wxsource);
		editor.onchange?.(wxsource.getCurrentStyleObjectCopy());
	};

	const timeControl = new WxTimeControl(10, wxsource);
	map.addControl(timeControl, 'top-left');

	const editor = new WxStyleEditorControl();
	map.addControl(editor, 'top-left');
	editor.onchange = async (style) => {
		await wxsource.updateCurrentStyleObject(style);
		const nstyle = wxsource.getCurrentStyleObjectCopy();
		legendControl.drawLegend(nstyle);
		editor.setStyle(nstyle);
	};
	editor.onchange(wxsource.getCurrentStyleObjectCopy());

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
