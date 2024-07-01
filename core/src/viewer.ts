import {
    Clock,
    Color,
    DepthTexture,
    EventDispatcher,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    OrthographicCamera,
    PerspectiveCamera,
    PlaneGeometry,
    RGBAFormat,
    Scene,
    UnsignedIntType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EarthControls } from "./earth-controls";
import { EDLMaterial } from "./materials/edl-material";
import { DEFAULT_POINT_MATERIAL, pointMaterialPool } from "./materials/point-material";
import { PointCloud } from "./pointcloud";
import { PointCloudNode, pointsWorkerPool } from "./pointcloud-node";
import { PriorityQueue } from "./priority-queue";
import { ALWAYS_RENDER, CAMERA_FAR, CAMERA_NEAR, ERROR_LIMIT, POINT_BUDGET, SHOW_RENDERS } from "./settings";
import { createTightBounds, getCameraFrustum, printVec, throttle } from "./utils";

const clock = new Clock();

type TEvents = {
    loading: { nodes: number };
    message: { text: string };
    notice: { kind: "error" | "warn" | "info"; message: string };
    pointclouds: {
        pclouds: Array<{
            name: string;
            pointCount: number;
            item: PointCloud;
            onCenter: () => void;
            onRemove: () => void;
            onToggleVisibility: () => void;
        }>;
    };
};

export class Viewer extends EventDispatcher<TEvents> {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;

    econtrols: EarthControls;

    scene: Scene;
    labelScene: Scene;

    pointClouds: PointCloud[] = [];

    customOffset: Vector3 = new Vector3();
    customOffsetInitialized = false;

    frame = 0;
    lastFrameTime = 0;
    avgFrameTime1 = 0;
    avgFrameTime2 = 0;
    renderTarget: WebGLRenderTarget;

    sceneOrtho: Scene;
    cameraOrtho: OrthographicCamera;

    width = 0;
    height = 0;

    renderRequested: boolean;

    edlMaterial: EDLMaterial;

    initialized = false;

    #debug_mode = false;

    get debug_mode() {
        return this.#debug_mode;
    }

    set debug_mode(to: boolean) {
        this.pointClouds.forEach((pc) => {
            if (pc.tightBoundsMesh) {
                pc.tightBoundsMesh.visible = to;
            }
        });
        this.#debug_mode = to;
        this.requestRender("debug mode toggled");
    }

    debugEl: HTMLElement | undefined = undefined;

    debugInfo = {
        jsmem: "",
        camera: "",
        // touch: "",
        pool: "",
        render: "",
        frames: "",
        offset: "",
        nodestats: "",
        vis: "",
    };

    labelRenderer: CSS2DRenderer;

    constructor(canvasElement: HTMLCanvasElement, width: number, height: number) {
        super();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (window as any).viewer = this;

        this.width = width;
        this.height = height;

        this.renderRequested = false;

        this.renderer = new WebGLRenderer({
            canvas: canvasElement,
            // antialias: false,
            // alpha: false,
            // premultipliedAlpha: true,
            stencil: false,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false,
        });

        this.renderer.setClearColor(new Color(0x000000), 0.0);

        this.renderer.setSize(this.width, this.height, false);

        this.renderer.info.autoReset = false;

        this.renderTarget = new WebGLRenderTarget(this.width, this.height, {
            format: RGBAFormat,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            stencilBuffer: false,
            depthTexture: new DepthTexture(this.width, this.height, UnsignedIntType),
        });

        this.camera = new PerspectiveCamera(60, this.width / this.height, CAMERA_NEAR, CAMERA_FAR);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, -50, 25);
        this.camera.lookAt(0, 0, 0);

        this.labelRenderer = new CSS2DRenderer();
        this.econtrols = new EarthControls(this.camera, this.labelRenderer.domElement, this);

        this.scene = new Scene();
        this.labelScene = new Scene();

        this.edlMaterial = new EDLMaterial(this.renderTarget.texture, this.renderTarget.depthTexture);

        const tquad = new Mesh(new PlaneGeometry(2, 2), this.edlMaterial);
        this.sceneOrtho = new Scene();
        this.sceneOrtho.add(tquad); // Scene for orthographic display

        this.cameraOrtho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.setSize(this.width, this.height);
    }

    init(opts: { debugEl?: HTMLElement } = {}) {
        // document.body.appendChild(this.stats.dom);

        this.debugEl = opts.debugEl;

        this.econtrols.onChange = (why) => {
            this.debugInfo.camera = printVec(this.camera.position);

            this.loadMoreNodesThrottled();
            this.requestRender("controls " + why);
        };

        document.addEventListener("dragover", (ev) => {
            ev.preventDefault();
        });

        document.addEventListener("drop", (ev) => {
            console.log("dropped", ev);
            ev.preventDefault();

            if (!ev.dataTransfer) return;

            if (ev.dataTransfer.items) {
                [...ev.dataTransfer.items].forEach((item, i) => {
                    if (item.kind === "file") {
                        const file = item.getAsFile();
                        if (file) {
                            console.log(`… file[${i}].name = ${file.name}`);
                            void this.addLAZ(file, true);
                        }
                    }
                });
            }
        });

        document.addEventListener("keyup", (ev) => {
            if (["w", "s", "a", "d"].includes(ev.key)) {
                this.econtrols.keyevent(ev.key, false);
                this.requestRender("keyup");
            }
        });

        document.addEventListener("keydown", (ev) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) {
                console.log("skip key", ev.key);
                return;
            }

            for (const ptmat of [DEFAULT_POINT_MATERIAL, ...pointMaterialPool.all]) {
                if (ev.key === "1") {
                    ptmat.changeColorMode("INTENSITY");
                } else if (ev.key === "2") {
                    ptmat.changeColorMode("CLASSIFICATION");
                } else if (ev.key === "3") {
                    ptmat.changeColorMode("RGB");
                } else if (ev.key === "4") {
                    ptmat.changeColorMode("RGB_AND_CLASS");
                } else if (ev.key === "+") {
                    ptmat.updatePointSize(+1);
                } else if (ev.key === "-") {
                    ptmat.updatePointSize(-1);
                }
            }

            if (["w", "s", "a", "d"].includes(ev.key)) {
                this.econtrols.keyevent(ev.key, true);
            }

            if (ev.key === "r") {
                this.econtrols.targetAll();
            }
            if (ev.key === "u") {
                this.loadMoreNodes();
            }
            if (ev.key === "m") {
                if (!this.econtrols.measure.isActive) {
                    this.econtrols.measure.start();
                }
            }

            this.requestRender("keydown");
        });

        this.econtrols.init();

        const rect = this.renderer.domElement.getBoundingClientRect();

        this.labelRenderer.setSize(this.width, this.height);
        this.labelRenderer.domElement.style.position = "absolute";
        this.labelRenderer.domElement.style.top = rect.y + "px";
        this.labelRenderer.domElement.style.left = rect.x + "px";
        this.labelRenderer.domElement.addEventListener("touchstart", (e) => {
            e.preventDefault();
        });

        document.body.appendChild(this.labelRenderer.domElement);

        this.initialized = true;
        this.requestRender("init");

        pointsWorkerPool.addEventListener("status", (ev) => {
            const n = ev.active + ev.queued;
            this.dispatchEvent({ type: "loading", nodes: n });
        });

        this.renderer.domElement.style.display = "block";
    }

    debugMessage(text: string) {
        this.dispatchEvent({ type: "message", text });
    }

    addPointcloudLabel(text1: string, text2: string | null, pos: Vector3, pc: PointCloud) {
        const label = this.addLabel(text1, text2, pos, () => this.econtrols.showPointCloud(pc));
        return label;
    }

    addLabel(text1: string, text2: string | null, pos: Vector3, onClick: null | (() => void)) {
        const div = document.createElement("div");
        div.classList.add("label");
        if (onClick) {
            div.classList.add("cursor-pointer");
        }
        div.style.textAlign = "right";

        div.innerHTML = `<span>${text1}</span>`;
        if (text2) {
            div.innerHTML += `<br><span style="color: rgba(254,255,255,0.3); fontSize: smaller;">${text2}</span>`;
        }

        const label = new CSS2DObject(div);

        if (onClick) {
            label.element.addEventListener("click", onClick);
        }

        label.position.copy(pos);
        label.center.set(0, 1);

        this.labelScene.add(label);

        return label;
    }

    prevCam = new Vector3();

    requestRender(why: string) {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => this.render(why));
        }
    }

    private render(why: string) {
        const frameStart = performance.now();
        this.renderRequested = false;

        if (ALWAYS_RENDER) {
            this.requestRender("loop");
        }

        const delta = clock.getDelta();

        // this.controls.update(delta);
        this.econtrols.update(delta);

        // render to texture
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.scene, this.camera);

        // render to screen quad
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.sceneOrtho, this.cameraOrtho);

        this.frame++;

        this.debugInfo.nodestats =
            `loads:${PointCloudNode.stats.loads} ` +
            `retries:${PointCloudNode.stats.retries} ` +
            `errs:${PointCloudNode.stats.errors}`;

        this.debugInfo.render =
            // `progs:${this.renderer.info.programs?.length} ` +
            `m_geoms:${this.renderer.info.memory.geometries} ` +
            `r_calls:${this.renderer.info.render.calls} ` +
            `r_pts:${(this.renderer.info.render.points / 1_000_000).toFixed(2)}M`;

        this.avgFrameTime1 = 0.9 * this.avgFrameTime1 + 0.1 * this.lastFrameTime;
        this.avgFrameTime2 = 0.99 * this.avgFrameTime2 + 0.01 * this.lastFrameTime;
        this.debugInfo.frames = ` ${this.frame} ${this.lastFrameTime.toFixed(1)}ms ${this.avgFrameTime1.toFixed(1)}ms ${this.avgFrameTime2.toFixed(1)}ms`;

        let tot = 0;
        let cnt = 0;
        const tpoints = PointCloudNode.visibleNodes.forEach((n) => {
            tot += n.pointCount;
            cnt++;
        });
        this.debugInfo.vis = `${cnt} pts:${(tot / 1_000_000).toFixed(2)}M`;

        this.debugInfo.pool =
            ` ${pointsWorkerPool.running()} ${pointsWorkerPool.queueLength}` + ` (${pointsWorkerPool.tasksFinished})`;

        // this.debugInfo.touch = `z:${this.econtrols.isZooming} 1:${this.econtrols.down.primary} 2:${this.econtrols.down.secondary}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        this.debugInfo.jsmem = (((performance as any).memory?.usedJSHeapSize ?? 0) / 1024 / 1024).toFixed(2);

        this.debugInfo.offset = printVec(this.customOffset);

        if (this.debugEl) {
            this.debugEl.innerHTML = Object.entries(this.debugInfo)
                .map(([k, v]) => `${k}: ${v.length ? v : "-"}`)
                .join("<br>");
        }

        this.renderer.info.reset();
        const frameEnd = performance.now();
        this.lastFrameTime = frameEnd - frameStart;

        this.labelRenderer.render(this.labelScene, this.camera);

        if (SHOW_RENDERS && why) {
            const dx = this.camera.position.x - this.prevCam.x;
            const dy = this.camera.position.y - this.prevCam.y;
            console.log("requestRender", why, dx.toFixed(2), dy.toFixed(2));
        }
        this.prevCam.copy(this.camera.position);
    }

    loadMoreNodesThrottled = throttle(300, () => {
        this.loadMoreNodes();
    });

    async loadMoreNodes() {
        const frustum = getCameraFrustum(this.camera);

        const pq = new PriorityQueue<PointCloudNode>(
            (a, b) => b.estimateNodeError(this.camera) - a.estimateNodeError(this.camera)
        );

        for (const pc of this.pointClouds) {
            if (!frustum.intersectsBox(pc.tree.root.node.bounds)) {
                // console.log("skip showing of ", pc.name, "outside frustum", pc.octreeBounds, pc.tightBounds);
                continue;
            }

            for (const node of pc.tree.walk((n) => n.estimateNodeError(this.camera) > ERROR_LIMIT)) {
                let msg = `node: ${node.nodeName} error: ${node.estimateNodeError(this.camera).toFixed(3)} s: ${node.state}`;
                if (node.depth === 0 || frustum.intersectsBox(node.bounds)) {
                    pq.push(node);
                } else {
                    msg += " (cull)";
                    if (node.state === "visible") {
                        node.cache();
                    }
                }

                this.debugMessage(msg);
            }
        }

        let visiblePoints = 0;

        let node: PointCloudNode | null = null;

        while ((node = pq.pop())) {
            const err = node.estimateNodeError(this.camera);

            const shouldBeShown = node.depth == 0 || (visiblePoints < POINT_BUDGET && err > ERROR_LIMIT);

            switch (node.state) {
                case "visible":
                    if (shouldBeShown) {
                        // all good
                        visiblePoints += node.pointCount;
                    } else {
                        // console.log("CACHE", node.nodeName, err);
                        // node.unload(this);
                        node.cache();
                    }
                    break;

                case "cached":
                    if (shouldBeShown) {
                        node.show();
                        visiblePoints += node.pointCount;
                    }
                    break;

                case "unloaded":
                    if (shouldBeShown) {
                        // console.log("LOAD", node.nodeName, err);

                        node.load(this)
                            .then((_nd) => {
                                // console.log("node loaded finishz", node.nodeName, node.pointCount);
                            })
                            .catch((e) => {
                                console.error("oh no, load error", e);
                                throw e;
                            });
                    }
                    break;

                case "loading":
                    // TODO: how to cancel?
                    // visiblePoints += node.pointCount;
                    break;

                case "error":
                    // TODO: how to retry?
                    break;
            }
        }

        for (const r of pointsWorkerPool.active) {
            visiblePoints += r.info.node.pointCount;
        }

        let drops = 0;
        let caches = 0;
        for (const vnode of PointCloudNode.visibleNodes) {
            const err = vnode.estimateNodeError(this.camera);
            const shouldBeHidden = vnode.depth > 0 && err < ERROR_LIMIT;

            if (shouldBeHidden) {
                vnode.cache();
                caches++;
            }
        }

        if (pointsWorkerPool.queueLength > 0) {
            pointsWorkerPool.rescore((x) => {
                const err = x.info.node.estimateNodeError(this.camera);

                if (x.info.node.depth === 0 || (visiblePoints < POINT_BUDGET && err > ERROR_LIMIT)) {
                    visiblePoints += x.info.node.pointCount;
                    return err;
                } else {
                    drops++;
                    x.info.node.unload(this);
                    return null;
                }
            });
        }

        // console.log("RESCORE dropped", drops, "cached", caches);

        this.requestRender("load more");
    }

    mats = {
        culled: new MeshBasicMaterial({ color: 0xff0077, wireframe: true }),
        hidden: new MeshBasicMaterial({ color: 0xcc33ff, wireframe: true }),
        loaded: new MeshBasicMaterial({ color: 0x0ffff0, wireframe: true }),
    };

    setSize = throttle(200, (width: number, height: number) => {
        this.width = width;
        this.height = height;
        const pr = 1.0; //window.devicePixelRatio;

        this.edlMaterial.uniforms.uResolution.value = [width, height];

        this.renderTarget.setSize(this.width * pr, this.height * pr);
        this.renderer.setSize(this.width * pr, this.height * pr, false);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        const sz = new Vector2();
        this.renderer.getDrawingBufferSize(sz);
        // this.renderer.domElement.style.width = `${this.width}px`;

        this.labelRenderer.setSize(this.width, this.height);
        this.requestRender("resize");
    });

    addPointCloud(pc: PointCloud, center = false) {
        this.pointClouds.push(pc);

        const tightBoundsCube = createTightBounds(pc);
        tightBoundsCube.position.sub(this.customOffset);
        tightBoundsCube.visible = this.debug_mode;
        this.scene.add(tightBoundsCube);

        pc.tightBoundsMesh = tightBoundsCube;

        console.log("ADD POINTCLOUD", pc);

        void pc.initialize();

        this.scene.add(pc.group);

        // TODO: show some node stats in the label
        const label = this.addPointcloudLabel(
            `${pc.name}`,
            null,
            // `${(pc.pointCount / 1_000_000).toFixed(2)}M`,
            pc.tightBounds.max.clone().sub(this.customOffset),
            pc
        );

        pc.label = label;

        this.loadMoreNodesThrottled();

        if (center) {
            this.econtrols.showPointCloud(pc);
        }

        this.dispatchCloudsUpdated();
    }

    removePointcloud(pc: PointCloud) {
        this.pointClouds.splice(this.pointClouds.indexOf(pc), 1);

        if (pc.tightBoundsMesh) {
            this.scene.remove(pc.tightBoundsMesh);
            pc.tightBoundsMesh.geometry.dispose();
        }
        if (pc.label) {
            this.labelScene.remove(pc.label);
        }

        pc.tree.unload(this);

        this.loadMoreNodesThrottled();

        this.dispatchCloudsUpdated();

        if (this.pointClouds.length === 0) {
            this.customOffsetInitialized = false;
        }
    }

    dispatchCloudsUpdated() {
        this.dispatchEvent({
            type: "pointclouds",
            pclouds: this.pointClouds.map((p) => ({
                name: p.name,
                pointCount: p.pointCount,
                item: p,
                onCenter: () => this.econtrols.showPointCloud(p),
                onRemove: () => this.removePointcloud(p),
                onToggleVisibility: () => p.toggleVisibility(),
            })),
        });
    }

    async addLAZ(what: string | File, center = false) {
        try {
            const pc = await PointCloud.loadLAZ(this, what);

            const offset = pc.tightBounds.min.clone();

            let shouldCenterToAdded = center;

            if (!this.customOffsetInitialized) {
                if (offset.length() > 100_000) {
                    console.warn("set coordinate offset to", offset);
                    this.customOffset.copy(offset);
                    // this.dispatchEvent({
                    //     type: "notice",
                    //     kind: "info",
                    //     message: "Coordinate offset set to " + printVec(this.customOffset),
                    // });
                } else {
                    this.customOffset.set(0, 0, 0);
                }

                this.customOffsetInitialized = true;
            } else {
                if (offset.sub(this.customOffset).length() > 100_000) {
                    this.dispatchEvent({
                        type: "notice",
                        kind: "warn",
                        message: "Coordinates very far away. Precision may suffer.",
                    });
                }
            }

            const wasRestored = this.econtrols.restoreCamera();
            if (!wasRestored) {
                shouldCenterToAdded = true;
            }

            this.addPointCloud(pc, shouldCenterToAdded);

            this.debugMessage(`Loaded laz file '${pc.name}' (${(pc.pointCount / 1_000_000).toFixed(2)}M)`);
        } catch (e) {
            console.error("ERROR!!!", e);
            this.dispatchEvent({
                type: "notice",
                kind: "error",
                message: "LAZ loading error! Only valid COPC LAZ files are supported. See console for details.",
            });
        }
    }
}

export { PointCloud };
