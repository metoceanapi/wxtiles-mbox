import { WXLOG } from '../utils/wxtools';
import { WxEventType, ListenerMethod } from '../wxlayer/WxImplementation';

/**
 * Framework dependent source type to be inherited by the framework dependent custom source type.
 * Mapbox does not provide a parent type for the custom source.
 * Leaflet provides a parent type for the custom layer to inherit from L.GridLayer.
 * Used as universal type for the custom source parent class. see {@link WxTileSource}
 */
export class FrameworkParentClass {
	/** MAPBOX API required */
	readonly id: string;
	/** MAPBOX API required */
	readonly type: 'custom' = 'custom';
	/** MAPBOX API required */
	readonly dataType: 'raster' = 'raster';
	/** MAPBOX API required. only 256 */
	readonly tileSize: number = 256;
	/** MAPBOX API */
	readonly maxzoom?: number;
	/** MAPBOX API */
	readonly bounds?: [number, number, number, number];
	/** MAPBOX API */
	readonly attribution?: string;

	readonly opacity?: number;

	/**
	 * @ignore
	 * evented listeners
	 * */
	protected _listeners: { [eventName: string]: ListenerMethod[] | undefined } = {};

	/**
	 * @param {FrameworkOptions} frwOptions - Framework's basic options to construct the layer.
	 */
	constructor(frwOptions: FrameworkOptions) {
		WXLOG(`FrameworkParentClass.constructor frwOptions: ${JSON.stringify(frwOptions)}`);
		this.id = frwOptions.id;
		this.maxzoom = frwOptions.maxzoom;
		this.bounds = frwOptions.bounds;
		this.attribution = frwOptions.attribution;
		this.opacity = frwOptions.opacity;
	}

	// evented methods

	/**
	 * add a listener for the event
	 * @param {string} type - event name
	 * @param {ListenerMethod} listener - listener function
	 * @returns {this}
	 * */
	on<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// push listener to the list of listeners
		(this._listeners[type] ||= []).push(listener);
	}

	/**
	 * Removes a listener for the event.
	 * @param {string} type - The event name.
	 * @param {ListenerMethod} listener - The listener function to remove.
	 * @returns {void}
	 */
	off<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// remove listener from the list of listeners
		this._listeners[type] = this._listeners[type]?.filter((l) => l !== listener);
	}

	/**
	 * Adds a listener for the event that will be executed only once.
	 * After the event is fired, the listener will be removed.
	 * @param {string} type - The event name.
	 * @param {ListenerMethod} listener - The listener function to add.
	 * @returns {void}
	 */
	once<T extends keyof WxEventType>(type: T, listener: ListenerMethod): void {
		// push listener to the list of listeners
		const onceListener = (...args: any[]) => {
			listener(...args);
			this.off(type, onceListener);
		};

		this.on(type, onceListener);
	}

	/**
	 * Fires an event of the specified type with the given data.
	 * Calls all listeners for the type asynchronously.
	 * @param {string} type - The event type.
	 * @param {any} data - The data to pass to the listeners.
	 * @returns {void}
	 */
	protected fire<T extends keyof WxEventType>(type: T, data: WxEventType[T]): void {
		// fire runs all listeners asynchroniously, so my algos don't stuck
		// call all listeners for the type
		this._listeners[type]?.forEach(async (l) => l(data));
	}
}

/**
 * Framework's basic options to construct the layer.
 * @example
 * ```ts
 *  const options = {
 * 	id: 'wxlayer',
 * 	bounds: [ -180, -90, 180, 90 ],
 * 	attribution: 'WxTiles',
 * };
 * ```
 */
export interface FrameworkOptions {
	id: string; // MAPBOX API
	maxzoom?: number; // MAPBOX API
	bounds?: [number, number, number, number]; // MAPBOX API
	attribution?: string; // MAPBOX API
	opacity?: number; // dummy
}
