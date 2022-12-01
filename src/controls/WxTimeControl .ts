import { WxTileSource } from '../index';

// // Leaflet
// const timeControl = new WxTimeControl();
// 	map.addControl(new (L.Control.extend(timeControl.extender()))({ position: 'topright' }));

// // MBox
// const timeControl = new WxTimeControl();
// map.addControl(timeControl, 'top-right');

export class WxTimeControl {
	private readonly _div: HTMLDivElement;
	private readonly button: HTMLButtonElement;
	private readonly timesEl: HTMLSelectElement;
	onchange: (time: string) => void = () => {};
	constructor(public readonly delay: number, private wxsource?: WxTileSource) {
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
		this.timesEl = document.createElement('select');
		div.appendChild(this.timesEl);
		this.timesEl.onchange = async () => {
			this.timesEl.value = (await this.wxsource?.setTime(this.timesEl.value)) || '';
			this.onchange(this.timesEl.value);
		};

		this.wxsource && this.updateSource(this.wxsource);

		this.button.innerHTML = 'Start';
		let t = 0;
		const holder = { abortController: new AbortController() };

		this.button.onclick = async () => {
			if (this.button.innerHTML === 'Start') {
				this.button.innerHTML = 'Stop'; // change button text
				const nextTimeStep = async () => {
					// recursive time steps renderer function
					if (!this.wxsource) return;
					if (this.button.innerHTML === 'Stop') {
						const nextTimeIndex = t++ % this.wxsource.wxdatasetManager.getTimes().length;
						await this.wxsource.setTime(nextTimeIndex, holder.abortController);
						setTimeout(nextTimeStep, this.delay);
					} else {
						await this.wxsource.unsetCoarseLevel();
					}

					this.timesEl.value = this.wxsource.getTime() || '';
					this.onchange(this.timesEl.value);
				};

				await this.wxsource?.setCoarseLevel(3);
				nextTimeStep();
			} else {
				holder.abortController.abort();
				holder.abortController = new AbortController(); // recreate new abort controller
				this.button.innerHTML = 'Start';
			}
		};
	}

	setTimes(times: string[]) {
		this.timesEl.options.length = 0;
		// fill this.timesEl with values from times
		for (let i = 0; i < times.length; i++) {
			const option = document.createElement('option');
			option.value = times[i];
			option.text = times[i];
			this.timesEl.appendChild(option);
		}

		this.onchange(this.timesEl.value);
	}

	updateSource(wxsource?: WxTileSource) {
		this.button.innerHTML = 'Start';
		this.wxsource = wxsource;
		this.timesEl.options.length = 0;
		const times = this.wxsource?.wxdatasetManager.getTimes() || [];
		this.setTimes(times);
		this.timesEl.value = this.wxsource?.getTime() || '';
		this.onchange(this.timesEl.value);
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
