import { DepthTexture, ShaderMaterial, Texture } from "three";
import { CAMERA_FAR, CAMERA_NEAR } from "../settings";
import edlFrag from "../shaders/edl.frag";
import edlVert from "../shaders/edl.vert";

export class EDLMaterial extends ShaderMaterial {
    constructor(colorTexture: Texture, depthTexture: DepthTexture) {
        super({
            glslVersion: "300 es",
            uniforms: {
                cameraNear: { value: CAMERA_NEAR },
                cameraFar: { value: CAMERA_FAR },
                colorTexture: { value: colorTexture },
                depthTexture: { value: depthTexture },
            },
            vertexShader: edlVert,
            fragmentShader: edlFrag,
        });
    }
}
