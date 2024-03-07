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
} from "three";

class PointCloud {
    static load() {
        const geometry = new BufferGeometry();
        const vertices = [];

        for (let i = 0; i < 1_000; i++) {
            const x = (Math.random() - 0.5) * 5;
            const y = (Math.random() - 0.5) * 5;
            const z = (Math.random() - 0.5) * 5;

            vertices.push(x, y, z);
        }

        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

        return geometry;
    }

    static getMaterial() {
        const vertexShader = `
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                gl_PointSize = 2.0;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            void main() {
                gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
            }
        `;

        const smaterial = new ShaderMaterial({
            uniforms: {
                color: { value: new Color(0xff0000) },
                position: {},
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        const pmaterial = new PointsMaterial({
            size: 5,
        });

        return smaterial;
    }
}

class World {
    scene: Scene;
    cube: Mesh;

    constructor() {
        this.scene = new Scene();

        this.cube = getCube();
        this.scene.add(this.cube);

        const pcloud = new Points(PointCloud.load(), PointCloud.getMaterial());
        this.scene.add(pcloud);
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
    const material = new MeshBasicMaterial({ color: 0x00ff00 });

    const cube = new Mesh(geometry, material);
    return cube;
}

const renderer = new WebGLRenderer();

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

document.body.appendChild(renderer.domElement);

document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", onPointerMove);

window.addEventListener("resize", onWindowResize);

let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const world = new World();

function loop() {
    requestAnimationFrame(loop);

    world.update(camera);

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
}

loop();
