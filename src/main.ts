import {
    BufferGeometry,
    Clock,
    Color,
    Float32BufferAttribute,
    Line,
    LineBasicMaterial,
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
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';


import vertex from "./vertex.glsl";
import fragment from "./fragment.glsl";
import { Copc } from "copc";

async function loadPoints() {
    const url = "http://localhost:5173/lion_takanawa.copc.laz";
    const copc = await Copc.create(url);

    console.log(copc);
    const { nodes, pages } = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);

    console.log(nodes);

    console.log("pages", pages);

    type Point = [number, number, number, number, number, number];
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
            ];

            points.push(point);
        }
        console.log(points.at(-1));
    }
    console.log("loaded points:", points.length);
    return points;
}

class PointCloud {
    static async load() {
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

        // lion
        const pts = await loadPoints();

        for (const pt of pts) {
            vertices.push(5 * pt[0], 5 * pt[1], 5 * pt[2]);
            colors.push(pt[3] / 255, pt[4] / 255, pt[5] / 255);
            classes.push(2);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return geometry;
    }

    static getMaterial() {
        const material = new ShaderMaterial({
            uniforms: {
                uColor: { value: new Color(0x33ee44) },
                uMouse: { value: pointer },
            },
            vertexShader: vertex,
            fragmentShader: fragment,
        });

        return material;
    }
}

class World {
    scene: Scene;
    pcloud: Points | null;

    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);
        this.pcloud = null;
    }

    async load() {
        const bgeom = await PointCloud.load();
        this.pcloud = new Points(bgeom, PointCloud.getMaterial());
        this.scene.add(this.pcloud);
    }
}

const renderer = new WebGLRenderer({
    antialias: true,
});

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.up.set(0,0,1);


camera.position.set(0, -100, 50);
camera.lookAt(0,0,0);

const controls = new MapControls(camera, renderer.domElement);
// const controls = new FlyControls(camera, renderer.domElement);
// const controls = new FirstPersonControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.20;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", onPointerMove);

window.addEventListener("resize", onWindowResize);

const debug = document.getElementById("debug")!;

const pointer = new Vector2();
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
    const intersections = raycaster.intersectObject(world.pcloud, false);

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
