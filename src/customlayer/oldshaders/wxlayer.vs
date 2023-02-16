// #pragma vscode_glsllint_stage : vert

precision highp float;

attribute vec2 aPos;
uniform mat4 uMatrix;
varying vec2 vTexCoord;

const float Extent = 8192.0; // some magic number

void main() {
    gl_Position = uMatrix * vec4(aPos * Extent, 0, 1);
    vTexCoord = aPos;
}
