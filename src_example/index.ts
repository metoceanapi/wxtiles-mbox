import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA';

(async function start() {
	const map = new mapboxgl.Map({
		container: 'map',
		style: { version: 8, name: 'Empty', sources: {}, layers: [] },
		// projection: { name: 'globe' },
	});

	map.addControl(new mapboxgl.NavigationControl());

	map.showTileBoundaries = true;

	const customSource = {
		type: 'custom' as 'custom',
		dataType: 'raster' as 'raster',
		id: 'customSource',

		async loadTile(tile: { z: any; x: any; y: any }, init: RequestInit | undefined): Promise<ImageBitmap> {
			const im = createImageBitmap(await (await fetch(`http://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`, init)).blob());
			await Promise.all([im, new Promise((resolve) => setTimeout(resolve, 2500))]);
			return im;
		},
	};

	map.on('load', async () => {
		map.addSource(customSource.id, customSource);
		map.addLayer({ id: 'rasterLayer', type: 'raster', source: customSource.id });
		setTimeout(() => map.flyTo({ center: [0, 15], zoom: 4 }), 4000);
	});
})();
