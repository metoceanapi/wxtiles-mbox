import { loadTexture, createCLUT, loadImage } from './textures';

import vsSource from './shaders/wxlayer.vs';
import fsSource from './shaders/wxlayer.fs';

// const mapboxgl = window.mapboxgl;
import mapboxgl from 'mapbox-gl';

interface MapEx extends mapboxgl.Map {
	style: any;
	painter: any;
}
export class WxTileLayer implements mapboxgl.CustomLayerInterface {
	id: string;
	sourceID: string;
	type: 'custom' = 'custom';
	renderingMode: '2d' = '2d';

	URI: string;

	map!: MapEx;
	layerProgram!: LayerProgram;

	// durty hacks
	sourceCache: any;

	constructor(id: string, URI: string) {
		this.id = id;
		this.sourceID = this.id + 'Source';
		this.URI = URI;
	}

	onAdd(map: MapEx, gl: WebGLRenderingContext) {
		this.map = map;
		this.layerProgram = setupLayer(gl);

		map.on('move', this.move.bind(this));
		map.on('zoom', this.zoom.bind(this));
		map.on('click', (e) => console.log(e.lngLat));

		map.addSource(this.sourceID, {
			type: 'raster',
			tiles: [this.URI],
			maxzoom: 2,
			minzoom: 0,
			tileSize: 256,
			attribution: 'WxTiles',
		});

		const tileSource = map.getSource(this.sourceID) as mapboxgl.RasterSource & mapboxgl.Evented; //{ on: any };
		tileSource.on('data', (e: any) => e.sourceDataType === 'content' && this.updateTiles());

		this.sourceCache = map.style._otherSourceCaches[this.sourceID];
		// !IMPORTANT! hack to make mapbox mark the sourceCache as 'used' so it will initialise tiles.
		map.style._layers[this.id].source = this.sourceID;

		// SERG: mindblowing!! I have to add a 'mock' layer to make MapBox load two sourses
		// map.addLayer({
		//   id: this.id + "mock",
		//   type: "custom",
		//   source: this.id + "Source2",
		//   render: () => {},
		// });
	}

	move(/* e */) {
		this.updateTiles();
	}

	zoom(/* e */) {}

	updateTiles() {
		// this.sourceCache.update(this.map.painter.transform);
	}

	// prerender(gl: WebGLRenderingContext, matrix: Array<number>) {
	// 	if (this.preRenderCallback)
	// 		this.preRenderCallback(
	// 			gl,
	// 			matrix,
	// 			this.sourceCache.getVisibleCoordinates().map((tileid) => this.sourceCache.getTile(tileid))
	// 		);
	// }

	render(gl: WebGLRenderingContext, matrix: Array<number>) {
		const coords = this.sourceCache.getVisibleCoordinates();
		const tiles = coords.map((tileid: any) => this.sourceCache.getTile(tileid));
		if (tiles.length === 0) return;
		const { layerProgram } = this;
		gl.useProgram(layerProgram.program);

		// data tex uniform
		gl.uniform1i(layerProgram.dataTex, 0);
		// data tex2 uniform
		gl.uniform1i(layerProgram.dataTex2, 2);

		// CLUT texture (1)
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, layerProgram.textureCLUT);
		gl.uniform1i(layerProgram.CLUTTex, 1);

		// zoom
		gl.uniform1f(layerProgram.zoom, this.map.getZoom());

		// minmax's (mock at now)
		gl.uniform1f(layerProgram.dataMin, 0);
		gl.uniform1f(layerProgram.dataDif, 1);
		gl.uniform1f(layerProgram.clutMin, 0.0);
		gl.uniform1f(layerProgram.clutDif, 1);

		// vertex buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, layerProgram.vertexBuffer);
		gl.enableVertexAttribArray(layerProgram.vertexPosition);
		gl.vertexAttribPointer(layerProgram.vertexPosition, 2, gl.FLOAT, false, 0, 0);

		for (let i = 0; i < tiles.length; ++i) {
			const tile = tiles[i];
			if (!tile.texture) return;

			// model matrix
			gl.uniformMatrix4fv(layerProgram.uMatrix, false, tile.tileID.posMatrix);

			// data texture (0)
			gl.activeTexture(gl.TEXTURE0);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.bindTexture(gl.TEXTURE_2D, tile.texture.texture);

			// data texture2 (2)
			gl.activeTexture(gl.TEXTURE2);
			// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.bindTexture(gl.TEXTURE_2D, tile.texture.texture);

			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
		}
	}
}

interface LayerProgram {
	program: WebGLProgram;
	vertexPosition: number;
	uMatrix: WebGLUniformLocation;
	vertexBuffer: WebGLBuffer;

	textureCLUT: WebGLTexture;

	dataTex: WebGLUniformLocation;
	dataTex2: WebGLUniformLocation;
	CLUTTex: WebGLUniformLocation;

	zoom: WebGLUniformLocation;

	dataMin: WebGLUniformLocation;
	dataDif: WebGLUniformLocation;
	clutMin: WebGLUniformLocation;
	clutDif: WebGLUniformLocation;
}

interface UniformLocations {
	program: WebGLProgram;
	[key: string]: WebGLUniformLocation;
}

function getUniforms(gl: WebGLRenderingContext, program: WebGLProgram, uniforms: string[]): { [key: string]: WebGLUniformLocation } {
	const result: UniformLocations = { program };
	uniforms.forEach((u) => {
		result[u] = gl.getUniformLocation(program, u) || 0;
		if (!result[u]) throw new Error(`Uniform ${u} not found`);
	});

	return result;
}

function setupLayer(gl: WebGLRenderingContext): LayerProgram {
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	if (!vertexShader) throw '!vertexShader';

	gl.shaderSource(vertexShader, vsSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(vertexShader);
		throw new Error(`Could not compile vertex program ${info}`);
	}

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	if (!fragmentShader) throw '!fragmentShader';

	gl.shaderSource(fragmentShader, fsSource);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(fragmentShader);
		throw new Error(`Could not compile fragment program ${info}`);
	}

	const program = gl.createProgram();
	if (!program) throw '!program';

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.validateProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		throw new Error(`Could not compile WebGL program ${info}`);
	}

	const vertexPosition = gl.getAttribLocation(program, 'vertexPosition');

	const uMatrix = gl.getUniformLocation(program, 'uMatrix');
	if (!uMatrix) throw new Error('!uMatrix');

	const dataTex = gl.getUniformLocation(program, 'dataTex');
	if (!dataTex) throw new Error('!dataTex');
	const dataTex2 = gl.getUniformLocation(program, 'dataTex2');
	if (!dataTex2) throw new Error('!dataTex2');

	const CLUTTex = gl.getUniformLocation(program, 'CLUTTex');
	if (!CLUTTex) throw new Error('!CLUTTex');

	const zoom = gl.getUniformLocation(program, 'zoom');
	if (!zoom) throw new Error('!zoom');

	const dataMin = gl.getUniformLocation(program, 'dataMin');
	if (!dataMin) throw new Error('!dataMin');
	const dataDif = gl.getUniformLocation(program, 'dataDif');
	if (!dataDif) throw new Error('!dataDif');
	const clutMin = gl.getUniformLocation(program, 'clutMin');
	if (!clutMin) throw new Error('!clutMin');
	const clutDif = gl.getUniformLocation(program, 'clutDif');
	if (!clutDif) throw new Error('!clutDif');

	const vertexBuffer = gl.createBuffer();
	if (!vertexBuffer) throw new Error('!vertexBuffer');

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

	const textureCLUT = loadTexture(gl, loadImage('clut.png'));

	return {
		program,
		vertexPosition,
		uMatrix,
		vertexBuffer,

		textureCLUT,

		dataTex,
		dataTex2,
		CLUTTex,

		zoom,

		dataMin,
		dataDif,
		clutMin,
		clutDif,
	};
}
