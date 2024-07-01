import { Box3, Group, Mesh, Vector3 } from "three";
import type { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Hierarchy, LazSource, WorkerHierarchy, WorkerInfo } from "./copc-loader";
import workerUrl from "./copc-loader?worker&url";
import { Octree, OctreePath } from "./octree";
import { PointCloudNode } from "./pointcloud-node";
import { nodeToBox } from "./utils";
import { Viewer } from "./viewer";
import { WorkerPool } from "./worker-pool";

export const infoWorkerPool = new WorkerPool<
    { info: { score: number }; command: WorkerInfo["Request"] },
    WorkerInfo["Response"]
>(workerUrl, 4);

export const hierachyWorkerPool = new WorkerPool<
    { info: { score: number }; command: WorkerHierarchy["Request"] },
    WorkerHierarchy["Response"]
>(workerUrl, 4);

export class PointCloud {
    viewer: Viewer;
    name: string;
    source: string | File;
    headerOffset: Vector3;
    tightBounds: Box3;
    octreeBounds: Box3;
    hierarchy: Hierarchy;
    rootSpacing: number;
    pointCount: number;

    group: Group;

    tightBoundsMesh: Mesh | null = null;
    label: CSS2DObject | null = null;

    tree: Octree;

    id: string;

    constructor(
        viewer: Viewer,
        name: string,
        source: string | File,
        tightBounds: Box3,
        octreeBounds: Box3,
        headerOffset: Vector3,
        hierarchy: Hierarchy,
        rootSpacing: number,
        pointCount: number
    ) {
        this.viewer = viewer;
        this.name = name;
        this.source = source;
        this.headerOffset = headerOffset;
        this.tightBounds = tightBounds;
        this.octreeBounds = octreeBounds;
        this.hierarchy = hierarchy;
        this.rootSpacing = rootSpacing;
        this.pointCount = pointCount;

        this.id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        this.tree = new Octree(hierarchy, this.source, (n) => this.createNode(n));

        this.group = new Group();
        this.group.name = name;
    }

    get visible() {
        return this.group.visible;
    }

    createNode(n: OctreePath) {
        const bbox = nodeToBox(this.octreeBounds, n, this.viewer.customOffset);
        const node = new PointCloudNode(this, n, bbox, this.rootSpacing / Math.pow(2, n[0]));
        return node;
    }

    initialize() {
        const nodePaths = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);
        // sort by ascending zoom level
        nodePaths.sort((a, b) => a[0] - b[0]);

        for (const n of nodePaths) {
            const node = this.createNode(n);
            if (n[0] === 0) {
                this.tree.initializeRoot(node);
                node.load(this.viewer);
            } else {
                this.tree.add(node);
            }
        }
    }

    toggleVisibility() {
        this.group.visible = !this.group.visible;
        this.viewer.requestRender("toggleVisibility");
        this.viewer.dispatchCloudsUpdated();
    }

    setHighlight(to: boolean) {
        if (!this.tightBoundsMesh) {
            return;
        }
        if (to) {
            this.tightBoundsMesh.visible = true;
        } else {
            this.tightBoundsMesh.visible = this.viewer.debug_mode || false;
        }
        this.viewer.requestRender("highlight");
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const pcloudName = typeof source === "string" ? source.split("/").pop()! : source.name;

        const details = await PointCloud.getInfo(source);
        const headerOffset = new Vector3(...details.header.offset);

        const tightBoundsFull = new Box3().setFromArray([...details.header.min, ...details.header.max]);

        const tightBounds = tightBoundsFull.clone();
        tightBounds.min.sub(headerOffset);
        tightBounds.max.sub(headerOffset);

        const octreeBounds = new Box3().setFromArray(details.info.cube);

        octreeBounds.translate(headerOffset.clone().negate());

        const rootHierarchy = await PointCloud.getHierachy(source, details.info.rootHierarchyPage);

        const pcloud = new PointCloud(
            viewer,
            pcloudName,
            source,
            tightBounds,
            octreeBounds,
            headerOffset,
            rootHierarchy,
            details.info.spacing,
            details.header.pointCount
        );

        return pcloud;
    }

    static async getHierachy(source: LazSource, pageInfo: { pageOffset: number; pageLength: number }) {
        const r = await hierachyWorkerPool.runTask({
            info: {
                score: Date.now(),
            },
            command: {
                command: "hierarchy",
                source: source,
                pageInfo: pageInfo,
            },
        });

        return r.hierarchy;
    }

    static async getInfo(source: LazSource) {
        return await infoWorkerPool.runTask({
            info: {
                score: Date.now(),
            },
            command: {
                command: "info",
                source: source,
            },
        });
    }
}
