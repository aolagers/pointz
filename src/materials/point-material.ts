import { Color, ShaderMaterial, Vector2 } from "three";
import { COLOR_MODE } from "../settings";
import defaultFrag from "../shaders/default.frag";
import defaultVert from "../shaders/default.vert";

let ptSize = 6.0;

export class PointMaterial extends ShaderMaterial {
    constructor(pick: boolean) {
        const colorMode: keyof typeof COLOR_MODE = (localStorage.getItem("COLOR_MODE") as any) || "RGB";
        super({
            glslVersion: "300 es",
            defines: {
                COLOR_MODE: COLOR_MODE[colorMode],
                PICK: pick ? true : false,
            },
            uniforms: {
                uColor: { value: new Color(3403332) },
                uMouse: { value: new Vector2(0, 0) },
                ptSize: { value: ptSize },
                uCustom1: { value: 0.0 },
                uCustom2: { value: 0.0 },
                // uClassMask: { value: 0xffff & ~(1 << 2) },
                uClassMask: { value: 0xffff },
            },
            vertexShader: defaultVert,
            fragmentShader: defaultFrag,
        });
    }

    updatePointSize(amount: number) {
        ptSize += amount;
        const uc1 = this.uniforms.ptSize;
        if (uc1) {
            uc1.value = ptSize;
        }
        this.needsUpdate = true;
    }

    setPointer(pointer: Vector2) {
        const uc1 = this.uniforms.uMouse;
        if (uc1) uc1.value = pointer;
    }

    updateSliders(c1: number, c2: number) {
        const uc1 = this.uniforms.uCustom1;
        const uc2 = this.uniforms.uCustom2;
        if (uc1) uc1.value = c1;
        if (uc2) uc2.value = c2;
    }

    changeColorMode(color: keyof typeof COLOR_MODE) {
        localStorage.setItem("COLOR_MODE", color);
        this.defines.COLOR_MODE = COLOR_MODE[color];
        this.needsUpdate = true;
    }
}
