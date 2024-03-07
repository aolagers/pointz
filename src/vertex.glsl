uniform vec2 uMouse;
attribute uint classification;

flat varying uint cls;
flat varying vec2 mouse;

void main() {
    cls = classification;
    mouse = uMouse;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 screenPosition = projectionMatrix * mvPosition;

    vec2 screenNorm = mvPosition.xy;

    float dist = distance(cameraPosition, position);

    gl_PointSize = max(3.0, 100.0/dist);

    gl_Position = screenPosition;


    vec4 mpos = screenPosition / screenPosition.w;

    float mDist = distance(mouse, mpos.xy);

    if (mDist < 0.01) {
        gl_PointSize = 2.0 + gl_PointSize * 2.0;
    }
}
