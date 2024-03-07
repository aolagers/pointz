import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, Vector3 } from "three";
import { Copc } from "copc";
import workerUrl from "./worker?worker&url";

export class PointCloud {
    geometry: BufferGeometry;
    offset: Vector3;
    bounds: { min: Vector3; max: Vector3 } | null;

    constructor(geom: BufferGeometry, bounds: { min: Vector3; max: Vector3 } | null, offset: Vector3) {
        this.geometry = geom;
        this.bounds = bounds;
        this.offset = offset;
    }

    static async loadLAZ() {
        const copcData = await loadCOPC();

        const geometry = new BufferGeometry();

        const classes = [];

        const pos = [];
        const col = [];

        for (let i = 0; i < copcData.pointCount; i++) {
            classes.push(2);
            pos.push(copcData.positions[i * 3 + 0]!);
            pos.push(copcData.positions[i * 3 + 1]!);
            pos.push(copcData.positions[i * 3 + 2]!);
            col.push(copcData.colors[i * 3 + 0]! / 256);
            col.push(copcData.colors[i * 3 + 1]! / 256);
            col.push(copcData.colors[i * 3 + 2]! / 256);
        }

        for (let i = 0; i < 1_000; i++) {
            console.log(col[i]);
        }

        console.log("LAZ", copcData.positions.length, pos.length);

        geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(col, 3, false));
        // geometry.setAttribute("position", new Float32BufferAttribute(copcData.positions, 3));
        // geometry.setAttribute("color", new Float32BufferAttribute(copcData.colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return new PointCloud(
            geometry,
            {
                min: new Vector3(...copcData.bounds.min),
                max: new Vector3(...copcData.bounds.max),
            },
            new Vector3(...copcData.offset),
        );
    }

    static loadDemo() {
        const geometry = new BufferGeometry();
        const vertices = [];
        const colors = [];

        const classes = [];
        const C = 0.2;

        // gnd
        for (let i = 0; i < 10_000; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            colors.push(0.4 + Math.random() * C, 0.15 + Math.random() * C, 0 + Math.random() * C);
            classes.push(0);
        }

        function r() {
            return Math.random() - 0.5;
        }

        // trees
        for (let i = 0; i < 16; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < 50; j++) {
                vertices.push(x + ((50 - j) / 25) * r(), y + ((50 - j) / 25) * r(), z + j / 5);
                colors.push(0.1 + Math.random() * C, 0.7 + Math.random() * C, 0.1 + Math.random() * C);
                classes.push(1);
            }
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return new PointCloud(geometry, null, new Vector3());
    }
}

async function loadCOPC() {
    // const url = "http://localhost:5173/lion_takanawa.copc.laz";
    const url = "http://localhost:5173/autzen-classified.copc.laz";

    const worker = new Worker(workerUrl, { type: "module" });

    return new Promise<{
        pointCount: number;
        bounds: { min: number[]; max: number[] };
        offset: number[];
        positions: Float32Array;
        colors: Float32Array;
    }>((resolve) => {
        worker.onmessage = (e) => {
            console.log("FROM WORKER", e.data);
            resolve({
                pointCount: e.data.pointCount,
                bounds: e.data.bounds, //{ min: [0, 0, 0], max: [1, 1, 1] },
                offset: e.data.offset, // [1, 1, 1],
                positions: e.data.positions,
                colors: e.data.colors,
            });
        };
        // resolve({
        //     pointCount: 0,
        //     bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        //     offset: [1, 1, 1],
        //     positions: [],
        //     colors: [],
        // });
        worker.postMessage(url);
    });

    /*
    const copc = await Copc.create(url);

    console.log(copc);

    const offset = new Vector3(...copc.header.offset);

    const bounds = {
        min: new Vector3(...copc.header.min),
        max: new Vector3(...copc.header.max),
    };

    const { nodes, pages } = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);

    console.log(nodes);

    console.log("pages", pages);

    type Point = readonly [number, number, number, number, number, number];
    const points: Point[] = [];

    for (const key in nodes) {
        const node = nodes[key];
        // console.log("LOAD", key, node);
        if (!node) continue;

        const view = await Copc.loadPointDataView(url, copc, node);
        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: view.getter("Red"),
            g: view.getter("Green"),
            b: view.getter("Blue"),
        };

        for (let i = 0; i < view.pointCount; i++) {
            const point = [
                getters.x(i),
                getters.y(i),
                getters.z(i),
                getters.r(i) / 256,
                getters.g(i) / 256,
                getters.b(i) / 256,
            ] as const;

            points.push(point);
        }

        console.log("node", key, points.at(-1), node, points.length);

        if (points.length > 2_000_000) {
            break;
        }
        break;
    }
    console.log("loaded points:", points.length);
    return {
        points,
        bounds,
        offset,
    };
    */
}
