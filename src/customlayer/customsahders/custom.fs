// 2D vector field animation
// Author: Sergei Melman (sergeimelman0@gmail.com)
// Year: 2023
// Distributed under the MIT License.

#version 100
precision highp float;

#define PI 3.1415926538

uniform sampler2D u_noiseTexture; // noise texture
uniform sampler2D u_tileTexture; // main tiles texture (background)
uniform float u_opacity; // general opacity of the layer

uniform float u_Lmax; // maximum possible length of the vector field

uniform sampler2D u_V; // V component of the vector field
uniform float u_Vmul; // V component multiplier to convert [0, 65535] to proper value
uniform float u_Vmin; // V component minimum value to convert [0, 65535] to proper value

uniform sampler2D u_U; // U component of the vector field
uniform float u_Umul; // U component multiplier to convert [0, 65535] to proper value
uniform float u_Umin; // U component minimum value to convert [0, 65535] to proper value

uniform float u_vectorFieldFactor; // multiply vector field by this value
uniform float u_animationTimePosition; // animation time - phase of animation
uniform float u_animationIntensity; // animation intensity
uniform float u_wavesCount; // number of waves, beter more than one

varying vec2 v_pos0; // main tiles texture coordinates
varying vec2 v_posV; // vector field texture coordinates. Shifted as vector field is 258x258, but main tiles are 256x256

// The Noise texture
vec3 noise(vec2 uv) {
    return texture2D(u_noiseTexture, uv).rgb;

    ////  Or generate noise on the fly. Noise must be:
    //// 1. normalized to [0, 1]
    //// 2. reproducable for any uv
    //// 3. irregular (no visible grid)
    //// these two examples break the rule (3) unfortunately
    // float v = length(sin(PI * uv * 90.) * sin(PI * uv * 95.) * sin(PI * uv * 81.)) / sqrt(2.0);
    // float v = length(sin(PI * uv * 30.)) / sqrt(2.0);
    // return vec3(0., 1. - v, v);
}

void main() {
	// read color from the main tiles texture
    vec4 color = texture2D(u_tileTexture, v_pos0) * u_opacity;
	// simple render for non animated layers
    if(u_vectorFieldFactor < 0.2) {
        gl_FragColor = color;
        return;
    }

	// read vector U an V component, use only ALPHA chennel as a HIGH byte from two 8bit channels - enough for visualization
    float U = texture2D(u_U, v_posV).a;
    float V = texture2D(u_V, v_posV).a;

	// Fector field value at pixel (convert [0,65535] to proper U/V values)
    vec2 vectorValueAtPixel = vec2(-(U * u_Umul + u_Umin), V * u_Vmul + u_Vmin) / u_Lmax; // normalize by maximum possible length of the vector field
    float vectorValueAtPixelLength = length(vectorValueAtPixel);
    if(vectorValueAtPixelLength < 0.001) {
        gl_FragColor = color;
        return;
    }

    vec3 wavesCumulativeNoise = vec3(0.0);
    float d = 1.0 / u_wavesCount;
    for(float i = 0.0; i < 10.0; i++) { // the limit of u_wavesCount is 10
        if(i >= u_wavesCount) // workaround for WebGL 1.0, GLSL 1.0 shader does not support non const variables in for loop
            break;
        // waves along the vector field
        float phase = fract(i * d + u_animationTimePosition); // -> [0, 1]
        float intensity = 1. - 2. * abs(phase - 0.5); // triangle function [0, 0.5, 1]-> [0, 1, 0]; The maximum intensity is at the middle of the time interval (t = 0.5)
        vec3 noiseValue = noise(v_pos0 + vectorValueAtPixel * phase * u_vectorFieldFactor);
        wavesCumulativeNoise += (noiseValue - 0.5) * intensity; // add noise to the color
    }

    // Now we adjust the noise's intensity
    wavesCumulativeNoise *= vectorValueAtPixelLength *  // intensity depends on the vector field length
        u_animationIntensity / // animation intensity
        u_wavesCount; // avarageing by number of waves

    color.xyz *= 1.0 + wavesCumulativeNoise; // distort the color by noise 
    gl_FragColor = color;
}
