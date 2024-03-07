uniform vec2 uMouse;

in int classification;
in float intensity;
in vec3 color;
in int ptIndex;

in float visibleIndex;

uniform float ptSize;
uniform float uCustom1;
uniform float uCustom2;

out vec4 rgbColor;
flat out int vClass;

out float custom1;
out float custom2;

out float fintensity;

out vec2 mouse;

out float depth;

void main() {
    vClass = classification;
    rgbColor = vec4(color, 4);

    mouse = uMouse;

    fintensity = intensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 screenPosition = projectionMatrix * mvPosition;

    float dist = distance(cameraPosition, position);

    depth = dist;
    custom1 = uCustom1;
    custom2 = uCustom2;

    //gl_PointSize = max(ptSize, 150.0/dist) + uCustom1/10.0;

    gl_PointSize = ptSize;

    gl_Position = screenPosition;

    /*
    vec4 mpos = screenPosition / screenPosition.w;

    float mDist = distance(mouse, mpos.xy);

    if (mDist < 0.01) {
        gl_PointSize = 2.0 + gl_PointSize * 2.0;
    }
    */

#if defined(PICK)
    gl_PointSize=4.0;

    int data = ptIndex;

    float r = float((data >> 16) & 0xff) / 255.0;
    float g = float((data >> 8) & 0xff) / 255.0;
    float b = float(data & 0xff) / 255.0;
    // TODO: why is this inverted? is it?
    // float a = 1.0 - visibleIndex;
    float a = visibleIndex;

    rgbColor = vec4(r, g, b, a);
        //rgbColor = vec4(vec3(visibleIndex), 1.0);
#endif

}
