import './wxtiles.css';

import { __colorSchemes_default_preset } from '../defaults/colorschemes';
import { __colorStyles_default_preset } from '../defaults/styles';
import { __units_default_preset } from '../defaults/uconv';
import { fetchJson, loadImageData, cacheUriPromise, uriXYZ, XYZ, WxTilesLibOptions, WxTilesLibSetup } from '../utils/wxtools';
import { QTree } from '../utils/qtree';

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

	getBoundaries(): [number, number, number, number] | undefined {
		const b180a = this.meta.boundaries?.boundaries180;
		if (!(b180a?.length === 1)) return; // TODO can's make lon = [170 to 190] as mapBox uses -180 to 180, so need to check for that in loader
		const b180 = b180a[0]; // else let mapbox manage boundaries
		return [b180.west, b180.south, b180.east, b180.north];
	}

	getURI({ variable, time, ext = 'png' }: { variable: string; time?: string | number | Date; ext?: string }): string {
		if (!this.meta.variablesMeta?.[variable]) throw new Error(`in dataset ${this.name} variable ${variable} not found`);
		time = time !== undefined ? this.getValidTime(time) : '{time}';
		return `${this.wxapi.dataServerURL + this.name}/${this.instance}/${variable}/${time}/{z}/{x}/{y}.${ext}`;
	}

	checkVariableValid(variable: string): boolean {
		return this.meta.variablesMeta?.[variable] !== undefined;
	}

	async checkDatasetValid(): Promise<boolean> {
		await this.wxapi.initDone;
		if (!this.wxapi.datasetsNames.includes(this.name)) throw new Error(`Dataset ${this.name} not found`);
		return (await this.wxapi.getDatasetInstance(this.name)) === this.instance;
	}
}

export interface wxAPIOptions extends WxTilesLibOptions {
	dataServerURL: string;
	maskURL?: 'none' | 'auto' | string;
	qtreeURL?: 'none' | 'auto' | string;
	requestInit?: RequestInit;
}

export class wxAPI {
	readonly dataServerURL: string;
	readonly maskURL?: string;
	readonly requestInit?: RequestInit;
	readonly datasetsNames: wxDataSetsNames = [];
	readonly processed: wxProcessed = {};
	readonly initDone: Promise<void>;
	readonly loadMaskFunc: ({ x, y, z }: XYZ) => Promise<ImageData>;
	readonly qtree: QTree = new QTree();

	constructor({ dataServerURL, maskURL = 'auto', qtreeURL = 'auto', requestInit, colorStyles, units, colorSchemes }: wxAPIOptions) {
		WxTilesLibSetup({ colorStyles, units, colorSchemes });

		this.dataServerURL = dataServerURL;
		maskURL = maskURL === 'auto' ? dataServerURL + 'mask/' : maskURL;
		this.maskURL = maskURL;
		qtreeURL = qtreeURL === 'auto' ? dataServerURL + 'seamask.qtree' : qtreeURL;
		this.requestInit = requestInit;

		const maskloader = cacheUriPromise(loadImageData);
		this.loadMaskFunc =
			maskURL !== 'none'
				? async (coord: XYZ) => {
						try {
							return await maskloader(uriXYZ(maskURL, coord), requestInit);
						} catch (e) {
							throw new Error(`loading mask failure  message: ${e.message} maskURL: ${maskURL}`);
						}
				  }
				: () => Promise.reject(new Error('maskURL not defined'));

		this.initDone = Promise.all([
			fetchJson<string[]>(dataServerURL + 'datasets.json', requestInit),
			fetchJson<wxProcessed>(dataServerURL + 'processed.json', requestInit),
			qtreeURL !== 'none' ? this.qtree.load(qtreeURL, requestInit) : Promise.resolve(),
		]).then(([datasets, processed, _]): void => {
			this.datasetsNames.push(...datasets);
			// in 'processed.json' we need to get rid of the 'path' after datasets names
			Object.keys(processed).forEach((datasetName): void => {
				this.processed[datasetName.split(':')[0]] = processed[datasetName];
			});
		});
	}

	async getDatasetInstance(datasetName: string): Promise<string> {
		try {
			const instances = await fetchJson<wxInstances>(this.dataServerURL + datasetName + '/instances.json', this.requestInit);
			if (instances.length === 0) throw new Error(`No instances found for dataset ${datasetName}`);
			return instances[instances.length - 1];
		} catch (e) {
			throw new Error(`getting dataset instances failure  message: ${e.message} datasetName: ${datasetName}`);
		}
	}

	async createDatasetManager(datasetName: string): Promise<wxDataSet> {
		await this.initDone;
		if (!this.datasetsNames.includes(datasetName)) throw new Error('Dataset not found:' + datasetName);
		const instance = await this.getDatasetInstance(datasetName);
		const meta = await fetchJson<Meta>(this.dataServerURL + datasetName + '/' + instance + '/meta.json', this.requestInit);
		const processed = this.processed[datasetName];
		return new wxDataSet({ datasetName, instance, meta, processed, wxapi: this });
	}

	async createAllDatasets(): Promise<wxDataSet[]> {
		await this.initDone;
		return Promise.all(this.datasetsNames.map((datasetName: string) => this.createDatasetManager(datasetName)));
	}

	static filterDatasetsByVariableName(datasets: wxDataSet[], variableName: string): wxDataSet[] {
		return datasets.filter((dataset) => dataset.meta.variables?.includes?.(variableName));
	}
}