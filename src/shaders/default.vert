uniform vec2 uMouse;

attribute uint classification;
attribute vec3 color;

uniform float ptSize;

flat varying vec3 rgbColor;
flat varying uint cls;

flat varying vec2 mouse;

void main() {
    cls = classification;
    rgbColor = color;

    mouse = uMouse;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 screenPosition = projectionMatrix * mvPosition;

    vec2 screenNorm = mvPosition.xy;

    float dist = distance(cameraPosition, position);

    gl_PointSize = max(ptSize, 150.0/dist);

    gl_Position = screenPosition;

    vec4 mpos = screenPosition / screenPosition.w;

    float mDist = distance(mouse, mpos.xy);

    if (mDist < 0.01) {
        gl_PointSize = 2.0 + gl_PointSize * 2.0;
    }

    //if (gl_FragDepth < 0.5) {
        //gl_PointSize = 1.0;
    //}
}
