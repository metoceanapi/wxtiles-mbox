import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl, { baseApiUrl } from 'mapbox-gl';

import { wxAPI } from '../src/wxAPI/wxAPI';
import { WxTileSource } from '../src/wxsource/wxsource';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

async function start() {
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	const wxapi = new wxAPI({ dataServerURL, requestInit: {} });

	const datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	const variables = ['air.temperature.at-2m'];
	// const variables = ['wind.speed.northward.at-10m', 'wind.speed.eastward.at-10m'];

	// const datasetName = 'ww3-ecmwf.global';
	// const variables = ['wave.direction.mean'];
	const wxmanager = await wxapi.createDatasetManager(datasetName);

	const map = new mapboxgl.Map({
		container: 'map',
		// style: 'mapbox://styles/mapbox/light-v10',
		// style: 'mapbox://styles/mapbox/satellite-v9',
		style: { version: 8, name: 'Empty', sources: {}, layers: [] },
		center: [-209.2, -34.26],
		zoom: 2,
		// projection: { name: 'globe' },
	});

	map.addControl(new mapboxgl.NavigationControl());
	map.showTileBoundaries = true;

	await map.once('load');

	const wxsource = new WxTileSource({
		map,
		id: 'wxsource',
		wxstyleName: 'base',
		wxdataset: wxmanager,
		variables,
		time: 0,
	});

	map.addSource(wxsource.id, wxsource);
	map.addLayer({
		id: 'wxtiles',
		type: 'raster',
		source: 'wxsource',
		paint: { 'raster-fade-duration': 0 }, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
	});

	// addSkyAndTerrain(map);
	// addRaster(map, wxmanager.createURI({ variable: variables[0] }), wxmanager.getMaxZoom());
	addPoints(map);

	// let t = 0;
	// const tlength = wxdataset.getTimes().length;
	// const nextTimeStep = async () => {
	// 	t = (t + 1) % tlength;
	// 	await wxsource.setTime(t); // await always !!
	// 	setTimeout(nextTimeStep, 0);
	// };
	// setTimeout(nextTimeStep, 5000);

	setTimeout(() => wxsource.setTime(10), 3000);
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
