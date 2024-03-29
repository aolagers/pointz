import {
    Box3,
    Euler,
    EulerOrder,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    Plane,
    SphereGeometry,
    Vector2,
    Vector3,
    Vector3Tuple,
} from "three";
import { Viewer } from "./viewer";
import { getMouseIntersection, getMouseRay } from "./pick";
import { PointCloud } from "./pointcloud";
import { LOCALSTORAGE_KEYS } from "./settings";

type CameraPosition = {
    position: Vector3Tuple;
    rotation: [number, number, number, EulerOrder];
};

const UNIT_Z = new Vector3(0, 0, 1);

// see: https://www.redblobgames.com/making-of/draggable/

export class EarthControls {
    camera: PerspectiveCamera;
    domElement: HTMLElement;
    viewer: Viewer;
    pivot: Mesh;

    pointer = new Vector2(0, 0);

    secondPointer = new Vector2(0, 0);
    prevPinch = 0;

    dragging: "left" | "right" | "mid" | null = null;

    lastClickUp = performance.now();
    lastClickDown = performance.now();

    start = {
        mouse: new Vector2(),
    };

    down = {
        primary: false,
        secondary: false,
    };

    onChange: null | ((why: string) => void) = null;

    constructor(camera: PerspectiveCamera, element: HTMLElement, viewer: Viewer) {
        this.camera = camera;
        this.domElement = element;
        this.viewer = viewer;

        this.pivot = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshNormalMaterial({ wireframe: false, opacity: 0.8, transparent: true })
        );

        this.camera.layers.disable(1);
        this.pivot.layers.set(1);

        this.pivot.visible = false;

        this.domElement.addEventListener("touchstart", createDoubleTapPreventer(500), { passive: false });

        this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

        this.domElement.addEventListener("pointerdown", (e) => this.pointerStart(e));
        this.domElement.addEventListener("pointerup", (e) => this.pointerUp(e));
        this.domElement.addEventListener("pointercancel", (e) => this.pointerEnd(e));
        this.domElement.addEventListener("pointermove", (e) => this.pointerMove(e));

        this.domElement.addEventListener("pointerenter", (_e) => {});
        this.domElement.addEventListener("pointerleave", (_e) => {});

        this.domElement.addEventListener("wheel", (e) => {
            e.preventDefault();

            const deltaY = Math.sign(e.deltaY) * Math.pow(Math.abs(e.deltaY), 0.2);
            const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);

            if (pt) {
                this.zoomTo(pt.position, 1.0 + deltaY / 20);
            } else {
                // TODO: what to do if no point was hit? error flash?
                this.changed("wheel");
            }
        });
    }

    changed(why: string) {
        this.onChange?.(why);
    }

    init() {
        this.viewer.scene.add(this.pivot);
    }

    setCursor(cursor: string) {
        this.viewer.labelRenderer.domElement.style.cursor = cursor;
    }

    zoomTo(target: Vector3, factor: number) {
        const targetToCam = new Vector3().subVectors(this.camera.position, target);
        this.camera.position.copy(target).add(targetToCam.multiplyScalar(factor));
        this.saveCamera();
        this.changed("zoomTo");
    }

    isZooming = false;

    zoomPrevY = 0;
    zoomStart3D = new Vector3();

    pointerStart(e: PointerEvent) {
        const rect = this.domElement.getBoundingClientRect();
        if (e.isPrimary) {
            this.down.primary = true;
            this.pointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
        } else {
            this.down.secondary = true;
            this.secondPointer.x = ((e.clientX - rect.x) / rect.width) * 2 - 1;
            this.secondPointer.y = -((e.clientY - rect.y) / rect.height) * 2 + 1;
            return;
        }

        const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);

        if (pt) {
            this.pivot.position.copy(pt.position);
            this.pivot.visible = true;
            const dst = pt.position.clone().sub(this.camera.position).length();
            const scl = 0.1 + dst / 40;
            this.pivot.scale.set(scl, scl, scl);
            // console.log("!!HIT!!", pt, scl, pt.position);
        } else {
            // console.log("miss");
            this.pivot.visible = false;
        }

        this.changed("pointerStart");

        if (!pt) {
            return;
        }

        // TODO: check for double click zoom thing
        if (e.isPrimary) {
            if (performance.now() - this.lastClickDown < 200) {
                this.zoomPrevY = this.pointer.y;
                this.zoomStart3D.copy(pt.position);
                this.isZooming = true;
            }

            this.lastClickDown = performance.now();
        }

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

        // console.log("pointer DOWN", this.dragging, e);
    }

    pointerUp(e: PointerEvent) {
        if (e.isPrimary) {
            const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);
            if (pt) {
                if (performance.now() - this.lastClickUp < 200) {
                    this.zoomTo(pt.position, 0.5);
                    // return;
                }
            }
            this.lastClickUp = performance.now();
        }

        this.pointerEnd(e);
    }

    pointerEnd(e: PointerEvent) {
        if (e.isPrimary) {
            this.setCursor("auto");
            this.down.primary = false;
        } else {
            this.down.secondary = false;
        }

        this.isZooming = false;
        this.prevPinch = 0;
        if (!e.isPrimary) {
            return;
        }
        this.dragging = null;
        this.pivot.visible = false;
        this.changed("pointerEnd");
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

        if (this.isZooming) {
            this.setCursor("zoom-in");
            const dy = this.pointer.y - this.zoomPrevY;

            const z = 1.0 + dy * 3.0;
            this.zoomPrevY = this.pointer.y;
            this.zoomTo(this.zoomStart3D, z);
            return;
        }

        if (!this.dragging) {
            return;
        }

        const sensitivity = e.pointerType === "touch" ? 0.4 : 0.8;

        if (e.isPrimary) {
            const dp = this.pointer.clone().sub(this.start.mouse);

            if (this.dragging === "right" || (this.down.primary && this.down.secondary)) {
                // PITCH & YAW

                this.setCursor("grab");
                const ax = dp.x * 2 * Math.PI * sensitivity;
                const ay = dp.y * 2 * Math.PI * sensitivity;

                const dx = this.prevAngle.x - ax;
                let dy = this.prevAngle.y - ay;

                const cameraDir = this.camera.getWorldDirection(new Vector3());
                const pitch = cameraDir.angleTo(UNIT_Z);

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
                pivotToCam.applyAxisAngle(UNIT_Z, dx);

                // update camera position
                this.camera.position.addVectors(this.pivot.position, pivotToCam);

                this.camera.rotateOnWorldAxis(right, -dy);
                this.camera.rotateOnWorldAxis(UNIT_Z, dx);

                this.prevAngle.set(ax, ay);
            } else if (this.dragging === "left") {
                // PAN

                this.setCursor("move");

                const plane = new Plane().setFromNormalAndCoplanarPoint(UNIT_Z, this.pivot.position);
                const ray = getMouseRay(this.pointer, this.camera);
                const intersection = ray.intersectPlane(plane, new Vector3());
                if (intersection) {
                    const intersectionToPivot = new Vector3().subVectors(this.pivot.position, intersection);
                    this.camera.position.add(intersectionToPivot);
                }
            }
        }

        // pinch zoom
        /*
        if (two buttons down) {
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
        */

        this.saveCamera();
        this.changed("pointerMove");
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
            } as CameraPosition;
            localStorage.setItem(LOCALSTORAGE_KEYS.CAMERA, JSON.stringify(campos));
            this.saveHandle = 0;
        }, 100);
    }

    restoreCamera() {
        const camText = localStorage.getItem(LOCALSTORAGE_KEYS.CAMERA);

        if (!camText) {
            return false;
        }

        try {
            const camJSON = JSON.parse(camText) as CameraPosition;
            this.camera.position.copy(new Vector3().fromArray(camJSON.position));
            this.camera.rotation.copy(new Euler().fromArray(camJSON.rotation));
            this.changed("restoreCam");
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
        this.changed("showBox");
    }

    showPointCloud(pc: PointCloud) {
        this.showBox(pc.tightBounds);
    }
}

/** Prevent the event if double tapped too quickli */
function createDoubleTapPreventer(timeout_ms: number) {
    let dblTapTimer = 0;
    let dblTapPressed = false;

    return function (e: TouchEvent) {
        clearTimeout(dblTapTimer);
        if (dblTapPressed) {
            e.preventDefault();
            dblTapPressed = false;
        } else {
            dblTapPressed = true;
            dblTapTimer = setTimeout(() => {
                dblTapPressed = false;
            }, timeout_ms);
        }
    };
}
