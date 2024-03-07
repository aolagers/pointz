import { Color, DepthTexture, ShaderMaterial, Texture, Vector2 } from "three";
import { CAMERA_FAR, CAMERA_NEAR, COLOR_MODE, PIXEL_RATIO } from "./settings";
import defaultFrag from "./shaders/default.frag";
import defaultVert from "./shaders/default.vert";
import edlFrag from "./shaders/edl.frag";
import edlVert from "./shaders/edl.vert";

const ptSize = 4.0 * PIXEL_RATIO;

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

let pointMaterial: ShaderMaterial | null = null;

export function setPointer(pointer: Vector2) {
    if (!pointMaterial) return;
    const uc1 = pointMaterial.uniforms.uMouse;
    if (uc1) uc1.value = pointer;
}

export function updateMaterials1(c1: number, c2: number) {
    if (!pointMaterial) return;

    const uc1 = pointMaterial.uniforms.uCustom1;
    const uc2 = pointMaterial.uniforms.uCustom2;
    if (uc1) uc1.value = c1;
    if (uc2) uc2.value = c2;
}

export function updateMaterials2(color: keyof typeof COLOR_MODE) {
    if (!pointMaterial) return;
    pointMaterial.defines.COLOR_MODE = COLOR_MODE[color];
    pointMaterial.needsUpdate = true;
}

export function getPointMaterial() {
    if (pointMaterial) {
        return pointMaterial;
    }

    pointMaterial = new ShaderMaterial({
        defines: {
            // 0: intensity
            // 1: classification
            // 2: rgb
            COLOR_MODE: "2",
        },
        uniforms: {
            uColor: { value: new Color(3403332) },
            uMouse: { value: new Vector2(0, 0) },
            ptSize: { value: ptSize },
            uCustom1: { value: 0.0 },
            uCustom2: { value: 0.0 },
        },
        vertexShader: defaultVert,
        fragmentShader: defaultFrag,
    });

    return pointMaterial;
}
