import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { wxAPI } from '../src/wxAPI/wxAPI';
import { WxTileSource } from '../src/wxsource/wxsource';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

async function start() {
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	const datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	const variables = ['air.temperature.at-2m'];
	// const variables = ['wind.speed.northward.at-10m', 'wind.speed.eastward.at-100m'];

	// const datasetName = 'ww3-ecmwf.global';
	// const variables = ['wave.direction.mean'];

	const wxapi = new wxAPI({ dataServerURL, qtreeURL: dataServerURL + 'seamask.qtree', maskURL: dataServerURL, init: {} });
	const wxdataset = await wxapi.createDatasetByName(datasetName);

	const map = new mapboxgl.Map({
		container: 'map',
		// style: 'mapbox://styles/mapbox/light-v10',
		// style: 'mapbox://styles/mapbox/satellite-v9',
		//*
		style: {
			version: 8,
			name: 'Empty',
			sources: {},
			layers: [],
		}, // */
		center: [-209.2, -34.26],
		zoom: 2,
		projection: { name: 'globe' },
	});

	map.addControl(new mapboxgl.NavigationControl());

	map.showTileBoundaries = true;

	map.on('load', async () => {
		// map.getStyle().transition = { delay: 500, duration: 500 }; //?.duration

		// addSkyAndTerrain(map);

		// const wxsource = new WxTileSource({ map, id: 'wxsource', wxstyleName: 'base', wxdataset, variables, tileSize: 256 });
		// const wxsource = new WxTileSource({ id: 'wxsource' });
		// map.addSource(wxsource.id, wxsource);
		// map.addSource(wxsource.id, { maxzoom: wxdataset.getMaxZoom(), id: wxsource.id, type: 'raster', tiles: [wxsource.tilesURIs[0]], tileSize: 256 });
		// map.addSource('wxsource', { type: 'raster', tiles: ['http://tile.openstreetmap.org/{z}/{x}/{y}.png'] });

		//*
		map.addSource('wxsource', {
			type: 'custom',
			dataType: 'raster',
			id: 'wxsource',

			async loadTile(tile, init?: { signal?: AbortSignal }): Promise<ImageBitmap> {
				return createImageBitmap(await (await fetch(`http://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`, init)).blob());
			},
		}); //*/

		// map.areTilesLoaded();
		// map.isSourceLoaded(wxsource.id);

		map.addLayer({ id: 'wxtiles', type: 'raster', source: 'wxsource' });

		addPoints(map);

		// setTimeout(() => {
		// 	// const source = map.getSource('trace'); //.setData({});
		// 	// wxsource.setTime(0);
		// 	// wxsource.reload();
		// 	const source2 = <mapboxgl.CustomSource<ImageBitmap>>map.getSource('wxsource'); //.setData(URIw);
		// 	const imp = source2._implementation;
		// 	// map.style._sourceCaches['other:wxtiles'].clearTiles();
		// 	// map.style._sourceCaches['other:wxtiles'].update(map.transform);

		// 	// (map as any).style._otherSourceCaches?.['wxtiles'].reload();
		// 	// const style = map.style;
		// 	// const { sourceCaches, _sourceCaches } = style;
		// 	// style.sources['wxtiles'].tiles = [URI2];
		// 	const t = 0;

		// 	// 	// map.addSource('wxtiles', {
		// 	// 	// 	type: 'raster',
		// 	// 	// 	tiles: [URIw],
		// 	// 	// 	tileSize: 256,
		// 	// 	// 	maxzoom: 4,
		// 	// 	// });
		// }, 3000);

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
