in int classification;
in float intensity;
in vec3 color;
in int ptIndex;

uniform float uNodeIndex;
uniform float ptSize;
uniform int uClassMask;

out vec4 vColor;
flat out int vClass;

out float vIntensity;

//out float depth;

void main() {

    if (((1 << classification) & uClassMask) == 0 ) {
        return;
    }

    vClass = classification;
    vColor = vec4(color, 4);
    vIntensity = intensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 screenPosition = projectionMatrix * mvPosition;

    //depth = distance(cameraPosition, position);

    gl_PointSize = ptSize;
    gl_Position = screenPosition;

#if defined(PICK)

    int data = ptIndex;

    float r = float((data >> 16) & 0xff) / 255.0;
    float g = float((data >> 8) & 0xff) / 255.0;
    float b = float(data & 0xff) / 255.0;
    float a = uNodeIndex / 255.0;

    vColor = vec4(r, g, b, a);

#endif

}
