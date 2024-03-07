varying vec2 vUv;

void main() {
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 screenPosition = projectionMatrix * mvPosition;
    gl_Position = screenPosition;
}

