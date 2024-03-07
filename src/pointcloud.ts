import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Frustum,
    Int32BufferAttribute,
    IntType,
    Mesh,
    Points,
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
import { PointMaterial } from "./materials/point-material";
import { Viewer } from "./viewer";
import { boxToMesh, nodeToBox } from "./utils";
import { OctreePath } from "./octree";
import { PriorityQueue } from "./priority-queue";

type RespMap = {
    info: WorkerInfoResponse;
    points: WorkerPointsResponse;
};

export const pool = new WorkerPool<RespMap>(workerUrl, 8);

export class PointCloudNode {
    nodeName: OctreePath;
    geometry: BufferGeometry;
    bounds: Box3;
    pco: Points;
    visibleIndex: number;

    debugMesh: Mesh;

    constructor(name: OctreePath, geom: BufferGeometry, bounds: Box3, idx: number) {
        this.nodeName = name;
        this.geometry = geom;
        this.bounds = bounds;

        this.pco = new Points(this.geometry, PointCloud.material);
        this.pco.matrixAutoUpdate = false;

        const cube = boxToMesh(this.bounds, name[0] === 0 ? "red" : name[0] === 1 ? "green" : "blue");
        if (name[0] === 0) {
            cube.scale.set(1.02, 1.02, 1.02);
        }
        if (name[0] === 1) {
            cube.scale.set(0.99, 0.99, 0.99);
        }
        this.debugMesh = cube;
        this.visibleIndex = idx;
    }
}

async function getInfo(source: LazSource) {
    const req: WorkerInfoRequest = {
        command: "info",
        source: source,
    };

    const res = await pool.runTask(req);
    return res;
}

let chunkId = 0;

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

    const vis = new Uint8Array(data.pointCount);
    const cid = ++chunkId;
    vis.fill(cid);
    const visibleIndexAttribute = new Uint8BufferAttribute(vis, 1, true);
    geometry.setAttribute("visibleIndex", visibleIndexAttribute);

    const classificationAttribute = new Int32BufferAttribute(data.classifications, 1);
    classificationAttribute.gpuType = IntType;
    geometry.setAttribute("classification", classificationAttribute);

    const ptIndexAttribute = new Int32BufferAttribute(data.indices, 1);
    ptIndexAttribute.gpuType = IntType;
    geometry.setAttribute("ptIndex", ptIndexAttribute);

    return { geometry: geometry, pointCount: data.pointCount, chunkId: cid };
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
    spacing: number;
    pointsLoaded: number = 0;

    static material = new PointMaterial(false);
    static pickMaterial = new PointMaterial(true);

    constructor(
        viewer: Viewer,
        name: string,
        source: string | File,
        tightBounds: Box3,
        octreeBounds: Box3,
        offset: Vector3,
        hierarchy: Hierarchy,
        spacing: number
    ) {
        this.viewer = viewer;
        this.name = name;
        this.source = source;
        this.offset = offset;
        this.tightBounds = tightBounds;
        this.octreeBounds = octreeBounds;
        this.loadedNodes = [];
        this.hierarchy = hierarchy;
        this.spacing = spacing;
    }

    async loadFake() {
        const pcn = this.loadedNodes[0]!;

        this.viewer.addObject(pcn.pco);
    }

    async load() {
        const toLoad = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);

        // toLoad.sort((a, b) => {
        //     for (let i = 0; i < 4; i++) {
        //         if (a[i]! < b[i]!) {
        //             return -1;
        //         } else if (a[i]! > b[i]!) {
        //             return 1;
        //         }
        //     }
        //     return 0;
        // });

        console.log(this.name, { toLoad, l: toLoad.length });

        let loaded = 0;

        const frustum = new Frustum();
        frustum.setFromProjectionMatrix(this.viewer.camera.projectionMatrix);
        frustum.planes.forEach((plane) => {
            plane.applyMatrix4(this.viewer.camera.matrixWorld);
        });

        const pq = new PriorityQueue<OctreePath>((a, b) => {
            const bboxA = nodeToBox(this.octreeBounds, a);
            const distA = this.viewer.camera.position.distanceTo(bboxA.getCenter(new Vector3()));

            const bboxB = nodeToBox(this.octreeBounds, b);
            const distB = this.viewer.camera.position.distanceTo(bboxB.getCenter(new Vector3()));

            return distA - distB;
        });

        let inview = 0;
        for (const nnum of toLoad) {
            // if (nnum[0] <= 3) {
            inview++;
            pq.push(nnum);
            // }
            // const bbox = nodeToBox(this.octreeBounds, nnum);
            // if (frustum.intersectsBox(bbox)) {
            //     inview++;
            //     pq.push(nnum);
            // }
        }

        const promises = [];

        while (!pq.isEmpty() && promises.length < 255) {
            const n = pq.pop()!;

            const nname = n.join("-");
            const nodeInfo = this.hierarchy.nodes[nname]!;

            // const bb = nodeToBox(this.octreeBounds, n);
            // const dst = this.viewer.camera.position.distanceTo(bb.getCenter(new Vector3()));
            // console.log("load", nname, dst);

            const prom = getChunk(this.source, nodeInfo, this.offset.toArray()).then((pointData) => {
                const bbox = nodeToBox(this.octreeBounds, n);

                const pcn = new PointCloudNode(n, pointData.geometry, bbox, pointData.chunkId);

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

    static loadDemo(viewer: Viewer) {
        const geometry = new BufferGeometry();
        const vertices = [];
        const colors = [];

        const classes = [];
        const indices = [];
        let indice = 0;
        const ints = [];
        const C = 0.2;

        const offset = new Vector3(0, 0, 0);

        function r() {
            return 2 * (Math.random() - 0.5);
        }
        // gnd
        for (let i = 0; i < 10_000; i++) {
            const x = -50 + (i % 100);
            // const x = r() * 50;
            const y = -50 + Math.floor(i / 100);
            // const y = r() * 50;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            colors.push(0.4 + Math.random() * C, 0.15 + Math.random() * C, 0 + Math.random() * C);
            classes.push(0);
            ints.push(Math.floor(200 * (x + y + 100)));
            indices.push(indice++);
        }

        // trees
        const treePts = 256;
        for (let i = 0; i < 24; i++) {
            const treeH = 8 + 10 * Math.random();
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < treePts; j++) {
                let h = (j / treePts) * treeH;
                vertices.push(x + (r() * (treePts - j)) / treePts, y + (r() * (treePts - j)) / treePts, z + h);
                colors.push(0.1 + Math.random() * C, 0.7 + Math.random() * C, 0.1 + Math.random() * C);
                classes.push(1);
                ints.push(i * 1000);
                indices.push(indice++);
            }
        }

        const tightBounds = new Box3();
        for (let i = 0; i < vertices.length; i += 3) {
            tightBounds.expandByPoint(new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]));
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("intensity", new Uint16BufferAttribute(ints, 1, true));
        geometry.setAttribute("classification", new Int32BufferAttribute(classes, 1));

        const vis = new Uint8Array(classes.length);

        const cid = ++chunkId;
        vis.fill(cid);
        const visibleIndex = new Uint8BufferAttribute(vis, 1, true);
        // visibleIndex.gpuType = IntType;
        geometry.setAttribute("visibleIndex", visibleIndex);

        const ptIndexAttribute = new Int32BufferAttribute(indices, 1);
        ptIndexAttribute.gpuType = IntType;
        geometry.setAttribute("ptIndex", ptIndexAttribute);

        const pc = new PointCloud(
            viewer,
            "demodata",
            "",
            tightBounds,
            tightBounds,
            offset,
            { pages: {}, nodes: {} },
            0
        );

        pc.loadedNodes.push(new PointCloudNode([0, 0, 0, 0], geometry, tightBounds, cid));

        return pc;
    }
}
