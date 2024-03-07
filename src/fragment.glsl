uniform vec3 uColor;

flat varying uint cls;
flat varying vec2 mouse;
flat varying vec3 rgbColor;

void main() {

    // classification color
    if (cls == 0u) {
        gl_FragColor = vec4(0.5, 0.25, 0.1, 1.0);
    } else {
        gl_FragColor = vec4(uColor, 1.0);
    }

    // round points
    float u = 2.0 * gl_PointCoord.x - 1.0;
    float v = 2.0 * gl_PointCoord.y - 1.0;
    float cc = u*u + v*v;
    if(cc > 1.0) {
        discard;
    }

    // rgb color
    if (rgbColor.xyz != vec3(0.0, 0.0, 0.0)) {
        gl_FragColor = vec4(rgbColor, 1.0);
    }
}
