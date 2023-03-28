import vertexSource from './customsahders/custom.vs';
import fragmentSource from './customsahders/custom.fs';
import { WxTileSource } from '../wxsource/wxsource';
import { HashXYZ } from '../utils/wxtools';
import { WxRasterData } from '../wxlayer/painter';
import mapboxgl from 'mapbox-gl';
class VertexArrayObject {
	boundProgram: any;
	boundLayoutVertexBuffer: any;
	boundPaintVertexBuffers: any[] = [];
	boundIndexBuffer: any;
	boundVertexOffset: any;
	boundDynamicVertexBuffer: any;
	vao: any;
	context: any;
	boundDynamicVertexBuffer2: any;

	bind(context, program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2) {
		this.context = context;

		let paintBuffersDiffer = this.boundPaintVertexBuffers.length !== paintVertexBuffers.length;
		for (let i = 0; !paintBuffersDiffer && i < paintVertexBuffers.length; i++) {
			if (this.boundPaintVertexBuffers[i] !== paintVertexBuffers[i]) {
				paintBuffersDiffer = true;
			}
		}

		const isFreshBindRequired =
			!this.vao ||
			this.boundProgram !== program ||
			this.boundLayoutVertexBuffer !== layoutVertexBuffer ||
			paintBuffersDiffer ||
			this.boundIndexBuffer !== indexBuffer ||
			this.boundVertexOffset !== vertexOffset ||
			this.boundDynamicVertexBuffer !== dynamicVertexBuffer ||
			this.boundDynamicVertexBuffer2 !== dynamicVertexBuffer2;

		if (!context.extVertexArrayObject || isFreshBindRequired) {
			this.freshBind(program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2);
		} else {
			context.bindVertexArrayOES.set(this.vao);

			if (dynamicVertexBuffer) {
				// The buffer may have been updated. Rebind to upload data.
				dynamicVertexBuffer.bind();
			}

			if (indexBuffer && indexBuffer.dynamicDraw) {
				indexBuffer.bind();
			}

			if (dynamicVertexBuffer2) {
				dynamicVertexBuffer2.bind();
			}
		}
	}

	freshBind(program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2) {
		let numPrevAttributes = 0;
		const numNextAttributes = program.numAttributes;

		const context = this.context;
		const gl = context.gl;

		if (context.extVertexArrayObject) {
			if (this.vao) this.destroy();
			this.vao = context.extVertexArrayObject.createVertexArrayOES();
			context.bindVertexArrayOES.set(this.vao);

			// store the arguments so that we can verify them when the vao is bound again
			this.boundProgram = program;
			this.boundLayoutVertexBuffer = layoutVertexBuffer;
			this.boundPaintVertexBuffers = paintVertexBuffers;
			this.boundIndexBuffer = indexBuffer;
			this.boundVertexOffset = vertexOffset;
			this.boundDynamicVertexBuffer = dynamicVertexBuffer;
			this.boundDynamicVertexBuffer2 = dynamicVertexBuffer2;
		} else {
			numPrevAttributes = context.currentNumAttributes || 0;

			// Disable all attributes from the previous program that aren't used in
			// the new program. Note: attribute indices are *not* program specific!
			for (let i = numNextAttributes; i < numPrevAttributes; i++) {
				// WebGL breaks if you disable attribute 0.
				// http://stackoverflow.com/questions/20305231
				if (i !== 0) gl.disableVertexAttribArray(i);
			}
		}

		layoutVertexBuffer.enableAttributes(gl, program);
		for (const vertexBuffer of paintVertexBuffers) {
			vertexBuffer.enableAttributes(gl, program);
		}

		if (dynamicVertexBuffer) {
			dynamicVertexBuffer.enableAttributes(gl, program);
		}
		if (dynamicVertexBuffer2) {
			dynamicVertexBuffer2.enableAttributes(gl, program);
		}

		layoutVertexBuffer.bind();
		layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
		for (const vertexBuffer of paintVertexBuffers) {
			vertexBuffer.bind();
			vertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
		}

		if (dynamicVertexBuffer) {
			dynamicVertexBuffer.bind();
			dynamicVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
		}
		if (indexBuffer) {
			indexBuffer.bind();
		}
		if (dynamicVertexBuffer2) {
			dynamicVertexBuffer2.bind();
			dynamicVertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
		}

		context.currentNumAttributes = numNextAttributes;
	}

	destroy() {
		if (this.vao) {
			this.context.extVertexArrayObject.deleteVertexArrayOES(this.vao);
			this.vao = null;
		}
	}
}

class UniformsManager {
	fill(gl: WebGLRenderingContext, program: WebGLProgram) {
		for (const d in this) {
			if (!d.startsWith('u_')) continue;
			const loc = gl.getUniformLocation(program, d);
			if (loc) this[d] = loc as any;
			else console.log('uniform not found: ' + d);
		}
	}
}

class CustomWxTilesLayerUniforms extends UniformsManager {
	u_matrix: WebGLUniformLocation = {};
	u_opacity: WebGLUniformLocation = {};
	u_tileTexture: WebGLUniformLocation = {};
	u_noiseTexture: WebGLUniformLocation = {};

	u_animationTimePosition: WebGLUniformLocation = {};
	u_vectorFieldFactor: WebGLUniformLocation = {};
	u_animationIntensity: WebGLUniformLocation = {};
	u_wavesCount: WebGLUniformLocation = {};
	u_Lmax: WebGLUniformLocation = {};
	u_U: WebGLUniformLocation = {};
	u_Umul: WebGLUniformLocation = {};
	u_Umin: WebGLUniformLocation = {};
	u_V: WebGLUniformLocation = {};
	u_Vmul: WebGLUniformLocation = {};
	u_Vmin: WebGLUniformLocation = {};

	// u_image1: WebGLUniformLocation = {};
}

// Our custom tileset renderer!
export class CustomWxTilesLayer implements mapboxgl.CustomLayerInterface {
	type: 'custom' = 'custom';
	renderingMode: '2d' | '3d' = '2d';
	opacity: number;
	map: any;
	program!: WebGLProgram;
	attributes!: { a_pos: any; a_texture_pos: any };
	uniforms: CustomWxTilesLayerUniforms = new CustomWxTilesLayerUniforms();

	noiseTexture: WebGLTexture | null = null;

	constructor(public id: string, public sourceID: string, opacity?: number) {
		this.opacity = opacity || 1.0;
	}
	onRemove(map: any, gl: WebGLRenderingContext): void {
		// map.style._layers[this.id].source = undefined;

		// delete gl resources
		gl.deleteTexture(this.noiseTexture);
		gl.deleteProgram(this.program);
	}

	onAdd(map, gl: WebGLRenderingContext) {
		this.map = map;
		this.noiseTexture = createNoiseTexture(gl);
		this.program = createShaderProgram(gl);
		// The VertexBuffer assumes that 'this' looks like a Program, at least that it has attributes
		this.attributes = {
			a_pos: gl.getAttribLocation(this.program, 'a_pos'),
			a_texture_pos: gl.getAttribLocation(this.program, 'a_texture_pos'),
		};

		// Here are all the uniforms needed either by default for the render, or for any of our visual effects
		this.uniforms.fill(gl, this.program);

		map.style._layers[this.id].source = this.sourceID;
	}

	render(gl: WebGLRenderingContext /* , matrix */): void {
		if (!this.program) return;
		const sourceCache = this.map.style._otherSourceCaches[this.sourceID];
		const wxsource: WxTileSource = sourceCache.getSource()._implementation;
		const visibleCoordsMapBox = (sourceCache.getVisibleCoordinates() as Array<any>).reverse();
		if (!visibleCoordsMapBox.length) return;

		gl.useProgram(this.program);

		// This is needed because there's a cache that cares about the layer id
		const layerID = this.id;

		const painter = this.map.painter;
		const tilesCache = wxsource.getCache();

		const context = painter.context;

		const minTileZ = (visibleCoordsMapBox.length && visibleCoordsMapBox[0].overscaledZ) || 0;

		// These are normally whole objects, but I've simplified them down into raw json.
		const stencilMode = {
			test: { func: 0x0207, mask: 0 },
			ref: 0,
			mask: 0,
			fail: 0x1e00,
			depthFail: 0x1e00,
			pass: 0x1e00,
		};
		const cullFaceMode = {
			enable: false,
			mode: 0x0405,
			frontFace: 0x0901,
		};

		for (let coord of visibleCoordsMapBox) {
			const tile = sourceCache.getTile(coord);
			tile.registerFadeDuration(1000); // Was stored in the paint properties, here is hardcoded
			const depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ, true, gl.LESS);
			const colorMode = painter.colorModeForRenderPass();

			// Set GL properties
			context.setDepthMode(depthMode);
			context.setStencilMode(stencilMode);
			context.setColorMode(colorMode);
			context.setCullFace(cullFaceMode);

			// Set uniforms
			gl.uniformMatrix4fv(this.uniforms.u_matrix, false, coord.projMatrix);
			gl.uniform1i(this.uniforms.u_tileTexture, 0); // Texture unit 0 (layer 0)
			gl.uniform1f(this.uniforms.u_opacity, this.opacity);

			const wxstyle = wxsource.getCurrentStyleObjectCopy();
			const wxtile = tilesCache.get(HashXYZ(coord.canonical));
			if (wxtile?.data.data.length === 3 && wxstyle.streamLineSpeedFactor > 0.2) {
				// vector data. Let's render winds and currents
				if (!wxtile.rd) {
					// create a texture from wxtile
					const vectorTextureU = CreateTexureUV(gl, gl.TEXTURE1, wxtile.data.data[1].raw);
					const vectorTextureV = CreateTexureUV(gl, gl.TEXTURE2, wxtile.data.data[2].raw);
					wxtile.rd = { vectorTextureU, vectorTextureV, gl };
				}

				gl.uniform1f(this.uniforms.u_Lmax, wxtile.data.data[0].dmax);

				context.activeTexture.set(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, wxtile.rd.vectorTextureU);
				gl.uniform1i(this.uniforms.u_U, 1); // Texture unit 1 (layer 1)
				gl.uniform1f(this.uniforms.u_Umin, wxtile.data.data[1].dmin);
				gl.uniform1f(this.uniforms.u_Umul, wxtile.data.data[1].dmul * 65535);

				context.activeTexture.set(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, wxtile.rd.vectorTextureV);
				gl.uniform1i(this.uniforms.u_V, 2); // Texture unit 2 (layer 2)
				gl.uniform1f(this.uniforms.u_Vmin, wxtile.data.data[2].dmin);
				gl.uniform1f(this.uniforms.u_Vmul, wxtile.data.data[2].dmul * 65535);

				const speedFactor = wxsource.getCurrentStyleObjectCopy().streamLineSpeedFactor;
				const animationTimePosition = ((Date.now() % 10000) / 5000) * speedFactor;
				gl.uniform1f(this.uniforms.u_animationTimePosition, animationTimePosition);
				gl.uniform1f(this.uniforms.u_vectorFieldFactor, 1); // Let it be  for now
				gl.uniform1f(this.uniforms.u_animationIntensity, 5); // Let it be  for now
				gl.uniform1f(this.uniforms.u_wavesCount, 4); // Let it be  for now

				// Set up the noise textures
				context.activeTexture.set(gl.TEXTURE3);
				gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
				gl.uniform1i(this.uniforms.u_noiseTexture, 3); // Texture unit 3 (layer 3)
			} else {
				gl.uniform1f(this.uniforms.u_vectorFieldFactor, 0); // no glsl animation
			}

			// Set up the textures for this tile
			context.activeTexture.set(gl.TEXTURE0);
			tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

			// I'm assuming our source is an "ImageSource", though I don't really know what that means.
			// I followed the implementation on that branch of the if to produce the following.
			const mercatorBoundsBuffer = painter.mercatorBoundsBuffer;
			const quadTriangleIndexBuffer = painter.quadTriangleIndexBuffer;
			const mercatorBoundsSegments = painter.mercatorBoundsSegments;
			const primitiveSize = 3; // ибо triangles

			// Stolen from the draw function
			for (const segment of mercatorBoundsSegments.get()) {
				const vaos = segment.vaos || (segment.vaos = {});
				const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

				vao.bind(
					context,
					this, // program attributes
					mercatorBoundsBuffer, // layoutVertexBuffer
					[], // paintVertexBuffers
					quadTriangleIndexBuffer, // indexBuffer
					segment.vertexOffset, // vertexOffset
					null, // dynamicVertexBuffer
					null // dynamicVertexBuffer2
				);

				gl.drawElements(
					gl.TRIANGLES, // mode
					segment.primitiveLength * primitiveSize, // count
					gl.UNSIGNED_SHORT, // type
					segment.primitiveLength * primitiveSize * segment.primitiveOffset // offset
				);
			}
		}

		wxsource.getMetadata().vector && // TODO: control via style
			this.map.triggerRepaint();
	}
}

function CreateTexureUV(gl: WebGLRenderingContext, texLayer: number, raw: Uint16Array) {
	const texture = gl.createTexture();
	if (!texture) throw new Error('Unable to create texture');
	gl.activeTexture(texLayer);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 258, 258, 0, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, raw);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, 258, 258, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, new Uint8Array(raw.buffer));
	let t: number;
	if ((t = gl.getError())) throw new Error('GL error: ' + t);
	// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 256, 0, gl.RGB, gl.UNSIGNED_BYTE, raw256);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	if ((t = gl.getError())) throw new Error('GL error: ' + t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	if ((t = gl.getError())) throw new Error('GL error: ' + t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	if ((t = gl.getError())) throw new Error('GL error: ' + t);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	if ((t = gl.getError())) throw new Error('GL error: ' + t);

	return texture;
}

function createShader(gl: WebGLRenderingContext, shaderSource: string, type: number): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Could not create shader: GlError=' + gl.getError());
	gl.shaderSource(shader, shaderSource);
	let err: number;
	if ((err = gl.getError())) throw new Error('Could not set shader source: GlError=' + err);
	gl.compileShader(shader);
	if ((err = gl.getError())) throw new Error('Could not compile shader: GlError=' + err);

	console.log('Shader STATUS:', gl.getShaderParameter(shader, gl.COMPILE_STATUS));
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error('Could not compile vertex program: ' + gl.getShaderInfoLog(shader));
	}
	console.log('Shader compiled:', gl.getShaderInfoLog(shader));

	return shader;
}

function createShaderProgram(gl: WebGLRenderingContext): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error('Could not create WebGL program: GlError=' + gl.getError());

	gl.attachShader(program, createShader(gl, vertexSource, gl.VERTEX_SHADER));
	gl.attachShader(program, createShader(gl, fragmentSource, gl.FRAGMENT_SHADER));
	gl.linkProgram(program);
	gl.validateProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error('Could not link WebGL program: ' + gl.getProgramInfoLog(program));
	}

	return program;
}

function createNoiseTexture(gl: WebGLRenderingContext): WebGLTexture {
	// create RGB noise data texDim x texDim in noiseTextureData
	const texDim = 64;
	const noiseTextureData = Uint8Array.from({ length: texDim * texDim }, () => Math.random() * 256);

	// create a noise texture
	const noiseTexture = gl.createTexture();
	if (!noiseTexture) throw new Error('Could not create noise texture: GlError=' + gl.getError());
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, texDim, texDim, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(noiseTextureData));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	return noiseTexture;
}
