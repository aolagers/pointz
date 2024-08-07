import { LRUCache } from "lru-cache";
import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Int32BufferAttribute,
    IntType,
    Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Points,
    Uint16BufferAttribute,
    Uint8BufferAttribute,
    Vector3,
} from "three";
import type { CopcNodeInfo, WorkerPoints } from "./copc-loader";
import workerUrl from "./copc-loader?worker&url";
import { DEFAULT_POINT_MATERIAL, PointMaterial, pointMaterialPool } from "./materials/point-material";
import { OctreePath } from "./octree";
import { PointCloud } from "./pointcloud";
import { POINT_BUDGET } from "./settings";
import { boxToMesh } from "./utils";
import { Viewer } from "./viewer";
import { WorkerPool } from "./worker-pool";

export const pointsWorkerPool = new WorkerPool<
    {
        info: { score: number; node: PointCloudNode };
        command: WorkerPoints["Request"];
    },
    WorkerPoints["Response"]
>(workerUrl, 4);

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(globalThis as any).pointsWorkerPool = pointsWorkerPool;

const nodeCache = new LRUCache<string, PointCloudNode>({
    // max: 10,
    maxSize: POINT_BUDGET * 2,

    sizeCalculation(value) {
        // console.log("SIZE", value, value.pointCount);
        if (!value) return 1;
        if (value.pointCount === 0) return 1;
        return value.pointCount;
    },

    dispose(node, key, reason) {
        if (reason === "set" || reason === "evict") {
            console.log("CACHE DROP", reason, key, node.state, nodeCache.size, nodeCache.calculatedSize, node);
            node.unload(node.parent.viewer);
        }
    },
});

type NodeState = "unloaded" | "loading" | "visible" | "cached" | "error";

export class PointCloudNode {
    static visibleNodes = new Set<PointCloudNode>();

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

    cacheID: string;

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

        this.cacheID = `${this.parent.id}-${this.nodeName.join("-")}`;

        const colors = ["yellowgreen", "lightskyblue", "pink", "springgreen", "coral", "aquamarine"];
        let color = "white";
        if (name[0] >= 2) {
            color = colors[(name[0] - 2) % colors.length];
        }

        const cube = boxToMesh(this.bounds, color);

        const s = 1 - name[0] / 300;
        cube.scale.set(s, s, s);

        this.debugMesh = cube;

        this.debugMesh.visible = false;
        this.parent.viewer.scene.add(this.debugMesh);
    }

    get depth() {
        return this.nodeName[0];
    }

    estimateNodeError(camera: PerspectiveCamera | OrthographicCamera) {
        // IDEA: use bounding sphere instead of box?

        const dist =
            camera instanceof OrthographicCamera
                ? camera.right - camera.left
                : this.bounds.distanceToPoint(camera.position);

        // const cameraRay = new Ray(camera.position, camera.getWorldDirection(new Vector3()));
        // const center = this.bounds.getCenter(new Vector3());
        // const centerDist = cameraRay.distanceToPoint(center);
        // return this.spacing / (dist + centerDist);

        return this.spacing / dist;
    }

    setState(set_to: NodeState): NodeState {
        const err = () => new Error(`Invalid state change ${this.state} => ${set_to}`);
        switch (this.state) {
            case "unloaded":
                if (set_to === "loading" || set_to === "unloaded") {
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

    show() {
        this.assertState("loading", "cached");

        if (!this.data) {
            throw new Error("node claims to be loading but has no data");
        }

        if (this.state === "cached") {
            nodeCache.delete(this.cacheID);
            // console.log("CACHE STATS", nodeCache.size, nodeCache.calculatedSize);
            this.data.pco.visible = true;
        } else if (this.state === "loading") {
            this.parent.group.add(this.data.pco);
            this.parent.viewer.requestRender("new node");
        }

        PointCloudNode.visibleNodes.add(this);

        this.debugMesh.visible = false;
        this.setState("visible");
    }

    cache() {
        this.assertState("visible");
        this.data!.pco.visible = false;
        this.setState("cached");

        PointCloudNode.visibleNodes.delete(this);
        nodeCache.set(this.cacheID, this);
    }

    async load(viewer: Viewer, retry = 2) {
        this.assertState("unloaded", "error");

        this.setState("loading");

        try {
            this.debugMesh.visible = viewer.debug_mode;
            viewer.requestRender("start loading");
            const pointData = await this.getChunk(this.estimateNodeError(viewer.camera), viewer.customOffset);

            pointData.geometry.boundingBox = this.bounds;

            this.data = {
                pco: new Points(pointData.geometry, DEFAULT_POINT_MATERIAL),
                pickIndex: 0,
            };
            this.data.pco.matrixAutoUpdate = false;

            PointCloudNode.stats.loads++;
            if (this.state === "unloaded") {
                console.warn("node was unloaded before loading finished");
            } else {
                this.show();
            }
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
        this.assertState("loading", "cached", "unloaded");

        if (this.data) {
            this.parent.group.remove(this.data.pco);
            if (this.data.pco.material instanceof PointMaterial) {
                pointMaterialPool.returnMaterial(this.data.pco.material);
            }
            this.data.pco.geometry.dispose();
        }

        viewer.scene.remove(this.debugMesh);
        this.debugMesh.geometry.dispose();

        PointCloudNode.visibleNodes.delete(this);

        this.debugMesh.visible = false;

        this.data = null;

        this.setState("unloaded");
    }

    async getChunk(score: number, customOffset: Vector3) {
        // TODO: figure out how to abort this

        const geometry = new BufferGeometry();
        let ptCount = this.copcInfo.pointCount;

        if (this.copcInfo.pointCount > 0) {
            // only try fetching if the are points available
            const data = await pointsWorkerPool.runTask({
                info: {
                    score: score,
                    node: this,
                },
                command: {
                    command: "getChunk",
                    nodeInfo: this.copcInfo,
                    offset: new Vector3().addVectors(this.parent.headerOffset, customOffset).toArray(),
                    source: this.parent.source,
                },
            });
            geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
            geometry.setAttribute("color", new Uint8BufferAttribute(data.colors, 3, true));
            geometry.setAttribute("intensity", new Uint16BufferAttribute(data.intensities, 1, true));

            const classificationAttribute = new Int32BufferAttribute(data.classifications, 1);
            classificationAttribute.gpuType = IntType;
            geometry.setAttribute("classification", classificationAttribute);

            const ptIndexAttribute = new Int32BufferAttribute(data.indices, 1);
            ptIndexAttribute.gpuType = IntType;
            geometry.setAttribute("ptIndex", ptIndexAttribute);
            ptCount = data.pointCount;
            if (this.copcInfo.pointCount !== ptCount) {
                alert("point count mismatch: " + this.copcInfo.pointCount + "" + ptCount);
            }
        } else {
            // create a dummy geometry with no points
            geometry.setAttribute("position", new Float32BufferAttribute([], 3));
            geometry.setAttribute("color", new Uint8BufferAttribute([], 3, true));
            geometry.setAttribute("intensity", new Uint16BufferAttribute([], 1, true));

            const classificationAttribute = new Int32BufferAttribute([], 1);
            classificationAttribute.gpuType = IntType;
            geometry.setAttribute("classification", classificationAttribute);

            const ptIndexAttribute = new Int32BufferAttribute([], 1);
            ptIndexAttribute.gpuType = IntType;
            geometry.setAttribute("ptIndex", ptIndexAttribute);
        }
        return { geometry: geometry, pointCount: ptCount };
    }

    assertState(...states: NodeState[]) {
        if (!states.includes(this.state)) {
            throw new Error(`Node state ${this.state} not in ${states.join(",")}`);
        }
    }
}
