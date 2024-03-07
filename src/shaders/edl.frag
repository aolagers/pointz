#include <packing>

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture2D(depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
}

void main() {
    vec4 color = texture2D(colorTexture, vUv);

    if (color.a == 1.0) {
        // material is not pointcloud, skip EDL
        gl_FragColor = vec4(color.xyz, 1.0);
        return;
    }

    float depth = readDepth(depthTexture, vUv);

    float range = cameraFar - cameraNear;
    float dz = 2.0 * 1.0/range;

    float F = 0.001;

    float depth1 = readDepth(depthTexture, vUv + vec2(F, 0.0));
    float depth2 = readDepth(depthTexture, vUv + vec2(-F, 0.0));
    float depth3 = readDepth(depthTexture, vUv + vec2(0.0, F));
    float depth4 = readDepth(depthTexture, vUv + vec2(0.0, -F));

    float dm = range * depth;
    float d1 = range * depth1;
    float d2 = range * depth2;
    float d3 = range * depth3;
    float d4 = range * depth4;

    float ddif = 0.0
        + max(0.0, d1 - dm)
        + max(0.0, d2 - dm)
        + max(0.0, d3 - dm)
        + max(0.0, d4 - dm);

    //if (depth1 > depth+dz ||
        //depth2 > depth+dz ||
        //depth3 > depth+dz ||
        //depth4 > depth+dz
    if (ddif > 3.000 ) {
        gl_FragColor = vec4(color.xyz * max(0.3, (1.0 - ddif/50.0)), 1.0);
    } else {
        //gl_FragColor = vec4(color.xyz * (1.0-depth), 1.0);
        gl_FragColor = vec4(color.xyz, 1.0);
    }

    // Fog
    /*
    float from = 0.9;
    if (depth > from) {
        float m = 1.0 - (depth-from)/(1.0-from);
        gl_FragColor.xyz *= m;
        //gl_FragColor.a = m;
    }
    */
}

