import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from "three";
import { Copc } from "copc";

export class PointCloud {
    geometry: BufferGeometry;
    bounds: { min: Vector3; max: Vector3 } | null;

    constructor(geom: BufferGeometry, bounds: { min: Vector3; max: Vector3 } | null) {
        this.geometry = geom;
        this.bounds = bounds;
    }

    static async loadLion() {
        const { points, bounds } = await loadLion();

        console.log({ bounds });

        const geometry = new BufferGeometry();

        const vertices = [];
        const colors = [];

        const classes = [];

        for (const pt of points) {
            vertices.push(pt[0], pt[1], pt[2]);
            colors.push(pt[3] / 255, pt[4] / 255, pt[5] / 255);
            classes.push(2);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));
        return new PointCloud(geometry, bounds);
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

        // trees
        for (let i = 0; i < 16; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < 50; j++) {
                vertices.push(x + Math.random() / 2, y + Math.random() / 2, z + j / 5);
                colors.push(0.1 + Math.random() * C, 0.7 + Math.random() * C, 0.1 + Math.random() * C);
                classes.push(1);
            }
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return new PointCloud(geometry, null);
    }
}

async function loadLion() {
    const url = "http://localhost:5173/lion_takanawa.copc.laz";
    const copc = await Copc.create(url);

    console.log(copc);

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
        console.log(points.at(-1));
    }
    console.log("loaded points:", points.length);
    return {
        points,
        bounds,
    };
}
