import { EventDispatcher, Mesh, MeshNormalMaterial, PerspectiveCamera, SphereGeometry, Vector2 } from "three";
import { Viewer } from "./viewer";
import { getMouseIntersection } from "./pick";

type EventTypes = {
    change: {};
};

// see: https://www.redblobgames.com/making-of/draggable/

const pointer = new Vector2(0, 0);

export class EarthControls extends EventDispatcher<EventTypes> {
    camera: PerspectiveCamera;
    domElement: HTMLCanvasElement;
    viewer: Viewer;
    pivot: Mesh;

    constructor(camera: PerspectiveCamera, element: HTMLCanvasElement, viewer: Viewer) {
        super();

        this.camera = camera;
        this.domElement = element;
        this.viewer = viewer;

        this.pivot = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshNormalMaterial({ wireframe: false, opacity: 0.8, transparent: true })
        );
        this.pivot.visible = false;

        this.domElement.addEventListener("pointerdown", (e) => this.onPointerDown(e));
        this.domElement.addEventListener("pointerup", (e) => this.onPointerUp(e));
        this.domElement.addEventListener("pointercancel", (e) => this.onPointerCancel(e));
        this.domElement.addEventListener("pointermove", (e) => this.onPointerMove(e));

        // this.domElement.addEventListener("touchstart", (e) => e.preventDefault());
    }

    init() {
        this.viewer.addExtraStuff(this.pivot);
    }

    onPointerDown(e: PointerEvent) {
        console.log("pointer DOWN", e);

        const pt = getMouseIntersection(pointer, this.camera, this.viewer.renderer, this.viewer);

        if (pt) {
            this.pivot.position.copy(pt.position);
            this.pivot.visible = true;
            console.log("!!HIT!!", pt);
        } else {
            this.pivot.visible = false;
        }
    }

    onPointerUp(e: PointerEvent) {
        console.log("pointer UP", e);
    }

    onPointerCancel(e: PointerEvent) {
        console.log("pointer CANCEL", e);
    }

    onPointerMove(e: PointerEvent) {
        const rect = this.domElement.getBoundingClientRect();

        pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
        // console.log("pointer MOVE", pointer, e);
    }

    update(delta: number) {
        // TODO: run animations
    }
}
