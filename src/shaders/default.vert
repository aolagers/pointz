uniform vec2 uMouse;

attribute uint classification;
attribute float intensity;
attribute vec3 color;

uniform float ptSize;
uniform float uCustom1;
uniform float uCustom2;

flat varying vec3 rgbColor;
flat varying uint cls;

flat varying float custom1;
flat varying float custom2;

flat varying float fintensity;

flat varying vec2 mouse;

flat varying float depth;

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

    gl_PointSize = max(ptSize, 150.0/dist) + uCustom1/10.0;

    gl_Position = screenPosition;

    vec4 mpos = screenPosition / screenPosition.w;

    float mDist = distance(mouse, mpos.xy);

    if (mDist < 0.01) {
        gl_PointSize = 2.0 + gl_PointSize * 2.0;
    }
}
