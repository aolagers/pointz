flat in int vClass;
in vec4 vColor;
in float vIntensity;

uniform vec2 uIntensityRange;

out vec4 FragColor;

const uint N_CLASSES = 10u;
const vec3 CLASS_COLORS[N_CLASSES] = vec3[](
        vec3(0.4, 0.4, 0.4), // 0: never classified
        vec3(0.8, 0.8, 0.8), // 1: unassigned
        vec3(140.0/255.0, 80.0/255.0, 60.0/255.0), // 2: ground

        vec3(25.0/255.0, 170.0/255.0, 70.0/255.0), // 3: low vege
        vec3(15.0/255.0, 155.0/255.0, 30.0/255.0), // 4: med vege
        vec3(30.0/255.0, 239.0/255.0, 31.0/255.0), // 5: high vege

        vec3(1.0, 1.0, 0.0), // 6: building
        vec3(0.0, 1.0, 1.0), // 7: noise
        vec3(1.0, 0.0, 1.0), // 8: model key / reserved

        vec3(0.3, 0.3, 1.0) // 9: water
        // 10: rail
        // 11: road surface
        // 12: overlap / reserved
        // 13: wire - guard
        // 14: wire - conductor
        // 15: transmission tower
        // 16: wire - connector
        // 17: bridge deck
        // 18: high noise
        );

void main() {

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
        FragColor = vColor;
        return;
#endif

    if (COLOR_MODE == 0) {
        // intensity
        float scaledIntensity = (vIntensity - uIntensityRange.x) / (uIntensityRange.y - uIntensityRange.x);
        FragColor = vec4(vec3(scaledIntensity), alpha);
    } else if (COLOR_MODE == 1) {
        // classification
        FragColor = vec4(CLASS_COLORS[uint(vClass) % N_CLASSES], alpha);
    } else if (COLOR_MODE == 2) {
        // RGB
        FragColor = vec4(vColor.rgb, alpha);
    } else if (COLOR_MODE == 3) {
        // RGB_AND_CLASS
        FragColor = mix(
            vec4(CLASS_COLORS[uint(vClass) % N_CLASSES], alpha),
            vec4(vColor.rgb, alpha),
            0.7
        );
    } else {
        // what??
        FragColor = vec4(1.0, 0.0, 1.0, alpha);
    }
}
