import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Int32BufferAttribute,
    IntType,
    Uint16BufferAttribute,
    Uint8BufferAttribute,
    Vector3,
} from "three";
import workerUrl from "./copc-loader?worker&url";
import type {
    WorkerInfoRequest,
    WorkerInfoResponse,
    WorkerPointsResponse,
    LazSource,
    CopcNodeInfo,
    Hierarchy,
} from "./copc-loader";
import { WorkerPool } from "./worker-pool";
import { Viewer } from "./viewer";
import { getNodeVisibilityRating, nodeToBox } from "./utils";
import { OctreePath } from "./octree";
import { PriorityQueue } from "./priority-queue";
import { PointCloudNode } from "./pointcloud-node";

type RespMap = {
    info: WorkerInfoResponse;
    points: WorkerPointsResponse;
};

export const pool = new WorkerPool<RespMap>(workerUrl, 8);

async function getInfo(source: LazSource) {
    const req: WorkerInfoRequest = {
        command: "info",
        source: source,
    };

    const res = await pool.runTask(req);
    return res;
}

let _chunkId = 0;

export function getChunkID() {
    return ++_chunkId;
}

async function getChunk(source: LazSource, node: CopcNodeInfo, offset: number[]) {
    const data = await pool.runTask({
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

export class PointCloud {
    viewer: Viewer;
    name: string;
    source: string | File;
    offset: Vector3;
    tightBounds: Box3;
    octreeBounds: Box3;
    hierarchy: Hierarchy;
    loadedNodes: PointCloudNode[];
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
        this.loadedNodes = [];
        this.hierarchy = hierarchy;
        this.rootSpacing = rootSpacing;
    }

    async loadNodes() {
        if (this.isDemo) {
            const pcn = this.loadedNodes[0]!;
            this.viewer.addObject(pcn.pco);
            return;
        }

        const toLoad = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);

        console.log(this.name, { toLoad, l: toLoad.length });

        let loaded = 0;

        const score = (p: OctreePath) => {
            const score = getNodeVisibilityRating(this.octreeBounds, p, this.rootSpacing, this.viewer.camera);
            return score;
            // const box = nodeToBox(this.octreeBounds, p);
            // return this.viewer.camera.position.distanceTo(box.getCenter(new Vector3())) + p[0] * 1000;
        };

        const pq = new PriorityQueue<OctreePath>((a, b) => score(a) - score(b));

        let inview = 0;
        for (const nnum of toLoad) {
            // if (nnum[0] <= 3) {
            inview++;
            pq.push(nnum);
            // }
        }

        const promises = [];

        while (!pq.isEmpty() && promises.length < 255) {
            const n = pq.pop()!;

            const nname = n.join("-");
            const nodeInfo = this.hierarchy.nodes[nname]!;

            const prom = getChunk(this.source, nodeInfo, this.offset.toArray()).then((pointData) => {
                const bbox = nodeToBox(this.octreeBounds, n);

                const pcn = new PointCloudNode(
                    this,
                    n,
                    pointData.geometry,
                    bbox,
                    pointData.chunkId,
                    this.rootSpacing / Math.pow(2, n[0]),
                    pointData.pointCount
                );

                this.loadedNodes.push(pcn);

                this.viewer.addObject(pcn.pco);

                this.viewer.addExtraStuff(pcn.debugMesh);

                this.pointsLoaded += pointData.pointCount;

                loaded++;
            });

            promises.push(prom);
        }

        await Promise.all(promises);
        console.log(this.name, `${loaded} / ${inview} / ${toLoad.length}`);
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const details = await PointCloud.loadInfo(source);

        if (details.msgType !== "info") {
            throw new Error("not info");
        }

        const offset = new Vector3(...details.header.offset);

        const tightBounds = new Box3().setFromArray([...details.header.min, ...details.header.max]);

        const pcloudName = typeof source === "string" ? source.split("/").pop()! : source.name;

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

    static async loadInfo(source: LazSource) {
        const info = await getInfo(source);
        // console.log("COPC INFO", info);
        return info;
    }
}
