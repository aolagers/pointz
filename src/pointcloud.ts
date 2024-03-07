import { Box3, Vector3 } from "three";
import type { Hierarchy, LazSource, WorkerInfoRequest } from "./copc-loader";
import { Viewer } from "./viewer";
import { nodeToBox } from "./utils";
import { OctreePath } from "./octree";
import { PointCloudNode, workerPool } from "./pointcloud-node";

let _chunkId = 0;

export function getChunkID() {
    return ++_chunkId;
}

export class PointCloud {
    viewer: Viewer;
    name: string;
    source: string | File;
    offset: Vector3;
    tightBounds: Box3;
    octreeBounds: Box3;
    hierarchy: Hierarchy;
    nodes: PointCloudNode[];
    rootSpacing: number;
    pointsLoaded: number = 0;

    isDemo = false;

    constructor(
        viewer: Viewer,
        name: string,
        source: string | File,
        tightBounds: Box3,
        octreeBounds: Box3,
        offset: Vector3,
        hierarchy: Hierarchy,
        rootSpacing: number
    ) {
        this.viewer = viewer;
        this.name = name;
        this.source = source;
        this.offset = offset;
        this.tightBounds = tightBounds;
        this.octreeBounds = octreeBounds;
        this.nodes = [];
        this.hierarchy = hierarchy;
        this.rootSpacing = rootSpacing;
    }

    async initializeNodes(loadRoot = true) {
        if (this.isDemo) {
            const pcn = this.nodes[0]!;
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

        if (loadRoot) {
            console.log("load root");
            this.nodes.find((n) => n.depth === 0)?.load(this.viewer);
        }
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const pcloudName = typeof source === "string" ? source.split("/").pop()! : source.name;

        const details = await getInfo(source);
        const offset = new Vector3(...details.header.offset);

        const tightBounds = new Box3().setFromArray([...details.header.min, ...details.header.max]);
        tightBounds.min.sub(offset);
        tightBounds.max.sub(offset);

        const octreeBounds = new Box3().setFromArray(details.info.cube);

        octreeBounds.translate(offset.clone().negate());

        const pcloud = new PointCloud(
            viewer,
            pcloudName,
            source,
            tightBounds,
            octreeBounds,
            offset,
            details.hierarchy,
            details.info.spacing
        );

        return pcloud;
    }
}

async function getInfo(source: LazSource) {
    const req: WorkerInfoRequest = {
        command: "info",
        source: source,
    };

    const res = await workerPool.runTask(req);
    return res;
}
