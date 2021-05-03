import mapboxgl from 'mapbox-gl';

import vsSource from './shaders/wxlayer.vs';
import fsSource from './shaders/wxlayer.fs';

interface LayerProgram {
	program: WebGLProgram;
	aPos: number;
	uMatrix: WebGLUniformLocation;
	uTexture: WebGLUniformLocation;
	vertexBuffer: WebGLBuffer;
}

export class WxTileLayer {
	id: string;
	sourceID: string;
	type: string = 'custom';
	renderingMode: string = '2d';

	map!: mapboxgl.Map;
	// gl!: WebGLRenderingContext;
	layerProgram!: LayerProgram;
	// tileSource!: mapboxgl.AnySourceImpl; //RasterSource;

	sourceCache: any;

	constructor(id: string) {
		this.id = id;
		this.type = 'custom';
		this.renderingMode = '2d';
		this.sourceID = this.id + 'Source';
	}

	onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
		this.map = map;
		// this.gl = gl;

		this.layerProgram = setupLayer(gl);

		map.on('move', this.move.bind(this));
		map.on('zoom', this.zoom.bind(this));

		map.addSource(this.sourceID, {
			type: 'raster',
			tiles: ['https://tiles.metoceanapi.com/data/gfs.global/2021-05-02T12:00:00Z/air.temperature.at-2m/2021-05-02T12:00:00Z/{z}/{x}/{y}.png'],
			maxzoom: 4,
			minzoom: 0,
			tileSize: 256,
			attribution: '',
		});

		const tileSource = map.getSource(this.sourceID);
		tileSource.on('data', this.onData.bind(this));

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
	onData(e: { sourceDataType: string }) {
		if (e.sourceDataType == 'content') this.updateTiles();
	}
	updateTiles() {
		this.sourceCache.update(this.map.painter.transform);
	}
	prerender(/* gl: WebGLRenderingContext, matrix: Array<number> */) {
		/*     if (this.preRenderCallback)
      this.preRenderCallback(
        gl,
        matrix,
        this.sourceCache
          .getVisibleCoordinates()
          .map((tileid) => this.sourceCache.getTile(tileid))
      ); */
	}
	render(gl: WebGLRenderingContext, matrix: Array<number>) {
		const coords = this.sourceCache.getVisibleCoordinates();
		const tiles = coords.map((tileid: any) => this.sourceCache.getTile(tileid));
		render(gl, matrix, this.layerProgram, tiles);
	}
}

function render(gl: WebGLRenderingContext, matrix: Array<number>, layerProgram: LayerProgram, tiles: Array<any>) {
	gl.useProgram(layerProgram.program);
	tiles.forEach((tile) => {
		if (!tile.texture) return;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tile.texture.texture);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		gl.bindBuffer(gl.ARRAY_BUFFER, layerProgram.vertexBuffer);
		gl.enableVertexAttribArray(layerProgram.aPos);
		gl.vertexAttribPointer(layerProgram.aPos, 2, gl.FLOAT, false, 0, 0);

		gl.uniformMatrix4fv(layerProgram.uMatrix, false, tile.tileID.posMatrix);
		gl.uniform1i(layerProgram.uTexture, 0);
		// gl.depthFunc(gl.LESS);
		//gl.enable(gl.BLEND);
		//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	});
}

function setupLayer(gl: WebGLRenderingContext): LayerProgram {
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	if (!vertexShader) throw '!vertexShader';

	gl.shaderSource(vertexShader, vsSource);
	gl.compileShader(vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	if (!fragmentShader) throw '!fragmentShader';

	gl.shaderSource(fragmentShader, fsSource);
	gl.compileShader(fragmentShader);

	const program = gl.createProgram();
	if (!program) throw '!program';

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.validateProgram(program);

	const aPos = gl.getAttribLocation(program, 'aPos');
	const uMatrix = gl.getUniformLocation(program, 'uMatrix');
	if (!uMatrix) throw '!uMatrix';
	const uTexture = gl.getUniformLocation(program, 'uTexture');
	if (!uTexture) throw '!uTexture';

	// const vertexArray = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
	const vertexArray = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

	const vertexBuffer = gl.createBuffer();
	if (!vertexBuffer) throw '!vertexBuffer';

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

	return { program, aPos, uMatrix, uTexture, vertexBuffer };
}
