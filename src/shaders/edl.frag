#include <packing>

uniform sampler2D uColorTexture;
uniform sampler2D uDepthTexture;

uniform float uCameraNear;
uniform float uCameraFar;
uniform uint uResolution[2];

in vec2 vUv;

out vec4 FragColor;

float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture(depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
    return viewZToOrthographicDepth(viewZ, uCameraNear, uCameraFar);
}

void main() {
    vec4 color = texture(uColorTexture, vUv);

    if (color.a == 1.0) {
        // material is not pointcloud, skip EDL
        FragColor = vec4(color.xyz, 1.0);
        return;
    }

    float depth = readDepth(uDepthTexture, vUv);

    float range = uCameraFar - uCameraNear;
    float dz = 2.0 * 1.0/range;

    float edlWidth = 1.0;

    float dX = edlWidth / float(uResolution[0]);
    float dY = edlWidth / float(uResolution[1]);

    float depth1 = readDepth(uDepthTexture, vUv + vec2(dX, 0.0));
    float depth2 = readDepth(uDepthTexture, vUv + vec2(-dX, 0.0));
    float depth3 = readDepth(uDepthTexture, vUv + vec2(0.0, dY));
    float depth4 = readDepth(uDepthTexture, vUv + vec2(0.0, -dY));

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

    if (ddif > 1.000 ) {
        FragColor = vec4(color.xyz * max(0.1, (1.0 - ddif/30.0)), color.a);
    } else {
        //gl_FragColor = vec4(color.xyz * (1.0-depth), 1.0);
        FragColor = vec4(color.xyz, color.a);
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

