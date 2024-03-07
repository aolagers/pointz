#define INTENSITY false

uniform vec3 uColor;

flat varying uint cls;
flat varying vec2 mouse;
flat varying vec3 rgbColor;

flat varying float fintensity;

flat varying float custom1;
flat varying float custom2;

vec4 fromLinear(vec4 linearRGB)
{
	bvec4 cutoff = lessThan(linearRGB, vec4(0.0031308));
	vec4 higher = vec4(1.055)*pow(linearRGB, vec4(1.0/2.4)) - vec4(0.055);
	vec4 lower = linearRGB * vec4(12.92);

	return mix(higher, lower, cutoff);
}

vec4 toLinear(vec4 sRGB)
{
	bvec4 cutoff = lessThan(sRGB, vec4(0.04045));
	vec4 higher = pow((sRGB + vec4(0.055))/vec4(1.055), vec4(2.4));
	vec4 lower = sRGB/vec4(12.92);

	return mix(higher, lower, cutoff);
}

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

    // fix colors when rendering to a texture
    gl_FragColor = toLinear(gl_FragColor);
}
