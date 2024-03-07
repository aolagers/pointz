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
    float depth = readDepth(depthTexture, vUv);

    float range = cameraFar - cameraNear;
    float dz = 2.0 * 1.0/range;

    float F = 0.001;

    float depth1 = readDepth(depthTexture, vUv + vec2(F, 0.0));
    float depth2 = readDepth(depthTexture, vUv + vec2(-F, 0.0));
    float depth3 = readDepth(depthTexture, vUv + vec2(0.0, F));
    float depth4 = readDepth(depthTexture, vUv + vec2(0.0, -F));

    if (depth1 > depth+dz ||
        depth2 > depth+dz ||
        depth3 > depth+dz ||
        depth4 > depth+dz
       ) {
        gl_FragColor = vec4(color.xyz * 0.5, 1.0);
    } else {
        //gl_FragColor = vec4(color.xyz * (1.0-depth), 1.0);
        gl_FragColor = vec4(color.xyz, 1.0);

    }
}

