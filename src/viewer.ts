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
import { PointCloudNode, workerPool } from "./pointcloud-node";
import { EDLMaterial } from "./materials/edl-material";
import { createTightBounds, getCameraFrustum, printVec } from "./utils";
import { ALWAYS_RENDER, CAMERA_FAR, CAMERA_NEAR, POINT_BUDGET } from "./settings";
import { PriorityQueue } from "./priority-queue";
import { pointMaterialPool } from "./materials/point-material";

const debugEl = document.querySelector("#debug")!;
const debug = {
    jsmem: "",
    camera: "",
    touchCount: "",
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

    frame: number = 0;
    frameTime: number = 0;
    renderTarget: WebGLRenderTarget;

    sceneOrtho: Scene;
    cameraOrtho: OrthographicCamera;

    width: number = 0;
    height: number = 0;

    renderRequested: boolean;

    edlMaterial: EDLMaterial;

    constructor(canvasElement: HTMLCanvasElement, width: number, height: number) {
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
                            this.addLAZ(file!, true);
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

        let totalPts = 0;

        this.frame++;

        debug.render =
            // `progs:${this.renderer.info.programs?.length} ` +
            `geoms:${this.renderer.info.memory.geometries} ` +
            `calls:${this.renderer.info.render.calls} ` +
            `pts:${(this.renderer.info.render.points / 1_000_000).toFixed(2)}M`;

        debug.frames = ` ${this.frame} ${this.frameTime.toFixed(1)}ms`;

        // debug.pts = ` ${(totalPts / 1_000_000.0).toFixed(2)}M`;

        debug.pool = ` ${workerPool.running()} ${workerPool.queued()} (${workerPool.tasksFinished})`;

        debug.touchCount = ` ${this.econtrols.touchCount}`;

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

        let visiblePoints = 0;

        const nonVisibleNodes: PointCloudNode[] = [];

        for (const pc of this.pointClouds) {
            for (const node of pc.nodes) {
                if (node.state === "visible" || node.state === "loading") {
                    visiblePoints += node.pointCount;
                }
                const inFrustum = frustum.intersectsBox(node.bounds);
                if (inFrustum) {
                    if (node.state === "unloaded") {
                        pq.push(node);
                    }
                } else {
                    if (node.state === "visible") {
                        nonVisibleNodes.push(node);
                    }
                }
            }
        }

        while (visiblePoints < POINT_BUDGET && !pq.isEmpty()) {
            if (loads == 5) {
                break;
            }

            const node = pq.popOrThrow();

            // dont load too fine resolution
            if (node.estimateNodeError(this.camera) < 0.001) {
                break;
            }

            visiblePoints += node.pointCount;

            if (node.state === "unloaded") {
                console.log("load", node);
                loads++;
                node.load(this)
                    .then((_nd) => {
                        console.log("node loaded finishz", node.nodeName, node.pointCount);
                    })
                    .catch((e) => {
                        console.error("oh no, load error", e);
                    });
            } else {
                console.log("node already loaded", node.state);
            }
        }

        for (const node of nonVisibleNodes) {
            node.unload(this);
        }

        // TODO: only render if something changed
        this.requestRender();

        if (loads === 0) {
            console.warn("no more loads to do", visiblePoints, POINT_BUDGET);
        }

        return loads;
    }

    mats = {
        culled: new MeshBasicMaterial({ color: 0xff0077, wireframe: true }),
        hidden: new MeshBasicMaterial({ color: 0xcc33ff, wireframe: true }),
        loaded: new MeshBasicMaterial({ color: 0x0ffff0, wireframe: true }),
    };

    resizeHandle = 0;

    setSize(width: number, height: number) {
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
            this.requestRender();
        }, 200);
    }

    addPointCloud(pc: PointCloud, center = false) {
        this.pointClouds.push(pc);

        const cube = createTightBounds(pc);
        this.scene.add(cube);

        console.log("ADD POINTCLOUD", pc);

        pc.initializeNodes();

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
            alert("LAZ loading error: " + e);
        }
    }
}
