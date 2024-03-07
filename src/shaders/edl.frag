uniform sampler2D tx;
varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(tx, vUv);
}

