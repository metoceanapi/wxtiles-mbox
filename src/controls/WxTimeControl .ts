import { WxCreateLegend, WxTileInfo, WxTileSource, type WxColorStyleStrict } from '../index';

// // Leaflet
// const timeControl = new WxTimeControl();
// 	map.addControl(new (L.Control.extend(timeControl.extender()))({ position: 'topright' }));

// // MBox
// const timeControl = new WxTimeControl();
// map.addControl(timeControl, 'top-right');

export class WxTimeControl {
	private readonly _div: HTMLDivElement;
	private readonly button: HTMLButtonElement;
	private readonly times: HTMLSelectElement;
	onchange: (time: string) => void = () => {};
	constructor(private readonly delay: number, private wxsource?: WxTileSource) {
		const div = document.createElement('div');
		div.className = 'mapboxgl-ctrl leaflet-control';
		div.style.borderStyle = 'solid';
		div.style.borderColor = '#000';
		div.style.backgroundColor = '#aaaaaaaa';
		div.style.padding = '5px';
		div.style.display = 'flex';
		div.style.flexDirection = 'column';
		this._div = div;
		div.innerText = 'Time animation';
		this.button = document.createElement('button');
		div.appendChild(this.button);
		this.times = document.createElement('select');
		div.appendChild(this.times);
		this.times.onchange = async () => {
			this.times.value = (await this.wxsource?.setTime(this.times.value)) || '';
			this.onchange(this.times.value);
		};

		this.wxsource && this.updateSource(this.wxsource);

		this.button.innerHTML = 'Start';
		let t = 0;
		let abortController: AbortController;

		this.button.onclick = () => {
			if (this.button.innerHTML === 'Start') {
				this.button.innerHTML = 'Stop';
				abortController = new AbortController();
				const nextTimeStep = async () => {
					await this.wxsource?.setTime(t++ % this.wxsource.wxdatasetManager.getTimes().length, abortController); // await always !!
					this.times.value = this.wxsource?.getTime() || '';
					this.onchange(this.times.value);
					this.button.innerHTML === 'Stop' && setTimeout(nextTimeStep, this.delay);
				};
				nextTimeStep();
			} else {
				this.button.innerHTML = 'Start';
				abortController.abort();
			}
		};
	}

	setTimes(times: string[]) {
		this.times.options.length = 0;
		// fill this.times with values from times
		for (let i = 0; i < times.length; i++) {
			const option = document.createElement('option');
			option.value = times[i];
			option.text = times[i];
			this.times.appendChild(option);
		}

		this.onchange(this.times.value);
	}

	updateSource(wxsource: WxTileSource) {
		this.button.innerHTML = 'Start';
		this.wxsource = wxsource;
		this.times.options.length = 0;
		const times = this.wxsource?.wxdatasetManager.getTimes() || [];
		this.setTimes(times);
		this.times.value = this.wxsource.getTime();
	}

	onAdd(/* map */) {
		return this._div;
	}

	onRemove() {
		this._div.parentNode?.removeChild(this._div);
	}

	// for Leaflet
	extender() {
		return { onAdd: () => this.onAdd(), onRemove: () => this.onRemove() };
	}
}