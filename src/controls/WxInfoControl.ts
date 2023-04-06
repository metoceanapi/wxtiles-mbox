import { WxTileInfo, WxTileSource } from '../index';

// // Leaflet
// const infoControl = new WxInfoControl();
// 	map.addControl(new (L.Control.extend(infoControl.extender()))({ position: 'topright' }));

// // MBox
// const infoControl = new WxInfoControl();
// map.addControl(infoControl, 'top-right');

export class WxInfoControl {
	private readonly div: HTMLDivElement;
	private pos: { lng: number; lat: number } = { lng: 0, lat: 0 };
	constructor() {
		const div = document.createElement('div');
		div.className = 'mapboxgl-ctrl leaflet-control';
		div.style.borderStyle = 'solid';
		div.style.borderColor = '#000';
		div.style.backgroundColor = '#aaaaaaaa';
		div.style.padding = '5px';
		this.div = div;
	}

	onAdd(/* map */) {
		return this.div;
	}

	onRemove() {
		this.div.parentNode?.removeChild(this.div);
	}

	update(wxsource: WxTileSource | undefined, map: any, pos_?: { lng: number; lat: number }) {
		if (pos_) this.pos = pos_;
		if (!wxsource) {
			this.div.innerHTML = '';
			return;
		}

		const { min, max, units } = wxsource.getCurrentVariableMeta();
		const { datasetName } = wxsource.wxdatasetManager;
		const datasetCurrentMeta = wxsource.wxdatasetManager.getInstanceMeta(wxsource.getTime());
		const { sourceID, baseAtmosphericModel, model } = datasetCurrentMeta;
		this.div.innerHTML = `lnglat=(${this.pos.lng.toFixed(2)}, ${this.pos.lat.toFixed(2)})<br>`;
		this.div.innerHTML += (sourceID && `sourceID=${sourceID}<br>`) || '';
		this.div.innerHTML += (baseAtmosphericModel && `baseAtmosphericModel=${baseAtmosphericModel}<br>`) || '';
		this.div.innerHTML += (model && `model=${model}<br>`) || '';
		this.div.innerHTML += `dataset=${datasetName}<br>
		variables=${wxsource.getVariables()}<br>
		time=${wxsource.getTime()}<br>
		min=${min.toFixed(2)} ${units}, max=${max.toFixed(2)} ${units}<br>`;
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(this.pos, map);
		if (tileInfo) {
			this.div.innerHTML += `style=${tileInfo.inStyleUnits.map((d) => d.toFixed(2))} ${tileInfo.styleUnits}<br>
			source=${tileInfo.data.map((d) => d.toFixed(2))} ${tileInfo.dataUnits}<br>`;
		} else {
			this.div.innerHTML += `style=outside<br>source=outside<br>`;
		}
	}
	// for Leaflet
	extender() {
		return { onAdd: () => this.onAdd(), onRemove: () => this.onRemove() };
	}
}
