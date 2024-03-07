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
} from "three";

const scene = new Scene();

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio( window.devicePixelRatio );

document.body.appendChild(renderer.domElement);

document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", onPointerMove);

window.addEventListener("resize", onWindowResize);

const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: 0x00ff00 });

const cube = new Mesh(geometry, material);

const VERT = `
attribute float size;
attribute vec3 customColor;

varying vec3 vColor;

void main() {

    vColor = customColor;

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    gl_PointSize = size * ( 300.0 / -mvPosition.z );

    gl_Position = projectionMatrix * mvPosition;

}`;

const FRAG = `
uniform vec3 color;
uniform sampler2D pointTexture;
uniform float alphaTest;

varying vec3 vColor;

void main() {

    gl_FragColor = vec4( color * vColor, 1.0 );

    gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );

    if ( gl_FragColor.a < alphaTest ) discard;

}`;

scene.add(cube);

camera.position.z = 5;

let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const bgeometry = new BufferGeometry();
const vertices = [];

for (let i = 0; i < 1_000; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const y = (Math.random() - 0.5) * 1000;
    const z = (Math.random() - 0.5) * 1000;

    vertices.push(x, y, z);
}

bgeometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

// const bmaterial = new ShaderMaterial({
//     uniforms: {
//         color: { value: new Color(0xff0000) },
//     },
//     vertexShader: VERT,
//     fragmentShader: FRAG,
// });
//
const bmaterial = new PointsMaterial({
    size: 5,
    // sizeAttenuation: true,

})

const particles = new Points(bgeometry, bmaterial);
scene.add(particles);


function animate() {
    requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    camera.position.x = Math.sin(Date.now()/2_000);
    camera.position.y = Math.sin(Date.now()/5_000);

    camera.lookAt(cube.position);

    renderer.render(scene, camera);
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    // console.log("resize", window.innerWidth, window.innerHeight, camera.aspect);
}

function onPointerMove(event) {
    if (event.isPrimary === false) return;

    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;
    // console.log("mouse", mouseX, mouseY);
}
animate();
