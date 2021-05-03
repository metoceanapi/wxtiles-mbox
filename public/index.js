// https://github.com/maeneak/mapbox-texture-layer - real example
// https://gist.github.com/karantza/15d67e3add6f5e1418a3eeb2be0a6efb - attempt to use shaders in map box
const mapboxgl = window.mapboxgl;
const { WxTileLayer } = window.wxtilembox;

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

const map = new mapboxgl.Map({
	container: document.getElementById('map'),
	style: {
		version: 8,
		name: 'Empty',
		metadata: { 'mapbox:autocomposite': true },
		sources: {},
		layers: [],
	},
	center: [0, 0],
	zoom: 2,
});

map.on('load', () => {
	let customlayer = new WxTileLayer('wxlayerID');
	map.addLayer(customlayer);
});
