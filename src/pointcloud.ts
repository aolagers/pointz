import { Box3, Vector3 } from "three";
import type { Hierarchy, LazSource, WorkerInfoRequest, WorkerInfoResponse } from "./copc-loader";
import workerUrl from "./copc-loader?worker&url";
import { OctreePath } from "./octree";
import { PointCloudNode } from "./pointcloud-node";
import { nodeToBox } from "./utils";
import { Viewer } from "./viewer";
import { WorkerPool } from "./worker-pool";

export const infoWorkerPool = new WorkerPool<
    { info: { abort: AbortController; score: number }; command: WorkerInfoRequest },
    WorkerInfoResponse
>(workerUrl, 4);

export class PointCloud {
    viewer: Viewer;
    name: string;
    source: string | File;
    headerOffset: Vector3;
    tightBounds: Box3;
    octreeBounds: Box3;
    hierarchy: Hierarchy;
    nodes: PointCloudNode[];
    rootSpacing: number;
    pointCount: number;

    id: string;
    isDemo = false;

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
        this.nodes = [];
        this.hierarchy = hierarchy;
        this.rootSpacing = rootSpacing;
        this.pointCount = pointCount;

        this.id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        // TODO: fix offset if it seems too small
    }

    async initializeNodes() {
        if (this.isDemo) {
            const pcn = this.nodes[0];
            this.viewer.addNode(pcn);
            return;
        }

        const nodePaths = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);

        console.log(this.name, { toLoad: nodePaths, l: nodePaths.length });

        for (const n of nodePaths) {
            const bbox = nodeToBox(this.octreeBounds, n);
            const pcn = new PointCloudNode(this, n, bbox, this.rootSpacing / Math.pow(2, n[0]));
            this.nodes.push(pcn);
        }

        // always load the root node by default
        const root = this.nodes.find((n) => n.depth === 0);
        if (root) {
            await root.load(this.viewer);
        }
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const pcloudName = typeof source === "string" ? source.split("/").pop()! : source.name;

        const details = await PointCloud.getInfo(source);
        const headerOffset = new Vector3(...details.header.offset);

        const tightBoundsFull = new Box3().setFromArray([...details.header.min, ...details.header.max]);

        const mid = tightBoundsFull.getCenter(new Vector3());

        const diff = mid.sub(headerOffset).length();

        if (diff > 1_000_000) {
            alert("TODO: fix big offset! " + diff);
            // headerOffset.copy(mid);
        }

        const tightBounds = tightBoundsFull.clone();
        tightBounds.min.sub(headerOffset);
        tightBounds.max.sub(headerOffset);

        const octreeBounds = new Box3().setFromArray(details.info.cube);

        octreeBounds.translate(headerOffset.clone().negate());

        const pcloud = new PointCloud(
            viewer,
            pcloudName,
            source,
            tightBounds,
            octreeBounds,
            headerOffset,
            details.hierarchy,
            details.info.spacing,
            details.header.pointCount
        );

        return pcloud;
    }
    static async getInfo(source: LazSource) {
        return await infoWorkerPool.runTask({
            info: {
                score: Date.now(),
                abort: new AbortController(),
            },
            command: {
                command: "info",
                source: source,
            },
        });
    }
}
