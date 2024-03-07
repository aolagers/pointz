import {
    BufferGeometry,
    Vector3,
    Box3,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Int32BufferAttribute,
    IntType,
} from "three";
import { PointCloud, getChunkID } from "./pointcloud";
import { PointCloudNode } from "./pointcloud-node";
import { Viewer } from "./viewer";

export function loadDemo(viewer: Viewer) {
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
        classes.push(2);
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

    const ptIndexAttribute = new Int32BufferAttribute(indices, 1);
    ptIndexAttribute.gpuType = IntType;
    geometry.setAttribute("ptIndex", ptIndexAttribute);

    const pc = new PointCloud(viewer, "demodata", "", tightBounds, tightBounds, offset, { pages: {}, nodes: {} }, 1.0);

    pc.isDemo = true;

    pc.loadedNodes.push(
        new PointCloudNode(pc, [0, 0, 0, 0], geometry, tightBounds, getChunkID(), pc.rootSpacing, indice)
    );

    return pc;
}
