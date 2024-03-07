import {
    BufferGeometry,
    Clock,
    Color,
    Line,
    LineBasicMaterial,
    PerspectiveCamera,
    Points,
    Raycaster,
    Scene,
    Vector3,
    WebGLRenderer,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import Stats from "three/addons/libs/stats.module.js";
import { PointCloud } from "./pointcloud";
import { pointer, updateValues } from "./materials";
import { createTightBounds, printVec } from "./utils";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";

const points = [];
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

    constructor() {
        this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

        this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100_000);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, -100, 50);
        this.camera.lookAt(0, 0, 0);

        this.controls = new MapControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.2;

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.scene = new Scene();
        this.scene.background = new Color(0x202020);
        this.scene.add(line);

        this.stats = new Stats();
        this.gpuPanel = new GPUStatsPanel(this.renderer.getContext());
        this.stats.addPanel(this.gpuPanel);
        this.stats.showPanel(0);

        // const gl = this.renderer.getContext();
        // const f = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
        // const e = gl.getExtension("WEBGL_depth_texture");
        // const sup = gl.getSupportedExtensions();
        // console.log({ ALIASED_POINT_SIZE_RANGE: f, WEBGL_depth_texture: e, sup });
    }

    init() {
        document.body.appendChild(this.stats.dom);
        document.body.appendChild(this.renderer.domElement);

        document.body.addEventListener("pointermove", this.onPointerMove);

        const sl1 = document.getElementById("sl1") as HTMLInputElement;
        const sl2 = document.getElementById("sl2") as HTMLInputElement;

        const sliders: [number, number] = [0, 0];
        sl1.addEventListener("input", () => {
            sliders[0] = parseFloat(sl1.value);
            debug.slider1 = sliders[0].toFixed(2);
            updateValues(sliders[0], sliders[1]);
        });
        sl2.addEventListener("input", () => {
            sliders[1] = parseFloat(sl2.value);
            debug.slider2 = sliders[1].toFixed(2);
            updateValues(sliders[0], sliders[1]);
        });
        window.addEventListener("resize", this.onWindowResize);

        this.controls.addEventListener("change", (e) => {
            debug.target = printVec(e.target.target);
            debug.camera = printVec(this.camera.position);
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
    }

    renderLoop() {
        this.stats.update();
        const delta = clock.getDelta();

        if (this.objects.length > 0) {
            raycaster.setFromCamera(pointer, this.camera);
            const intersections = raycaster.intersectObject(this.objects[0]!, false);

            if (intersections.length > 0 && intersections[0]) {
                line.visible = true;
                const pos = line.geometry.attributes.position!;
                const verts = pos.array;

                verts[3] = intersections[0].point.x;
                verts[4] = intersections[0].point.y;
                verts[5] = intersections[0].point.z;

                pos.needsUpdate = true;
                document.body.style.cursor = "crosshair";
            } else {
                document.body.style.cursor = "auto";
                line.visible = false;
            }
        }

        this.controls.update(delta);
        this.gpuPanel.startQuery();
        this.renderer.render(this.scene, this.camera);
        this.gpuPanel.endQuery();

        let totalPts = 0;

        for (const pc of this.pclouds) {
            totalPts += pc.pointsLoaded;
        }

        debug.pts = ` ${(totalPts / 1_000_000.0).toFixed(2)}M`;

        debugEl.innerHTML = Object.entries(debug)
            .map(([k, v]) => `${k}: ${v.length ? v : "-"}`)
            .join("<br>");

        // console.log(this.controls.getDistance(), this.controls.getPolarAngle(), this.controls.getAzimuthalAngle());

        requestAnimationFrame(() => this.renderLoop());
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onPointerMove(event: PointerEvent) {
        if (event.isPrimary === false) return;

        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        debug.mouse = printVec(pointer);
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
