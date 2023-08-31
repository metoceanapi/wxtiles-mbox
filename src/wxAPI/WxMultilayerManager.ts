import { WxDate, WxRequestInit } from '../wxlayer/wxlayer';
import { WxTileSource } from '../wxsource/wxsource';

/**
 * WxMultilayerManager manages multiple WxTileSource and provides methods to set time and preload tiles for all sources.
 * @example
 * ```ts
 *	// Get the API ready - should be ONE per application
 *	const wxapi = new WxAPI({ dataServerURL, maskURL: 'none', qtreeURL: 'none' });
 *
 *	const wxdatasetManager = await wxapi.createDatasetManager('gfs.global');
 *
 *	const layerManager = new WxMultilayerManager();
 *
 *	const layer1 = wxdatasetManager.createSourceLayer({ variable: 'air.visibility' }, { id: 'wxsource1', opacity: 1.0 });
 *	layerManager.addSource(layer1);
 *	await addWxLayer(layer1);
 *
 *	const layer2 = wxdatasetManager.createSourceLayer({ variable: 'air.humidity.at-2m' }, { id: 'wxsource2', opacity: 0.7 });
 *	layerManager.addSource(layer2);
 *	await addWxLayer(layer2);
 *
 *	const times = layer1.getAllTimes().slice(0, 10);
 *	await layerManager.preloadTimes(times);
 *
 *	let t = 0;
 *	const nextTimeStep = async () => {
 *		await layerManager.setTime(t++ % times.length); // await always !!
 *		setTimeout(nextTimeStep, 0);
 *	};
 *
 *	setTimeout(nextTimeStep);
 * ```
 */
export class WxMultilayerManager {
	protected readonly _sources: Map<string, WxTileSource> = new Map();

	/**
	 * Creates an instance of WxMultilayerManager.
	 * @param sources An array of WxTileSource objects to add to the manager.
	 */
	constructor(sources: WxTileSource[] = []) {
		for (const source of sources) this.addSource(source);
	}

	/**
	 * Sets the time for all sources in the multilayer manager.
	 * @param time The time to set.
	 * @param requestInit Optional request options.
	 * @returns A Promise that resolves when all sources have set their time and redrawn their tiles.
	 */
	async setTime(time: WxDate, requestInit?: WxRequestInit): Promise<void> {
		const sources = Array.from(this._sources.values());
		await Promise.all(sources.map((source) => source.setTime(time, requestInit, false)));
		await Promise.all(sources.map((source) => source._redrawTiles()));
	}

	/**
	 * Preloads data for a specific time across all sources.
	 * @param time The time to preload data for.
	 * @param requestInit Optional request options to pass to the underlying fetch requests.
	 * @returns A Promise that resolves when all data has been preloaded.
	 */
	async preloadTime(time: WxDate, requestInit?: WxRequestInit): Promise<void> {
		const sources = Array.from(this._sources.values());
		await Promise.all(sources.map((source) => source.preloadTime(time, requestInit)));
	}

	/**
	 * Preloads the specified times for all sources.
	 * @param times - The array of WxDate objects to preload.
	 * @param requestInit - Optional request options to pass to the preloadTime method of each source.
	 * @returns A Promise that resolves when all preloading is complete.
	 */
	async preloadTimes(times: WxDate[], requestInit?: WxRequestInit): Promise<void> {
		const sources = Array.from(this._sources.values());
		for (const time of times) {
			if (requestInit?.signal?.aborted) return;
			await Promise.all(sources.map((source) => source.preloadTime(time, requestInit)));
		}
	}

	/**
	 * Preloads the specified times for all sources using alternative method with rasterizing tiles but not put on screen. 
	 * May be faster but may cause some artifacts if USER drags the map during preloading.
	 * @param times - The array of WxDate objects representing the times to preload.
	 * @param requestInit - Optional WxRequestInit object to configure the request.
	 * @returns A Promise that resolves when all the renders have been preloaded.
	 */
	async preloadTimesRasterize(times: WxDate[], requestInit?: WxRequestInit): Promise<void> {
		const sources = Array.from(this._sources.values());
		for (const time of times) {
			if (requestInit?.signal?.aborted) return;
			await Promise.all(sources.map((source) => source.setTime(time, requestInit, false)));
		}
	}

	/**
	 * Adds a new tile source to the multilayer manager.
	 * @param source - The tile source to add.
	 */
	addSource(source: WxTileSource): void {
		this._sources.set(source.id, source);
	}

	/**
	 * Removes a WxTileSource from the manager.
	 * @param source - The WxTileSource or its ID to remove.
	 */
	removeSource(source: WxTileSource | string): void {
		if (typeof source === 'string') this._sources.delete(source);
		else this._sources.delete(source.id);
	}

	/**
	 * Removes all sources from the multilayer manager.
	 */
	clear(): void {
		this._sources.clear();
	}
}
