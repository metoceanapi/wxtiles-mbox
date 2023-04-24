import { WxColorStyleStrict } from '../index';
import { WxGetColorSchemes, WxGetColorStyles } from '../index';
import { WxColorStyleWeak } from '../index';

// // Leaflet
// const editor = new WxStyleEditorControl();
// 	map.addControl(new (L.Control.extend(editor.extender()))({ position: 'topleft' }));

// // MBox
// const editor = new WxStyleEditorControl();
// map.addControl(editor, 'top-left');

export class WxStyleEditorControl {
	onchange?: (style: WxColorStyleWeak, nonnative?: boolean) => Promise<void>;

	editorTextAreaEl: HTMLTextAreaElement;
	editorDivEl: HTMLDivElement;

	// inputs
	parentInput: HTMLInputElement; // string

	nameInput: HTMLInputElement; // string

	fillSelect: HTMLSelectElement; // string

	isolineColorSelect: HTMLSelectElement; // string
	isolineColorInput: HTMLInputElement;

	isolineTextInput: HTMLInputElement; // boolean

	vectorTypeSelect: HTMLSelectElement; // string

	vectorColorSelect: HTMLSelectElement; // string
	vectorColorInput: HTMLInputElement; // string

	vectorFactorInput: HTMLInputElement; // number

	streamLineColorSelect: HTMLSelectElement; // string
	streamLineColorInput: HTMLInputElement; // string

	streamLineSpeedFactorInput: HTMLInputElement; // number

	streamLineStaticInput: HTMLInputElement; // boolean

	showBelowMinInput: HTMLInputElement; // boolean

	showAboveMaxInput: HTMLInputElement; // boolean

	colorSchemeSelect: HTMLSelectElement; // string

	colorsInput: HTMLInputElement; // string[];

	colorMapInput: HTMLInputElement; // [number, string][];

	levelsInput: HTMLInputElement; // number[];

	blurRadiusInput: HTMLInputElement; // number

	addDegreesInput: HTMLInputElement; // number

	unitsInput: HTMLInputElement; // string

	extraUnitsInput: HTMLInputElement; // WxUnits as { [name: string]: [string, number, ?number] };

	maskSelect: HTMLSelectElement; // string

	animationSpeed: HTMLInputElement; // number
	noiseTexturePow: HTMLInputElement; // number
	vectorFieldFactor: HTMLInputElement; // number
	animationIntensity: HTMLInputElement; // number
	wavesCount: HTMLInputElement; // number

	styleBase: WxColorStyleStrict;

	// main container
	parent: HTMLDivElement;

	constructor() {
		this.parent = document.createElement('div');
		this.parent.className = 'mapboxgl-ctrl leaflet-control'; // in case of MapBox or Leaflet

		this.parent.style.borderStyle = 'solid';
		this.parent.style.borderColor = '#000';
		this.parent.style.backgroundColor = '#aaaaaaaa';
		this.parent.style.padding = '5px';

		this.parent.onmousemove = this.parent.ondblclick = this.parent.onclick = (e) => e.stopPropagation?.(); // in case of Leaflet

		this.styleBase = WxGetColorStyles()['base'];

		// helpers
		// Top level container
		const topmostDivEl = createEl(this.parent, 'div', { onclick: onwheel, ondblclick: onwheel, onwheel, onmousedown, onmouseup });
		// Button to open/close editor
		const customStyleButtonEl = createEl(topmostDivEl, 'button', {
			id: 'customStyleButton',
			style: 'height: 1.5em; background-color: gray',
			innerText: 'Custom Style',
		});
		// Editor container
		const customStyleHiddableDivEl = createEl(topmostDivEl, 'div', {
			id: 'customStyleDiv',
			style: 'display: none; border-color: black; border-style: solid; border-width: 2px; background-color: rgba(135, 206, 250, 0.8)',
		});
		customStyleButtonEl.addEventListener('click', () => {
			if (customStyleHiddableDivEl.style.display !== 'none') {
				customStyleHiddableDivEl.style.display = 'none';
				customStyleButtonEl.innerHTML = 'show Custom Style Editor';
			} else {
				customStyleHiddableDivEl.style.display = 'flex';
				customStyleButtonEl.innerHTML = 'update Custom Style & Hide';
			}
		});

		// Text area to edit custom style
		this.editorTextAreaEl = createEl(customStyleHiddableDivEl, 'textarea', { id: 'customStyleTextArea', style: 'width: 20vw;' });
		this.editorTextAreaEl.readOnly = true;
		// this.editorTextAreaEl.addEventListener('change', () => this._onTextChange());
		// Editor container
		this.editorDivEl = createEl(customStyleHiddableDivEl, 'div'); // TODO check
		// Helpers
		const addLabel = (id: string, br: boolean = true) => {
			createEl(this.editorDivEl, 'label', { htmlFor: id, id: id + 'Label', className: id + 'LabelClass', textContent: id.replace(/Input|Select$/i, '') });
			br && createEl(this.editorDivEl, 'br', {});
		};

		const addInput = ({
			id,
			type,
			min,
			max,
			step,
			onEvent = 'change',
			br = true,
		}: {
			id: string;
			type: string;
			onEvent?: string;
			min?: string;
			max?: string;
			step?: string;
			br?: boolean;
		}): HTMLInputElement => {
			const el = createEl(this.editorDivEl, 'input', { id, className: id + 'Class', type, min, max, step });
			onEvent !== 'none' && el.addEventListener(onEvent, () => this._onDivChange());
			addLabel(id, br);
			return el;
		};

		const addSelect = ({ id, opts, onEvent = 'change', br = true }: { id: string; opts: string[]; onEvent?: string; br?: boolean }) => {
			const el = createEl(this.editorDivEl, 'select', { id, className: id + 'Class' });
			onEvent !== 'none' && el.addEventListener(onEvent, () => this._onDivChange());
			opts.forEach((name) => el.options.add(createEl(el, 'option', { value: name, text: name })));
			addLabel(id, br);
			el.selectedIndex = 0;
			return el;
		};

		const addSelectInputColor = (id: string): [HTMLSelectElement, HTMLInputElement] => {
			const select = addSelect({ id: id + 'Select', br: false, opts: ['inverted', 'fill', 'none', 'custom'] });
			const input = addInput({ id: id + 'Input', type: 'color', onEvent: 'none' });
			input.addEventListener('change', () => {
				select.value = 'custom';
				this._onDivChange();
			});
			return [select, input];
		};

		this.parentInput = addInput({ id: 'parentInput', type: 'text' });
		this.nameInput = addInput({ id: 'nameInput', type: 'text' });
		this.fillSelect = addSelect({ id: 'fillSelect', opts: ['gradient', 'solid', 'none'] });

		[this.isolineColorSelect, this.isolineColorInput] = addSelectInputColor('isolineColor');
		this.isolineTextInput = addInput({ id: 'isolineTextInput', type: 'checkbox' });

		this.vectorFactorInput = addInput({ id: 'vectorFactorInput', type: 'number', min: '0.1', max: '10', step: '0.1' });
		this.vectorTypeSelect = addSelect({ id: 'vectorTypeSelect', opts: ['arrows', 'barbs', 'none'] });
		[this.vectorColorSelect, this.vectorColorInput] = addSelectInputColor('vectorColor');
		[this.streamLineColorSelect, this.streamLineColorInput] = addSelectInputColor('streamLineColor');

		this.streamLineSpeedFactorInput = addInput({ id: 'streamLineSpeedFactorInput', type: 'range', onEvent: 'input', min: '0.1', max: '10', step: '0.1' });
		this.streamLineStaticInput = addInput({ id: 'streamLineStaticInput', type: 'checkbox' });

		this.showBelowMinInput = addInput({ id: 'showBelowMinInput', type: 'checkbox' });
		this.showAboveMaxInput = addInput({ id: 'showAboveMaxInput', type: 'checkbox' });

		this.colorSchemeSelect = addSelect({ id: 'colorSchemeSelect', opts: Object.keys(WxGetColorSchemes()), onEvent: 'none' });
		this.colorSchemeSelect.addEventListener('change', () => {
			const style = this.getStyle();
			delete style.colors;
			this._setStyleToTextArea(style);
			this.colorsInput.value = '';
			this._onDivChange();
		});

		this.colorsInput = addInput({ id: 'colorsInput', type: 'text' }); // TODO:
		this.colorMapInput = addInput({ id: 'colorMapInput', type: 'text' }); // TODO:
		this.levelsInput = addInput({ id: 'levelsInput', type: 'text' }); // TODO:

		this.blurRadiusInput = addInput({ id: 'blurRadiusInput', type: 'range', onEvent: 'input', min: '0', max: '10', step: '1' });
		this.addDegreesInput = addInput({ id: 'addDegreesInput', type: 'number', min: '0', max: '360', step: '1' });
		this.unitsInput = addInput({ id: 'unitsInput', type: 'text' });
		this.extraUnitsInput = addInput({ id: 'extraUnitsInput', type: 'text' });
		this.maskSelect = addSelect({ id: 'maskSelect', opts: ['none', 'sea', 'land'] });

		this.animationSpeed = addInput({ id: 'animationSpeed', type: 'range', onEvent: 'input', min: '0.1', max: '10', step: '0.1' });
		this.noiseTexturePow = addInput({ id: 'noiseTexturePow', type: 'range', onEvent: 'input', min: '5', max: '8', step: '1' });
		this.vectorFieldFactor = addInput({ id: 'vectorFieldFactor', type: 'range', onEvent: 'input', min: '0.1', max: '3', step: '0.1' });
		this.animationIntensity = addInput({ id: 'animationIntensity', type: 'range', onEvent: 'input', min: '0.1', max: '10', step: '0.1' });
		this.wavesCount = addInput({ id: 'wavesCount', type: 'range', onEvent: 'input', min: '2', max: '10', step: '1' });
	}

	// for Leaflet
	extender() {
		return { onAdd: () => this.onAdd(), onRemove: () => this.onRemove() };
	}

	onAdd(/* map */) {
		return this.parent;
	}

	onRemove() {
		this.parent.parentNode?.removeChild(this.parent);
	}

	getStyle(): WxColorStyleWeak {
		return this._getStyleFromDiv();
	}

	setStyle(style: WxColorStyleWeak): void {
		if (style.colorMap) {
			delete style.colors;
			delete style.levels;
		}
		this._setStyleToDiv(style);
		this._setStyleToTextArea(this._getStyleFromDiv());
	}

	protected _getStyleFromDiv(): WxColorStyleWeak {
		const objFromValue = (field: string) => {
			try {
				return this[field].value ? JSON.parse(this[field].value) : undefined;
			} catch (e) {
				console.log(field, ' : parsing error: ', e);
				return undefined;
			}
		};

		const colorFromSelectInput = (select: HTMLSelectElement, input: HTMLInputElement): string | undefined => {
			if (select.value === 'custom') {
				return input.value;
			}
			return select.value || undefined;
		};

		const style: WxColorStyleWeak = {
			parent: this.parentInput.value || undefined, // string;
			name: this.nameInput.value || undefined, //string;
			fill: (this.fillSelect.value as any) || undefined, //string;
			isolineColor: colorFromSelectInput(this.isolineColorSelect, this.isolineColorInput) as any, //string;
			isolineText: this.isolineTextInput.checked, //boolean;
			vectorType: (this.vectorTypeSelect.value as any) || undefined, //string;
			vectorColor: colorFromSelectInput(this.vectorColorSelect, this.vectorColorInput) as any, //string;
			vectorFactor: +this.vectorFactorInput.value, //number;
			streamLineColor: colorFromSelectInput(this.streamLineColorSelect, this.streamLineColorInput) as any, //string;
			streamLineSpeedFactor: +this.streamLineSpeedFactorInput.value, //number;
			streamLineStatic: this.streamLineStaticInput.checked, //boolean;
			showBelowMin: this.showBelowMinInput.checked, //boolean;
			showAboveMax: this.showAboveMaxInput.checked, //boolean;
			colorScheme: this.colorSchemeSelect.value || undefined, //string;
			colors: objFromValue('colorsInput'), // string[];
			colorMap: objFromValue('colorMapInput'), // [number, string][];
			levels: objFromValue('levelsInput'), // number[];
			blurRadius: +this.blurRadiusInput.value, //number;
			addDegrees: +this.addDegreesInput.value, //number;
			units: this.unitsInput.value || undefined, //string;
			extraUnits: objFromValue('extraUnitsInput'), // WxUnits; //{ [name: string]: [string, number, ?number] };
			mask: (this.maskSelect.value as any) || undefined, // string;
			gl: {
				animationSpeed: +this.animationSpeed.value || undefined,
				noiseTexturePow: +this.noiseTexturePow.value || undefined,
				vectorFieldFactor: +this.vectorFieldFactor.value || undefined,
				animationIntensity: +this.animationIntensity.value || undefined,
				wavesCount: +this.wavesCount.value || undefined,
			},
		};

		return style;
	}

	protected _setStyleToTextArea(style: WxColorStyleWeak): void {
		this.editorTextAreaEl.value = JSON.stringify(JSONsort(style), null, 2);
	}

	protected _setStyleToDiv(style: WxColorStyleWeak): void {
		this.parentInput.value = style.parent || ''; // string;
		this.nameInput.value = style.name || ''; //string;
		this.fillSelect.value = style.fill || ''; //string;
		this.isolineColorSelect.value = style.isolineColor?.[0] === '#' ? 'custom' : style.isolineColor || ''; //string;
		this.isolineColorInput.value = style.isolineColor?.[0] === '#' ? style.isolineColor : '#000000'; //string;
		this.isolineTextInput.checked = style.isolineText || false; //boolean;
		this.vectorTypeSelect.value = style.vectorType || ''; //string;
		this.vectorColorSelect.value = style.vectorColor?.[0] === '#' ? 'custom' : style.vectorColor || ''; //string;
		this.vectorColorInput.value = style.vectorColor?.[0] === '#' ? style.vectorColor : '#000000'; //string;
		this.vectorFactorInput.value = style.vectorFactor?.toString() || '1'; //number;
		this.streamLineColorSelect.value = style.streamLineColor?.[0] === '#' ? 'custom' : style.streamLineColor || ''; //string;
		this.streamLineColorInput.value = style.streamLineColor?.[0] === '#' ? style.streamLineColor : '#000000'; //string;
		this.streamLineSpeedFactorInput.value = style.streamLineSpeedFactor?.toString() || '1'; //number;
		this.streamLineStaticInput.checked = style.streamLineStatic || false; //boolean;
		this.showBelowMinInput.checked = style.showBelowMin || false; //boolean;
		this.showAboveMaxInput.checked = style.showAboveMax || false; //boolean;
		this.colorSchemeSelect.value = style.colorScheme || ''; //string;
		this.colorsInput.value = style.colors?.length ? JSON.stringify(style.colors) : ''; // string[];
		this.colorMapInput.value = style.colorMap?.length ? JSON.stringify(style.colorMap) : ''; // [number, string][];
		this.levelsInput.value = style.levels?.length ? JSON.stringify(style.levels.map((s) => +s.toFixed(2))) : ''; // number[];
		this.blurRadiusInput.value = style.blurRadius?.toString() || ''; //number;
		this.addDegreesInput.value = style.addDegrees?.toString() || ''; //number;
		this.unitsInput.value = style.units || ''; //string;
		this.extraUnitsInput.value = style.extraUnits ? JSON.stringify(style.extraUnits) : ''; // WxUnits; //{ [name: string]: [string, number, ?number] };
		this.maskSelect.value = style.mask || ''; // string;
		style.gl?.animationSpeed && (this.animationSpeed.value = style.gl?.animationSpeed.toString());
		style.gl?.noiseTexturePow && (this.noiseTexturePow.value = style.gl?.noiseTexturePow.toString());
		style.gl?.vectorFieldFactor && (this.vectorFieldFactor.value = style.gl?.vectorFieldFactor.toString());
		style.gl?.animationIntensity && (this.animationIntensity.value = style.gl?.animationIntensity.toString());
		style.gl?.wavesCount && (this.wavesCount.value = style.gl?.wavesCount.toString());
	}

	protected _onDivChange(): void {
		const style = this._getStyleFromDiv();
		Object.keys(style).forEach((key) => (style[key] === undefined || style[key] === '' || !style[key].length) && delete style[key]);
		// update text area
		this._setStyleToTextArea(style);
		// call callback
		this.onchange?.(this.getStyle());
	}
}

function createEl<K extends keyof HTMLElementTagNameMap>(container: HTMLElement, tag: K, params?: any): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	Object.assign(el, params);
	container?.appendChild(el);
	return el;
}

function JSONsort(o: any) {
	if (Array.isArray(o)) {
		return o.map(JSONsort);
	} else if (typeof o === 'object' && o !== null) {
		const keys = Object.keys(o)
			// .map((a) => a.toUpperCase())
			.sort((a, b) => {
				const aa = a.toUpperCase();
				const bb = b.toUpperCase();
				return aa == bb ? 0 : aa > bb ? 1 : -1;
			});
		return keys.reduce((a, k) => {
			a[k] = JSONsort(o[k]);
			return a;
		}, {});
	}
	return o;
}
