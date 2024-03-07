import {
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    Frustum,
    Points,
    Uint32BufferAttribute,
    Uint8BufferAttribute,
    Vector3,
} from "three";
import workerUrl from "./worker?worker&url";
import type {
    WorkerInfoRequest,
    WorkerInfoResponse,
    WorkerPointsRequest,
    WorkerPointsResponse,
    LazSource,
    CopcNodeInfo,
    Hierarchy,
    OctreeInfo,
} from "./worker";
import { MATERIALS } from "./materials";
import { Viewer } from "./viewer";
import { createCubeBounds, createCubeBoundsBox } from "./utils";
import { OctreePath } from "./octree";

export class PointCloudNode {
    nodeName: string;
    geometry: BufferGeometry;
    bounds: Box3;
    pco: Points;

    constructor(name: string, geom: BufferGeometry, bounds: Box3) {
        this.nodeName = name;
        this.geometry = geom;
        this.bounds = bounds;
        this.pco = new Points(this.geometry, MATERIALS.POINT);
    }
}

function getInfo(worker: Worker, source: LazSource) {
    return new Promise<WorkerInfoResponse>((resolve, reject) => {
        worker.onmessage = (e) => {
            console.log("FROM WORKER", e.data);
            const data = e.data as WorkerInfoResponse;
            if (data.msgType === "info") {
                resolve(data);
            } else {
                reject("not info");
            }
        };

        const req: WorkerInfoRequest = {
            command: "info",
            source: source,
        };

        worker.postMessage(req);
    });
}

function getData(worker: Worker, source: LazSource, node: CopcNodeInfo, offset: number[]) {
    return new Promise<{ geometry: BufferGeometry }>((resolve, reject) => {
        worker.onmessage = (e) => {
            const data = e.data as WorkerPointsResponse;
            if (data.msgType === "points") {
                const geometry = new BufferGeometry();
                geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
                geometry.setAttribute("color", new Uint8BufferAttribute(data.colors, 3, true));
                const classes = Array(data.pointCount).fill(2);
                geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));
                resolve({
                    geometry: geometry,
                });
            } else {
                reject("not points");
            }
        };
        const req: WorkerPointsRequest = {
            command: "load-node",
            source: source,
            node: node,
            offset: offset,
        };
        worker.postMessage(req);
    });
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

    constructor(
        viewer: Viewer,
        name: string,
        source: string | File,
        bounds: Box3,
        offset: Vector3,
        hierarchy: Hierarchy,
        octreeInfo: OctreeInfo
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
        this.viewer.scene.add(pcn.pco);
        this.viewer.objects.push(pcn.pco);
    }

    async load() {
        const worker = new Worker(workerUrl, { type: "module" });

        const toLoad = Object.keys(this.hierarchy.nodes).map((n) => n.split("-").map(Number) as OctreePath);

        toLoad.sort((a, b) => {
            for (let i = 0; i < 4; i++) {
                if (a[i]! < b[i]!) {
                    return -1;
                } else if (a[i]! > b[i]!) {
                    return 1;
                }
            }
            return 0;
        });

        console.log({ toLoad, l: toLoad.length });

        let loaded = 0;

        const frustum = new Frustum();
        frustum.setFromProjectionMatrix(this.viewer.camera.projectionMatrix);
        frustum.planes.forEach((plane) => {
            plane.applyMatrix4(this.viewer.camera.matrixWorld);
        });

        let inview = 0;
        for (const nnum of toLoad) {
            if (loaded < 64) {
                const nname = nnum.join("-");

                console.log("LOAD", nname);
                const node = this.hierarchy.nodes[nname]!;
                const data = await getData(worker, this.source, node, this.offset.toArray());

                const pcn = new PointCloudNode(nname, data.geometry, this.bounds);

                this.loadedNodes.push(pcn);

                this.viewer.scene.add(pcn.pco);
                this.viewer.objects.push(pcn.pco);
            }

            loaded++;

            const bbox = createCubeBoundsBox(this.octreeInfo.cube, nnum, this.offset);
            if (frustum.intersectsBox(bbox)) {
                const _dist = this.viewer.camera.position.distanceTo(bbox.getCenter(new Vector3()));
                // console.log(dist);
                inview++;
            }

            // this.viewer.scene.add(bbox);
            // await new Promise((resolve) => setTimeout(resolve, 50));
        }

        console.log("load ratio", inview, "/", toLoad.length, ((100 * inview) / toLoad.length).toFixed(1) + "%");

        worker.terminate();
    }

    static async loadLAZ(viewer: Viewer, source: string | File) {
        const details = await PointCloud.loadInfo(source);

        if (details.msgType !== "info") {
            throw new Error("not info");
        }

        const offset = new Vector3(...details.header.offset);
        const bounds = new Box3().setFromArray([...details.header.min, ...details.header.max]);

        const pc = new PointCloud(viewer, "pc-1", source, bounds, offset, details.hierarchy, details.info);

        return pc;
    }

    static async loadInfo(source: LazSource) {
        const worker = new Worker(workerUrl, { type: "module" });
        const info = await getInfo(worker, source);
        console.log("COPC INFO", info);

        worker.terminate();
        return info;
    }

    static loadDemo(viewer: Viewer) {
        const geometry = new BufferGeometry();
        const vertices = [];
        const colors = [];

        const classes = [];
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
            }
        }

        const bounds = new Box3();
        for (let i = 0; i < vertices.length; i += 3) {
            bounds.expandByPoint(new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]));
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        const pc = new PointCloud(
            viewer,
            "demodata",
            "",
            bounds,
            offset,
            { pages: {}, nodes: {} },
            { cube: [0, 0, 0, 0, 0, 0], spacing: 0 }
        );

        pc.loadedNodes.push(new PointCloudNode("0-0-0-0", geometry, bounds));

        return pc;
    }
}
