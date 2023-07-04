import { IControl } from 'mapbox-gl';
import mapboxgl from 'mapbox-gl';
import { WxGetColorStyles } from '../src/utils/wxtools';
import { CustomWxTilesLayer } from '../src/customlayer/customlayer';
import { WxBoundaryMeta } from '../src/wxAPI/WxAPItypes';

export function flyTo(map: mapboxgl.Map, zoom: number, lng: number, lat: number, bearing: number, pitch: number) {
	map.flyTo({ zoom, center: [lng, lat], bearing, pitch });
}

export function setURL(map: mapboxgl.Map, time: string, datasetName: string, variable: string, style: any) {
	const base = WxGetColorStyles()['base'];
	for (const i in style) style[i] === base[i] && delete style[i]; // remove default values
	if (style.gl) {
		for (const i in style.gl) style.gl[i] === base.gl?.[i] && delete style.gl[i]; // remove default values from gl
		Object.keys(style.gl).length === 0 && delete style.gl; // remove gl if empty
	}
	const center = map.getCenter().wrap();
	const href =
		`##${datasetName}/${variable}/${time}/${map.getZoom().toFixed(2)}/${center.lng.toFixed(2)}/${center.lat.toFixed(2)}/${map.getBearing().toFixed(2)}/${map
			.getPitch()
			.toFixed(2)}` + (style ? '/' + JSON.stringify(style) : '');

	history.replaceState(null, '', href);
}

export async function initFrameWork() {
	mapboxgl.accessToken = 'pk.eyJ1IjoibWV0b2NlYW4iLCJhIjoia1hXZjVfSSJ9.rQPq6XLE0VhVPtcD9Cfw6A';
	const map = new mapboxgl.Map({
		container: 'map',
		// style: 'mapbox://styles/mapbox/light-v10',
		// style: 'mapbox://styles/mapbox/satellite-v9',
		style: { version: 8, name: 'Empty', sources: {}, layers: [] },
		// center: [180, 0],
		center: [174.5, -41.3],
		zoom: 5,

		// projection: { name: 'globe' },
	});

	map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
	// map.showTileBoundaries = true;
	await map.once('load');

	// addSkyAndTerrain(map);
	// addPoints(map);

	return map;
}

export function position(e: mapboxgl.MapMouseEvent): mapboxgl.LngLat {
	return e.lngLat.wrap(); // (mapbox)
}

export function addPoints(map: mapboxgl.Map) {
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

export function addSkyAndTerrain(map: mapboxgl.Map) {
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

export function addControl(map: mapboxgl.Map, control: IControl, position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') {
	map.addControl(control, position);
}

export function removeLayer(map: mapboxgl.Map, idS: string, source?: any) {
	const layer = map.getLayer('wxtiles');
	layer && map.removeLayer('wxtiles');
	const mbsource = map.getSource(idS);
	mbsource && map.removeSource(idS);
	console.log('removeLayer', idS, source);
}

export function addRaster(map: mapboxgl.Map, idS: string, idL: string, URL: string, maxZoom: number, boundariesnorm?: WxBoundaryMeta) {
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
		}
		// idL !== 'baseL' ? 'baseL' : undefined
	);
}

export async function addLayer(map: mapboxgl.Map, idL: string, source: any) {
	map.addSource(source.id, source);
	// const baseL = map.getLayer('baseL') && 'baseL';
	map.addLayer(new CustomWxTilesLayer(idL, source.id, source.opacity)); //, baseL);

	// map.addLayer(
	// 	{
	// 		id: idL,
	// 		type: 'raster',
	// 		source: source.id,
	// 		paint: {
	// 			'raster-fade-duration': 0, //kinda helps to avoid bug https://github.com/mapbox/mapbox-gl-js/issues/12159
	// 			'raster-opacity': source.opacity,
	// 		},
	// 	}
	// 	// baseL
	// ); //
	// await new Promise((done) => map.once('idle', done));
}
