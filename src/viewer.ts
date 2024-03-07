import {
    BufferGeometry,
    Clock,
    Color,
    Line,
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
import { MATERIALS, pointer, updateValues } from "./materials";
import { createTightBounds } from "./utils";
import { GPUStatsPanel } from "three/addons/utils/GPUStatsPanel.js";

const points = [];
points.push(new Vector3(0, 0, 100));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);
const line = new Line(lineGeom, MATERIALS.LINE);

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
        this.renderer = new WebGLRenderer({ antialias: true });

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
        document.body.appendChild(this.stats.dom);
    }

    init() {
        document.body.appendChild(this.renderer.domElement);

        document.body.addEventListener("pointermove", this.onPointerMove);

        const sl1 = document.getElementById("sl1") as HTMLInputElement;
        const sl2 = document.getElementById("sl2") as HTMLInputElement;

        const sliders: [number, number] = [0, 0];
        sl1.addEventListener("input", () => {
            sliders[0] = parseInt(sl1.value);
            updateValues(sliders[0], sliders[1]);
        });
        sl2.addEventListener("input", () => {
            sliders[1] = parseInt(sl2.value);
            updateValues(sliders[0], sliders[1]);
        });
        window.addEventListener("resize", this.onWindowResize);
    }

    loop() {
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

        // console.log(this.controls.getDistance(), this.controls.getPolarAngle(), this.controls.getAzimuthalAngle());
        requestAnimationFrame(() => this.loop());
    }

    async start() {
        this.addDemo();
        // this.addLAZ("http://localhost:5173/copc.copc.laz");
        this.addLAZ("http://localhost:5173/lion_takanawa.copc.laz");
        // this.addLAZ("http://localhost:5173/autzen-classified.copc.laz");

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

        this.loop();
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

        debug.innerHTML = `x: ${pointer.x.toFixed(2)}, y: ${pointer.y.toFixed(2)}`;
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

const debug = document.getElementById("debug")!;

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const clock = new Clock();