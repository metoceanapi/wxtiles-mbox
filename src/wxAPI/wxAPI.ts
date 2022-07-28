async function fetchJson(url: string, init?: RequestInit | undefined): Promise<any> {
	return (await fetch(url, init)).json(); // json loader helper
}

type wxDataSetsNames = Array<string>;

type wxInstances = Array<string>;

interface wxProcessed {
	[datasetName: string]: [string, string];
}

export interface VariableMeta {
	[name: string]: {
		units: string;
		min: number;
		max: number;
	};
}

export interface BoundaryMeta {
	west: number;
	north: number;
	east: number;
	south: number;
}

export interface AllBoundariesMeta {
	boundariesnorm: BoundaryMeta;
	boundaries180: BoundaryMeta[];
	boundaries360: BoundaryMeta[];
}

export interface Meta {
	variables: string[];
	variablesMeta: VariableMeta;
	maxZoom: number;
	times: string[];
	boundaries?: AllBoundariesMeta;
}

export class wxDataSet {
	name: string;
	instance: string;
	meta: Meta;
	processed: [string, string];
	wxapi: wxAPI;

	constructor({
		datasetName,
		instance,
		meta,
		processed,
		wxapi,
	}: {
		datasetName: string;
		instance: string;
		meta: Meta;
		processed: [string, string];
		wxapi: wxAPI;
	}) {
		this.name = datasetName;
		this.instance = instance;
		this.meta = meta;
		this.processed = processed;
		this.wxapi = wxapi;
	}

	/**
	 * Get closets valid time to the given time.
	 * @memberof wxDataSet
	 * @argument {number} time - either a number of a step in dataset's time array or seconds since epoch
	 * @argument {string} time - time convertable to a Date object
	 * @argument {Date} time - Date object
	 * @returns {string} - closest valid time from the dataset's time array
	 * */
	getValidTime(time: string | number | Date = Date()): string {
		if (typeof time === 'number') {
			if (time < 0) return this.meta.times[0];
			if (time < this.meta.times.length) return this.meta.times[time];
		}

		time = new Date(time).getTime();
		const { times } = this.meta;
		const found = times.find((t) => new Date(t).getTime() >= time);
		return found || times[times.length - 1];
	}

	getTimes(): string[] {
		return this.meta.times;
	}

	getVariables(): string[] {
		return this.meta.variables;
	}

	getVariableMeta(variable: string): { units: string; min: number; max: number } | undefined {
		return this.meta.variablesMeta[variable];
	}

	getMaxZoom(): number {
		return this.meta.maxZoom;
	}

	getBoundaries(): AllBoundariesMeta | undefined {
		return this.meta.boundaries;
	}

	getURI({ variableName, time, ext = 'png' }: { variableName?: string; time?: string | number | Date; ext?: string }): string {
		let url = this.wxapi.dataServerURL;
		url += this.name + '/' + this.instance + '/';
		if (!variableName || !this.meta.variablesMeta[variableName]) return url;
		url += variableName + '/' + (time ? this.getValidTime(time) : '{time}') + '/{z}/{x}/{y}.' + ext;
		return url;
	}

	async checkDatasetValid(): Promise<boolean> {
		await this.wxapi.initDone;
		if (this.wxapi.datasetsNames.includes(this.name)) throw new Error('Dataset not found:' + this.name);
		return (await this.wxapi.getDatasetInstance(this.name)) === this.instance;
	}
}

export class wxAPI {
	dataServerURL: string;
	init?: RequestInit;
	datasetsNames: wxDataSetsNames = [];
	processed: wxProcessed = {};
	initDone: Promise<void>;

	constructor(dataServerURL: string, init?: RequestInit) {
		this.dataServerURL = dataServerURL;
		this.init = init;
		let promises = Promise.all([fetchJson(dataServerURL + 'datasets.json', init), fetchJson(dataServerURL + 'processed.json', init)]);
		this.initDone = promises.then(([datasets, processed]) => {
			this.datasetsNames = datasets;
			// in 'processed.json' we need to get rid of the 'path' in dataset name
			Object.keys(processed).forEach((datasetName) => {
				this.processed[datasetName.split(':')[0]] = processed[datasetName];
			});
		});
	}

	async getDatasetInstance(datasetName: string): Promise<string> {
		let instances: wxInstances = await fetchJson(this.dataServerURL + datasetName + '/instances.json', this.init);
		return instances.reverse()[0];
	}

	async getDatasetByName(datasetName: string): Promise<wxDataSet> {
		await this.initDone;
		if (!this.datasetsNames.includes(datasetName)) throw new Error('Dataset not found:' + datasetName);
		let instance = await this.getDatasetInstance(datasetName);
		let meta: Meta = await fetchJson(this.dataServerURL + datasetName + '/' + instance + '/meta.json', this.init);
		let processed = this.processed[datasetName];
		return new wxDataSet({ datasetName, instance, meta, processed, wxapi: this });
	}

	async getAllDatasets(): Promise<wxDataSet[]> {
		await this.initDone;
		return Promise.all(this.datasetsNames.map(async (datasetName: string) => this.getDatasetByName(datasetName)));
	}

	static filterDatasetsByVariableName(datasets: wxDataSet[], variableName: string): wxDataSet[] {
		return datasets.filter((dataset) => dataset.meta.variables?.includes?.(variableName));
	}
}
