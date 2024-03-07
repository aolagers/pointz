uniform vec3 uColor;

flat varying uint cls;
flat varying vec2 mouse;
flat varying vec3 rgbColor;

void main() {

    if (cls == 0u) {
        gl_FragColor = vec4(0.5, 0.25, 0.1, 1.0);
    } else {
        gl_FragColor = vec4(uColor, 1.0);
    }

    gl_FragColor = vec4(rgbColor, 1.0);
}
