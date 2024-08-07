export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200_000.0;

export const POINT_BUDGET = 4_000_000;

export const ALWAYS_RENDER = false;

export const ERROR_LIMIT = 0.002;

export const COLOR_MODE = {
    INTENSITY: "0",
    CLASSIFICATION: "1",
    RGB: "2",
    RGB_AND_CLASS: "3",
};

export const LOCALSTORAGE_KEYS = {
    CAMERA: "camera",
    COLOR_MODE: "color_mode",
};

export function getDefaultColorMode() {
    const colorMode: keyof typeof COLOR_MODE =
        ("localStorage" in globalThis
            ? (localStorage.getItem(LOCALSTORAGE_KEYS.COLOR_MODE) as keyof typeof COLOR_MODE)
            : null) || "RGB";
    return colorMode;
}
