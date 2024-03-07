uniform vec2 uMouse;

in uint classification;
in float intensity;
in vec3 color;
in uint indices;

uniform float ptSize;
uniform float uCustom1;
uniform float uCustom2;

out vec3 rgbColor;
flat out uint cls;

out float custom1;
out float custom2;

out float fintensity;

out vec2 mouse;

out float depth;

void main() {
    cls = classification;
    rgbColor = color;

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

    vec4 mpos = screenPosition / screenPosition.w;

    float mDist = distance(mouse, mpos.xy);

    if (mDist < 0.01) {
        gl_PointSize = 2.0 + gl_PointSize * 2.0;
    }

#if defined(PICK)
        gl_PointSize=1.0;
        return;
#endif

}
