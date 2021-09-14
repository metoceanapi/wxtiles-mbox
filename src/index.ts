import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

const mapEl = document.getElementById('map');
if (!mapEl) throw '!mapEl';

const map = new mapboxgl.Map({
	container: mapEl,
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
	try {
		// get a workable URI (could be hardcoded, but tiles-DB is alive!)
		const fetchJson = async (url) => (await fetch(url)).json(); // json loader helper
		const dataServer = 'https://tiles.metoceanapi.com/data/';
		const dataSet = 'ww3-gfs.global/'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
		const variable = 'wave.height/'; /* 'current.speed.northward.at-sea-surface/';  */ /* 'air.humidity.at-2m/';  */ /* 'reflectivity/'; */
		const instance = (await fetchJson(dataServer + dataSet + 'instances.json')).reverse()[0] + '/';
		const { times } = await fetchJson(dataServer + dataSet + instance + 'meta.json');
		const time = times.find((t) => new Date(t).getTime() >= Date.now()) || times[times.length - 1];
		// URI could be hardcoded, but tiles-DB is alive!
		const URI = dataServer + dataSet + instance + variable + time + '/{z}/{x}/{y}.png';

		map.addSource('wxtiles', {
			type: 'raster',
			tiles: ['https://tiles.metoceanapi.com/data/ecwmf.global/2021-07-19T12:00:00Z/air.temperature.at-2m/2021-07-19T12:00:00Z/{z}/{x}/{y}.png'],

			// tiles: ['https://stamen-tiles.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg'],
			// tiles: [URI],
			tileSize: 256,
		});
		map.addLayer({
			id: 'simple-tiles',
			type: 'raster',
			source: 'wxtiles',
			minzoom: 0,
			maxzoom: 24,
		});
	} catch (e) {
		console.log(e);
	}
});
