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
const vec2 addR = vec2(1.0, 0.0) * tileSzExInv;
const vec2 addD = vec2(0.0, 1.0) * tileSzExInv;

void main() {
    gl_Position = uMatrix * vec4(vertexPosition * Extent, 0, 1);

    vTexCoordC = (vertexPosition * tileSz + one) * tileSzExInv;
    vTexCoordR = vTexCoordC + addR;
    vTexCoordD = vTexCoordC + addD;
}
