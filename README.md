# wxtiles

This is a project for weather data visualization.
There are three main parts of the project:

1. [Splitter](https://github.com/metocean/wxtile-splitter) - a service that splits the datasets into tiles (PNG) and some metadata (JSON) served by a fileserver backend aka NGINX.
2. [WxTiles-mbox source code](https://github.com/metoceanapi/wxtiles-mbox), npm [@metoceanapi/wxtiles-mbox](https://www.npmjs.com/package/@metoceanapi/wxtiles-mbox) - a JS API providing work with metadata, dataset manager and an implementation of a Custom MapBox-gl-gs Layer for visualizing the tiles using [Mapbox-gl-gs](https://www.mapbox.com/).
3. [WxTiles-leaflet source code](https://github.com/metoceanapi/wxtiles-leaflet), npm [@metoceanapi/wxtiles-leaflet](https://www.npmjs.com/package/@metoceanapi/wxtiles-leaflet) - a JS API providing work with metadata, dataset manager and an implementation of a Custom Leaflet Layer for visualizing the tiles using [Leaflet](https://leafletjs.com/).

## API

APIs for Leaflet and Mapbox-gl-gs are similar in many ways. The difference is in framework-specific implementations of the Custom Source/Layer.

Usage and API documentation is mainly equal for both frameworks.

## DOCS

- Mapbox-gl: https://metoceanapi.github.io/wxtiles-mbox/docs/
- Leaflet: https://metoceanapi.github.io/wxtiles-leaflet/docs/

## Examples

### MapBox-gl-js

```ts
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import { WxAPI } from '@metoceanapi/wxtiles-mbox';

async func(){
	// Get the API ready - should be ONE per application
	// requestInit is used in every request to the server. Add your keys, credentials, mode, etc.
	const wxapi = new WxAPI({ dataServerURL: 'https://tiles.metoceanapi.com/data/',
		requestInit: { /* headers: new Headers([['x-api-key', 'key']]), */ } });

	// Create a dataset manager (may be used for many variables-layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager('gfs.global');

	// Automatically gets a proper set of variable(s) from the dataset and composes northward or eastward components if needed
	const variables = wxdatasetManager.checkCombineVariableIfVector('air.temperature.at-2m'); // 'wind.speed.eastward.at-10m' - Vector example

	// create a Mapbox layer source
	const mboxSourceOptions = { id: 'wxsource', attribution: 'WxTiles' };
	const wxsource = new WxTileSource({ wxdatasetManager, variables }, mboxSourceOptions);

	// add the layer to the map
    const map = new mapboxgl.Map({ container: 'map', accessToken:'token', style: { version: 8, name: 'Empty', sources: {}, layers: [] } });
    await map.once('load');
	map.addSource(wxsource.id, wxsource);
	map.addLayer({ id: 'wxlayer', type: 'raster', source: wxsource.id, paint: { 'raster-fade-duration': 0 /*NEDDED for animation*/ } });
}()

```

### Leaflet

```ts
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { WxAPI } from '@metoceanapi/wxtiles-leaflet';

async func(){
	// Get the API ready - should be ONE per application
	// requestInit is used in every request to the server. Add your keys, credentials, mode, etc.
	const wxapi = new WxAPI({ dataServerURL: 'https://tiles.metoceanapi.com/data/',
		requestInit: { /* headers: new Headers([['x-api-key', 'key']]), */ } });

	// Create a dataset manager (may be used for many variables-layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager('gfs.global');

	// Automatically gets a proper set of variable(s) from the dataset and composes northward or eastward components if needed
	const variables = wxdatasetManager.checkCombineVariableIfVector('air.temperature.at-2m'); // 'wind.speed.eastward.at-10m' - Vector example

	// create a layer
	const leafletOptions: L.GridLayerOptions = { opacity: 1, attribution: 'WxTiles' };
	const wxsource = new WxTileSource({ wxdatasetManager, variables }, leafletOptions);

	// add the layer to the map
	const map = L.map('map', { center: [0, 0], zoom: 2, zoomControl: true });
	map.addLayer(wxsource);
	await new Promise((done) => wxsource.once('load', done)); // highly recommended to await for the first load
}()
```

### Change the time step

```ts
await wxsource.setTimeStep(1); // 1 - index of the time step in the dataset
```

or

```ts
await wxsource.setTimeStep('2020-01-01T00:00:00Z'); // '2020-01-01T00:00:00Z' - time step in the dataset
```

or

```ts
await wxsource.setTimeStep(2345323454); //  time in seconds since 1970-01-01T00:00:00Z
```

or

```ts
await wxsource.setTimeStep(new Date('2020-01-01T00:00:00Z')); // Date object
```

### Update the style

```ts
await wxsource.updateCurrentStyleObject({ units: 'm/s', levels: undefined }); // set levels to undefined - to automatically calculate the levels from the dataset
```

### Preload the time steps

```ts
// load the time step 10 to the cache but do not not render it
const prom = wxsource.preloadTime(10);
// do stuff asyncronously
// ...
await prom; // wait for the time step to finish loading
// now set the time step to 10
await wxsource.setTime(10); // will be fast rendered from the cache
```

### Abort loading

```ts
const abortController = new AbortController();
console.log('setTime(5)');
const prom = wxsource.setTime(5, abortController);
abortController.abort(); // aborts the request
await prom; // await always !! even if aborted
console.log('aborted');
```

### Get the current time step

```ts
const timeStep = wxsource.getTime();
```

### read lon lat data

```ts
map.on('mousemove', (e) => {
	if (!wxsource) return;
	const pos = position(e); //
	const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos.wrap(), map);
	if (tileInfo) {
		console.log(tileInfo);
	}
});
```

### animated blur effect

```ts
(async function step(n: number = 0) {
	await wxsource.updateCurrentStyleObject({ isolineText: false, blurRadius: ~~(10 * Math.sin(n / 500) + 10) }); // await always !!
	requestAnimationFrame(step);
})();
```

### more interactive - additional level and a bit of the red transparentness around the level made from current mouse position

```ts
await wxsource.updateCurrentStyleObject({ levels: undefined }); // reset levels if existed in the style
const levels = wxsource.getCurrentStyleObjectCopy().levels || []; // get current/default/any levels
// generate a new color map from the levels
const colMap: [number, string][] = levels.map((level) => [level, '#' + Math.random().toString(16).slice(2, 8) + 'ff']);
let busy = false;
map.on('mousemove', async (e) => {
	if (!wxsource || busy) return;
	busy = true;
	const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(position(e), map);
	if (tileInfo) {
		await wxsource.updateCurrentStyleObject({ colorMap: [...colMap, [tileInfo.inStyleUnits[0], '#ff000000']] });
		onsole.log(tileInfo);
	}
	busy = false;
});
```
