import {
    Box3,
    Euler,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    Plane,
    SphereGeometry,
    Vector2,
    Vector3,
} from "three";
import { Viewer } from "./viewer";
import { getMouseIntersection, getMouseRay } from "./pick";
import { PointCloud } from "./pointcloud";

const unitZ = new Vector3(0, 0, 1);

// see: https://www.redblobgames.com/making-of/draggable/

export class EarthControls {
    camera: PerspectiveCamera;
    domElement: HTMLElement;
    viewer: Viewer;
    pivot: Mesh;

    pointer = new Vector2(0, 0);

    secondPointer = new Vector2(0, 0);
    touchCount = 0;
    prevPinch = 0;

    dragging: "left" | "right" | "mid" | null = null;

    lastClick = performance.now();

    start = {
        mouse: new Vector2(),
    };

    onChange: null | (() => void) = null;

    constructor(camera: PerspectiveCamera, element: HTMLElement, viewer: Viewer) {
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

        this.domElement.addEventListener("pointerenter", (_e) => {});
        this.domElement.addEventListener("pointerleave", (_e) => {
            this.touchCount = Math.max(0, this.touchCount - 1);
        });

        this.domElement.addEventListener("wheel", (e) => {
            e.preventDefault();

            const deltaY = Math.sign(e.deltaY) * Math.pow(Math.abs(e.deltaY), 0.2);
            const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);

            if (pt) {
                this.zoomTo(pt.position, 1.0 + deltaY / 30);
            } else {
                // TODO: what to do if no point was hit? error flash?
                this.changed();
            }
        });
    }

    changed() {
        this.onChange?.();
    }

    init() {
        this.viewer.scene.add(this.pivot);
    }

    zoomTo(target: Vector3, factor: number) {
        const targetToCam = new Vector3().subVectors(this.camera.position, target);
        this.camera.position.copy(target).add(targetToCam.multiplyScalar(factor));
        this.saveCamera();
        this.changed();
    }

    pointerStart(e: PointerEvent) {
        this.touchCount++;
        const rect = this.domElement.getBoundingClientRect();
        if (e.isPrimary) {
            this.pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
        } else {
            this.secondPointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.secondPointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
            return;
        }

        const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);

        if (pt) {
            this.pivot.position.copy(pt.position);
            this.pivot.visible = true;
            const dst = pt.position.clone().sub(this.camera.position).length();
            const scl = 0.3 + dst / 40;
            this.pivot.scale.set(scl, scl, scl);
            // console.log("!!HIT!!", pt, scl, pt.position);
        } else {
            // console.log("miss");
            this.pivot.visible = false;
        }

        this.changed();

        if (!pt) {
            return;
        }

        // check for double click
        if (performance.now() - this.lastClick < 200) {
            this.zoomTo(pt.position, 0.5);
            return;
        }

        this.lastClick = performance.now();

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
        this.prevPinch = 0;
        this.touchCount = Math.max(0, this.touchCount - 1);
        if (!e.isPrimary) {
            return;
        }
        this.dragging = null;
        this.pivot.visible = false;
        this.changed();
    }

    prevAngle = new Vector2(0, 0);

    pointerMove(e: PointerEvent) {
        const rect = this.domElement.getBoundingClientRect();
        if (e.isPrimary) {
            this.pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
        } else {
            this.secondPointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.secondPointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
        }

        if (!this.dragging) {
            return;
        }

        if (e.isPrimary) {
            const dp = this.pointer.clone().sub(this.start.mouse);

            if (this.dragging === "right" || this.touchCount > 1) {
                // PITCH & YAW

                const ax = dp.x * 2 * Math.PI;
                const ay = dp.y * 2 * Math.PI;

                const dx = this.prevAngle.x - ax;
                let dy = this.prevAngle.y - ay;

                const cameraDir = this.camera.getWorldDirection(new Vector3());
                const pitch = cameraDir.angleTo(unitZ);

                // limit pitch angle to 0..PI to prevent flipping upside down
                if (pitch + dy > Math.PI) {
                    dy = Math.PI - pitch;
                }
                if (pitch + dy < 0) {
                    dy = 0 - pitch;
                }

                const pivotToCam = new Vector3().subVectors(this.camera.position, this.pivot.position);

                const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

                pivotToCam.applyAxisAngle(right, -dy);
                pivotToCam.applyAxisAngle(unitZ, dx);

                // update camera position
                this.camera.position.addVectors(this.pivot.position, pivotToCam);

                this.camera.rotateOnWorldAxis(right, -dy);
                this.camera.rotateOnWorldAxis(unitZ, dx);

                this.prevAngle.set(ax, ay);
            } else if (this.dragging === "left") {
                // PAN

                const plane = new Plane().setFromNormalAndCoplanarPoint(unitZ, this.pivot.position);
                const ray = getMouseRay(this.pointer, this.camera);
                const intersection = ray.intersectPlane(plane, new Vector3());
                if (intersection) {
                    const intersectionToPivot = new Vector3().subVectors(this.pivot.position, intersection);
                    this.camera.position.add(intersectionToPivot);
                }
            }
        }

        if (this.touchCount == 2) {
            const pinchDist = new Vector2().subVectors(this.pointer, this.secondPointer).length();

            const eps = 0.02;
            if (this.prevPinch > 0) {
                if (pinchDist > this.prevPinch) {
                    this.zoomTo(this.pivot.position, 1 - eps);
                } else {
                    this.zoomTo(this.pivot.position, 1 + eps);
                }
            }

            this.prevPinch = pinchDist;
        }

        this.saveCamera();
        this.changed();
    }

    update(_delta: number) {}

    targetAll() {
        const tbox = new Box3();
        for (const pcloud of this.viewer.pointClouds) {
            tbox.min.min(pcloud.tightBounds.min);
            tbox.max.max(pcloud.tightBounds.max);
        }
        console.log("TBOX", tbox);
        this.showBox(tbox);
    }

    private saveHandle = 0;

    saveCamera() {
        if (this.saveHandle > 0) {
            clearTimeout(this.saveHandle);
        }

        this.saveHandle = setTimeout(() => {
            const campos = {
                position: this.camera.position.toArray(),
                rotation: this.camera.rotation.toArray(),
            };
            localStorage.setItem("camera", JSON.stringify(campos));
            this.saveHandle = 0;
        }, 100);
    }

    restoreCamera() {
        const camText = localStorage.getItem("camera");

        if (!camText) {
            return false;
        }

        try {
            const camJSON = JSON.parse(camText);
            this.camera.position.copy(new Vector3().fromArray(camJSON.position));
            this.camera.rotation.copy(new Euler().fromArray(camJSON.rotation));
            this.changed();
            return true;
        } catch (e) {
            console.error("Error restoring camera", e);
            return false;
        }
    }

    showBox(box: Box3) {
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3()).x;

        this.camera.position.copy(center).add(new Vector3(0, -1, 0.5).multiplyScalar(size * 1.1));
        this.camera.lookAt(center);

        console.log("cam", this.camera.position);

        this.saveCamera();
        this.changed();
    }

    showPointCloud(pc: PointCloud) {
        this.showBox(pc.tightBounds);
    }
}
