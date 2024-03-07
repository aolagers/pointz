uniform vec3 uColor;

flat in int vClass;
in vec2 mouse;
in vec4 rgbColor;

in float fintensity;

in float custom1;
in float custom2;

out vec4 FragColor;

const uint N_CLASSES = 6u;
const vec3 CLASS_COLORS[N_CLASSES] = vec3[](
        vec3(0.4, 0.4, 0.4),
        vec3(0.8, 0.8, 0.8),
        vec3(1.0, 0.0, 0.0),
        vec3(0.0, 1.0, 0.0),
        vec3(0.0, 0.0, 1.0),
        vec3(1.0, 0.0, 1.0));

void main() {

    uint cls = uint(vClass);
    // classification color
    if (cls == 0u) {
        FragColor = vec4(0.5, 0.25, 0.1, 1.0);
    } else {
        FragColor = vec4(uColor, 1.0);
    }

    // round points
    float u = 2.0 * gl_PointCoord.x - 1.0;
    float v = 2.0 * gl_PointCoord.y - 1.0;
    if (u*u + v*v > 1.0) {
        discard;
    }

    // TODO: replace ugly hack by passing material id in some other way
    //float alpha = 1.0;
    float alpha = 0.998;

#if defined(PICK)
        FragColor = rgbColor; 
        //FragColor = vec4(1.0, 1.0, 0.0, rgbColor.a); 
        return;
#endif

    if (COLOR_MODE == 0) {
        // intensity
        FragColor = vec4(vec3(fintensity), alpha);
    } else if (COLOR_MODE == 1) {
        // classification
        FragColor = vec4(CLASS_COLORS[cls%N_CLASSES], alpha);
    } else if (COLOR_MODE == 2) {
        // RGB
        FragColor = vec4(rgbColor.rgb, alpha);
    } else {
        FragColor = vec4(0.0, 0.0, 1.0, alpha);
    }
}
