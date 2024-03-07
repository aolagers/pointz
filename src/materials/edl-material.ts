import { DepthTexture, ShaderMaterial, Texture } from "three";
import { CAMERA_FAR, CAMERA_NEAR } from "../settings";
import edlFrag from "../shaders/edl.frag";
import edlVert from "../shaders/edl.vert";

export class EDLMaterial extends ShaderMaterial {
    constructor(colorTexture: Texture, depthTexture: DepthTexture) {
        super({
            glslVersion: "300 es",
            uniforms: {
                uCameraNear: { value: CAMERA_NEAR },
                uCameraFar: { value: CAMERA_FAR },
                uColorTexture: { value: colorTexture },
                uDepthTexture: { value: depthTexture },
                uResolution: { value: [50, 50] },
            },
            vertexShader: edlVert,
            fragmentShader: edlFrag,
        });
    }
}
