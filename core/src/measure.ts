import { BufferGeometry, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { Viewer } from "./viewer";

type Measurement = {
    nodes: Array<Mesh>;
    lineGeom: BufferGeometry;
    line: Line;
};

export class Measure {
    mark: Mesh;

    activeMeasurement: Measurement | null = null;

    measurements: Measurement[] = [];

    viewer: Viewer | null;

    isActive = false;

    constructor() {
        this.mark = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshBasicMaterial({ color: "rgb(0, 255,0)", opacity: 0.8, transparent: true })
        );

        this.mark.layers.set(1);
        this.viewer = null;
    }

    init(viewer: Viewer) {
        viewer.scene.add(this.mark);
        this.viewer = viewer;
    }

    start() {
        this.isActive = true;
        const g = new BufferGeometry();
        this.activeMeasurement = {
            line: new Line(g, new LineBasicMaterial({ color: "rgb(0, 255, 0)" })),
            lineGeom: g,
            nodes: [],
        };

        this.activeMeasurement.line.layers.set(1);
        this.viewer?.scene.add(this.activeMeasurement.line);
        console.log("LINE", this.activeMeasurement.line);
    }

    update(pos: Vector3) {
        this.mark.visible = true;
        this.mark.position.copy(pos);
        // TODO: scale
        // const dst = pt.position.clone().sub(this.camera.position).length();
        // const scl = 0.1 + dst / 50;
        // this.measure.mark.scale.set(scl, scl, scl);
    }

    addPoint(pos: Vector3) {
        if (!this.isActive || !this.activeMeasurement) {
            alert("no active measurement");
            throw new Error("no active measurement");
        }

        const node = this.mark.clone();

        this.viewer?.scene.add(node);

        this.activeMeasurement.nodes.push(node);

        const positions = this.activeMeasurement.nodes.map((n) => n.position);

        this.activeMeasurement.line.geometry.setFromPoints(positions);

        this.activeMeasurement.line.geometry.getAttribute("position").needsUpdate = true;
        this.activeMeasurement.line.geometry.computeBoundingSphere();

        if (positions.length > 1) {
            const prev = positions.at(-2)!;
            const cur = positions.at(-1)!;

            const vec = new Vector3().subVectors(cur, prev);
            const mid = vec.clone().multiplyScalar(0.5).add(prev);
            const len = vec.length();

            this.viewer?.addLabel(len.toFixed(2) + " m", null, mid);

            // TODO: add total to last measure
        }
    }

    stop() {
        this.isActive = false;
        this.mark.visible = false;
    }
}
