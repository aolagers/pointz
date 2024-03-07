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
    Ray,
    Uint16BufferAttribute,
    Uint8BufferAttribute,
    Vector3,
} from "three";
import { PointMaterial, pointMaterialPool } from "./materials/point-material";
import { boxToMesh } from "./utils";
import { OctreePath } from "./octree";
import { PointCloud } from "./pointcloud";
import { Viewer } from "./viewer";
import { CopcNodeInfo, WorkerPointsRequest, WorkerPointsResponse } from "./copc-loader";
import { WorkerPool } from "./worker-pool";
import workerUrl from "./copc-loader?worker&url";

export const pointsWorkerPool = new WorkerPool<
    {
        info: { abort: AbortController; score: number; node: PointCloudNode };
        command: WorkerPointsRequest;
    },
    WorkerPointsResponse
>(workerUrl, 4);

type NodeState = "unloaded" | "loading" | "visible" | "cached" | "error";

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

    static stats = {
        retries: 0,
        errors: 0,
        loads: 0,
    };

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
        this.parent.viewer.scene.add(this.debugMesh);
    }

    get sizeBytes() {
        return this.copcInfo.pointDataLength;
    }

    get depth() {
        return this.nodeName[0];
    }

    estimateNodeError(camera: Camera) {
        // IDEA: use bounding sphere instead of box?

        const cameraRay = new Ray(camera.position, camera.getWorldDirection(new Vector3()));
        const dist = this.bounds.distanceToPoint(camera.position);

        const center = this.bounds.getCenter(new Vector3());
        const centerDist = cameraRay.distanceToPoint(center);

        const angle = Math.atan(this.spacing / (dist + centerDist));

        return angle;
    }

    setState(set_to: NodeState): NodeState {
        const err = () => new Error(`Invalid state change ${this.state} => ${set_to}`);
        switch (this.state) {
            case "unloaded":
                if (set_to === "loading") {
                    return (this.state = set_to);
                }
                throw err();
            case "loading":
                if (set_to === "visible" || set_to === "error" || set_to === "unloaded") {
                    return (this.state = set_to);
                }
                throw err();
            case "error":
                if (set_to === "loading" || set_to === "unloaded") {
                    return (this.state = set_to);
                }
                throw err();
            case "visible":
                if (set_to === "cached") {
                    return (this.state = set_to);
                }
                throw err();
            case "cached":
                if (set_to === "visible" || set_to === "unloaded") {
                    return (this.state = set_to);
                }
                throw err();
        }
    }

    show(viewer: Viewer) {
        this.assertState("loading", "cached");

        if (this.state === "cached") {
            this.data!.pco.visible = true;
        } else if (this.state === "loading") {
            viewer.addNode(this);
        }

        this.debugMesh.visible = false;
        this.setState("visible");
    }

    cache() {
        this.assertState("visible");
        this.data!.pco.visible = false;
        this.setState("cached");
    }

    async load(viewer: Viewer, retry = 2) {
        this.assertState("unloaded", "error");

        this.setState("loading");

        try {
            this.debugMesh.visible = true;
            viewer.requestRender();
            const pointData = await this.getChunk(this.estimateNodeError(viewer.camera));

            pointData.geometry.boundingBox = this.bounds;

            this.data = {
                pco: new Points(pointData.geometry, pointMaterialPool.getMaterial()),
                pickIndex: 0,
            };
            this.data.pco.matrixAutoUpdate = false;

            PointCloudNode.stats.loads++;
            this.show(viewer);
        } catch (e) {
            this.setState("error");
            if (retry > 0) {
                PointCloudNode.stats.retries++;
                console.error("RETRY ERROR", retry, e);
                await new Promise((resolve) => setTimeout(resolve, 200));
                await this.load(viewer, retry - 1);
            } else {
                PointCloudNode.stats.errors++;
                this.debugMesh.visible = true;
                this.debugMesh.material = new MeshBasicMaterial({ color: "red", wireframe: true });
                throw e;
            }
        }
    }

    unload(viewer: Viewer) {
        this.assertState("loading", "cached");

        if (this.data) {
            viewer.scene.remove(this.data.pco);
            if (this.data.pco.material instanceof PointMaterial) {
                pointMaterialPool.returnMaterial(this.data.pco.material);
            }
            this.data.pco.geometry.dispose();
        }

        this.debugMesh.visible = false;

        this.data = null;
        this.setState("unloaded");
    }

    async getChunk(score: number) {
        const data = await pointsWorkerPool.runTask({
            info: {
                abort: new AbortController(),
                score: score,
                node: this,
            },
            command: {
                command: "points",
                nodeInfo: this.copcInfo,
                offset: this.parent.offset.toArray(),
                source: this.parent.source,
            },
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

        return { geometry: geometry, pointCount: data.pointCount };
    }

    assertState(...states: NodeState[]) {
        if (!states.includes(this.state)) {
            throw new Error(`Node state ${this.state} not in ${states.join(",")}`);
        }
    }
}
