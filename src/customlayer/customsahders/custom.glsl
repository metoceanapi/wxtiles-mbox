
// This fragment shader is similar to the default, but I do some extra calculations to give it a false color appearance.
precision highp float;

uniform sampler2D u_tileTexture;
uniform float u_opacity;

uniform float u_Lmax;

uniform sampler2D u_V;
uniform float u_Vmul;
uniform float u_Vmin;

uniform sampler2D u_U;
uniform float u_Umul;
uniform float u_Umin;

uniform float u_animationSpeed;
uniform float u_animationTime;

#define PI 3.1415926538

varying vec2 v_pos0;
varying vec2 v_posV;

float getNoise(vec2 pos, vec2 vec, float w, float t) {
	// pos *= PI / 255.0 * w *255.0; // w - wave length
	pos *= PI; // w - wave length
	vec *= t * 20.00000001; // vec - shift to vec direction by x25 pixels,t - time [-1, 1]
	// mat2 rot = mat2(1.0, 0.0, 0.0, 1.0); // rotation matrix
	// mat2 rot = mat2(vec2norm.x, vec2norm.y, -vec2norm.y, vec2norm.x); // rotation matrix
	// vec2 vec2norm = normalize(vec2(vec.x, vec.y));
	// pos = rot * vec2(1.0, 0.0);
	// function to imitate periodic noise
	// pos.y /= 15.0;
	vec2 p = cos(pos +// any periodic function.
		vec);
	return length(p) / sqrt(2.0) * 0.5 - 0.5;
}

void main() {
	// read color from the main tiles
	vec4 color = texture2D(u_tileTexture, v_pos0);
	color *= u_opacity;
	// simple render for non animated layers
	if(u_animationSpeed < 0.1) {
		gl_FragColor = color;
		return;
	}

	// read vector U component, and combine [0,65535] from two 8bit channels
	float U = dot(texture2D(u_U, v_posV).ra, vec2(1.0, 255.0) * 255.0);
	if(U < 0.0001) {
		// NODATA
		gl_FragColor = color; // most likely transparent
		return;
	}

	// read vector V component, and combine [0,65535] from two 8bit channels
	float V = dot(texture2D(u_V, v_posV).ra, vec2(1.0, 255.0) * 255.0);
	
	// convert [0,65535] to proper U/V values
	vec2 Lvec = vec2(U, V); // vector field value at the pixel
	Lvec *= vec2(-u_Umul, u_Vmul);
	Lvec += vec2(-u_Umin, u_Vmin);
	// normalize Lvec and scale it by animation speed 
	Lvec *= u_animationSpeed / u_Lmax; // normalize by maximum possible length of the vector field

	float LvecLen = length(Lvec);

	if(LvecLen < 0.0001) {
		gl_FragColor = color;
		return;
	}

	float t0 = u_animationTime * 1.0000001 + 1.0;
	float t1 = t0 - 1.0;
	if(t1 < -1.0) {
		t1 += 2.0;
	}

	float n = 0.0;
	n += getNoise(v_pos0, Lvec, 30.0, t0) * (1.0 - abs(t0));
	n += getNoise(v_pos0, Lvec, 30.0, t1) * (1.0 - abs(t1));

	if(color.a > 0.1)
		color.xyz += color.xyz * n /* * LvecLen */; // use pixel's color if pixel is not transparent
	else
		color = vec4(vec3(n + 0.5) * 2.0, 1.0); // otherwise use the spec effect only

	gl_FragColor = color;
}
