import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { Viewer } from "./viewer";

type Measurement = {
    nodes: Array<Mesh>;
    lines: Array<Mesh>;
};

export class Measure {
    mark: Mesh;

    activeMeasurement: Measurement | null = null;

    measurements: Measurement[] = [];

    isActive = false;

    constructor() {
        this.mark = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshBasicMaterial({ color: "rgb(0, 255,0)", opacity: 0.8, transparent: true })
        );

        this.mark.layers.set(1);
    }

    init(viewer: Viewer) {
        viewer.scene.add(this.mark);
    }

    start() {
        this.isActive = true;
    }
    update(pos: Vector3) {
        this.mark.visible = true;
        this.mark.position.copy(pos);
        // TODO: scale
        // const dst = pt.position.clone().sub(this.camera.position).length();
        // const scl = 0.1 + dst / 50;
        // this.measure.mark.scale.set(scl, scl, scl);
    }
    stop() {
        this.isActive = false;
        this.mark.visible = false;
    }
}
