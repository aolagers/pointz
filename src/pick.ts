import {
    Camera,
    MeshBasicMaterial,
    NearestFilter,
    PerspectiveCamera,
    RGBAFormat,
    Raycaster,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { Viewer } from "./viewer";
import { PointCloud, PointCloudNode } from "./pointcloud";
import { PointMaterial } from "./materials/point-material";

const raycaster = new Raycaster();

const PICK_WINDOW = 31;

const pickMaterial = new PointMaterial(true);

const pickRenderTarget = new WebGLRenderTarget(PICK_WINDOW, PICK_WINDOW, {
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
});

export function getMouseRay(mouse: Vector2, camera: Camera) {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.ray;
}

export function getMouseIntersection(
    pointer: Vector2,
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    viewer: Viewer
) {
    const ray = getMouseRay(pointer, camera);

    let point: null | { screenPosition: Vector2; position: Vector3; pointcloud: PointCloud; node: PointCloudNode } =
        null;

    let hits = 0;
    for (const pc of viewer.pclouds) {
        for (const node of pc.loadedNodes) {
            const isHit = ray.intersectsBox(node.bounds);
            // const attr = node.geometry.getAttribute("visibleIndex");

            if (isHit) {
                // console.log("RAY", ray, node.bounds);

                // node.debugMesh.material = new MeshBasicMaterial({ color: "pink", wireframe: true });
                // node.visibleIndex = hitIdx;
                // for (let pidx = 0; pidx < attr.count; pidx++) {
                //     attr.setW(pidx, hitIdx);
                // }

                // console.log("SET", node, vi);
                hits++;
                // attr.needsUpdate = true;
            } else {
                // node.debugMesh.material = new MeshBasicMaterial({ color: "gray", wireframe: true });
                // node.visibleIndex = -1;
            }
        }
    }

    // limit rendering to area around mouse
    camera.setViewOffset(
        viewer.width,
        viewer.height,
        ((pointer.x + 1) / 2) * viewer.width - PICK_WINDOW / 2,
        viewer.height - ((pointer.y + 1) / 2) * viewer.height - PICK_WINDOW / 2,
        PICK_WINDOW,
        PICK_WINDOW
    );

    // TODO: only matching objects
    for (const o of viewer.objects) {
        o.material = pickMaterial;
    }

    // render to pick buffer
    renderer.setRenderTarget(pickRenderTarget);
    // this.renderer.clear();
    renderer.render(viewer.scene, camera);

    let pbuf = new Uint8Array(4 * PICK_WINDOW * PICK_WINDOW);

    renderer.readRenderTargetPixels(pickRenderTarget, 0, 0, PICK_WINDOW, PICK_WINDOW, pbuf);
    let closest = Infinity;
    let best = 0;

    for (let i = 0; i < pbuf.length / 4; i++) {
        const x = i % PICK_WINDOW;
        const y = Math.floor(i / PICK_WINDOW);
        const sqdist = (x - PICK_WINDOW / 2) ** 2 + (y - PICK_WINDOW / 2) ** 2;

        const r = pbuf[i * 4 + 0];
        const g = pbuf[i * 4 + 1];
        const b = pbuf[i * 4 + 2];
        const a = pbuf[i * 4 + 3];
        if ((r || g || b) && a != 255) {
            if (sqdist < closest) {
                closest = sqdist;
                best = i;
            }
        }
    }

    if (closest < Infinity) {
        // const x = best % pickWindow;
        // const y = Math.floor(best / pickWindow);
        const vals = pbuf.slice(best * 4, best * 4 + 4);
        const r = pbuf[best * 4 + 0];
        const g = pbuf[best * 4 + 1];
        const b = pbuf[best * 4 + 2];
        const a = pbuf[best * 4 + 3];
        const idx = r * 256 * 256 + g * 256 + b;
        let nodehit = null;
        let pchit = null;
        for (const pc of viewer.pclouds) {
            for (const lnode of pc.loadedNodes) {
                // console.log(node.visibleIndex);
                if (lnode.visibleIndex === a) {
                    nodehit = lnode;
                    pchit = pc;
                }
            }
        }

        if (nodehit && pchit) {
            const attrs = nodehit.geometry.getAttribute("position");

            const X = attrs.array[idx * 3 + 0];
            const Y = attrs.array[idx * 3 + 1];
            const Z = attrs.array[idx * 3 + 2];

            point = {
                screenPosition: new Vector2(pointer.x, pointer.y),
                position: new Vector3(X, Y, Z),
                node: nodehit,
                pointcloud: pchit,
            };

            console.log(
                `HIT a:${a} c:${vals.join("/")} idx:${idx} n:${nodehit} ` +
                    `p:${X} ${Y} ${Z} pts:${attrs.count} idx:${idx}`
            );
        } else {
            console.warn("NOPE", a, vals.join("/"), idx, nodehit, "f:", hits);
        }
    }

    /*
    // render to output canvas
    this.renderer.setRenderTarget(null);
    this.renderer.setViewport(0, 0, pickWindow, pickWindow);
    this.renderer.render(this.scene, this.camera);
    */

    // reset rendering
    camera.clearViewOffset();
    renderer.setViewport(0, 0, viewer.width, viewer.height);

    for (const o of viewer.objects) {
        o.material = PointCloud.material;
    }

    return point;
}
