import { DepthTexture, ShaderMaterial, Texture } from "three";
import { CAMERA_FAR, CAMERA_NEAR } from "../settings";
import edlFrag from "../shaders/edl.frag";
import edlVert from "../shaders/edl.vert";

export function createEDLMaterial(colorTexture: Texture, depthTexture: DepthTexture) {
    const edlMaterial = new ShaderMaterial({
        uniforms: {
            cameraNear: { value: CAMERA_NEAR },
            cameraFar: { value: CAMERA_FAR },
            colorTexture: { value: colorTexture },
            depthTexture: { value: depthTexture },
        },
        vertexShader: edlVert,
        fragmentShader: edlFrag,
    });

    return edlMaterial;
}
