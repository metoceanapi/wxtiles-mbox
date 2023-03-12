#version 100
// This vertex shader is verbatim the same as the raster vertex shader
uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos0;
varying vec2 v_posV;

void main() {
	gl_Position = u_matrix * vec4(a_pos, 0, 1);

	// We are using Int16 for texture position coordinates to give us enough precision for
	// fractional coordinates. We use 8192 to scale the texture coordinates in the buffer
	// as an arbitrarily high number to preserve adequate precision when rendering.
	// This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,
	// so math for modifying either is consistent.
	v_pos0 = a_texture_pos / 8192.0;
	v_posV = (v_pos0 * 256.0 + vec2(1.0, 1.0)) / 258.0;
}