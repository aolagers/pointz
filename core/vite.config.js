import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [dts(), glsl()],
    build: {
        lib: {
            entry: "src/viewer.ts",
            name: "core",
            formats: ["es"],
        },
        minify: false,
    },
    base: "./",
    test: {
        includeSource: ["src/**/*.ts"],
    },
});
