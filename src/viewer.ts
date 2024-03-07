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
    scene: Scene;
    pclouds: PointCloud[] = [];
    objects: Points[] = [];

    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);
    }

    async load() {
        const demo = await PointCloud.loadDemo();
        this.pclouds.push(demo);

        const pco1 = new Points(demo.geometry, pointMaterial);
        this.objects.push(pco1);
        this.scene.add(pco1);

        const lion = await PointCloud.loadLion();
        this.pclouds.push(lion);
        const pco2 = new Points(lion.geometry, pointMaterial);
        this.objects.push(pco2);
        this.scene.add(pco2);

        if (lion.bounds) {
            const size = [
                lion.bounds.max.x - lion.bounds.min.x,
                lion.bounds.max.y - lion.bounds.min.y,
                lion.bounds.max.z - lion.bounds.min.z,
            ];
            console.log("lion", size);
            const boundGeom = new BoxGeometry(...size);
            const mat = new MeshBasicMaterial({ color: "red", wireframe: true });
            const cube = new Mesh(boundGeom, mat);
            const halfSize = size.map((x) => x / 2);
            cube.position.copy(lion.bounds.min).add(new Vector3(...halfSize));
            this.scene.add(cube);
        }
    }
}

export class Viewer {
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    controls: MapControls;

    constructor() {
        this.renderer = new WebGLRenderer({ antialias: true });

        this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, -100, 50);
        this.camera.lookAt(0, 0, 0);

        this.controls = new MapControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.2;

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    init() {
        document.body.appendChild(this.renderer.domElement);

        document.body.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("resize", this.onWindowResize);
    }

    loop() {
        const delta = clock.getDelta();

        raycaster.setFromCamera(pointer, this.camera);
        const intersections = raycaster.intersectObject(world.objects[0]!, false);

        if (intersections.length > 0 && intersections[0]) {
            line.visible = true;
            const pos = line.geometry.attributes.position!;
            const verts = pos.array;

            verts[3] = intersections[0].point.x;
            verts[4] = intersections[0].point.y;
            verts[5] = intersections[0].point.z;

            pos.needsUpdate = true;
        } else {
            line.visible = false;
        }

        this.controls.update(delta);
        this.renderer.render(world.scene, this.camera);

        requestAnimationFrame(() => this.loop());
    }

    async start() {
        await world.load();
        this.loop();
    }

    onWindowResize() {
        // windowHalfX = window.innerWidth / 2;
        // windowHalfY = window.innerHeight / 2;

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onPointerMove(event: PointerEvent) {
        if (event.isPrimary === false) return;

        // mouseX = event.clientX - windowHalfX;
        // mouseY = event.clientY - windowHalfY;

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

const world = new World();

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const points = [];
points.push(new Vector3(0, 0, 100));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);

const line = new Line(lineGeom, new LineBasicMaterial({ color: 0xff0000 }));

world.scene.add(line);

const clock = new Clock();
