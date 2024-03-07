import {
    Clock,
    Color,
    DepthTexture,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    OrthographicCamera,
    PerspectiveCamera,
    PlaneGeometry,
    RGBAFormat,
    Raycaster,
    Scene,
    UnsignedIntType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";
import Stats from "three/addons/libs/stats.module.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

import { EarthControls } from "./earth-controls";
import { PointCloud } from "./pointcloud";
import { PointCloudNode, pointsWorkerPool } from "./pointcloud-node";
import { EDLMaterial } from "./materials/edl-material";
import { createTightBounds, getCameraFrustum, printVec, stringifyError } from "./utils";
import { ALWAYS_RENDER, CAMERA_FAR, CAMERA_NEAR, POINT_BUDGET } from "./settings";
import { PriorityQueue } from "./priority-queue";
import { pointMaterialPool } from "./materials/point-material";

const debugEl = document.querySelector("#debug")!;
const debug = {
    jsmem: "",
    camera: "",
    touch: "",
    pool: "",
    render: "",
    frames: "",
};

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const clock = new Clock();

export class Viewer {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;

    econtrols: EarthControls;

    scene: Scene;

    pointClouds: PointCloud[] = [];

    stats: Stats;
    gpuPanel: GPUStatsPanel;

    frame = 0;
    frameTime = 0;
    renderTarget: WebGLRenderTarget;

    sceneOrtho: Scene;
    cameraOrtho: OrthographicCamera;

    width = 0;
    height = 0;

    renderRequested: boolean;

    edlMaterial: EDLMaterial;

    errors: Record<string, boolean> = {
        noPointClouds: true,
        resizing: false,
    };

    errorElement: HTMLElement | null;
    initialized = false;

    constructor(canvasElement: HTMLCanvasElement, width: number, height: number) {
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

        this.stats = new Stats();
        this.gpuPanel = new GPUStatsPanel(this.renderer.getContext());
        this.stats.addPanel(this.gpuPanel);
        this.stats.showPanel(0);

        this.edlMaterial = new EDLMaterial(this.renderTarget.texture, this.renderTarget.depthTexture);

        const tquad = new Mesh(new PlaneGeometry(2, 2), this.edlMaterial);
        this.sceneOrtho = new Scene();
        this.sceneOrtho.add(tquad); // Scene for orthographic display

        this.cameraOrtho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.errorElement = document.querySelector("#errormsg");

        this.setSize(this.width, this.height);
    }

    private loadHandle = 0;

    init() {
        document.body.appendChild(this.stats.dom);

        this.econtrols.onChange = () => {
            debug.camera = printVec(this.camera.position);

            if (this.loadHandle > 0) {
                clearTimeout(this.loadHandle);
            }

            this.loadHandle = setTimeout(() => {
                this.loadMoreNodes();
                this.loadHandle = 0;
            }, 200);

            this.requestRender();
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

        document.addEventListener("keydown", (ev) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) {
                console.log("skip key", ev.key);
                return;
            }

            for (const ptmat of pointMaterialPool.all) {
                if (ev.key === "1") {
                    ptmat.changeColorMode("INTENSITY");
                }
                if (ev.key === "2") {
                    ptmat.changeColorMode("CLASSIFICATION");
                }
                if (ev.key === "3") {
                    ptmat.changeColorMode("RGB");
                }
                if (ev.key === "4") {
                    ptmat.changeColorMode("RGB_AND_CLASS");
                }
                if (ev.key === "+") {
                    ptmat.updatePointSize(+1);
                }
                if (ev.key === "-") {
                    ptmat.updatePointSize(-1);
                }
            }

            if (ev.key === "r") {
                this.econtrols.targetAll();
            }
            if (ev.key === "u") {
                this.loadMoreNodes();
            }
            if (ev.key === "x") {
                this.dropWorstNodes();
            }

            this.requestRender();
        });

        this.econtrols.init();

        this.labelRenderer.setSize(this.width, this.height);
        this.labelRenderer.domElement.style.position = "absolute";
        this.labelRenderer.domElement.style.top = "0px";
        // this.labelRenderer.domElement.style.pointerEvents = "none";

        document.body.appendChild(this.labelRenderer.domElement);

        this.econtrols.restoreCamera();

        this.initialized = true;
        this.requestRender();
    }

    addLabel(text1: string, text2: string, pos: Vector3, pc: PointCloud) {
        const div = document.createElement("div");
        div.classList.add("nice", "label");
        div.style.textAlign = "right";

        div.innerHTML = `
            <span>${text1}</span><br>
            <span style="color: rgba(255,255,255,0.3); fontSize: smaller;">${text2}</span>
        `;

        div.addEventListener("click", () => {
            this.econtrols.showPointCloud(pc);
        });

        const label = new CSS2DObject(div);
        label.position.copy(pos);
        label.center.set(0, 1);

        this.scene.add(label);
    }

    labelRenderer = new CSS2DRenderer();

    requestRender() {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => this.render());
        }
    }

    private render() {
        const frameStart = performance.now();
        this.renderRequested = false;

        if (ALWAYS_RENDER) {
            this.requestRender();
        }

        this.stats.update();
        const delta = clock.getDelta();

        // this.controls.update(delta);
        this.econtrols.update(delta);

        this.gpuPanel.startQuery();

        // render to texture
        this.renderer.setRenderTarget(this.renderTarget);
        // this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);

        // render to screen quad
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.sceneOrtho, this.cameraOrtho);

        this.gpuPanel.endQuery();

        this.frame++;

        debug.render =
            // `progs:${this.renderer.info.programs?.length} ` +
            `geoms:${this.renderer.info.memory.geometries} ` +
            `calls:${this.renderer.info.render.calls} ` +
            `pts:${(this.renderer.info.render.points / 1_000_000).toFixed(2)}M`;

        debug.frames = ` ${this.frame} ${this.frameTime.toFixed(1)}ms`;

        debug.pool = ` ${pointsWorkerPool.running()} ${pointsWorkerPool.queued()} (${pointsWorkerPool.tasksFinished})`;

        debug.touch = `z:${this.econtrols.isZooming} 1:${this.econtrols.down.primary} 2:${this.econtrols.down.secondary}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        debug.jsmem = (((performance as any).memory?.usedJSHeapSize ?? 0) / 1024 / 1024).toFixed(2);

        debugEl.innerHTML = Object.entries(debug)
            .map(([k, v]) => `${k}: ${v.length ? v : "-"}`)
            .join("<br>");

        this.renderer.info.reset();
        const frameEnd = performance.now();
        this.frameTime = frameEnd - frameStart;

        this.labelRenderer.render(this.scene, this.camera);
    }

    renderLoop() {
        this.render();
        requestAnimationFrame(() => this.renderLoop());
    }

    addNode(n: PointCloudNode) {
        if (n.state === "visible") {
            const o = n.data!.pco;
            this.scene.add(o);
            this.requestRender();
        } else {
            throw new Error("cannot add node that is not loaded");
        }
    }

    *getVisibleNodes() {
        for (const pc of this.pointClouds) {
            for (const node of pc.nodes) {
                if (node.state === "visible") {
                    yield node;
                }
            }
        }
    }

    dropWorstNodes() {
        const loadedNodes = [];
        for (const pc of this.pointClouds) {
            for (const node of pc.nodes) {
                if (node.state == "visible" && node.depth > 0) {
                    loadedNodes.push(node);
                }
            }
        }

        loadedNodes.sort((a, b) => {
            return b.estimateNodeError(this.camera) - a.estimateNodeError(this.camera);
        });

        const toDrop = loadedNodes.slice(-5).filter((n) => n.depth > 0);

        for (const node of toDrop) {
            node.unload(this);
        }

        this.requestRender();
    }

    loadMoreNodes() {
        let loads = 0;
        const frustum = getCameraFrustum(this.camera);

        const pq = new PriorityQueue<PointCloudNode>(
            (a, b) => b.estimateNodeError(this.camera) - a.estimateNodeError(this.camera)
        );

        const nonVisibleNodes: PointCloudNode[] = [];

        // check node visibility
        for (const pc of this.pointClouds) {
            for (const node of pc.nodes) {
                if (frustum.intersectsBox(node.bounds)) {
                    pq.push(node);
                } else {
                    nonVisibleNodes.push(node);
                }
            }
        }

        // unload culled nodes
        for (const node of nonVisibleNodes) {
            if (node.state === "visible") {
                node.unload(this);
            }
        }

        let visiblePoints = 0;

        const ERROR_LIMIT = 0.001;

        while (!pq.isEmpty()) {
            const node = pq.popOrThrow();
            const err = node.estimateNodeError(this.camera);

            const shouldBeShown = node.depth == 0 || (visiblePoints < POINT_BUDGET && err > ERROR_LIMIT);

            switch (node.state) {
                case "visible":
                    if (shouldBeShown) {
                        // all good
                        visiblePoints += node.pointCount;
                    } else {
                        console.log("DROP", node.nodeName, err);
                        node.unload(this);
                    }
                    break;

                case "unloaded":
                    if (shouldBeShown) {
                        console.log("LOAD", node.nodeName, err);
                        loads++;
                        // visiblePoints += node.pointCount;

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

        if (pointsWorkerPool.queued() > 0) {
            pointsWorkerPool.rescore((x) => {
                const score = x.info.node.estimateNodeError(this.camera);

                if (score > ERROR_LIMIT && visiblePoints < POINT_BUDGET) {
                    visiblePoints += x.info.node.pointCount;
                    return score;
                } else {
                    console.log("RESCORE DROP", x.info.node.nodeName, score, visiblePoints);

                    x.info.node.unload(this);
                    return null;
                }
            });
        }

        this.requestRender();

        return loads;
    }

    mats = {
        culled: new MeshBasicMaterial({ color: 0xff0077, wireframe: true }),
        hidden: new MeshBasicMaterial({ color: 0xcc33ff, wireframe: true }),
        loaded: new MeshBasicMaterial({ color: 0x0ffff0, wireframe: true }),
    };

    resizeHandle = 0;

    setSize(width: number, height: number) {
        this.setError("resizing", true);
        if (this.resizeHandle > 0) {
            clearTimeout(this.resizeHandle);
        }

        this.resizeHandle = setTimeout(() => {
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
            this.setError("resizing", false);
            this.requestRender();
        }, 100);
    }

    setError(k: keyof typeof this.errors, set_to: boolean) {
        if (!this.errorElement) {
            return;
        }
        if (!this.initialized) {
            return;
        }

        this.errors[k] = set_to;

        this.errorElement.style.display = "block";
        if (this.errors.resizing) {
            this.errorElement.textContent = "resizing...";
        } else if (this.errors.noPointClouds) {
            this.errorElement.textContent = "no pointclouds";
        } else {
            this.errorElement.style.display = "none";
        }
    }

    addPointCloud(pc: PointCloud, center = false) {
        this.setError("noPointClouds", false);
        this.pointClouds.push(pc);

        const cube = createTightBounds(pc);
        this.scene.add(cube);

        console.log("ADD POINTCLOUD", pc);

        void pc.initializeNodes();

        this.addLabel(
            `${pc.name}`,
            `${pc.nodes.length} / ${(pc.pointCount / 1_000_000).toFixed(2)}M`,
            pc.tightBounds.max,
            pc
        );

        if (center) {
            this.econtrols.showPointCloud(pc);
        }
    }

    async addLAZ(what: string | File, center = false) {
        try {
            const pc = await PointCloud.loadLAZ(this, what);
            this.addPointCloud(pc, center);
        } catch (e) {
            console.error(e);
            alert("LAZ loading error: " + stringifyError(e));
        }
    }
}
