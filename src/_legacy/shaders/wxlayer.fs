#pragma vscode_glsllint_stage : frag

precision highp float;

varying vec2 vTexCoordC;
varying vec2 vTexCoordR;
varying vec2 vTexCoordD;

uniform sampler2D dataTex;
uniform sampler2D dataTex2; // TODO: bind non lenear texture and if r===0 -> transparent!
uniform sampler2D CLUTTex;

uniform float dataMin;
uniform float dataDif;
uniform float clutMin;
uniform float clutDif;

// Consts

// Func Protos
float GetRawData(vec2);
float RawToPos(float);
vec4 CLUT(float);
int ISO(float);

void main() {

    vec4 tex2 = texture2D(dataTex2, vTexCoordC);
    if(tex2.g + tex2.r == 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
        return;
    }

    float rawC = GetRawData(vTexCoordC); // central
    float posC = RawToPos(rawC);
    vec4 colorC = CLUT(posC);
    int isoC = ISO(posC);

    float rawR = GetRawData(vTexCoordR); // Right
    float posR = RawToPos(rawR);
    int isoR = ISO(posR);

    float rawD = GetRawData(vTexCoordD); // Bottom
    float posD = RawToPos(rawD);
    int isoD = ISO(posD);

    gl_FragColor = colorC;
    if(isoC != isoD || isoC != isoR) {
        gl_FragColor = vec4(1.0 - colorC.r, 1.0 - colorC.g, 1.0 - colorC.b, colorC.a);
        // gl_FragColor = vec4(colorC.r, colorC.g, colorC.b, colorC.a);
    }
}

float GetRawData(vec2 texCoord) {
    vec4 tex = texture2D(dataTex, texCoord);
    float texData = tex.r / 255.0 + tex.g;
    float rawData = texData * dataDif + dataMin;
    return rawData;
}

float RawToPos(float realData) {
    float pos = (realData - clutMin) / clutDif;
    return pos;
}

vec4 CLUT(float pos) {
    return texture2D(CLUTTex, vec2(pos, 0.0));
}

int ISO(float pos) {
    return int(texture2D(CLUTTex, vec2(pos, 1.0)).r * 255.0);
}
