#pragma vscode_glsllint_stage : vert

precision highp float;

attribute vec2 vertexPosition;

uniform mat4 uMatrix;

varying vec2 vTexCoordC;
varying vec2 vTexCoordR;
varying vec2 vTexCoordD;

const float Extent = 8192.0; // some magic number

const float tileSz = 256.0;
const float tileSzExInv = 1.0 / 258.0;
const vec2 one = vec2(1.0, 1.0);

uniform float zoom;

void main() {
    gl_Position = uMatrix * vec4(vertexPosition * Extent, 0, 1);

    vTexCoordC = (vertexPosition * tileSz + one) * tileSzExInv;

    float shift = 10.0 * tileSzExInv / (zoom + 1.0);
    vTexCoordR = vTexCoordC + vec2(shift, 0.0);
    vTexCoordD = vTexCoordC + vec2(0.0, shift);
}
