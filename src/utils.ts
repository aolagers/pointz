import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { PointCloud } from "./pointcloud";
import { MATERIALS } from "./materials";

export function createTightBounds(pc: PointCloud) {
    const size = pc.bounds.getSize(new Vector3());
    const halfSize = size.clone().divideScalar(2);
    const boundGeom = new BoxGeometry(...size);
    const cube = new Mesh(boundGeom, MATERIALS.BBOX);
    cube.position.copy(pc.bounds.min).sub(pc.offset).add(halfSize);
    return cube;
}

const bboxMaterial = new MeshBasicMaterial({ color: "yellow", wireframe: true });

export function createCubeBounds(baseCube: [number, number, number, number, number, number], key: number[], offset: Vector3) {
    const D = key[0]!;
    const X = key[1]!;
    const Y = key[2]!;
    const Z = key[3]!;

    const fullSize = new Vector3(baseCube[3] - baseCube[0], baseCube[4] - baseCube[1], baseCube[5] - baseCube[2]);
    const divSize = new Vector3().copy(fullSize).divideScalar(Math.pow(2, D));
    const halfSize = new Vector3().copy(divSize).divideScalar(2);

    const boundGeom = new BoxGeometry(...divSize);
    const cube = new Mesh(boundGeom, bboxMaterial);

    const midP = new Vector3(
        baseCube[0] - offset.x + X * divSize.x,
        baseCube[1] - offset.y + Y * divSize.y,
        baseCube[2] - offset.z + Z * divSize.z,
    );
    cube.position.copy(new Vector3().copy(midP)).add(halfSize);
    return cube;
}
