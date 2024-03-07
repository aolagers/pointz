import {
    BufferGeometry,
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
import vertex from "./vertex.glsl";
import fragment from "./fragment.glsl";

class PointCloud {
    static load() {
        const geometry = new BufferGeometry();
        const vertices = [];

        const classes = [];

        // gnd
        for (let i = 0; i < 10_000; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            vertices.push(x, y, z);
            classes.push(0);
        }

        // trees
        for (let i = 0; i < 16; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = 2 * Math.sin(x / 10) + 1 * Math.sin(y / 5);
            for (let j = 0; j < 50; j++) {
                vertices.push(x + Math.random() / 2, y + Math.random() / 2, z + j / 5);
                classes.push(1);
            }
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
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
    pcloud: Points;

    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);

        const bgeom = PointCloud.load();
        this.pcloud = new Points(bgeom, PointCloud.getMaterial());
        this.scene.add(this.pcloud);
    }
}

const renderer = new WebGLRenderer({
    antialias: true,
});

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

camera.position.set(0, -100, 50);

const controls = new MapControls(camera, renderer.domElement);

controls.enableDamping = true;

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

    debug.innerHTML = `mx: ${mouseX} my: ${mouseY}<br>x: ${pointer.x.toFixed(2)}, y: ${pointer.y.toFixed(2)}`;
}

loop();
