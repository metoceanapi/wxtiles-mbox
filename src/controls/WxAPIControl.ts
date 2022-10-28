import { WxAPI, WxTileInfo, WxTileSource } from '../index';

// // Leaflet
// const apiControl = new WxAPIControl();
// 	map.addControl(new (L.Control.extend(apiControl.extender()))({ position: 'topright' }));

// // MBox
// const apiControl = new WxAPIControl();
// map.addControl(apiControl, 'top-right');

export class WxAPIControl {
	private readonly _div: HTMLDivElement;
	private readonly datasets: HTMLSelectElement;
	private readonly variables: HTMLSelectElement;

	onchange?: (dataset: string, variable: string) => Promise<void>;

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
			await this.fillVariables();
			await this.onchange?.(this.datasets.value, this.variables.value);
		});

		const variableslabel = document.createElement('label');
		variableslabel.innerText = 'Variable';
		div.appendChild(variableslabel);

		this.variables = document.createElement('select');
		div.appendChild(this.variables);
		this.variables.addEventListener('change', () => {
			this.onchange?.(this.datasets.value, this.variables.value);
		});

		this.datasets.value = dataset || '';
		this.variables.value = variable || '';
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
		(await this.wxapi.getDatasetVariables(dataset)).forEach((variable) => {
			const option = document.createElement('option');
			option.value = variable;
			option.text = variable;
			this.variables.appendChild(option);
		});

		variable && (this.variables.value = variable);
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
