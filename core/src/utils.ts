import { Box3, BoxGeometry, Camera, Frustum, Matrix4, Mesh, MeshBasicMaterial, Vector2, Vector3 } from "three";
import { OctreePath } from "./octree";
import { PointCloud } from "./pointcloud";

const tightBboxMaterial = new MeshBasicMaterial({ color: "lightgreen", wireframe: true });

const colorCache = new Map<string, MeshBasicMaterial>();
function getWireframeMaterial(color: string) {
    if (colorCache.has(color)) {
        return colorCache.get(color)!;
    } else {
        const mat = new MeshBasicMaterial({ color: color, wireframe: true, depthWrite: false });
        colorCache.set(color, mat);
        return mat;
    }
}

export function createTightBounds(pc: PointCloud) {
    const size = pc.tightBounds.getSize(new Vector3());
    const halfSize = size.clone().divideScalar(2);
    const boundGeom = new BoxGeometry(...size);
    const cube = new Mesh(boundGeom, tightBboxMaterial);
    cube.position.copy(pc.tightBounds.min).add(halfSize);

    return cube;
}

export function printVec(v: Vector3 | Vector2) {
    if (v instanceof Vector2) {
        return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`;
    } else {
        return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
    }
}

export function boxToMesh(box: Box3, color: string) {
    const size = box.getSize(new Vector3());
    const halfSize = size.clone().divideScalar(2);
    const boundGeom = new BoxGeometry(...size);

    const mat = getWireframeMaterial(color);
    const cube = new Mesh(boundGeom, mat);

    cube.position.copy(box.min).add(halfSize);
    return cube;
}

export function nodeToBox(base: Box3, key: OctreePath, customOffset: Vector3) {
    const D = key[0];
    const X = key[1];
    const Y = key[2];
    const Z = key[3];

    const size = base.getSize(new Vector3());
    const divSize = size.divideScalar(Math.pow(2, D));

    const move = new Vector3(X * divSize.x, Y * divSize.y, Z * divSize.z);

    const newMin = base.min.clone().add(move).sub(customOffset);

    const nodeBox = new Box3(newMin, newMin.clone().add(divSize));

    return nodeBox;
}

export function getCameraFrustum(camera: Camera) {
    const frustum = new Frustum();
    const projScreenMatrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    return frustum;
}

export function stringifyError(e: unknown) {
    if (e instanceof Error) {
        return JSON.stringify(e, Object.getOwnPropertyNames(e));
    } else if (typeof e === "string") {
        return e;
    } else {
        return JSON.stringify(e);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<F extends (...args: any[]) => void>(interval_ms: number, fn: F) {
    let lastRun = 0;
    let handle = 0;

    return (...args: Parameters<F>) => {
        if (lastRun === 0 || performance.now() - lastRun > interval_ms) {
            // run immediately if first time or long enouth from previous
            lastRun = performance.now();
            fn(...args);
        } else {
            // run after the interval time has passed since last run
            clearTimeout(handle);
            handle = setTimeout(
                () => {
                    lastRun = performance.now();
                    fn(...args);
                },
                interval_ms - (performance.now() - lastRun)
            );
        }
    };
}
