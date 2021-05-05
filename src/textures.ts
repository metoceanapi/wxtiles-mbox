export function createCLUT(gl: WebGLRenderingContext, width: number): WebGLTexture {
	const data = new Uint8Array(width * 4);
	for (let i = 0; i < width; ++i) {
		data[i * 4 + 0] = (255 * i) / (width - 1);
		data[i * 4 + 1] = 0;
		data[i * 4 + 2] = 0;
		data[i * 4 + 3] = 255;
	}

	const texture = createTextureArray(gl, width, 1, data);

	return texture;
}

export function createTextureArray(gl: WebGLRenderingContext, width: number, height: number, data: ArrayBufferView): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw '!texture';
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
	return texture;
}

export function loadTexture(gl: WebGLRenderingContext, imgPromise: Promise<HTMLImageElement>): WebGLTexture {
	const texture = createTextureArray(gl, 1, 1, new Uint8Array([0, 0, 255, 255]));

	imgPromise.then((img: HTMLImageElement) => {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	});

	return texture;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
	const img = new Image();
	img.crossOrigin = 'anonymous'; // essential
	img.src = url;
	await img.decode();
	return img;
}
