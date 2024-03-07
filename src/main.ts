import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Mesh,
    MeshBasicMaterial,
    BoxGeometry,
    Float32BufferAttribute,
    BufferGeometry,
    Points,
    ShaderMaterial,
    Color,
    PointsMaterial,
    Camera,
    Raycaster,
    Vector2,
    Vector3,
    LineBasicMaterial,
    Line,
    Uint8BufferAttribute,
    Uint32BufferAttribute,
} from "three";

class PointCloud {
    static load() {
        const geometry = new BufferGeometry();
        const vertices = [];

        const classes = [];

        for (let i = 0; i < 1_000; i++) {
            const x = (Math.random() - 0.5) * 5;
            const y = (Math.random() - 0.5) * 5;
            const z = (Math.random() - 0.5) * 5;

            classes.push(i % 5);

            vertices.push(x, y, z);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("classification", new Uint32BufferAttribute(classes, 1));

        return geometry;
    }

    static getMaterial() {
        const vertexShader = `

            attribute uint classification;

            flat varying uint cls;

            void main() {
                cls = classification;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 3.0;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            uniform vec3 color;
            flat varying uint cls;

            void main() {
                if (cls == 0u) {
                    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
                } else {
                    gl_FragColor = vec4(color, 1.0);
                }
            }
        `;

        const smaterial = new ShaderMaterial({
            uniforms: {
                color: { value: new Color(0x77ffaa) },
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        return smaterial;
    }
}

class World {
    scene: Scene;
    cube: Mesh;
    pcloud: Points;

    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x202020);

        this.cube = getCube();
        this.scene.add(this.cube);

        const bgeom = PointCloud.load();
        this.pcloud = new Points(bgeom, PointCloud.getMaterial());
        this.scene.add(this.pcloud);
    }

    update(camera: Camera) {
        camera.position.z = 5;
        //cube.rotation.x += 0.01;
        //cube.rotation.y += 0.01;
        camera.position.x = Math.sin(Date.now() / 2_000);
        camera.position.y = Math.sin(Date.now() / 5_000);
        camera.lookAt(this.cube.position);
    }
}

function getCube() {
    const geometry = new BoxGeometry(1.0, 0.1, 0.1);
    const material = new MeshBasicMaterial({ color: 0xff7070 });

    const cube = new Mesh(geometry, material);
    return cube;
}

const renderer = new WebGLRenderer({
    antialias: true,
});

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", onPointerMove);

window.addEventListener("resize", onWindowResize);

const pointer = new Vector2();
let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const world = new World();

const raycaster = new Raycaster();
raycaster.params.Points.threshold = 0.05;

const points = [];
points.push(new Vector3(0, 0, 0));
points.push(new Vector3(1, 1, 1));
const lineGeom = new BufferGeometry().setFromPoints(points);

const line = new Line(lineGeom, new LineBasicMaterial({ color: 0xff0000 }));

world.scene.add(line);

let cont = true;
function loop() {
    if (cont) requestAnimationFrame(loop);

    world.update(camera);

    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObject(world.pcloud, false);

    if (intersections.length > 0 && intersections[0]) {
        line.visible = true;
        console.log(intersections[0].distance, line.geometry.attributes);
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
}

loop();

window.onerror = function (...args) {
    console.error(args);
    cont = false;
    return false;
};
