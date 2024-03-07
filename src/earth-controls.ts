import { Mesh, MeshNormalMaterial, PerspectiveCamera, Plane, SphereGeometry, Vector2, Vector3 } from "three";
import { Viewer } from "./viewer";
import { getMouseIntersection, getMouseRay } from "./pick";
import { PointCloud } from "./pointcloud";

const unitZ = new Vector3(0, 0, 1);

// see: https://www.redblobgames.com/making-of/draggable/

// TODO: remove allocation from move handler
// TODO: try zooming to mouse position, not center
// TODO: run animations

export class EarthControls {
    camera: PerspectiveCamera;
    domElement: HTMLCanvasElement;
    viewer: Viewer;
    pivot: Mesh;

    pointer = new Vector2(0, 0);

    dragging: "left" | "right" | "mid" | null = null;

    lastClick = Date.now();

    start = {
        mouse: new Vector2(),
    };

    onChange: null | (() => void) = null;

    constructor(camera: PerspectiveCamera, element: HTMLCanvasElement, viewer: Viewer) {
        this.camera = camera;
        this.domElement = element;
        this.viewer = viewer;

        this.pivot = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshNormalMaterial({ wireframe: false, opacity: 0.8, transparent: true })
        );
        this.pivot.visible = false;

        this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

        this.domElement.addEventListener("pointerdown", (e) => this.pointerStart(e));
        this.domElement.addEventListener("pointerup", (e) => this.pointerEnd(e));
        this.domElement.addEventListener("pointercancel", (e) => this.pointerEnd(e));
        this.domElement.addEventListener("pointermove", (e) => this.pointerMove(e));
        this.domElement.addEventListener("wheel", (e) => {
            this.zoom(e.deltaY);
            e.preventDefault();
        });

        // this.domElement.addEventListener("touchstart", (e) => e.preventDefault());
    }

    zoom(deltaY: number) {
        const step = Math.sign(deltaY) * Math.sqrt(Math.abs(deltaY));
        console.log("zoom", deltaY);
        const dir = this.camera.getWorldDirection(new Vector3());
        this.camera.position.add(dir.multiplyScalar(-step));
        this.onChange?.();
    }

    init() {
        this.viewer.addExtraStuff(this.pivot);
    }

    zoomTo(target: Vector3) {
        const camToTarget = new Vector3().subVectors(target, this.camera.position);
        this.camera.position.add(camToTarget.multiplyScalar(0.5));
    }

    pointerStart(e: PointerEvent) {
        if (!e.isPrimary) {
            return;
        }

        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;

        const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);

        if (pt) {
            this.pivot.position.copy(pt.position);
            this.pivot.visible = true;
            const dst = pt.position.clone().sub(this.camera.position).length();
            const scl = 0.3 + dst / 40;
            this.pivot.scale.set(scl, scl, scl);
            console.log("!!HIT!!", pt, scl, pt.position);
        } else {
            console.log("miss");
            this.pivot.visible = false;
        }

        this.onChange?.();

        if (!pt) {
            return;
        }

        if (Date.now() - this.lastClick < 200) {
            this.zoomTo(pt.position);
            return;
        }

        this.lastClick = Date.now();

        if (e.button === 0) {
            this.dragging = "left";
        } else if (e.button === 1) {
            this.dragging = "mid";
        } else if (e.button === 2) {
            this.dragging = "right";
        } else {
            this.pointerEnd(e);
            console.error("unknown button", e.button);
            return;
        }

        this.start.mouse.copy(this.pointer);
        this.prevAngle.set(0, 0);

        console.log("pointer DOWN", this.dragging, e);
    }

    pointerEnd(e: PointerEvent) {
        if (!e.isPrimary) {
            return;
        }
        this.dragging = null;
        this.pivot.visible = false;
        console.log("pointer UP", this.dragging, e);
        this.onChange?.();
    }

    prevAngle = new Vector2(0, 0);

    pointerMove(e: PointerEvent) {
        const rect = this.domElement.getBoundingClientRect();
        if (!e.isPrimary) {
            return;
        }

        this.pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;

        if (!this.dragging) return;

        const dp = this.pointer.clone().sub(this.start.mouse);

        if (this.dragging === "left") {
            // PAN

            const plane = new Plane().setFromNormalAndCoplanarPoint(unitZ, this.pivot.position);
            const ray = getMouseRay(this.pointer, this.camera);
            const intersection = ray.intersectPlane(plane, new Vector3());
            if (intersection) {
                const intersectionToPivot = new Vector3().subVectors(this.pivot.position, intersection);
                this.camera.position.add(intersectionToPivot);
            }
        } else if (this.dragging === "right") {
            // PITCH & YAW

            const ax = dp.x * 2 * Math.PI;
            const ay = dp.y * 2 * Math.PI;

            const dx = this.prevAngle.x - ax;
            const dy = this.prevAngle.y - ay;

            const pivotToCam = new Vector3().subVectors(this.camera.position, this.pivot.position);
            const right = new Vector3().crossVectors(unitZ, this.camera.getWorldDirection(new Vector3())).normalize();

            pivotToCam.applyAxisAngle(right, dy);
            pivotToCam.applyAxisAngle(unitZ, dx);

            const newPos = new Vector3().addVectors(this.pivot.position, pivotToCam);

            this.camera.position.copy(newPos);

            this.camera.rotateOnWorldAxis(unitZ, dx);
            this.camera.rotateOnWorldAxis(right, dy);

            this.prevAngle.set(ax, ay);
        }

        this.onChange?.();
    }

    update(_delta: number) {}

    showPointCloud(pc: PointCloud) {
        const center = pc.octreeBounds.getCenter(new Vector3());
        const size = pc.octreeBounds.getSize(new Vector3()).x;

        this.camera.position.copy(center).add(new Vector3(0, -size, size / 2));
        this.camera.lookAt(center);

        console.log("cam", this.camera.position);

        this.onChange?.();
    }
}