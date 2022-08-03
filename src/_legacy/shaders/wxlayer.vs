#pragma vscode_glsllint_stage : vert

precision highp float;

attribute vec2 vertexPosition;

uniform mat4 uMatrix;
uniform float zoom;

varying vec2 vTexCoordC;
varying vec2 vTexCoordR;
varying vec2 vTexCoordD;

const float Extent = 8192.0; // some magic number

void main() {
    gl_Position = uMatrix * vec4(vertexPosition * Extent, 0, 1);

    // Tiles are 258x258. 1 pixel border is used to calc isolines and proper interpolation. It needs to be excluded from 'tile filling' process.
    // Modifying 'vertexPosition' in order to skip borders.
    const float tileSzExInv = 1.0 / 258.0;
    const float tileM = 256.0 / 258.0;
    const vec2 one = vec2(1.0, 1.0) * tileSzExInv;
    vTexCoordC = vertexPosition * tileM + one;

    // calculating coords of R(right) and D(down) pixels, which are used to calc ISOlines.
    float shift = 2.0 * tileSzExInv / (zoom + 1.0); // current zoom let us work out the thickness of the isolines.
    vTexCoordR = vTexCoordC + vec2(shift, 0.0);
    vTexCoordD = vTexCoordC + vec2(0.0, shift);
}
