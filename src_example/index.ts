import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { wxAPI } from '../src/wxAPI/wxAPI';
import { WxTileSource } from '../src/wxsource/wxsource';
import { WxTilesLibSetup } from '../src/utils/wxtools';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

async function start() {
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	const datasetName = 'ecmwf.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	const variable = 'air.temperature.at-2m'; /* 'current.speed.northward.at-sea-surface/';  */ /* 'air.humidity.at-2m/';  */ /* 'reflectivity/'; */

	const wxapi = new wxAPI({ dataServerURL });
	const wxdataset = await wxapi.createDatasetByName(datasetName);
	WxTilesLibSetup({});

	const map = new mapboxgl.Map({
		container: 'map',
		style: {
			version: 8,
			name: 'Empty',
			sources: {},
			layers: [],
		},
		center: [-209.2, -34.26],
		zoom: 3,
	});

	map.showTileBoundaries = true;

	map.on('load', async () => {
		const wxsource = new WxTileSource({ map, id: 'wxsource', wxstyleName: 'base', wxdataset, variable });
		map.addSource(wxsource.id, wxsource);

		map.addLayer({
			id: 'wxtiles',
			type: 'raster',
			source: wxsource.id,
			minzoom: 0,
			maxzoom: 24,
		});

		addPoints(map);

		// const sourceCache = map.style._otherSourceCaches[wxsource.id];

		setTimeout(() => {
			// 	const URIw = dataServer + dataSet + instance + variable + times[7] + '/{z}/{x}/{y}.png';
			// const URI2 = dataset.getURI({ variableName: variable, time: 20 });
			// const source2 = <mapboxgl.CustomSource<ImageBitmap>>map.getSource('wxtiles'); //.setData(URIw);
			// const imp = source2._implementation;
			// map.style._sourceCaches['other:wxtiles'].clearTiles();
			// map.style._sourceCaches['other:wxtiles'].update(map.transform);

			// (map as any).style._otherSourceCaches?.['wxtiles'].reload();
			// const style = map.style;
			// const { sourceCaches, _sourceCaches } = style;
			// style.sources['wxtiles'].tiles = [URI2];
			const t = 0;

			// 	// map.addSource('wxtiles', {
			// 	// 	type: 'raster',
			// 	// 	tiles: [URIw],
			// 	// 	tileSize: 256,
			// 	// 	maxzoom: 4,
			// 	// });
		}, 1000);

		// const layer = new WxTileLayer('asdf', URI);
		// map.addLayer(layer);
	});
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
