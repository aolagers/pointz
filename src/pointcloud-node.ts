import {
    Box3,
    BufferGeometry,
    Camera,
    Float32BufferAttribute,
    Int32BufferAttribute,
    IntType,
    Mesh,
    MeshBasicMaterial,
    Points,
    Uint16BufferAttribute,
    Uint8BufferAttribute,
} from "three";
import { PointMaterial, pointMaterialPool } from "./materials/point-material";
import { boxToMesh } from "./utils";
import { OctreePath } from "./octree";
import { PointCloud, getChunkID } from "./pointcloud";
import { Viewer } from "./viewer";
import { CopcNodeInfo, LazSource, WorkerInfoResponse, WorkerPointsResponse } from "./copc-loader";
import { WorkerPool } from "./worker-pool";
import workerUrl from "./copc-loader?worker&url";

type RespMap = {
    info: WorkerInfoResponse;
    points: WorkerPointsResponse;
};

export const workerPool = new WorkerPool<RespMap>(workerUrl, 4);

type NodeState = "unloaded" | "loading" | "visible" | "error";

export class PointCloudNode {
    parent: PointCloud;
    nodeName: OctreePath;
    bounds: Box3;

    debugMesh: Mesh;

    spacing: number;

    state: NodeState;
    pointCount: number;

    copcInfo: CopcNodeInfo;

    data: null | {
        pco: Points;
        pickIndex: number;
    };

    isDemo: boolean = false;

    constructor(parent: PointCloud, name: OctreePath, bounds: Box3, spacing: number) {
        this.parent = parent;
        this.nodeName = name;
        this.bounds = bounds;
        this.spacing = spacing;

        this.state = "unloaded";
        this.data = null;

        this.copcInfo = this.parent.hierarchy.nodes[this.nodeName.join("-")]!;
        this.pointCount = this.copcInfo?.pointCount ?? 0;

        const cube = boxToMesh(this.bounds, name[0] === 0 ? "red" : name[0] === 1 ? "green" : "blue");
        if (name[0] === 0) {
            cube.scale.set(1.02, 1.02, 1.02);
        }
        if (name[0] === 1) {
            cube.scale.set(1.0, 1.0, 1.0);
        }
        if (name[0] === 2) {
            cube.scale.set(0.99, 0.99, 0.99);
        }
        if (name[0] > 2) {
            cube.scale.set(0.98, 0.98, 0.98);
        }
        this.debugMesh = cube;

        this.debugMesh.visible = false;
        // this.parent.viewer.scene.add(this.debugMesh);
    }

    get sizeBytes() {
        return this.copcInfo.pointDataLength;
    }

    get depth() {
        return this.nodeName[0];
    }

    getNodeVisibilityRating(camera: Camera) {
        // TODO: Add preference to points in the screen middle
        // IDEA: use bounding sphere instead of box?

        const dist = this.bounds.distanceToPoint(camera.position);
        // const screenRes = this.spacing / dist;

        const angle = Math.atan(this.spacing / dist);

        return -angle;
    }

    setState(state: NodeState) {
        this.state = state;
    }

    async load(viewer: Viewer) {
        if (this.state === "loading" || this.state === "visible") {
            console.warn("node already loading or loaded");
            return;
        }

        this.setState("loading");

        try {
            const pointData = await getChunk(this.parent.source, this.copcInfo, this.parent.offset.toArray());

            this.data = {
                pco: new Points(pointData.geometry, pointMaterialPool.getMaterial()),
                pickIndex: pointData.chunkId,
            };

            this.data.pco.matrixAutoUpdate = false;
            // TODO: dont use userData, it's ugly
            this.data.pco.userData.nodeIndex = this.data.pickIndex;

            this.setState("visible");

            viewer.addNode(this);

            return this.data;
        } catch (e) {
            // TODO: retry
            this.state === "error";
            this.debugMesh.visible = true;
            this.debugMesh.material = new MeshBasicMaterial({ color: "red", wireframe: true });
            throw e;
        }
    }

    unload(viewer: Viewer) {
        if (this.state === "unloaded") {
            console.warn("node already unloaded");
            return;
        }

        if (this.data) {
            viewer.scene.remove(this.data!.pco);
            if (this.data.pco.material instanceof PointMaterial) {
                pointMaterialPool.returnMaterial(this.data.pco.material);
            } else {
                throw new Error("Expected a PointMaterial");
            }
            this.data.pco.geometry.dispose();
        }

        this.data = null;
        this.setState("unloaded");
    }
}

async function getChunk(source: LazSource, node: CopcNodeInfo, offset: number[]) {
    const data = await workerPool.runTask({
        command: "points",
        source: source,
        node: node,
        offset: offset,
    });

    const geometry = new BufferGeometry();

    geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("color", new Uint8BufferAttribute(data.colors, 3, true));
    geometry.setAttribute("intensity", new Uint16BufferAttribute(data.intensities, 1, true));

    const classificationAttribute = new Int32BufferAttribute(data.classifications, 1);
    classificationAttribute.gpuType = IntType;
    geometry.setAttribute("classification", classificationAttribute);

    const ptIndexAttribute = new Int32BufferAttribute(data.indices, 1);
    ptIndexAttribute.gpuType = IntType;
    geometry.setAttribute("ptIndex", ptIndexAttribute);

    return { geometry: geometry, pointCount: data.pointCount, chunkId: getChunkID() };
}
