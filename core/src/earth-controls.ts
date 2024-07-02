import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Euler,
    EulerOrder,
    Intersection,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshNormalMaterial,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Plane,
    SphereGeometry,
    Vector2,
    Vector3,
    Vector3Tuple,
} from "three";
import { Measure } from "./measure";
import { getMouseIntersection, getMouseRay } from "./pick";
import { PointCloud } from "./pointcloud";
import { LOCALSTORAGE_KEYS } from "./settings";
import { getCameraFrustum } from "./utils";
import { Viewer } from "./viewer";

type CameraPosition = {
    type: "perspective" | "ortho";
    position: Vector3Tuple;
    rotation: [number, number, number, EulerOrder];
    size: number[];
};

const UNIT_Z = new Vector3(0, 0, 1);
const DBLCLICK_LEN = 300;

// see: https://www.redblobgames.com/making-of/draggable/

const lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0x00ff00, depthWrite: false }));

export class EarthControls {
    camera: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement;
    viewer: Viewer;
    pivot: Mesh;

    measure: Measure;

    pointer = new Vector2(0, 0);

    secondPointer = new Vector2(0, 0);
    prevPinch = 0;

    dragging: "left" | "right" | "mid" | null = null;

    lastClickUp = performance.now();
    lastClickDown = performance.now();
    lastMove = performance.now();

    start = {
        mouse: new Vector2(),
    };

    speed = 10.0;

    down = {
        primary: false,
        secondary: false,
    };

    onChange: null | ((why: string) => void) = null;

    warningElement: HTMLDivElement;

    constructor(camera: PerspectiveCamera | OrthographicCamera, element: HTMLElement, viewer: Viewer) {
        this.camera = camera;
        this.domElement = element;
        this.viewer = viewer;

        this.pivot = new Mesh(
            new SphereGeometry(0.5, 16, 16),
            new MeshNormalMaterial({ wireframe: false, opacity: 0.8, transparent: true })
        );
        this.pivot.layers.set(1);
        this.pivot.visible = false;

        this.measure = new Measure();

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

        this.warningElement = document.createElement("div");
        document.body.appendChild(this.warningElement);
        this.warningElement.classList.add(
            "fixed",
            "z-20",
            "top-2",
            "text-white",
            "cursor-pointer",
            "opacity-75",
            "left-1/2",
            "-translate-x-1/2",
            "hidden"
        );
        this.warningElement.innerText = "No pointclouds visible. Click to here reset camera.";
        this.warningElement.addEventListener("click", () => {
            this.targetAll();
        });
    }

    lastVisibilityCheck = 0;

    changed(why: string) {
        if (performance.now() - this.lastVisibilityCheck > 500) {
            const frustum = getCameraFrustum(this.camera);
            let hasVisible = false;

            for (const pc of this.viewer.pointClouds) {
                if (frustum.intersectsBox(pc.tree.root.node.bounds)) {
                    hasVisible = true;
                    this.warningElement.classList.add("hidden");
                }
            }
            if (!hasVisible && this.viewer.pointClouds.length > 0) {
                console.log("no clouds visible!", this.camera, frustum);
                this.warningElement.classList.remove("hidden");
            }
            this.lastVisibilityCheck = performance.now();
        }

        this.onChange?.(why);
    }

    init() {
        this.viewer.scene.add(this.pivot);
        this.measure.init(this.viewer);

        const vertices = new Float32Array(128 * 3);
        lines.geometry.setAttribute("position", new BufferAttribute(vertices, 3));

        this.viewer.scene.add(lines);
    }

    setCursor(cursor: string) {
        this.viewer.labelRenderer.domElement.style.cursor = cursor;
    }

    zoomTo(target: Vector3, factor: number) {
        if (this.camera instanceof OrthographicCamera) {
            this.camera.left *= factor;
            this.camera.right *= factor;
            this.camera.top *= factor;
            this.camera.bottom *= factor;
        } else {
            const targetToCam = new Vector3().subVectors(this.camera.position, target);
            this.camera.position.copy(target).add(targetToCam.multiplyScalar(factor));
        }
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
            if (this.camera instanceof PerspectiveCamera) {
                const dst = pt.position.clone().sub(this.camera.position).length();
                const scl = 0.1 + dst / 40;
                this.pivot.scale.set(scl, scl, scl);
            } else {
                const scl = (this.camera.right - this.camera.left) / 50;
                this.pivot.scale.set(scl, scl, scl);
            }

            const l = pt.position.distanceTo(this.camera.position);
            this.speed = l / 10;

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
            if (performance.now() - this.lastClickDown < DBLCLICK_LEN && this.lastClickDown > this.lastMove) {
                this.zoomPrevY = this.pointer.y;
                this.zoomStart3D.copy(pt.position);
                this.isZooming = true;
            }
        }

        if (e.button === 0) {
            if (this.measure.isActive && performance.now() - this.lastClickDown > DBLCLICK_LEN) {
                this.measure.addPoint(pt.position);
            }
            this.dragging = "left";
        } else if (e.button === 1) {
            this.dragging = "mid";
        } else if (e.button === 2) {
            if (this.measure.isActive) {
                this.measure.stop();
            }
            this.dragging = "right";
        } else {
            this.pointerEnd(e);
            console.error("unknown button", e.button);
            return;
        }

        this.start.mouse.copy(this.pointer);
        this.prevAngle.set(0, 0);

        if (e.isPrimary) {
            this.lastClickDown = performance.now();
        }
    }

    pointerUp(e: PointerEvent) {
        if (e.isPrimary) {
            const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);
            if (pt) {
                if (performance.now() - this.lastClickUp < DBLCLICK_LEN && this.lastClickUp > this.lastMove) {
                    if (this.measure.isActive) {
                        this.measure.stop();
                    } else {
                        this.zoomTo(pt.position, 0.5);
                    }
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
    prevPanTime = 0;
    intersectionToPivot = new Vector3();
    panSpeed = 0.0;

    prevFrame = 0;

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

        if (this.measure.isActive) {
            const pt = getMouseIntersection(this.pointer, this.camera, this.viewer.renderer, this.viewer);
            if (pt) {
                this.measure.update(pt.position);
                this.changed("measure");
            }
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
                const ay = (dp.y * 2 * Math.PI * sensitivity) / 2;

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
                    this.intersectionToPivot.subVectors(this.pivot.position, intersection);

                    const meters = this.intersectionToPivot.length();
                    const dt = performance.now() - this.prevPanTime;
                    this.panSpeed = meters / dt;
                    this.prevPanTime = performance.now();

                    if (this.prevFrame !== this.viewer.frame) {
                        this.camera.position.add(this.intersectionToPivot);
                    }
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
        this.prevFrame = this.viewer.frame;
    }

    updateLines() {
        let hpid = 0;
        for (let pcid = 0; pcid < this.viewer.pointClouds.length; pcid++) {
            const pc = this.viewer.pointClouds[pcid];
            if (!pc.isHighlighted) {
                continue;
            }

            const corner = pc.tightBounds.max.clone().sub(this.viewer.customOffset);

            let x = 0.8;
            let y = 0.9;

            if (pc.uiLabel) {
                const rect = this.domElement.getBoundingClientRect();
                const labelRect = pc.uiLabel.getBoundingClientRect();
                x = ((labelRect.x - rect.x) / rect.width) * 2 - 1;
                y = -((labelRect.y + labelRect.height / 2 - rect.y) / rect.height) * 2 + 1;
            }

            const ray = getMouseRay(new Vector2(x, y), this.camera);
            const to = ray.origin.addScaledVector(ray.direction, 100);

            lines.geometry.attributes.position.setXYZ(hpid * 2, to.x, to.y, to.z);
            lines.geometry.attributes.position.setXYZ(hpid * 2 + 1, corner.x, corner.y, corner.z);
            lines.geometry.attributes.position.needsUpdate = true;
            lines.geometry.computeBoundingSphere();

            hpid++;
        }

        lines.geometry.setDrawRange(0, hpid * 2);
    }

    keysDown = new Set<string>();

    keyevent(key: string, down: boolean) {
        if (down) {
            this.keysDown.add(key);
        } else {
            this.keysDown.delete(key);
        }
    }

    wasKeyPressedOnLastUpdate = false;

    update(delta: number) {
        if (this.keysDown.size > 0) {
            if (!this.wasKeyPressedOnLastUpdate) {
                // don't try to render on first frame after keypress because the deltatime might be huge
                this.wasKeyPressedOnLastUpdate = true;
                this.changed("wasd-movement");
                return;
            }
            const fwd = this.camera.getWorldDirection(new Vector3());

            const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            const fwdLevel = fwd.clone().setZ(0).normalize();

            if (this.keysDown.has("w")) {
                this.camera.position.add(fwdLevel.multiplyScalar(delta * this.speed));
            } else if (this.keysDown.has("s")) {
                this.camera.position.add(fwdLevel.multiplyScalar(-delta * this.speed));
            }

            if (this.keysDown.has("d")) {
                this.camera.position.add(right.multiplyScalar(delta * this.speed));
            } else if (this.keysDown.has("a")) {
                this.camera.position.add(right.multiplyScalar(-delta * this.speed));
            }

            this.changed("wasd-movement");
        } else {
            this.wasKeyPressedOnLastUpdate = false;
        }
    }

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
            const campos: CameraPosition = {
                type: this.camera instanceof PerspectiveCamera ? "perspective" : "ortho",
                position: new Vector3().addVectors(this.camera.position, this.viewer.customOffset).toArray(),
                rotation: this.camera.rotation.toArray() as [number, number, number, EulerOrder],
                size:
                    this.camera instanceof OrthographicCamera
                        ? [this.camera.left, this.camera.right, this.camera.top, this.camera.bottom]
                        : [],
            };
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

            if (camJSON.type === "perspective" && !(this.camera instanceof PerspectiveCamera)) {
                this.viewer.camera = this.viewer.createCamera("perspective");
                this.camera = this.viewer.camera;
            }
            if (camJSON.type === "ortho" && !(this.camera instanceof OrthographicCamera)) {
                this.viewer.camera = this.viewer.createCamera("ortho");
                this.camera = this.viewer.camera;
            }

            this.camera.position.copy(new Vector3().fromArray(camJSON.position).sub(this.viewer.customOffset));
            this.camera.rotation.copy(new Euler().fromArray(camJSON.rotation));
            console.log("RESTORE", camJSON);

            if (camJSON.type === "ortho" && this.camera instanceof OrthographicCamera) {
                this.camera.left = camJSON.size[0];
                this.camera.right = camJSON.size[1];
                this.camera.top = camJSON.size[2];
                this.camera.bottom = camJSON.size[3];
            }
            this.camera.updateProjectionMatrix();

            this.changed("restoreCam");
            return true;
        } catch (e) {
            console.error("Error restoring camera", e);
            return false;
        }
    }

    showBox(box: Box3) {
        const tbox = box.clone();
        tbox.min.sub(this.viewer.customOffset);
        tbox.max.sub(this.viewer.customOffset);

        const center = tbox.getCenter(new Vector3());
        const boxSize = tbox.getSize(new Vector3());
        const maxEdge = Math.max(boxSize.x, boxSize.y, boxSize.z);

        if (this.camera instanceof OrthographicCamera) {
            const sx = this.camera.right - this.camera.left;
            const sy = this.camera.top - this.camera.bottom;

            const xmult = (1.05 * maxEdge) / sy;
            const ymult = (1.05 * maxEdge) / sx;

            this.camera.left *= xmult;
            this.camera.right *= xmult;
            this.camera.top *= ymult;
            this.camera.bottom *= ymult;

            this.camera.position.copy(center).add(new Vector3(0, -1, 0.8).normalize().multiplyScalar(10_000));
            this.camera.updateProjectionMatrix();
        }
        if (this.camera instanceof PerspectiveCamera) {
            const fovRad = this.camera.fov * (Math.PI / 180);
            const cdist = (0.5 * maxEdge) / Math.sin(fovRad / 2);
            this.camera.position.copy(center).add(new Vector3(0, -1, 0.8).normalize().multiplyScalar(cdist * 1.1));
        }

        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();

        console.log("cam", this.camera.position);

        this.saveCamera();
        this.changed("showBox");
    }

    showPointCloud(pc: PointCloud) {
        this.showBox(pc.tightBounds);
    }

    move(arg0: number[]) {
        throw new Error("Method not implemented.");
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
