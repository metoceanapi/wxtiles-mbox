#version 100
precision highp float;

uniform sampler2D u_noiseTexture;
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
    // if(u_animationSpeed > 0.2) {
    //     gl_FragColor = vec4(noise(v_pos0), 1.0);
    //     return;
    // }

	// read color from the main tiles
    vec4 color = texture2D(u_tileTexture, v_pos0) * u_opacity;
	// simple render for non animated layers
    if(u_animationSpeed < 0.2) {
        gl_FragColor = color;
        return;
    }

	// read vector U an V component, use only HIGH byte from two 8bit channels - enough for visualization
    float U = texture2D(u_U, v_posV).a;
    float V = texture2D(u_V, v_posV).a;

	// Fector field value at pixel (convert [0,65535] to proper U/V values)
    vec2 vec = vec2(-(U * u_Umul + u_Umin), V * u_Vmul + u_Vmin) / u_Lmax; // normalize by maximum possible length of the vector field
    float lvec = length(vec);
    if(lvec < 0.001) {
        gl_FragColor = color;
        return;
    }

    float t = fract(u_animationTime); // -> [0, 1]

    vec3 col = vec3(0.0);
    const float d = 0.3;
    for(float i = 0.0; i < 1.0; i += d) {
        float t1 = fract(i + t); // -> [0, 1]
        float t2 = fract(t1 + 0.5);
        col += noise(v_pos0 + vec * u_animationSpeed * t1) * (1. - 2. * abs(t1 - 0.5)) * d;
        col += noise(v_pos0 + vec * u_animationSpeed * t2) * (1. - 2. * abs(t2 - 0.5)) * d;
    }

    col -= (0.5);
    color.xyz += color.xyz * col * lvec * 4.; // use pixel's color if pixel is not transparent

    gl_FragColor = color;
}

/*
// 2D vector field: The Vortex
vec2 vField( vec2 uv )
{
    // uv - Normalized pixel coordinates (from 0 to 1)
    
    uv*= 2.;
    uv -= vec2(1.); // fragCoord -> [-1, 1]
    
    uv = normalize(vec2(uv.y, -uv.x)) * sin(3.145*length(uv)*2.);
    
    return uv;
}

// The Noise texture
vec4 noise( vec2 uv )
{
    // uv - Normalized pixel coordinates (from 0 to 1)

    float v = length(sin(uv*200.))/sqrt(2.0);
    return vec4(v, abs(0.5-v), 1. - v, 1.);
}


// image
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
    
    
    vec2 vec = vField(uv).xy / 09.;
    
    float t1 = fract(iTime);
    float t2 = fract(t1 +0.5);
    vec3 col1 = noise(uv + vec * t1).rgb * (1. - 2.*abs(t1-0.5));
    vec3 col2 = noise(uv + vec * t2).rgb * (1. - 2.*abs(t2-0.5));

    vec3 col = (col1 + col2) ;
    // Output to screen
    fragColor = vec4(col* length(vec*9.),1.0);
}
//*/

/*
// 2D vector field: The Vortex
vec2 vField( vec2 uv )
{
    // uv - Normalized pixel coordinates (from 0 to 1)
    
    uv*= 2.;
    uv -= vec2(1.); // fragCoord -> [-1, 1]
    
    uv = normalize(vec2(uv.y, -uv.x)) * sin(3.145*length(uv));
    
    return uv;
}

float inoise(float t) {
    return fract(sin(t * 7.1)*8.5453123);
}

#define PI 3.14156
// The Noise texture
vec3 noise( vec2 uv )
{

     //return vec3(inoise(uv.x*uv.y));

     return texture(iChannel0, uv).rgb;
    // uv - Normalized pixel coordinates (from 0 to 1)
    uv.x /= 1.;

    float v = (length(sin(PI*uv*30.)*sin(PI*uv*31.)*sin(PI*uv*32.5)));
    return vec3(v);
}


// image
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.y;

    vec2 vec = vField(uv) / 5. ;
   
    float t = fract(iTime/2.); // -> [0, 1]
    
    vec3 col;
    
    float d = 0.3;
    
    for(float i = 0.0; i < 1.0; i += d){
        float t1 = fract(i + t); // -> [0, 1]
        float t2 = fract(t1 + 0.5);
        col += noise(uv + vec*t1) * (1. - 2.*abs(t1-0.5))*d;
        col += noise(uv + vec*t2) * (1. - 2.*abs(t2-0.5))*d;
    }

    // Output to screen
    fragColor = vec4(col,1.0)*length(vec)*5.;
}
*/