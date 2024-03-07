import {
    BoxGeometry,
    BufferGeometry,
    Clock,
    Color,
    Line,
    Mesh,
    PerspectiveCamera,
    Points,
    Raycaster,
    Scene,
    Vector3,
    WebGLRenderer,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { PointCloud } from "./pointcloud";
import { MATERIALS, pointer } from "./materials";

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
    }

    init() {
        document.body.appendChild(this.renderer.domElement);

        document.body.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("resize", this.onWindowResize);
    }

    loop() {
        const delta = clock.getDelta();

        if (this.objects.length > 0) {
            raycaster.setFromCamera(pointer, this.camera);
            const intersections = raycaster.intersectObject(this.objects[0]!, false);

            if (intersections.length > 0 && intersections[0]) {
                line.visible = true;
                const pos = line.geometry.attributes.position!;
                const verts = pos.array;

                // intersec
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
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => this.loop());
    }

    async start() {
        this.addDemo();
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
        const cube = Viewer.createBounds(demo);
        this.scene.add(cube);
    }

    async addLAZ(what: string | File) {
        const pc = await PointCloud.loadLAZ(this, what);
        this.pclouds.push(pc);
        pc.load();
        const cube = Viewer.createBounds(pc);
        this.scene.add(cube);
    }

    static createBounds(pc: PointCloud) {
        const size = new Vector3().subVectors(pc.bounds.max, pc.bounds.min);
        const boundGeom = new BoxGeometry(...size.toArray());
        const cube = new Mesh(boundGeom, MATERIALS.BBOX);
        const halfSize = new Vector3().copy(size).divideScalar(2);
        const midP = new Vector3().subVectors(pc.bounds.min, pc.offset);
        cube.position.copy(midP).add(new Vector3(...halfSize));

        return cube;

        /*
            this.scene.add(cube);

            console.log(midP);

            midP.add(new Vector3(...halfSize));

            // this.viewer.camera.position.set(midP.x, midP.y - 100, midP.z + 50);
            // this.viewer.camera.lookAt(0, 0, 0);
            // this.viewer.camera.lookAt(midP);
            this.viewer.controls.target = midP;
        */
    }
}

const debug = document.getElementById("debug")!;

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const clock = new Clock();
