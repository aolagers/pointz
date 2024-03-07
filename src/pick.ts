import { Camera, MeshBasicMaterial, Raycaster, Vector2 } from "three";
import { Viewer } from "./viewer";
import { PointCloud } from "./pointcloud";

const raycaster = new Raycaster();

export function getMouseRay(mouse: Vector2, camera: Camera) {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.ray;
}

// TODO: only return the hit, dont modify rendering here
export function getMouseIntersection(pointer: Vector2, viewer: Viewer) {
    const pickWindow = 31;
    const ray = getMouseRay(pointer, viewer.camera);

    let hits = 0;
    for (const pc of viewer.pclouds) {
        for (const node of pc.loadedNodes) {
            const isHit = ray.intersectsBox(node.bounds);
            // const attr = node.geometry.getAttribute("visibleIndex");

            if (isHit) {
                // console.log("RAY", ray, node.bounds);

                node.debugMesh.material = new MeshBasicMaterial({ color: "pink", wireframe: true });
                // node.visibleIndex = hitIdx;
                // for (let pidx = 0; pidx < attr.count; pidx++) {
                //     attr.setW(pidx, hitIdx);
                // }

                // console.log("SET", node, vi);
                hits++;
                // attr.needsUpdate = true;
            } else {
                node.debugMesh.material = new MeshBasicMaterial({ color: "gray", wireframe: true });
                // node.visibleIndex = -1;
            }
        }
    }

    // limit rendering to area around mouse
    viewer.camera.setViewOffset(
        viewer.width,
        viewer.height,
        ((pointer.x + 1) / 2) * viewer.width - pickWindow / 2,
        viewer.height - ((pointer.y + 1) / 2) * viewer.height - pickWindow / 2,
        pickWindow,
        pickWindow
    );

    // TODO: only matching objects
    for (const o of viewer.objects) {
        o.material = PointCloud.pickMaterial;
    }

    // render to pick buffer
    viewer.renderer.setRenderTarget(viewer.pickTarget);
    // this.renderer.clear();
    viewer.renderer.render(viewer.scene, viewer.camera);

    let pbuf = new Uint8Array(4 * pickWindow * pickWindow);

    // if (Date.now() - lastlog > 1000)
    viewer.renderer.readRenderTargetPixels(viewer.pickTarget, 0, 0, pickWindow, pickWindow, pbuf);
    // console.log(pbuf.slice(0, 4).join("/"), pbuf.slice(4, 8).join("/"));
    let closest = Infinity;
    let best = 0;

    for (let i = 0; i < pbuf.length / 4; i++) {
        const x = i % pickWindow;
        const y = Math.floor(i / pickWindow);
        const sqdist = (x - pickWindow / 2) ** 2 + (y - pickWindow / 2) ** 2;

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

            viewer.marker.position.set(X, Y, Z);

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
    viewer.camera.clearViewOffset();
    viewer.renderer.setViewport(0, 0, viewer.width, viewer.height);

    for (const o of viewer.objects) {
        o.material = PointCloud.material;
    }

    return null;
}
