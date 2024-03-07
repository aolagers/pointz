import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { PointCloud } from "./pointcloud";
import { MATERIALS } from "./materials";

export function createTightBounds(pc: PointCloud) {
    const size = new Vector3().subVectors(pc.bounds.max, pc.bounds.min);
    const boundGeom = new BoxGeometry(...size.toArray());
    const cube = new Mesh(boundGeom, MATERIALS.BBOX);
    const halfSize = new Vector3().copy(size).divideScalar(2);
    const midP = new Vector3().subVectors(pc.bounds.min, pc.offset);
    cube.position.copy(midP).add(halfSize);

    return cube;
}

const bboxMaterial = new MeshBasicMaterial({ color: "yellow", wireframe: true });

export function createCubeBounds(b: [number, number, number, number, number, number], key: number[], offset: Vector3) {
    const D = key[0]!;
    const X = key[1]!;
    const Y = key[2]!;
    const Z = key[3]!;
    const fullSize = new Vector3(b[3] - b[0], b[4] - b[1], b[5] - b[2]);

    const divSize = new Vector3().copy(fullSize).divideScalar(Math.pow(2, D));
    const halfSize = new Vector3().copy(divSize).divideScalar(2);

    const boundGeom = new BoxGeometry(...divSize.toArray());
    const cube = new Mesh(boundGeom, bboxMaterial);

    const midP = new Vector3(
        b[0] - offset.x + X * divSize.x,
        b[1] - offset.y + Y * divSize.y,
        b[2] - offset.z + Z * divSize.z,
    );
    cube.position.copy(new Vector3().copy(midP)).add(halfSize);
    return cube;
}
