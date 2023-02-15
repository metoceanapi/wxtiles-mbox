// #pragma vscode_glsllint_stage : frag

precision highp float;

varying vec2 vTexCoord;
uniform sampler2D uTexture;

void main() {
    vec4 color = texture2D(uTexture, vTexCoord);

    // gl_FragColor = vec4(color.r, color.g, color.b, 1);
    gl_FragColor = vec4(1, color.x, 0, 1);
}

// void main() {
//     vec2 cen = vec2(0.5, 0.5) - vTexCoord;
//     vec2 mcen = -0.07 * log(length(cen)) * normalize(cen);
//     gl_FragColor = texture2D(uTexture, vTexCoord - mcen);
// }
