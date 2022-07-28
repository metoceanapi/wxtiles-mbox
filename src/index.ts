import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { WxTileLayer } from './wxtilelayer';
import { wxAPI } from './wxAPI/wxAPI';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

async function start() {
	const dataServer = 'https://tiles.metoceanapi.com/data/';
	const dataSet = 'ecmwf.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	const variable = 'air.temperature.at-2m'; /* 'current.speed.northward.at-sea-surface/';  */ /* 'air.humidity.at-2m/';  */ /* 'reflectivity/'; */
	const wxapi = new wxAPI(dataServer);
	const dataset = await wxapi.getDatasetByName(dataSet);
	const URI = dataset.getURI({ variableName: variable, time: Date.now() });
	const map = new mapboxgl.Map({
		container: 'map',
		style: {
			version: 8,
			name: 'Empty',
			sources: {
				wxtiles: {
					type: 'raster',
					tiles: [URI],
					tileSize: 256,
					maxzoom: 4,
				},
			},
			layers: [
				{
					id: 'simple-tiles',
					type: 'raster',
					source: 'wxtiles',
					minzoom: 0,
					maxzoom: 24,
				},
			],
		},
		center: [-209.2, -34.26],
		zoom: 3,
	});
	map.showTileBoundaries = true;

	// map.getStyle().sources;

	/*
	map.on('load', async () => {
		// map.addSource('wxtiles', {
		// 	type: 'raster',
		// 	tiles: [URI],
		// 	tileSize: 256,
		// 	maxzoom: 4,
		// 	id: 'wxtiles',
		// });
		map.addLayer({
			id: 'simple-tiles',
			type: 'raster',
			source: {
				type: 'raster',
				tiles: [URI],
				tileSize: 256,
				maxzoom: 4,
				id: 'wxtiles',
			},
			minzoom: 0,
			maxzoom: 24,
		});

		// map.addSource('point', {
		// 	type: 'geojson',
		// 	data: {
		// 		type: 'FeatureCollection',
		// 		features: [
		// 			{
		// 				type: 'Feature',
		// 				properties: {},
		// 				geometry: {
		// 					type: 'Point',
		// 					coordinates: [-209.2, -34.26],
		// 				},
		// 			},
		// 		],
		// 	},
		// });

		// map.addLayer({
		// 	id: 'point',
		// 	type: 'circle',
		// 	source: 'point',
		// 	paint: {
		// 		'circle-radius': 10,
		// 		'circle-color': '#F84C4C', // red color
		// 	},
		// });

		setTimeout(() => {
			const URIw = dataServer + dataSet + instance + variable + times[7] + '/{z}/{x}/{y}.png';
			const src = <mapboxgl.RasterSource>map.getSource('wxtiles'); //.setData(URIw);
			src.tiles = [URIw];

			// map.addSource('wxtiles', {
			// 	type: 'raster',
			// 	tiles: [URIw],
			// 	tileSize: 256,
			// 	maxzoom: 4,
			// });
		}, 3000);

		// const layer = new WxTileLayer('asdf', URI);
		// map.addLayer(layer);
	});
	*/
}

start();
