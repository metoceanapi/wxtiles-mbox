
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
	// vec4 color = texture2D(u_tileTexture, p);
	// return length(color);
	vec2 p = sin(pos * w * PI + vec * t);
	return length(p) / 3.0;//p.x * p.y * 0.5;
}

void main() {
	// read and cross-fade colors from the main and parent tiles
	vec4 color = texture2D(u_tileTexture, v_pos0);
	if(color.a < 0.01) {
		discard;
	}

	color = color * (color.a * u_opacity);

	if(u_animationSpeed < 0.000001) {
		gl_FragColor = color;
		return;
	}

	vec4 U = texture2D(u_U, v_posV);
	vec4 V = texture2D(u_V, v_posV);

	vec2 Lvec = vec2( // 
	((U.a * 255.0 + U.r) * u_Umul + u_Umin) * -1.0, // 
	(V.a * 255.0 + V.r) * u_Vmul + u_Vmin) * u_animationSpeed / u_Lmax * 25.0;

	float L = length(Lvec);

	float t1 = u_animationTime - 1.0;
	if(t1 < -1.0) {
		t1 += 2.0;
	}

	float n1 = getNoise(v_pos0, Lvec, 15.0, u_animationTime) * (1.0 - abs(u_animationTime));
	float n1_1 = getNoise(v_pos0, Lvec, 45.0, u_animationTime) * (1.0 - abs(u_animationTime));
	float n2 = getNoise(v_pos0, Lvec, 15.0, t1) * (1.0 - abs(t1));
	float n2_2 = getNoise(v_pos0, Lvec, 45.0, t1) * (1.0 - abs(t1));

	float n = n1 + n2 + n1_1 + n2_2;
	// color.xyz = mix(color.xyz, vec3(t), t);
	color.xyz += color.xyz * n / 5.0;

	gl_FragColor = color * color.a * u_opacity * 1.000000001 +
		vec4(n, n, n, 0.0) * 0.000000001 +
		vec4(L, L, L, 1.0) * 0.000000001;

	// gl_FragColor = mix(gl_FragColor, color, u_opacity);

	// gl_FragColor = color;
}
