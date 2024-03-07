#define INTENSITY false

uniform vec3 uColor;

flat varying uint cls;
flat varying vec2 mouse;
flat varying vec3 rgbColor;

flat varying float fintensity;

flat varying float custom1;
flat varying float custom2;

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
    if (u*u + v*v > 1.0) {
        discard;
    }

    if (INTENSITY) {
        gl_FragColor = vec4(vec3(fintensity), 1.0);
    } else {
        gl_FragColor = vec4(rgbColor, 1.0);
    }
}
