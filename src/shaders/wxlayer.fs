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
float RawToCLUT(float);
vec4 CLUT(float);
int ISO(float);

void main() {
    float rawDataC = GetRawData(vTexCoordC); // central
    float clutPosC = RawToCLUT(rawDataC);
    vec4 colorC = CLUT(clutPosC);
    // int isoC = ISO(clutPosC);

    // float rawDataR = GetRawData(vTexCoordR); // central
    // float clutPosR = RawToCLUT(rawDataR);
    // int isoR = ISO(clutPosR);

    // float rawDataD = GetRawData(vTexCoordD); // central
    // float clutPosD = RawToCLUT(rawDataD);
    // int isoD = ISO(clutPosD);

    gl_FragColor = colorC;
    // if(isoC != isoD || isoC != isoR) {
    //     gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    // }

}

float GetRawData(vec2 texCoord) {
    vec4 dataTex = texture2D(dataTex, texCoord);
    float textureData = dataTex.r / 255.0 + dataTex.g;
    float rawData = textureData * dataDif + dataMin;
    return rawData;
}

float RawToCLUT(float realData) {
    float pos = (realData - clutMin) / clutDif;
    return pos;
}

vec4 CLUT(float pos) {
    return texture2D(CLUTTex, vec2(pos, 0.0));
}

int ISO(float pos) {
    return int(texture2D(CLUTTex, vec2(pos, 1.0)).r * 255.0);
}
