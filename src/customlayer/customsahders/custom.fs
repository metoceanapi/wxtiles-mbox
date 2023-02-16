
// This fragment shader is similar to the default, but I do some extra calculations to give it a false color appearance.
precision highp float;

uniform float u_falsecolor_start;
uniform float u_falsecolor_end;

uniform float u_fade_t;
uniform float u_opacity;
uniform sampler2D u_image0;
uniform sampler2D u_image1;
varying vec2 v_pos0;
varying vec2 v_pos1;

void main() {

				  // read and cross-fade colors from the main and parent tiles
    vec4 color0 = texture2D(u_image0, v_pos0);
    vec4 color1 = texture2D(u_image1, v_pos1);
    if(color0.a > 0.0) {
        color0.rgb = color0.rgb / color0.a;
    }
    if(color1.a > 0.0) {
        color1.rgb = color1.rgb / color1.a;
    }
    vec4 color = mix(color0, color1, u_fade_t);
    color.a *= u_opacity;

				//   // Here's the arbitrary recoloring that turns it from RGB to false color

				//   float intensity = (2.0 * color.g - color.r - color.b) / (2.0 * color.g + color.r + color.b);
				//   float intensity_scaled = (intensity - u_falsecolor_start) / (u_falsecolor_end - u_falsecolor_start);
				//   intensity_scaled = clamp(intensity_scaled, -1.0, 1.0);

				//   // I should do this with Canvas and a texture, but this is less work
				//   float stop_vals[7];
				//   stop_vals[0] = -1.0;
				//   stop_vals[1] = -0.5;
				//   stop_vals[2] = -0.5;
				//   stop_vals[3] = 0.0;
				//   stop_vals[4] = 0.3;
				//   stop_vals[5] = 0.5;
				//   stop_vals[6] = 1.0;

				//   vec3 stop_cols[7];
				//   stop_cols[0] = vec3(0,0,0);
				//   stop_cols[1] = vec3(0.0,0.0,0.5);
				//   stop_cols[2] = vec3(1,0,1);
				//   stop_cols[3] = vec3(1,0,0);
				//   stop_cols[4] = vec3(0.984, 1.0, 0.0);
				//   stop_cols[5] = vec3(0.0, 0.6667, 0.0);
				//   stop_cols[6] = vec3(0.0, 0.3333, 0.0);

				//   for (int i = 0; i < 6; i++) {
				//     float interp = (intensity_scaled - stop_vals[i]) / (stop_vals[i+1] - stop_vals[i]);
				//     if (interp >= 0.0 && interp <= 1.0) {
				//       color.rgb = mix(stop_cols[i], stop_cols[i+1], interp);
				//     }
				//   }

    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
