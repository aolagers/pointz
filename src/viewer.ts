import {
    BoxGeometry,
    BufferGeometry,
    Clock,
    Color,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Points,
    Raycaster,
    Scene,
    ShaderMaterial,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { PointCloud } from "./pointcloud";
import fragment from "./fragment.glsl";
import vertex from "./vertex.glsl";

const pointer = new Vector2();

class World {
    viewer: Viewer;
    scene: Scene;
    pclouds: PointCloud[] = [];
    objects: Points[] = [];

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);
    }

    async addDemo() {
        const demo = PointCloud.loadDemo();
        this.pclouds.push(demo);

        const pco1 = new Points(demo.geometry, pointMaterial);
        this.objects.push(pco1);
        this.scene.add(pco1);
    }

    async addLAZ(what: string | File) {
        const testLaz = await PointCloud.loadLAZ(what);
        this.pclouds.push(testLaz);
        const pco2 = new Points(testLaz.geometry, pointMaterial);
        this.objects.push(pco2);
        this.scene.add(pco2);

        if (testLaz.bounds) {
            const size = [
                testLaz.bounds.max.x - testLaz.bounds.min.x,
                testLaz.bounds.max.y - testLaz.bounds.min.y,
                testLaz.bounds.max.z - testLaz.bounds.min.z,
            ];
            const boundGeom = new BoxGeometry(...size);
            const mat = new MeshBasicMaterial({ color: "red", wireframe: true });
            const cube = new Mesh(boundGeom, mat);
            const halfSize = size.map((x) => x / 2);
            const midP = new Vector3().subVectors(testLaz.bounds.min, testLaz.offset);
            cube.position.copy(midP).add(new Vector3(...halfSize));
            this.scene.add(cube);

            console.log(midP);

            midP.add(new Vector3(...halfSize));

            // this.viewer.camera.position.set(midP.x, midP.y - 100, midP.z + 50);
            // this.viewer.camera.lookAt(0, 0, 0);
            // this.viewer.camera.lookAt(midP);
            this.viewer.controls.target = midP;
        }
    }
}

const points = [];
points.push(new Vector3(0, 0, 100));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);
const line = new Line(lineGeom, new LineBasicMaterial({ color: 0xff0000 }));

export class Viewer {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    controls: MapControls;
    world: World;

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

        this.world = new World(this);

        this.world.scene.add(line);
    }

    init() {
        document.body.appendChild(this.renderer.domElement);

        document.body.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("resize", this.onWindowResize);
    }

    loop() {
        const delta = clock.getDelta();

        if (this.world.objects.length > 0) {
            raycaster.setFromCamera(pointer, this.camera);
            const intersections = raycaster.intersectObject(this.world.objects[0]!, false);

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
        this.renderer.render(this.world.scene, this.camera);

        requestAnimationFrame(() => this.loop());
    }

    async start() {
        this.world.addDemo();
        this.world.addLAZ("http://localhost:5173/lion_takanawa.copc.laz");
        // world.addLAZ("http://localhost:5173/autzen-classified.copc.laz");

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
                            this.world.addLAZ(file!);
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

        debug.innerHTML =
            // `mx: ${mouseX.toFixed(2)} my: ${mouseY.toFixed(2)}<br>` +
            `x: ${pointer.x.toFixed(2)}, y: ${pointer.y.toFixed(2)}`;
    }
}

const pointMaterial = new ShaderMaterial({
    uniforms: {
        uColor: { value: new Color(3403332) },
        uMouse: { value: pointer },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
});

const debug = document.getElementById("debug")!;

// let mouseX = 0;
// let mouseY = 0;

// let windowHalfX = window.innerWidth / 2;
// let windowHalfY = window.innerHeight / 2;

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const clock = new Clock();
