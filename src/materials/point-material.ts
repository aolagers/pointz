import { Color, ShaderMaterial, Vector2 } from "three";
import { COLOR_MODE } from "../settings";
import defaultFrag from "../shaders/default.frag";
import defaultVert from "../shaders/default.vert";

export const pointMaterialPool = {
    stash: [] as PointMaterial[],
    rented: [] as PointMaterial[],
    all: [] as PointMaterial[],

    getMaterial() {
        let m: PointMaterial;
        if (this.stash.length) {
            m = this.stash.pop()!;
        } else {
            m = new PointMaterial(false);
            this.all.push(m);
        }
        this.rented.push(m);
        return m;
    },

    returnMaterial(mat: PointMaterial) {
        this.rented.splice(this.rented.indexOf(mat), 1);
        this.stash.push(mat);
    },
};

const DEFAULT_PT_SIZE = 6.0;
export class PointMaterial extends ShaderMaterial {
    nodeIndex = 0;

    ptSize = DEFAULT_PT_SIZE;

    constructor(pick: boolean, nodeIndex = 0) {
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
                ptSize: { value: DEFAULT_PT_SIZE },
                uCustom1: { value: 0.0 },
                uCustom2: { value: 0.0 },
                // uClassMask: { value: 0xffff & ~(1 << 2) },
                uClassMask: { value: 0xffff },
                uNodeIndex: { value: 0 },
            },
            vertexShader: defaultVert,
            fragmentShader: defaultFrag,
        });

        this.updateNodeIndex(nodeIndex);
    }

    updateNodeIndex(nodeIndex: number) {
        if (nodeIndex !== this.nodeIndex) {
            this.uniforms.uNodeIndex.value = nodeIndex;
            this.nodeIndex = nodeIndex;

            this.needsUpdate = true;
        }
    }

    updatePointSize(amount: number) {
        this.ptSize += amount;
        const uc1 = this.uniforms.ptSize;
        if (uc1) {
            uc1.value = this.ptSize;
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
