import { WxTileSource, WxAPI, WxTilesLogging, type WxTileInfo, FrameworkOptions, WxGetColorStyles, WXLOG, WxColorStyleWeak } from '../src/index';
import { WxLegendControl } from '../src/controls/WxLegendControl';
import { WxStyleEditorControl } from '../src/controls/WxStyleEditorControl';
import { WxInfoControl } from '../src/controls/WxInfoControl';
import { WxTimeControl } from '../src/controls/WxTimeControl ';
import { WxAPIControl } from '../src/controls/WxAPIControl';
import { initFrameWork, addRaster, flyTo, setURL, addControl, removeLayer, addLayer, position } from './frwrkdeps';

const OPACITY = 0.8;

// this is universal function for Leaflet and Mapbox.
// Functions below are just framework specific wrappers for this universal function
// start() is the fully interchangable function for Leaflet and Mapbox
export async function start() {
	const map = await initFrameWork();
	addRaster(map, 'baseS', 'baseL', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 3);
	// addRaster(map, 'baseS', 'baseL', 'https://tiles.metoceanapi.com/base-lines/{z}/{x}/{y}', 5);
	// WxTilesLogging(console.trace);
	// const dataServerURL = 'data/'; // different sources manged in 'start' script in package.json
	// const dataServerURL = 'https://tilestest.metoceanapi.com/data/';
	// const dataServerURL = 'http://localhost:9191/data/';
	// const dataServerURL = 'https://68.171.214.87/data/'; // hihi1
	// const dataServerURL = 'https://68.171.214.81/data/'; // hihi2
	// const dataServerURL = 'https://hihi2.metoceanapi.com/data/';
	const dataServerURL = 'https://tilesdev.metoceanapi.com/data/';
	const myHeaders = new Headers();
	// myHeaders.append('x-api-key', 'SpV3J1RypVrv2qkcJE91gG');
	const wxapi = new WxAPI({
		dataServerURL,
		maskURL: 'auto',
		maskChannel: 'R',
		qtreeURL: 'auto',
		requestInit: { headers: myHeaders },
	});

	// let datasetName = 'ecmwf.global'; /* 'mercator.global/';  */ /* 'gfs.global/'; */ /* 'obs-radar.rain.nzl.national/'; */
	// let variable = 'cloud.cover';
	// let variable = 'air.temperature.at-2m';
	// let variable = 'wind.speed.eastward.at-10m';
	// let variable = 'wave.direction.peak';

	// let datasetName = 'ww3-ecmwf.global';
	// let variable = 'wave.direction.mean';

	let datasetName = 'obs-radar.rain.nzl.national';
	let variable = 'reflectivity';

	// let datasetName = 'him8_truecolor';
	// let variable = 'h8_rgb';

	// get datasetName from URL
	const urlParams = window.location.toString().split('##')[1];
	const params = urlParams?.split('/');
	datasetName = params?.[0] || datasetName;
	if (params?.[1]) variable = params[1];
	let time = params?.[2] || '';
	const zoom = (params && parseFloat(params[3])) || 0;
	const lng = (params && parseFloat(params[4])) || 0;
	const lat = (params && parseFloat(params[5])) || 0;
	const bearing = (params && parseFloat(params[6])) || 0;
	const pitch = (params && parseFloat(params[7])) || 0;
	if (params?.length > 8) params[8] = params.slice(8).join('/');

	const str = params?.[8] && params[8];
	const sth = { style: {} as WxColorStyleWeak };
	try {
		// get style from URL
		sth.style = str && { ...JSON.parse(decodeURI(str)) }; // reset levels if change units
	} catch (e) {
		/* ignore errors silently */
		console.log("Can't parse style from URL");
	}

	params && flyTo(map, zoom, lng, lat, bearing, pitch); // if no params stay at default position set in initFrameWork()

	map.on('zoom', () => setURL(map, time, datasetName, variable, sth.style));
	map.on('drag', () => setURL(map, time, datasetName, variable, sth.style));
	map.on('rotate', () => setURL(map, time, datasetName, variable, sth.style));
	map.on('pitch', () => setURL(map, time, datasetName, variable, sth.style));

	let wxsourceLayer: WxTileSource | undefined;

	const legendControl = new WxLegendControl();
	addControl(map, legendControl, 'top-right');

	const frameworkOptions = { id: 'wxsource', opacity: OPACITY, attribution: '<a href="https://metoceanapi.github.io/wxtiles-mbox/docs">WxTiles DOCS</a>' };
	const apiControl = new WxAPIControl(wxapi, datasetName, variable);
	addControl(map, apiControl, 'top-left');
	apiControl.onchange = async (_datasetName, _variable, resetStyleAndFlyTo = true): Promise<void> => {
		datasetName = _datasetName;
		variable = _variable;
		WXLOG('apiControl.onchange datasetName=', datasetName, 'variable=', variable);
		// remove existing source and layer
		removeLayer(map, frameworkOptions.id, wxsourceLayer);
		//
		resetStyleAndFlyTo && (sth.style = {}); // reset style if change dataset/variable
		wxsourceLayer = undefined;
		const wxdatasetManager = await wxapi.createDatasetManager(datasetName);
		const boundaries = wxdatasetManager.getBoundaries();
		if (boundaries && resetStyleAndFlyTo) {
			const { east, west, north, south } = boundaries.boundariesnorm;
			const zoom = Math.round(Math.log((360 * 360) / Math.max((east - west + 360) % 360, north - south) / 360) / Math.LN2); // from https://stackoverflow.com/questions/6048975/google-maps-v3-how-to-calculate-the-zoom-level-for-a-given-bounds
			flyTo(map, zoom, (east + west) / 2, (north + south) / 2, 0, 0);
		}
		const meta = wxdatasetManager.getVariableCurrentMeta(variable);
		if (meta?.units === 'RGB') {
			const times = wxdatasetManager.getAllTimes();

			addRaster(
				map,
				frameworkOptions.id,
				'wxtiles',
				wxdatasetManager.createURI(variable, times[0]),
				wxdatasetManager.getMaxZoom(),
				wxdatasetManager.getBoundaries()?.boundariesnorm
			);

			timeControl.setTimes(times);
			legendControl.clear();
		} else {
			wxsourceLayer = wxdatasetManager.createSourceLayer({ variable, time, wxstyle: sth.style }, frameworkOptions);
			wxsourceLayer.setCoarseLevel(0);
			await addLayer(map, 'wxtiles', wxsourceLayer);
			// wxsource.startAnimation();
			const styleCopy = wxsourceLayer.getCurrentStyleObjectCopy();
			legendControl.drawLegend(styleCopy); // first draw legend with current style
			styleCopy.levels = sth.style?.levels; // no need to show defaults it in the editor and URL
			styleCopy.colors = sth.style?.colors; // no need to show defaults it in the editor and URL
			await customStyleEditorControl.onchange?.(styleCopy, true);
			timeControl.updateSource(wxsourceLayer);
		}
		// apiControl.datasets.value = datasetName;
		// apiControl.variables.value = variable;
	};

	const timeControl = new WxTimeControl(50);
	addControl(map, timeControl, 'top-left');
	timeControl.onchange = (time_) => {
		setURL(map, (time = time_), datasetName, variable, sth.style);
		infoControl.update(wxsourceLayer, map);
	};

	const customStyleEditorControl = new WxStyleEditorControl();
	addControl(map, customStyleEditorControl, 'top-right');
	customStyleEditorControl.onchange = async (style, nonnativecall) => {
		WXLOG('customStyleEditorControl.onchange');
		if (!wxsourceLayer) return;
		nonnativecall || (await wxsourceLayer.updateCurrentStyleObject(style)); // if called manually, do not update wxsource's style
		const nstyle = wxsourceLayer.getCurrentStyleObjectCopy();
		legendControl.drawLegend(nstyle);
		nstyle.levels = style?.levels; // keep levels empty if they are not defined
		nstyle.colors = style?.colors; // keep colors empty if they are not defined
		customStyleEditorControl.setStyle(nstyle); // if called from wxsource, update customStyleEditorControl
		sth.style = nstyle;
		setURL(map, time, datasetName, variable, sth.style);
	};

	const infoControl = new WxInfoControl();
	addControl(map, infoControl, 'bottom-left');
	map.on('mousemove', (e) => infoControl.update(wxsourceLayer, map, position(e)));

	await apiControl.onchange(datasetName, variable, false); // initial load

	/*/ DEMO: more interactive - additional level and a bit of the red transparentness around the level made from current mouse position
	if (wxsource) {
		let busy = false;
		await wxsource.updateCurrentStyleObject({ levels: undefined }); // await always !!
		const levels = wxsource.getCurrentStyleObjectCopy().levels || []; // get current/default/any levels
		const colMap: [number, string][] = levels.map((level) => [level, '#' + Math.random().toString(16).slice(2, 8) + 'ff']);
		map.on('mousemove', async (e) => {
			if (!wxsource || busy) return;
			busy = true;
			const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(position(e), map);
			if (tileInfo) {
				await customStyleEditorControl.onchange?.({ colorMap: [...colMap, [tileInfo.inStyleUnits[0], '#ff000000']] }); // await always !!
			}
			busy = false;
		});
	} //*/

	/*/ DEMO: abort
	if (wxsource) {
		const abortController = new AbortController();
		console.log('setTime(5)');
		const prom = wxsource.setTime(5, abortController);
		abortController.abort(); // aborts the request
		await prom; // await always !! even if aborted
		console.log('aborted');
		await wxsource.setTime(5); // no abort
		console.log('setTime(5) done'); 
	}//*/

	/*/ DEMO: preload a timestep
	map.once('click', async () => {
		if (!wxsource) return;
		console.log('no preload time=5');
		const t = Date.now();
		await wxsource.setTime(5); // await always !! or abort
		console.log(Date.now() - t);
		await wxsource.preloadTime(10); // await always !! even if aborted
		await wxsource.preloadTime(20); // await always !! even if aborted
		console.log('preloaded timesteps 10, 20');
		map.once('click', async () => {
			if (!wxsource) return;
			const t = Date.now();
			await wxsource.setTime(10); // await always !! or abort
			console.log(Date.now() - t, ' step 10');
			map.once('click', async () => {
				if (!wxsource) return;
				const t = Date.now();
				await wxsource.setTime(20); // await always !! or abort
				console.log(Date.now() - t, ' step 20');
			});
		});
	}); //*/

	/*/ DEMO: change style's units
	let i = 0;
	map.on('click', async () => {
		if (!wxsource) return;
		const u = ['knots', 'm/s', 'km/h', 'miles/h'];
		await wxsource.updateCurrentStyleObject({ units: u[i], levels: undefined }); // levels: undefined - to recalculate levels
		legendControl.drawLegend(wxsource.getCurrentStyleObjectCopy());
		i = (i + 1) % u.length;
	}); //*/

	/*/ DEMO : read lon lat data
	map.on('mousemove', (e) => {
		if (!wxsource) return;
		const pos = position(e); //
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos.wrap(), map);
		if (tileInfo) {
			console.log(tileInfo);
		}
	}); //*/

	/*/ DEMO: timesteps
	let t = 0;
	const nextTimeStep = async () => {
		if (!wxsource) return;
		await wxsource.setTime(t++ % wxsource.wxdatasetManager.getTimes().length); // await always !!
		setTimeout(nextTimeStep, 0);
	};
	setTimeout(nextTimeStep, 2000);
	//*/

	/*/ DEMO: Dynamic blur effect /
	wxsource &&
		(async function step(n: number = 0) {
			await wxsource.updateCurrentStyleObject({ isolineText: false, blurRadius: ~~(10 * Math.sin(n / 500) + 10) }); // await always !!
			requestAnimationFrame(step);
		})();
		//*/
}
