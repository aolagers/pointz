import { Copc } from "copc";
import {
    BoxGeometry,
    BufferGeometry,
    Clock,
    Color,
    Float32BufferAttribute,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Points,
    Raycaster,
    Scene,
    ShaderMaterial,
    Uint32BufferAttribute,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import fragment from "./fragment.glsl";
import vertex from "./vertex.glsl";

const pointer = new Vector2();

async function loadPoints() {
    const url = "http://localhost:5173/lion_takanawa.copc.laz";
    const copc = await Copc.create(url);

    console.log(copc);

    const bounds = {
        min: new Vector3(...copc.header.min),
        max: new Vector3(...copc.header.max),
    };

    const { nodes, pages } = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);

    console.log(nodes);

    console.log("pages", pages);

    type Point = readonly [number, number, number, number, number, number];
    const points: Point[] = [];

    for (const key in nodes) {
        const node = nodes[key];
        // console.log("LOAD", key, node);
        if (!node) continue;

        const view = await Copc.loadPointDataView(url, copc, node);
        const getters = {
            x: view.getter("X"),
            y: view.getter("Y"),
            z: view.getter("Z"),
            r: view.getter("Red"),
            g: view.getter("Green"),
            b: view.getter("Blue"),
        };

        for (let i = 0; i < view.pointCount; i++) {
            const point = [
                getters.x(i),
                getters.y(i),
                getters.z(i),
                getters.r(i) / 256,
                getters.g(i) / 256,
                getters.b(i) / 256,
            ] as const;

            points.push(point);
        }
        console.log(points.at(-1));
    }
    console.log("loaded points:", points.length);
    return {
        points,
        bounds,
    };
}

class PointCloud {
    points: Points;
    bounds: { min: Vector3; max: Vector3 } | null;

    constructor(pts: Points, bounds: { min: Vector3; max: Vector3 } | null) {
        this.points = pts;
        this.bounds = bounds;
    }

    static async loadLion() {
        const { points, bounds } = await loadPoints();

        console.log({ bounds });

        const geometry = new BufferGeometry();

        const vertices = [];
        const colors = [];

        const classes = [];

        for (const pt of points) {
            vertices.push(pt[0], pt[1], pt[2]);
            colors.push(pt[3] / 255, pt[4] / 255, pt[5] / 255);
            classes.push(2);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));
        return new PointCloud(new Points(geometry, PointCloud.pointMaterial), bounds);
    }

    static async loadDemo() {
        const geometry = new BufferGeometry();
        const vertices = [];
        const colors = [];

        const classes = [];
        const C = 0.2;

        // gnd
        for (let i = 0; i < 10_000; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            colors.push(0.4 + Math.random() * C, 0.15 + Math.random() * C, 0.0 + Math.random() * C);
            classes.push(0);
        }

        // trees
        for (let i = 0; i < 16; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < 50; j++) {
                vertices.push(x + Math.random() / 2, y + Math.random() / 2, z + j / 5);
                colors.push(0.1 + Math.random() * C, 0.7 + Math.random() * C, 0.1 + Math.random() * C);
                classes.push(1);
            }
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return new PointCloud(new Points(geometry, PointCloud.pointMaterial), null);
    }

    static pointMaterial: ShaderMaterial = new ShaderMaterial({
        uniforms: {
            uColor: { value: new Color(0x33ee44) },
            uMouse: { value: pointer },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
    });
}

class World {
    scene: Scene;
    pclouds: PointCloud[] = [];

    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);
    }

    async load() {
        const demo = await PointCloud.loadDemo();
        this.pclouds.push(demo);
        this.scene.add(demo.points);

        const lion = await PointCloud.loadLion();
        this.pclouds.push(lion);
        this.scene.add(lion.points);

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

const renderer = new WebGLRenderer({
    antialias: true,
});

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.up.set(0, 0, 1);

camera.position.set(0, -100, 50);
camera.lookAt(0, 0, 0);

const controls = new MapControls(camera, renderer.domElement);
// const controls = new FlyControls(camera, renderer.domElement);
// const controls = new FirstPersonControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", onPointerMove);

window.addEventListener("resize", onWindowResize);

const debug = document.getElementById("debug")!;

let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const world = new World();

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.5;

const points = [];
points.push(new Vector3(0, 0, 100));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);

const line = new Line(lineGeom, new LineBasicMaterial({ color: 0xff0000 }));

world.scene.add(line);

function loop() {
    requestAnimationFrame(loop);

    // world.update(camera);
    //
    const delta = clock.getDelta();

    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObject(world.pclouds[0]!.points, false);

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

    controls.update(delta);
    renderer.render(world.scene, camera);
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event: PointerEvent) {
    if (event.isPrimary === false) return;

    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    debug.innerHTML =
        `mx: ${mouseX.toFixed(2)} my: ${mouseY.toFixed(2)}<br>` +
        `x: ${pointer.x.toFixed(2)}, y: ${pointer.y.toFixed(2)}`;
}

const clock = new Clock();

async function start() {
    await world.load();
    loop();
}

start();
