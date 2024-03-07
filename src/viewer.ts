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
    Points,
    RGBAFormat,
    Raycaster,
    Scene,
    UnsignedIntType,
    Vector2,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";
import Stats from "three/addons/libs/stats.module.js";

import { EarthControls } from "./earth-controls";
import { PointCloud, PointCloudNode, pool } from "./pointcloud";
import { EDLMaterial } from "./materials/edl-material";
import { createTightBounds, getCameraFrustum, getNodeVisibilityRating, printVec } from "./utils";
import { CAMERA_FAR, CAMERA_NEAR, POINT_BUDGET } from "./settings";
import { PriorityQueue } from "./priority-queue";

const debugEl = document.getElementById("debug")!;
const debug = {
    mouse: "",
    camera: "",
    // target: "",
    // slider1: "",
    // slider2: "",
    touchCount: "",
    pts: "",
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

    pclouds: PointCloud[] = [];
    objects: Points[] = [];

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

        this.econtrols = new EarthControls(this.camera, this.renderer.domElement, this);

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

    init() {
        document.body.appendChild(this.stats.dom);

        const sl1 = document.getElementById("sl1") as HTMLInputElement;
        const sl2 = document.getElementById("sl2") as HTMLInputElement;

        const sliders: [number, number] = [0, 0];
        sl1.addEventListener("input", () => {
            sliders[0] = parseFloat(sl1.value);
            // debug.slider1 = sliders[0].toFixed(2);
            PointCloud.material.updateSliders(sliders[0], sliders[1]);
        });
        sl2.addEventListener("input", () => {
            sliders[1] = parseFloat(sl2.value);
            // debug.slider2 = sliders[1].toFixed(2);
            PointCloud.material.updateSliders(sliders[0], sliders[1]);
        });

        this.econtrols.onChange = () => {
            debug.camera = printVec(this.camera.position);
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
            const ptmat = PointCloud.material;

            if (ev.key === "1") {
                ptmat.changeColorMode("INTENSITY");
            }
            if (ev.key === "2") {
                ptmat.changeColorMode("CLASSIFICATION");
            }
            if (ev.key === "3") {
                ptmat.changeColorMode("RGB");
            }
            if (ev.key === "+") {
                ptmat.updatePointSize(+1);
            }
            if (ev.key === "-") {
                ptmat.updatePointSize(-1);
            }
            if (ev.key === "u") {
                this.updateVisibile();
            }

            this.requestRender();
        });

        this.econtrols.init();

        setInterval(() => {
            this.updateVisibile();
        }, 1000);

        this.requestRender();
    }

    requestRender() {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => this.render());
        }
    }

    private render() {
        const frameStart = performance.now();
        this.renderRequested = false;
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

        for (const pc of this.pclouds) {
            totalPts += pc.pointsLoaded;
        }

        this.frame++;

        debug.render =
            `calls: ${this.renderer.info.render.calls}, ` +
            `pts: ${(this.renderer.info.render.points / 1_000_000).toFixed(2)}M`;

        debug.frames = ` ${this.frame} ${this.frameTime.toFixed(1)}ms`;

        debug.pts = ` ${(totalPts / 1_000_000.0).toFixed(2)}M`;

        debug.pool = ` ${pool.running()} ${pool.queued()} (${pool.tasksFinished})`;

        debug.touchCount = ` ${this.econtrols.touchCount}`;

        debugEl.innerHTML = Object.entries(debug)
            .map(([k, v]) => `${k}: ${v.length ? v : "-"}`)
            .join("<br>");

        this.renderer.info.reset();
        const frameEnd = performance.now();
        this.frameTime = frameEnd - frameStart;
    }

    renderLoop() {
        this.render();
        requestAnimationFrame(() => this.renderLoop());
    }

    addExtraStuff(m: Mesh) {
        this.scene.add(m);
    }

    addObject(o: Points) {
        this.scene.add(o);
        this.objects.push(o);
        this.requestRender();
    }

    updateVisibile() {
        const frustum = getCameraFrustum(this.camera);

        const nodeScore = (n: PointCloudNode) => {
            // TODO: Add preference to points in the screen middle
            // TODO: Add preference to zero-level nodes
            const s = getNodeVisibilityRating(n.parent.octreeBounds, n.nodeName, n.parent.rootSpacing, this.camera);

            return s;
        };

        const pq = new PriorityQueue<PointCloudNode>((a, b) => nodeScore(a) - nodeScore(b));

        for (const pc of this.pclouds) {
            for (const node of pc.loadedNodes) {
                const inFrustum = frustum.intersectsBox(node.bounds);
                if (inFrustum) {
                    node.pco.visible = true;
                    pq.push(node);
                    node.debugMesh.material = this.mats.loaded;
                } else {
                    node.debugMesh.material = this.mats.culled;
                    node.pco.visible = false;
                }
            }
        }

        let visiblePoints = 0;

        let vis = 0;

        while (visiblePoints < POINT_BUDGET && !pq.isEmpty()) {
            const node = pq.pop()!;
            if (!node.pco.visible) {
                console.log("show", node);
            }
            node.pco.visible = true;
            node.debugMesh.material = this.mats.loaded;
            visiblePoints += node.pointCount;
            vis++;
        }

        console.log("VIS", vis, "/", (visiblePoints / 1_000_000).toFixed(2) + "M");

        while (!pq.isEmpty()) {
            const node = pq.pop()!;

            node.pco.visible = false;
            node.debugMesh.material = this.mats.hidden;
        }

        // TODO: only render if changed
        this.requestRender();
    }

    mats = {
        culled: new MeshBasicMaterial({ color: 0xff0077, wireframe: true }),
        hidden: new MeshBasicMaterial({ color: 0xcc33ff, wireframe: true }),
        loaded: new MeshBasicMaterial({ color: 0x0ffff0, wireframe: true }),
    };

    setSize(width: number, height: number) {
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
        // console.log(this.width, sz);
    }

    async addDemo() {
        const demo = PointCloud.loadDemo(this);
        this.pclouds.push(demo);
        demo.loadFake();
        const cube = createTightBounds(demo);
        this.scene.add(cube);
    }

    async addLAZ(what: string | File, center = false) {
        const pc = await PointCloud.loadLAZ(this, what);
        this.pclouds.push(pc);
        const cube = createTightBounds(pc);
        this.scene.add(cube);

        console.log("NODES for", what, pc.hierarchy.nodes);
        pc.loadNodes();

        if (center) {
            this.econtrols.showPointCloud(pc);
        }
    }
}
