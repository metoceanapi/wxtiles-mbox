#pragma vscode_glsllint_stage : frag

precision highp float;

varying vec2 vTexCoordC;
varying vec2 vTexCoordR;
varying vec2 vTexCoordD;

uniform sampler2D dataTex;
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
    float rawC = GetRawData(vTexCoordC); // central
    float posC = RawToPos(rawC);
    vec4 colorC = CLUT(posC);
    int isoC = ISO(posC);

    float rawR = GetRawData(vTexCoordR); // central
    float posR = RawToPos(rawR);
    int isoR = ISO(posR);

    float rawD = GetRawData(vTexCoordD); // central
    float posD = RawToPos(rawD);
    int isoD = ISO(posD);

    gl_FragColor = colorC;
    if(isoC != isoD || isoC != isoR) {
        gl_FragColor = vec4(1.0 - colorC.r, 1.0 - colorC.g, 1.0 - colorC.b, colorC.a);
    }

}

float GetRawData(vec2 texCoord) {
    vec4 dataTex = texture2D(dataTex, texCoord);
    float textureData = dataTex.r / 255.0 + dataTex.g;
    float rawData = textureData * dataDif + dataMin;
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
