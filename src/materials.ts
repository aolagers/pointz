import { Color, LineBasicMaterial, MeshBasicMaterial, ShaderMaterial, Vector2 } from "three";
import fragment from "./shaders/default.frag";
import vertex from "./shaders/default.vert";

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
    vertexShader: vertex,
    fragmentShader: fragment,
});

export const MATERIALS = {
    LINE: lineMaterial,
    BBOX: bboxMaterial,
    POINT: pointMaterial,
};
