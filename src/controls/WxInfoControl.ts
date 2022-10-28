import { WxTileInfo, WxTileSource } from '../index';

// // Leaflet
// const infoControl = new WxInfoControl();
// 	map.addControl(new (L.Control.extend(infoControl.extender()))({ position: 'topright' }));

// // MBox
// const infoControl = new WxInfoControl();
// map.addControl(infoControl, 'top-right');

export class WxInfoControl {
	private readonly _div: HTMLDivElement;
	constructor() {
		const div = document.createElement('div');
		div.className = 'mapboxgl-ctrl leaflet-control';
		div.style.borderStyle = 'solid';
		div.style.borderColor = '#000';
		div.style.backgroundColor = '#aaaaaaaa';
		div.style.padding = '5px';
		this._div = div;
	}

	onAdd(/* map */) {
		return this._div;
	}

	onRemove() {
		this._div.parentNode?.removeChild(this._div);
	}

	update(wxsource: WxTileSource, map: any, pos: { lng: number; lat: number }) {
		const tileInfo: WxTileInfo | undefined = wxsource.getLayerInfoAtLatLon(pos, map);
		if (tileInfo) {
			const { min, max } = wxsource.getMetadata();
			this._div.innerHTML = `lnglat=(${pos.lng.toFixed(2)}, ${pos.lat.toFixed(2)})<br>
			dataset=${wxsource.wxdatasetManager.datasetName}<br>
			variables=${wxsource.getVariables()}<br>
			style=${tileInfo.inStyleUnits.map((d) => d.toFixed(2))} ${tileInfo.styleUnits}<br>
			source=${tileInfo.data.map((d) => d.toFixed(2))} ${tileInfo.dataUnits}<br>
			min=${min.toFixed(2)} ${tileInfo.dataUnits}, max=${max.toFixed(2)} ${tileInfo.dataUnits}<br>
			time=${wxsource.getTime()}`;
		} else {
			this._div.innerHTML = `lnglat=(${pos.lng.toFixed(2)}, ${pos.lat.toFixed(2)})<br>
			dataset=${wxsource.wxdatasetManager.datasetName}<br>
			variables=${wxsource.getVariables()}<br>
			style=outside<br>
			source=outside<br>
			min=outside, max=outside<br>
			time=${wxsource.getTime()}`;
		}
	}
	// for Leaflet
	extender() {
		return { onAdd: () => this.onAdd(), onRemove: () => this.onRemove() };
	}
}
