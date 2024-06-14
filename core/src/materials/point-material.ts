import { Material, ShaderMaterial } from "three";
import { COLOR_MODE, LOCALSTORAGE_KEYS } from "../settings";
import defaultFrag from "../shaders/default.frag";
import defaultVert from "../shaders/default.vert";

class MaterialPool {
    stash: PointMaterial[] = [];
    all: PointMaterial[] = [];

    pick: boolean;

    constructor(pick: boolean) {
        this.pick = pick;
    }

    getMaterial() {
        let m: PointMaterial;
        if (this.stash.length) {
            m = this.stash.pop()!;
        } else {
            m = new PointMaterial(this.pick);
            this.all.push(m);
        }
        return m;
    }

    returnMaterial(mat: Material | Material[]) {
        if (mat === DEFAULT_POINT_MATERIAL) {
            // console.warn("NO-OP returned default point material");
        } else if (mat instanceof PointMaterial) {
            this.stash.push(mat);
        } else {
            throw new Error("Expected a PointMaterial");
        }
    }
}

export const pointMaterialPool = new MaterialPool(false);
export const pickMaterialPool = new MaterialPool(true);

const DEFAULT_PT_SIZE = 6.0;

export class PointMaterial extends ShaderMaterial {
    nodeIndex = 0;

    isPickMaterial: boolean;

    ptSize = DEFAULT_PT_SIZE;

    constructor(pick: boolean) {
        const colorMode: keyof typeof COLOR_MODE =
            (localStorage.getItem(LOCALSTORAGE_KEYS.COLOR_MODE) as keyof typeof COLOR_MODE) ?? "RGB";
        super({
            glslVersion: "300 es",
            defines: {
                COLOR_MODE: COLOR_MODE[colorMode],
                PICK: pick ? true : false,
            },
            uniforms: {
                ptSize: { value: DEFAULT_PT_SIZE },
                uClassMask: { value: 0xffffffff },
                uNodeIndex: { value: 0 },
            },
            vertexShader: defaultVert,
            fragmentShader: defaultFrag,
        });

        this.isPickMaterial = pick;
    }

    updateNodeIndex(nodeIndex: number) {
        if (!this.isPickMaterial) {
            console.warn("not pick material");
            return;
        }

        if (nodeIndex !== this.nodeIndex) {
            this.uniforms.uNodeIndex.value = nodeIndex;
            this.nodeIndex = nodeIndex;
        }
    }

    updatePointSize(amount: number) {
        this.ptSize += amount;
        const uc1 = this.uniforms.ptSize;
        if (uc1) {
            uc1.value = this.ptSize;
        }
    }

    changeColorMode(color: keyof typeof COLOR_MODE) {
        localStorage.setItem(LOCALSTORAGE_KEYS.COLOR_MODE, color);
        this.defines.COLOR_MODE = COLOR_MODE[color];
        this.needsUpdate = true;
    }
}

export const DEFAULT_POINT_MATERIAL = new PointMaterial(false);
