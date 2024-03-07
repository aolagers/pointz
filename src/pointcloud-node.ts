import { Box3, BufferGeometry, Mesh, Points } from "three";
import { PointMaterial, pointMaterialPool } from "./materials/point-material";
import { boxToMesh } from "./utils";
import { OctreePath } from "./octree";
import { PointCloud } from "./pointcloud";
import { Viewer } from "./viewer";

type NodeState = "unloaded" | "loading" | "visible";

export class PointCloudNode {
    parent: PointCloud;
    nodeName: OctreePath;
    bounds: Box3;
    pco: Points;

    pcIndex: number;

    debugMesh: Mesh;

    spacing: number;
    pointCount: number;

    state: NodeState;

    constructor(
        parent: PointCloud,
        name: OctreePath,
        geom: BufferGeometry,
        bounds: Box3,
        idx: number,
        spacing: number,
        pointCount: number
    ) {
        this.state = "unloaded";

        this.parent = parent;
        this.nodeName = name;
        this.bounds = bounds;

        const mat = pointMaterialPool.getMaterial();

        this.pco = new Points(geom, mat);
        this.pco.matrixAutoUpdate = false;

        this.pointCount = pointCount;

        const cube = boxToMesh(this.bounds, name[0] === 0 ? "red" : name[0] === 1 ? "green" : "blue");
        if (name[0] === 0) {
            cube.scale.set(1.02, 1.02, 1.02);
        }
        if (name[0] === 1) {
            cube.scale.set(0.99, 0.99, 0.99);
        }
        this.debugMesh = cube;
        this.pcIndex = idx;
        this.spacing = spacing;

        // TODO: dont use userData, it's ugly
        this.pco.userData.nodeIndex = idx;
    }

    get depth() {
        return this.nodeName[0];
    }

    load(viewer: Viewer) {
        if (this.state === "loading" || this.state === "visible") {
            console.warn("node already loading or loaded");
            return;
        }

        // TODO: load the data
    }

    unload(viewer: Viewer) {
        if (this.state === "unloaded") {
            console.warn("node already unloaded");
            return;
        }

        viewer.scene.remove(this.pco);

        if (this.pco.material instanceof PointMaterial) {
            pointMaterialPool.returnMaterial(this.pco.material);
        } else {
            throw new Error("Expected a PointMaterial");
        }

        this.pco.geometry.dispose();
    }
}
