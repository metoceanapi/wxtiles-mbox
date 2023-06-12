import { WxAPI, WxTileInfo, WxTileSource } from '../index';

// // Leaflet
// const apiControl = new WxAPIControl();
// 	map.addControl(new (L.Control.extend(apiControl.extender()))({ position: 'topright' }));

// // MBox
// const apiControl = new WxAPIControl();
// map.addControl(apiControl, 'top-right');

export class WxAPIControl {
	private readonly _div: HTMLDivElement;
	readonly datasets: HTMLSelectElement;
	readonly variables: HTMLSelectElement;
	protected _busy = false;

	onchange?: (dataset: string, variable: string, resetStyleAndFlyTo?: boolean) => Promise<void>;

	constructor(private readonly wxapi: WxAPI, dataset?: string, variable?: string) {
		const div = document.createElement('div');
		div.className = 'mapboxgl-ctrl leaflet-control';
		div.style.borderStyle = 'solid';
		div.style.borderColor = '#000';
		div.style.backgroundColor = '#aaaaaaaa';
		div.style.padding = '5px';
		div.style.display = 'flex';
		div.style.flexDirection = 'column';
		this._div = div;

		const datasetslabel = document.createElement('label');
		datasetslabel.innerText = 'Dataset';
		div.appendChild(datasetslabel);

		this.datasets = document.createElement('select');
		div.appendChild(this.datasets);
		this.fillDatasets(dataset, variable);
		this.datasets.addEventListener('change', async () => {
			if (this._busy) return;
			this.setBusy(true);
			const dataset = this.datasets.value;
			await this.fillVariables();
			const variables = this.variables.value;
			await this.onchange?.(this.datasets.value, this.variables.value);
			this.datasets.value = dataset;
			this.variables.value = variables;
			this.setBusy(false);
		});

		const variableslabel = document.createElement('label');
		variableslabel.innerText = 'Variable';
		div.appendChild(variableslabel);

		this.variables = document.createElement('select');
		div.appendChild(this.variables);
		this.variables.addEventListener('change', async () => {
			if (this._busy) return;
			this.setBusy(true);
			const variables = this.variables.value;
			await this.onchange?.(this.datasets.value, this.variables.value);
			this.variables.value = variables;
			this.setBusy(false);
		});

		this.datasets.value = dataset || '';
		this.variables.value = variable || '';
	}

	setBusy(b: boolean) {
		this._busy = b;
		this._div.style.backgroundColor = b ? 'yellow' : 'lightgray';
	}

	async fillDatasets(dataset?: string, variable?: string): Promise<void> {
		this.datasets.options.length = 0;
		(await this.wxapi.getAllDatasetsNames()).forEach((dataset) => {
			const option = document.createElement('option');
			option.value = dataset;
			option.text = dataset;
			this.datasets.appendChild(option);
		});

		dataset && (this.datasets.value = dataset);

		await this.fillVariables(variable);
	}

	async fillVariables(variable?: string): Promise<void> {
		this.variables.options.length = 0;
		const dataset = this.datasets.value;
		(await this.wxapi.getDatasetAllVariables(dataset))?.forEach((variable) => {
			const option = document.createElement('option');
			option.value = variable;
			option.text = variable;
			this.variables.appendChild(option);
		});

		variable && this.variables.options.length && (this.variables.value = variable);
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
