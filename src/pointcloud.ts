import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Frustum,
    Points,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
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
    OctreeInfo,
} from "./copc-loader";
import { WorkerPool } from "./worker-pool";
import { PointMaterial } from "./materials/point-material";
import { Viewer } from "./viewer";
import { createCubeBoundsBox } from "./utils";
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

    constructor(name: OctreePath, geom: BufferGeometry, bounds: Box3) {
        this.nodeName = name;
        this.geometry = geom;
        this.bounds = bounds;

        this.pco = new Points(this.geometry, PointCloud.material);
        this.pco.matrixAutoUpdate = false;
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
    geometry.setAttribute("classification", new Uint32BufferAttribute(data.classifications, 1));
    geometry.setAttribute("intensity", new Uint16BufferAttribute(data.intensities, 1, true));
    geometry.setAttribute("indices", new Uint32BufferAttribute(data.indices, 1));

    return { geometry: geometry, pointCount: data.pointCount };
}

export class PointCloud {
    viewer: Viewer;
    name: string;
    source: string | File;
    offset: Vector3;
    bounds: Box3;
    hierarchy: Hierarchy;
    loadedNodes: PointCloudNode[];
    octreeInfo: OctreeInfo;
    pointsLoaded: number = 0;

    static material = new PointMaterial();
    static pickMaterial = new PointMaterial(true);

    constructor(
        viewer: Viewer,
        name: string,
        source: string | File,
        bounds: Box3,
        offset: Vector3,
        hierarchy: Hierarchy,
        octreeInfo: OctreeInfo,
    ) {
        this.viewer = viewer;
        this.name = name;
        this.source = source;
        this.offset = offset;
        this.bounds = bounds;
        this.loadedNodes = [];
        this.hierarchy = hierarchy;
        this.octreeInfo = octreeInfo;

        console.log({ octreeInfo });
    }

    async loadFake() {
        const pcn = this.loadedNodes[0]!;

        this.loadedNodes.push(pcn);
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
            const bboxA = createCubeBoundsBox(this.octreeInfo.cube, a, this.offset);
            const distA = this.viewer.camera.position.distanceTo(bboxA.getCenter(new Vector3()));

            const bboxB = createCubeBoundsBox(this.octreeInfo.cube, b, this.offset);
            const distB = this.viewer.camera.position.distanceTo(bboxB.getCenter(new Vector3()));

            return distA - distB;
        });

        let inview = 0;
        for (const nnum of toLoad) {
            const bbox = createCubeBoundsBox(this.octreeInfo.cube, nnum, this.offset);
            if (frustum.intersectsBox(bbox)) {
                inview++;
                pq.push(nnum);
            }
        }

        while (!pq.isEmpty() && loaded < 64) {
            const n = pq.pop()!;
            const nname = n.join("-");
            // console.log(this.name, "LOAD", nname);
            const node = this.hierarchy.nodes[nname]!;

            getChunk(this.source, node, this.offset.toArray()).then((pointData) => {
                const pcn = new PointCloudNode(n, pointData.geometry, this.bounds);

                this.loadedNodes.push(pcn);

                this.viewer.addObject(pcn.pco);

                this.pointsLoaded += pointData.pointCount;
                // await new Promise((resolve) => setTimeout(resolve, 100));
                loaded++;
            });
        }

        console.log(
            this.name,
            "load ratio",
            inview,
            "/",
            toLoad.length,
            ((100 * inview) / toLoad.length).toFixed(1) + "%",
        );
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const details = await PointCloud.loadInfo(source);

        if (details.msgType !== "info") {
            throw new Error("not info");
        }

        const offset = new Vector3(...details.header.offset);
        const bounds = new Box3().setFromArray([...details.header.min, ...details.header.max]);

        const pcloudName = typeof source === "string" ? source.split("/").pop()! : source.name;
        const pcloud = new PointCloud(viewer, pcloudName, source, bounds, offset, details.hierarchy, details.info);

        return pcloud;
    }

    static async loadInfo(source: LazSource) {
        const info = await getInfo(source);
        console.log("COPC INFO", info);
        return info;
    }

    static loadDemo(viewer: Viewer) {
        const geometry = new BufferGeometry();
        const vertices = [];
        const colors = [];

        const classes = [];
        const ints = [];
        const C = 0.2;

        const offset = new Vector3(0, 0, 0);

        function r() {
            return 2 * (Math.random() - 0.5);
        }
        // gnd
        for (let i = 0; i < 50_000; i++) {
            const x = r() * 50;
            const y = r() * 50;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            colors.push(0.4 + Math.random() * C, 0.15 + Math.random() * C, 0 + Math.random() * C);
            classes.push(0);
            ints.push(Math.floor(200 * (x + y + 100)));
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
            }
        }

        const bounds = new Box3();
        for (let i = 0; i < vertices.length; i += 3) {
            bounds.expandByPoint(new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]));
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("intensity", new Uint16BufferAttribute(ints, 1, true));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        const pc = new PointCloud(
            viewer,
            "demodata",
            "",
            bounds,
            offset,
            { pages: {}, nodes: {} },
            { cube: [0, 0, 0, 0, 0, 0], spacing: 0 },
        );

        pc.loadedNodes.push(new PointCloudNode([0, 0, 0, 0], geometry, bounds));

        return pc;
    }
}
