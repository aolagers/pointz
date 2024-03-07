import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Uint8BufferAttribute, Vector3 } from "three";
import workerUrl from "./worker?worker&url";
import type { WorkerRequest, WorkerResponse } from "./worker";

export class PointCloudNode {
    nodeName: string;
    geometry: BufferGeometry;
    bounds: { min: Vector3; max: Vector3 };

    constructor(name: string, geom: BufferGeometry, bounds: { min: Vector3; max: Vector3 }) {
        this.nodeName = name;
        this.geometry = geom;
        this.bounds = bounds;
    }
}

export class PointCloud {
    // geometry: BufferGeometry;
    name: string;
    source: string | File;
    offset: Vector3;
    worker: Worker | undefined;
    bounds: { min: Vector3; max: Vector3 };

    nodes: PointCloudNode[];
    hierarchy: { name: string; pointCount: number }[];

    constructor(name: string, source: string | File, bounds: { min: Vector3; max: Vector3 }, offset: Vector3) {
        this.name = name;
        this.source = source;
        this.offset = offset;
        this.bounds = bounds;
        this.nodes = [];
        this.hierarchy = [];
    }

    static async loadLAZ(source: string | File) {
        const { msg: info, worker } = await PointCloud.loadInfo(source);

        if (info.msgType !== "info") {
            throw new Error("not info");
        }

        const offset = new Vector3(...info.header.offset);
        const bounds = {
            min: new Vector3(...info.header.min),
            max: new Vector3(...info.header.max),
        };

        const pc = new PointCloud("pc-1", source, bounds, offset);

        pc.worker = worker;

        return new Promise<PointCloud>((resolve, reject) => {
            worker.onmessage = (e) => {
                console.log("FROM WORKER", e.data);
                const data = e.data as WorkerResponse;
                if (data.msgType === "points") {
                    const geometry = new BufferGeometry();
                    geometry.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
                    geometry.setAttribute("color", new Uint8BufferAttribute(data.colors, 3, true));

                    const classes = Array(data.pointCount).fill(2);
                    geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));
                    // geometry.setAttribute("classification", new Uint8BufferAttribute(data.classifications, 1));
                    const rootNode = new PointCloudNode("0-0-0-0", geometry, bounds);
                    pc.nodes.push(rootNode);
                    resolve(pc);
                } else {
                    reject("not points");
                }
            };

            const req: WorkerRequest = {
                command: "load-node",
                source: source,
                node: info.hierarchy.nodes["0-0-0-0"]!,
                offset: info.header.offset,
            };

            worker.postMessage(req);
        });
    }

    static async loadInfo(source: string | File) {
        const worker = new Worker(workerUrl, { type: "module" });

        return new Promise<{ msg: WorkerResponse; worker: Worker }>((resolve, reject) => {
            worker.onmessage = (e) => {
                console.log("FROM WORKER", e.data);
                const data = e.data as WorkerResponse;
                if (data.msgType === "info") {
                    resolve({ msg: data, worker: worker });
                } else {
                    reject("not info");
                }
            };

            const req: WorkerRequest = {
                command: "info",
                source: source,
            };

            worker.postMessage(req);
        });
    }

    static loadDemo() {
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
        for (let i = 0; i < 10_000; i++) {
            const x = r() * 50;
            const y = r() * 50;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            colors.push(0.4 + Math.random() * C, 0.15 + Math.random() * C, 0 + Math.random() * C);
            classes.push(0);
        }

        // trees
        const treeH = 12;
        const treePts = 100;
        for (let i = 0; i < 24; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < treePts; j++) {
                vertices.push(
                    x + (r() * (treePts - j)) / treePts,
                    y + (r() * (treePts - j)) / treePts,
                    z + (j / treePts) * treeH,
                );
                colors.push(0.1 + Math.random() * C, 0.7 + Math.random() * C, 0.1 + Math.random() * C);
                classes.push(1);
            }
        }

        const min = new Vector3(Infinity, Infinity, Infinity);
        const max = new Vector3(-Infinity, -Infinity, -Infinity);
        for (let i = 0; i < vertices.length; i += 3) {
            min.x = Math.min(min.x, vertices[i]!);
            max.x = Math.max(max.x, vertices[i]!);
            min.y = Math.min(min.y, vertices[i + 1]!);
            max.y = Math.max(max.y, vertices[i + 1]!);
            min.z = Math.min(min.z, vertices[i + 2]!);
            max.z = Math.max(max.z, vertices[i + 2]!);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        const bounds = { min, max };
        const node = new PointCloudNode("0-0-0-0", geometry, bounds);

        const pc = new PointCloud("demodata", "", bounds, offset);
        pc.nodes.push(node);

        return pc;
    }
}
