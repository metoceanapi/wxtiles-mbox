# WXTiles API Product Documentation

WXTiles API enable weather data visualization for programmers.
This documentation provides instructions for how to use WXTiles API in your project.

There are three main components of the product:

1. [Splitter](https://github.com/metocean/wxtile-splitter) - a service that splits the datasets into tiles (PNG) and some metadata (JSON) served by a fileserver backend aka NGINX.
2. [WxTiles-mbox source code](https://github.com/metoceanapi/wxtiles-mbox), npm [@metoceanapi/wxtiles-mbox](https://www.npmjs.com/package/@metoceanapi/wxtiles-mbox) - a JS API providing work with metadata, dataset manager and an implementation of a Custom MapBox-gl-gs Layer for visualizing the tiles using [Mapbox-gl-gs](https://www.mapbox.com/).
3. [WxTiles-leaflet source code](https://github.com/metoceanapi/wxtiles-leaflet), npm [@metoceanapi/wxtiles-leaflet](https://www.npmjs.com/package/@metoceanapi/wxtiles-leaflet) - a JS API providing work with metadata, dataset manager and an implementation of a Custom Leaflet Layer for visualizing the tiles using [Leaflet](https://leafletjs.com/).

## API Description

The API can be used with 2 different frameworks: Leaflet and Mapbox-gl-gs.
API for Leaflet and Mapbox-gl-gs are similar in many ways.
The difference is in the framework-specific implementations of the Custom Source/Layer.

Usage and API documentation is mainly the same for both frameworks.

## DOCS

- Mapbox-gl: https://metoceanapi.github.io/wxtiles-mbox/docs/
- Leaflet: https://metoceanapi.github.io/wxtiles-leaflet/docs/

## Examples

1. [SimpleDemo](https://metoceanapi.github.io/wxtiles-mbox/examples/simpleDemo.html).
2. [Animated blur parameter](https://metoceanapi.github.io/wxtiles-mbox/examples/seaMaskAndAnimatedBlur.html)
3. [Mouse Interaction](https://metoceanapi.github.io/wxtiles-mbox/examples/interactive.html)

### MapBox-gl-js

```ts
(async func(){
	//// MAPBOX initialization START
	mapboxgl.accessToken = '--key--';
	const map = new mapboxgl.Map({ container: 'map', style: { version: 8, name: 'Empty', sources: {}, layers:[] } });
	map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
	await map.once('load');
	// base layer
	map.addSource('baseS', { type: 'raster', tiles: ['https://tiles.metoceanapi.com/base-lines/{z}/{x}/{y}'], maxzoom: 4 });
	map.addLayer({ id: 'baseL', type: 'raster', source: 'baseS' });
	//// MAPBOX initialization END

	//// WXTILES initialization START
	// grab the WxTiles API
	const { WxTilesLogging, WxAPI, CustomWxTilesLayer } = window.wxtilesmbox;
	// WxTilesLogging(true); // log WxTiles info to console if needed

	const dataServerURL = 'https://tiles.metoceanapi.com/data/';
	// Specify RequestInit object such as headers, mode, credentials, etc
	const requestInit = {
		/* headers: new Headers({ 'x-api-key': '--proper-key-value--' }) //*/
	};

	// Get the API ready - should be ONE per application
	const wxapi = new WxAPI({ dataServerURL, requestInit });

	// Define the dataset and variable
	const datasetName = 'gfs.global';
	// const variable = 'air.temperature.at-2m'; // Scalar example
	const variable = 'wind.speed.eastward.at-10m'; // Vector example

	// Create a dataset manager (may be used for many layers from this dataset)
	const wxdatasetManager = await wxapi.createDatasetManager(datasetName);

	// create a layer
	const wxsource = wxdatasetManager.createSourceLayer({ variable }, { id: 'wxsource', attribution: 'WxTiles' });
	map.addSource(wxsource.id, wxsource);
	await new Promise((resolve) => map.once('idle', resolve));

	//// Add wxlayer using 'native raster' layer type
	// map.addLayer({ id: 'wxlayer', type: 'raster', source: wxsource.id, paint: { 'raster-fade-duration': 0 /* necessary */ } });

	//// Add wxlayer using CustomWxTilesLayer. Implements GLSL shader for vector field animation
	map.addLayer(new CustomWxTilesLayer('wxlayer', wxsource.id), 'baseL');
})()

```

### 'Land' masking and animated blur effect

```ts
(async function step(n: number = 0) {
	await wxsource.updateCurrentStyleObject({ isolineText: false, blurRadius: ~~(10 * Math.sin(n / 500) + 10) }); // await always !!
	requestAnimationFrame(step);
})();
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

### more interactive - additional level and a bit of the red transparentness around the level made from current mouse position

```ts
await wxsource.updateCurrentStyleObject({ levels: undefined }); // reset levels if existing in the style
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
		console.log(tileInfo);
	}
	busy = false;
});
```
