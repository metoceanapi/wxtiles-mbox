import vertexSource from './customsahders/custom.vs';
import fragmentSource from './customsahders/custom.fs';
// Stolen from mapbox, handles automatic fades
function getFadeValues(tile, parentTile, sourceCache, transform) {
	const fadeDuration = 0.3;

	function clamp(n, min, max) {
		return Math.min(max, Math.max(min, n));
	}

	if (fadeDuration > 0) {
		const nowFunc = window.performance && window.performance.now ? window.performance.now.bind(window.performance) : Date.now.bind(Date);
		const now = nowFunc();

		const sinceTile = (now - tile.timeAdded) / fadeDuration;
		const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

		const source = sourceCache.getSource();
		const idealZ = transform.coveringZoomLevel({
			tileSize: source.tileSize,
			roundZoom: source.roundZoom,
		});

		// if no parent or parent is older, fade in; if parent is younger, fade out
		const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ);

		const childOpacity = fadeIn && tile.refreshedUponExpiration ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);

		// we don't crossfade tiles that were just refreshed upon expiring:
		// once they're old enough to pass the crossfading threshold
		// (fadeDuration), unset the `refreshedUponExpiration` flag so we don't
		// incorrectly fail to crossfade them when zooming
		if (tile.refreshedUponExpiration && sinceTile >= 1) tile.refreshedUponExpiration = false;

		if (parentTile) {
			return {
				opacity: 1,
				mix: 1 - childOpacity,
			};
		} else {
			return {
				opacity: childOpacity,
				mix: 0,
			};
		}
	} else {
		return {
			opacity: 1,
			mix: 0,
		};
	}
}

// Stolen from mapbox, handles binding vertex/index buffers in a way I haven't bothered to figure out
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

class Uniforms {
	fill(gl: WebGLRenderingContext, program: WebGLProgram) {
		for (const d in this) {
			if (!d.startsWith('u_')) continue;
			if (!(this[d] = gl.getUniformLocation(program, d) as any)) throw new Error('uniform not found: ' + d);
		}
	}
}
class CustomTilesetLayerUniforms extends Uniforms {
	u_matrix: WebGLUniformLocation = {};
	u_tl_parent: WebGLUniformLocation = {};
	u_scale_parent: WebGLUniformLocation = {};
	u_buffer_scale: WebGLUniformLocation = {};
	u_fade_t: WebGLUniformLocation = {};
	u_opacity: WebGLUniformLocation = {};
	u_image0: WebGLUniformLocation = {};
	u_image1: WebGLUniformLocation = {};
	// u_falsecolor_start: WebGLUniformLocation = {};
	// u_falsecolor_end: WebGLUniformLocation = {};
}

// Our custom tileset renderer!
export class CustomTilesetLayer implements mapboxgl.CustomLayerInterface {
	type: 'custom' = 'custom';
	renderingMode: '2d' | '3d' = '3d';
	opacity: number;
	map: any;
	program!: WebGLProgram;
	attributes!: { a_pos: any; a_texture_pos: any };
	uniforms: CustomTilesetLayerUniforms = new CustomTilesetLayerUniforms();

	constructor(public id: string, public sourceID: string) {
		this.opacity = 0.5;
	}

	onAdd(map, gl: WebGLRenderingContext) {
		this.map = map;

		this.program = createShaderProgram(gl);

		// Store any uniform and attribute locations

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
		gl.useProgram(this.program);

		// This is needed because there's a cache that cares about the layer id
		const layerID = this.id;

		const painter = this.map.painter;
		const sourceCache = this.map.style._otherSourceCaches[this.sourceID];
		const source = sourceCache.getSource();
		const coords = (sourceCache.getVisibleCoordinates() as Array<any>).reverse();

		const context = this.map.painter.context;

		const minTileZ = coords.length && coords[0].overscaledZ;

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

		for (let coord of coords) {
			const tile = sourceCache.getTile(coord);

			// These are normally whole objects, but I've simplified them down into raw json.
			const depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ, true, gl.LESS);
			const colorMode = painter.colorModeForRenderPass();

			const posMatrix = coord.projMatrix;
			tile.registerFadeDuration(0.3); // Was stored in the paint properties, here is hardcoded

			const parentTile = sourceCache.findLoadedParent(coord, 0),
				fade = getFadeValues(tile, parentTile, sourceCache, painter.transform);

			// Properties computed for the shader
			let parentScaleBy, parentTL;

			// Set up the two textures for this tile and its parent
			const textureFilter = gl.LINEAR;
			context.activeTexture.set(gl.TEXTURE0);
			tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

			context.activeTexture.set(gl.TEXTURE1);
			if (parentTile) {
				parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
				parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
				parentTL = [(tile.tileID.canonical.x * parentScaleBy) % 1, (tile.tileID.canonical.y * parentScaleBy) % 1];
			} else {
				tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
			}

			// I'm assuming our source is an "ImageSource", though I don't really know what that means.
			// I followed the implementation on that branch of the if to produce the following.
			const layoutVertexBuffer = source.boundsBuffer || painter.mercatorBoundsBuffer;
			const indexBuffer = painter.quadTriangleIndexBuffer;
			const segments = source.boundsSegments || painter.mercatorBoundsSegments;

			// Set GL properties
			context.setDepthMode(depthMode);
			context.setStencilMode(stencilMode);
			context.setColorMode(colorMode);
			context.setCullFace(cullFaceMode);

			// Set uniforms
			gl.uniformMatrix4fv(this.uniforms.u_matrix, false, posMatrix);
			gl.uniform2fv(this.uniforms.u_tl_parent, parentTL || [0, 0]);
			gl.uniform1f(this.uniforms.u_scale_parent, parentScaleBy || 1);
			gl.uniform1f(this.uniforms.u_buffer_scale, 1);
			gl.uniform1f(this.uniforms.u_fade_t, fade.mix);
			gl.uniform1f(this.uniforms.u_opacity, fade.opacity * this.opacity);
			gl.uniform1i(this.uniforms.u_image0, 0);
			gl.uniform1i(this.uniforms.u_image1, 1);
			// gl.uniform1f(this.uniforms.u_falsecolor_start, 0.0 /* falsecolor_start */);
			// gl.uniform1f(this.uniforms.u_falsecolor_end, 0.99 /* falsecolor_end */);

			const primitiveSize = 3; // triangles

			// Stolen from the draw function
			for (const segment of segments.get()) {
				const vaos = segment.vaos || (segment.vaos = {});
				const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

				vao.bind(
					context,
					this, // program attributes
					layoutVertexBuffer,
					[], // paintVertexBuffers
					indexBuffer,
					segment.vertexOffset,
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
	}
}

function createShader(gl: WebGLRenderingContext, shaderSource: string, type: number): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Could not create shader: GlError=' + gl.getError());
	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error('Could not compile vertex program: ' + gl.getShaderInfoLog(shader));
	}

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
