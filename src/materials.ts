import { Color, LineBasicMaterial, MeshBasicMaterial, ShaderMaterial, Vector2 } from "three";
import fragment from "./shaders/default.frag";
import vertex from "./shaders/default.vert";

export const pointer = new Vector2();

const lineMaterial = new LineBasicMaterial({ color: 0xff0000 });

const bboxMaterial = new MeshBasicMaterial({ color: "red", wireframe: true });

const ptSize = 3.0 * window.devicePixelRatio;

const pointMaterial = new ShaderMaterial({
    uniforms: {
        uColor: { value: new Color(3403332) },
        uMouse: { value: pointer },
        ptSize: { value: ptSize },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
});

export const MATERIALS = {
    LINE: lineMaterial,
    BBOX: bboxMaterial,
    POINT: pointMaterial,
};
