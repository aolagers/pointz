import { Box3, Vector3 } from "three";
import type { Hierarchy, LazSource, WorkerHierarchy, WorkerInfo } from "./copc-loader";
import workerUrl from "./copc-loader?worker&url";
import { Octree, OctreePath } from "./octree";
import { PointCloudNode } from "./pointcloud-node";
import { nodeToBox } from "./utils";
import { Viewer } from "./viewer";
import { WorkerPool } from "./worker-pool";

export const infoWorkerPool = new WorkerPool<
    { info: { abort: AbortController; score: number }; command: WorkerInfo["Request"] },
    WorkerInfo["Response"]
>(workerUrl, 4);

export const hierachyWorkerPool = new WorkerPool<
    { info: { abort: AbortController; score: number }; command: WorkerHierarchy["Request"] },
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
        this.tree = new Octree(hierarchy);
    }

    createNode(n: OctreePath) {
        const bbox = nodeToBox(this.octreeBounds, n, this.viewer.customOffset);
        const node = new PointCloudNode(this, n, bbox, this.rootSpacing / Math.pow(2, n[0]));
        return node;
    }

    initialize() {
        const nodePaths = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);
        nodePaths.sort((a, b) => {
            for (let i = 0; i < 4; i++) {
                if (a[i]! < b[i]!) {
                    return -1;
                } else if (a[i]! > b[i]!) {
                    return 1;
                }
            }
            return 0;
        });

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

    *walkNodes(stillGood: (node: PointCloudNode) => boolean) {
        yield* this.tree.enumerate(stillGood);
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

        viewer.debugMessage("loaded hierarchy");

        // console.log("NODES", rootHierarchy);

        // TODO: do not block here for the full tree
        // TODO: load full tree only when needed
        // const pageQueue: Array<[string, { pageOffset: number; pageLength: number } | undefined]> = [];
        // pageQueue.push(["0-0-0-0", rootHierarchy.pages["0-0-0-0"]]);
        // // pageQueue.push(...Object.entries(rootHierarchy.pages));

        // while (pageQueue.length > 0) {
        //     const pageInfo = pageQueue.pop()!;

        //     if (pageInfo[1]) {
        //         console.log("LOAD EXTRA PAGE", pageInfo[0]);
        //         const h = await PointCloud.getHierachy(source, pageInfo[1]);

        //         for (const nodeID of Object.keys(h.nodes)) {
        //             rootHierarchy.nodes[nodeID] = h.nodes[nodeID];
        //         }

        //         // pageQueue.push(...Object.entries(h.pages));
        //     }
        // }

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
                abort: new AbortController(),
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
                abort: new AbortController(),
            },
            command: {
                command: "info",
                source: source,
            },
        });
    }
}
