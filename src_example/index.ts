import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { wxAPI } from '../src/wxAPI/wxAPI';
import { type WxTileInfo, WxTileSource, type wxVars } from '../src/wxsource/wxsource';
import { createLegend } from '../src/utils/RawCLUT';
import { ColorStyleStrict } from '../src/utils/wxtools';

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';
class LegendControl {
	_map?: mapboxgl.Map;
	_canvas: HTMLCanvasElement;
	constructor(map: mapboxgl.Map) {
		this._map = map;
		const canvas = document.createElement('canvas');
		canvas.width = 600;
		canvas.height = 40;
		canvas.style.borderStyle = 'solid';
		canvas.style.borderColor = '#000';
		canvas.style.backgroundColor = '#fff';
		this._canvas = canvas;
		this._canvas.className = 'mapboxgl-ctrl';
		this._canvas.textContent = 'Hello, world';
	}

	onAdd(map) {
		return this._canvas;
	}

	onRemove() {
		this._canvas.parentNode?.removeChild(this._canvas);
		this._map = undefined;
	}

	drawLegend(style: ColorStyleStrict) {
		const { _canvas } = this;
		const { width, height } = _canvas;
		const halfHeight = (16 + height) >> 2;
		const legend = createLegend(width - 50, style);

		// draw legend
		const ctx = _canvas.getContext('2d')!;
		const imData = ctx.createImageData(width, height);
		const im = new Uint32Array(imData.data.buffer);
		im.fill(-1);

		const startX = 2;
		const startY = 2;
		const startXY = startX + width * startY;

		const trSize = halfHeight >> 1;
		// left triangle
		if (legend.showBelowMin) {
			const c = legend.colors[0];
			if (c) {
				for (let x = 0; x < trSize; ++x) {
					for (let y = trSize; y < trSize + x; ++y) {
						im[startXY + x + y * width] = c;
						im[startXY + x + (trSize * 2 - y) * width] = c;
					}
				}
			}
		}

		for (let x = 0; x < legend.size; ++x) {
			for (let y = 0; y < halfHeight; ++y) {
				if (legend.colors[0]) {
					im[startX + x + trSize + (y + startY + 1) * width] = legend.colors[x];
				}
			}
		}

		// right triangle
		if (legend.showAboveMax) {
			const c = legend.colors[legend.colors.length - 1];
			if (c) {
				for (let x = 0; x <= trSize; ++x) {
					for (let y = trSize; y < trSize + x; ++y) {
						im[startXY + trSize * 2 + legend.size - x + y * width] = c;
						im[startXY + trSize * 2 + legend.size - x + (trSize * 2 - y) * width] = c;
					}
				}
			}
		}

		ctx.putImageData(imData, 0, 0);

		// draw ticks
		ctx.font = '8px sans-serif';
		ctx.beginPath();
		for (const tick of legend.ticks) {
			ctx.strokeStyle = '#000';
			ctx.moveTo(tick.pos + trSize + startX + 1, startY + 3);
			ctx.lineTo(tick.pos + trSize + startX + 1, halfHeight);
			ctx.fillText(tick.dataString, tick.pos + trSize + startX + 1, halfHeight + 11);
		}

		ctx.font = '12px sans-serif';
		const txt = `(${legend.units})`;
		ctx.fillText(txt, 13, height - 5);
		ctx.stroke();

		ctx.strokeStyle = '#888';
		ctx.strokeRect(1, 1, width - 3, height - 2); //for white background
	}
}
async function start() {
	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// const dataServerURL = 'http://tiles3.metoceanapi.com/';
	const myHeaders = new Headers();
	// myHeaders.append('x-api-key', 'SpV3J1RypVrv2qkcJE91gG');
	const wxapi = new wxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none', requestInit: { headers: myHeaders } });

	const datasetName = 'gfs.global'; /* 'mercator.global/';  */ /* 'ecwmf.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	// const variables: wxVars = ['air.temperature.at-2m'];
	const variables: wxVars = ['wind.speed.eastward.at-10m', 'wind.speed.northward.at-10m'];

	// const datasetName = 'ww3-ecmwf.global';
	// const variables = ['wave.direction.mean'];

	// const datasetName = 'obs-radar.rain.nzl.national';
	// const variables = ['reflectivity'];

	const wxmanager = await wxapi.createDatasetManager(datasetName);

	const map = new mapboxgl.Map({
		container: 'map',
		style: 'mapbox://styles/mapbox/light-v10',
		// style: 'mapbox://styles/mapbox/satellite-v9',
		// style: { version: 8, name: 'Empty', sources: {}, layers: [] },
		center: [174.5, -40.75],
		zoom: 6,
		// projection: { name: 'globe' },
	});

	const legendControl = new LegendControl(map);

	map.addControl(new mapboxgl.NavigationControl());
	map.addControl(legendControl, 'top-left');
	map.showTileBoundaries = true;

	await map.once('load');

	const wxsource = new WxTileSource({
		id: 'wxsource',
		wxstyleName: 'base',
		wxdataset: wxmanager,
		variables,
		// time: 0,
	});

	map.addSource(wxsource.id, wxsource);
	map.addLayer({
		id: 'wxtiles',
		type: 'raster',
		source: 'wxsource',
		paint: { 'raster-fade-duration': 0, 'raster-opacity': 0.5 }, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
	});

	// addSkyAndTerrain(map);
	// addRaster(map, wxmanager.createURI({ variable: variables[0] }), wxmanager.getMaxZoom());
	addPoints(map);

	// await wxsource.updateCurrentStyleObject({ streamLineColor: 'inverted', streamLineStatic: true }); // await always !!
	await wxsource.updateCurrentStyleObject({ streamLineColor: 'inverted', streamLineStatic: false, levels: undefined }); // await always !!
	legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
	wxsource.startAnimation();
	console.log('time', wxsource.getTime());

	/*/ DEMO: abort
	const abortController = new AbortController();
	console.log('setTime(5)');
	const prom = wxsource.setTime(5, { requestInit: abortController });
	abortController.abort(); // aborts the request
	await prom; // await always !! even if aborted
	console.log('aborted');
	await wxsource.setTime(5); // no abort
	console.log('setTime(5) done');//*/

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

	/*/ DEMO: read lon lat data
	let popup: mapboxgl.Popup = new mapboxgl.Popup({ closeOnClick: false }).setLngLat([0, 0]).setHTML('').addTo(map);
	map.on('mousemove', (e) => {
		popup.setHTML(`${e.lngLat}`);
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(e.lngLat.wrap(), map);
		if (tileInfo) {
			const { min, max } = wxsource.currentMeta;
			let content = `lnglat=(${e.lngLat.lng.toFixed(2)}, ${e.lngLat.lat.toFixed(2)})<br>
			dataset=${wxmanager.datasetName}<br>
			variables=${wxsource.variables}<br>
			style=${tileInfo.inStyleUnits.map((d) => d.toFixed(2))} ${tileInfo.styleUnits}<br>
			source=${tileInfo.data.map((d) => d.toFixed(2))} ${tileInfo.dataUnits}<br>
			min=${min.toFixed(2)} ${tileInfo.dataUnits}, max=${max.toFixed(2)} ${tileInfo.dataUnits}<br>
			time=${wxsource.getTime()}`;
			popup.setHTML(content);
		}

		popup.setLngLat(e.lngLat);
	}); //*/

	/*/ DEMO: timesteps
	const tlength = wxmanager.getTimes().length;
	let t = 0;
	const nextTimeStep = async () => {
		await wxsource.setTime(t++ % tlength); // await always !!
		setTimeout(nextTimeStep, 100);
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
