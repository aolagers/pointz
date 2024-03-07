import { Color, LineBasicMaterial, MeshBasicMaterial, ShaderMaterial, Texture, Vector2 } from "three";
import defaultFrag from "./shaders/default.frag";
import defaultVert from "./shaders/default.vert";
import edlFrag from "./shaders/edl.frag";
import edlVert from "./shaders/edl.vert";

export const pointer = new Vector2();

const lineMaterial = new LineBasicMaterial({ color: 0xff0000 });

const bboxMaterial = new MeshBasicMaterial({ color: "red", wireframe: true });

const ptSize = 3.0 * window.devicePixelRatio;

export function updateValues(c1: number, c2: number) {
    const uc1 = pointMaterial.uniforms.uCustom1;
    const uc2 = pointMaterial.uniforms.uCustom2;
    if (uc1) uc1.value = c1;
    if (uc2) uc2.value = c2;
}

const pointMaterial = new ShaderMaterial({
    uniforms: {
        uColor: { value: new Color(3403332) },
        uMouse: { value: pointer },
        ptSize: { value: ptSize },
        uCustom1: { value: 0.0 },
        uCustom2: { value: 0.0 },
    },
    vertexShader: defaultVert,
    fragmentShader: defaultFrag,
});

export function createEDLMaterial(tex: Texture) {
    const edlMaterial = new ShaderMaterial({
        uniforms: {
            tx: { value: tex },
        },
        vertexShader: edlVert,
        fragmentShader: edlFrag,
    });

    return edlMaterial;
}

export const MATERIALS = {
    LINE: lineMaterial,
    BBOX: bboxMaterial,
    POINT: pointMaterial,
};
