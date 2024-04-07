import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    // plugins: [glsl(), dts()],
    plugins: [dts(),glsl()],
    build: {
        lib: {
            entry: "src/viewer.ts",
            name: "core",
            // fileName: (format) => `core.${format}.js`,
        },
    },
	base: "./"
});
