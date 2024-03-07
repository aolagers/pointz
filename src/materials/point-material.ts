import { Color, ShaderMaterial, Vector2 } from "three";
import { COLOR_MODE, PIXEL_RATIO } from "../settings";
import defaultFrag from "../shaders/default.frag";
import defaultVert from "../shaders/default.vert";

let ptSize = 4.0 * PIXEL_RATIO;

let pointMaterial: ShaderMaterial | null = null;

export function updatePointSize(amount: number) {
    if (!pointMaterial) return;
    ptSize += amount;
    const uc1 = pointMaterial.uniforms.ptSize;
    if (uc1) {
        uc1.value = ptSize;
    }
    pointMaterial.needsUpdate = true;
}

export function setPointer(pointer: Vector2) {
    if (!pointMaterial) return;
    const uc1 = pointMaterial.uniforms.uMouse;
    if (uc1) uc1.value = pointer;
}

export function updateSliders(c1: number, c2: number) {
    if (!pointMaterial) return;

    const uc1 = pointMaterial.uniforms.uCustom1;
    const uc2 = pointMaterial.uniforms.uCustom2;
    if (uc1) uc1.value = c1;
    if (uc2) uc2.value = c2;
}

export function changeColorMode(color: keyof typeof COLOR_MODE) {
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
            COLOR_MODE: COLOR_MODE.RGB,
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
