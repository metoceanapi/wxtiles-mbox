// https://github.com/maeneak/mapbox-texture-layer - real example
// https://gist.github.com/karantza/15d67e3add6f5e1418a3eeb2be0a6efb - attempt to use shaders in map box

const { WxTileLayer } = window.wxtilembox;

mapboxgl.accessToken = 'pk.eyJ1IjoiY3JpdGljYWxtYXNzIiwiYSI6ImNqaGRocXd5ZDBtY2EzNmxubTdqOTBqZmIifQ.Q7V0ONfxEhAdVNmOVlftPQ';

const mapEl = document.getElementById('map');
if (!mapEl) throw '!mapEl';

const map = new mapboxgl.Map({ container: mapEl, style: { version: 8, name: 'Empty', sources: {}, layers: [] }, center: [0, 0], zoom: 0 });
map.showTileBoundaries = true;

map.on('load', async () => {
	try {
		// get a workable URI (could be hardcoded, but tiles-DB is alive!)
		const fetchJson = async (url) => (await fetch(url)).json(); // json loader helper
		const dataServer = 'https://tiles.metoceanapi.com/demo/data/';
		const dataSet = 'ecwmf.global/'; /* 'obs-radar.rain.nzl.national/' */
		const variable = 'air.humidity.at-2m/'; /* 'reflectivity/' */
		const instance = (await fetchJson(dataServer + dataSet + 'instances.json')).reverse()[0] + '/';
		const { times } = await fetchJson(dataServer + dataSet + instance + 'meta.json');
		const time = times.find((t) => new Date(t).getTime() >= Date.now()) || times[times.length - 1];
		// URI could be hardcoded, but tiles-DB is alive!
		const URI = dataServer + dataSet + instance + variable + time + '/{z}/{x}/{y}.png';

		// TODO: No-data pixels should be transparent
		// TODO: setTime()
		// TODO: vector data sources
		// TODO: isoline text labels
		// DEMO
		map.addLayer(new WxTileLayer('wxlayerID', URI));
	} catch (e) {
		console.log(e);
	}
});
