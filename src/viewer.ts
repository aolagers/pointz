import {
    BufferGeometry,
    Clock,
    Color,
    DepthTexture,
    Frustum,
    Line,
    LineBasicMaterial,
    LinearSRGBColorSpace,
    Mesh,
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
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import Stats from "three/addons/libs/stats.module.js";
import { PointCloud, PointCloudNode, pool } from "./pointcloud";
import { PointMaterial } from "./materials/point-material";
import { EDLMaterial } from "./materials/edl-material";
import { createCubeBoundsBox, createTightBounds, printVec } from "./utils";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";
import { CAMERA_FAR, CAMERA_NEAR } from "./settings";

const pickWindow = 31;

const points = [];

const pointer = new Vector2(0, 0);

points.push(new Vector3(0, 0, 200));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);
const line = new Line(lineGeom, new LineBasicMaterial({ color: 0x00ee00 }));

const debugEl = document.getElementById("debug")!;
const debug = {
    mouse: "",
    camera: "",
    target: "",
    slider1: "",
    slider2: "",
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
    controls: MapControls;

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
        this.width = width;
        this.height = height;

        this.renderRequested = false;

        this.renderer = new WebGLRenderer({
            canvas: canvasElement,
            antialias: false,
            alpha: false,
            stencil: false,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false,
        });

        this.renderer.autoClearColor = false;

        this.renderer.setSize(this.width, this.height, false);

        this.renderer.info.autoReset = false;

        this.renderTarget = new WebGLRenderTarget(this.width, this.height, {
            format: RGBAFormat,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            stencilBuffer: false,
            depthTexture: new DepthTexture(this.width, this.height, UnsignedIntType),
        });

        this.camera = new PerspectiveCamera(75, this.width / this.height, CAMERA_NEAR, CAMERA_FAR);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, -100, 50);
        this.camera.lookAt(0, 0, 0);

        this.controls = new MapControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.2;

        this.scene = new Scene();
        // this.scene.background = new Color(0x505050);
        // this.scene.background = new Color(0x4485b4);
        this.scene.background = new Color().setStyle("rgb(80,120,180)", LinearSRGBColorSpace).convertSRGBToLinear();
        this.scene.add(line);

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

        this.renderer.domElement.addEventListener("pointermove", (ev) => this.onPointerMove(ev));

        const sl1 = document.getElementById("sl1") as HTMLInputElement;
        const sl2 = document.getElementById("sl2") as HTMLInputElement;

        const ptmat = PointMaterial.getSingleton();

        const sliders: [number, number] = [0, 0];
        sl1.addEventListener("input", () => {
            sliders[0] = parseFloat(sl1.value);
            debug.slider1 = sliders[0].toFixed(2);
            ptmat.updateSliders(sliders[0], sliders[1]);
        });
        sl2.addEventListener("input", () => {
            sliders[1] = parseFloat(sl2.value);
            debug.slider2 = sliders[1].toFixed(2);
            ptmat.updateSliders(sliders[0], sliders[1]);
        });

        this.controls.addEventListener("change", (e) => {
            debug.target = printVec(e.target.target);
            debug.camera = printVec(this.camera.position);

            this.requestRender();
        });

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
                            this.addLAZ(file!);
                        }
                    }
                });
            }
        });

        document.addEventListener("keydown", (ev) => {
            const ptmat = PointMaterial.getSingleton();

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
        });

        // setInterval(() => { this.updateVisibile(); }, 2000);
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

        /*
        if (this.objects.length > 0) {
            let hit = false;
            raycaster.setFromCamera(pointer, this.camera);
            const intersections = raycaster.intersectObjects(this.objects, false);

            for (const intersection of intersections) {
                line.visible = true;
                const pos = line.geometry.attributes.position!;
                const verts = pos.array;

                verts[3] = intersections[0].point.x;
                verts[4] = intersections[0].point.y;
                verts[5] = intersections[0].point.z;

                pos.needsUpdate = true;
                document.body.style.cursor = "crosshair";
            }

            if (hit) {
                document.body.style.cursor = "auto";
                line.visible = false;
            }
        }
        */

        this.controls.update(delta);

        this.gpuPanel.startQuery();

        // render to texture
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        // render to screen quad
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.sceneOrtho, this.cameraOrtho);

        if (true) {
            this.camera.setViewOffset(
                this.width,
                this.height,
                ((pointer.x + 1) / 2) * this.width - pickWindow / 2,
                this.height - ((pointer.y + 1) / 2) * this.height - pickWindow / 2,
                pickWindow,
                pickWindow,
            );
            this.renderer.setRenderTarget(null);
            this.renderer.setViewport(0, 0, pickWindow, pickWindow);
            this.renderer.render(this.scene, this.camera);

            this.camera.clearViewOffset();
            this.renderer.setViewport(0, 0, this.width, this.height);
        }

        this.gpuPanel.endQuery();

        let totalPts = 0;

        for (const pc of this.pclouds) {
            totalPts += pc.pointsLoaded;
        }

        this.frame++;

        if (this.frame % 60 === 0) {
            debug.render =
                `calls: ${this.renderer.info.render.calls}, ` +
                `pts: ${(this.renderer.info.render.points / 1000).toFixed(0)}k`;
        }

        debug.frames = ` ${this.frame} ${this.frameTime.toFixed(1)}ms}`;

        debug.pts = ` ${(totalPts / 1_000_000.0).toFixed(2)}M`;

        debug.pool = ` ${pool.running()} ${pool.queued()} (${pool.tasksFinished})`;

        debugEl.innerHTML = Object.entries(debug)
            .map(([k, v]) => `${k}: ${v.length ? v : "-"}`)
            .join("<br>");

        // console.log(this.controls.getDistance(), this.controls.getPolarAngle(), this.controls.getAzimuthalAngle());

        this.renderer.info.reset();
        const frameEnd = performance.now();
        this.frameTime = frameEnd - frameStart;
    }

    renderLoop() {
        this.render();
        requestAnimationFrame(() => this.renderLoop());
    }

    addObject(o: Points) {
        this.scene.add(o);
        this.objects.push(o);
        this.requestRender();
    }

    updateVisibile() {
        const frustum = new Frustum();
        frustum.setFromProjectionMatrix(this.camera.projectionMatrix);
        frustum.planes.forEach((plane) => {
            plane.applyMatrix4(this.camera.matrixWorld);
        });

        const toDrop: [PointCloud, PointCloudNode][] = [];
        for (const pc of this.pclouds) {
            for (const node of pc.loadedNodes) {
                const bbox = createCubeBoundsBox(pc.octreeInfo.cube, node.nodeName, pc.offset);
                const visible = frustum.intersectsBox(bbox);
                if (!visible) {
                    toDrop.push([pc, node]);
                }
            }
        }

        for (const [pc, n] of toDrop) {
            console.log("drop", pc.name, n.nodeName);
            this.scene.remove(n.pco);
            pc.loadedNodes.splice(pc.loadedNodes.indexOf(n), 1);
        }
    }

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

    onPointerMove(event: PointerEvent) {
        if (event.isPrimary === false) return;

        const rect = this.renderer.domElement.getBoundingClientRect();

        pointer.x = ((event.clientX - rect.x) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.y) / rect.height) * 2 + 1;

        /*
        this.renderer.setScissor(
            ((pointer.x + 1) / 2) * this.width - W / 2,
            this.height + (this.height * (pointer.y - 1)) / 2 - W / 2,
            W,
            W,
        );
        */
        //this.renderTarget.setSize(W, W)
        //this.renderer.setSize(W, W)
        // this.renderer.setViewport(
        //     ((pointer.x + 1) / 2) * this.width - W / 2,
        //     this.height + (this.height * (pointer.y - 1)) / 2 - W / 2,
        //     W,
        //     W,
        // );
        //this.renderer.setScissorTest(true);

        debug.mouse = printVec(pointer);

        this.requestRender();
    }

    async addDemo() {
        const demo = PointCloud.loadDemo(this);
        this.pclouds.push(demo);
        demo.loadFake();
        const cube = createTightBounds(demo);
        this.scene.add(cube);
    }

    async addLAZ(what: string | File) {
        const pc = await PointCloud.loadLAZ(this, what);
        this.pclouds.push(pc);

        console.log("NODES", pc.hierarchy.nodes);
        pc.load();
        const cube = createTightBounds(pc);
        this.scene.add(cube);

        this.controls.target.copy(cube.position);
    }
}
