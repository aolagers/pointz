import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";
import { createReadStream } from "node:fs";
import { viteStaticCopy } from "vite-plugin-static-copy";

const wasmInterceptor = {
    name: "wasm-interceptor-plugin",
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url.endsWith("/laz-perf.wasm")) {
                console.log(">>> WASM", req.url);
                res.setHeader("Content-Type", "application/wasm");
                createReadStream("./node_modules/copc/node_modules/laz-perf/lib/laz-perf.wasm").pipe(res);
            } else {
                next();
            }
        });
    },
};

export default defineConfig({
    plugins: [glsl(), wasmInterceptor, viteStaticCopy({
        targets: [
            {
                src: "./node_modules/copc/node_modules/laz-perf/lib/laz-perf.wasm",
                dest: ".",
            },
            {
                src: "./node_modules/copc/node_modules/laz-perf/lib/laz-perf.wasm",
                dest: "./src",
            },
            {
                src: "./node_modules/copc/node_modules/laz-perf/lib/laz-perf.wasm",
                dest: "./assets",
            }
        ]
    })],
    base: "",
    test: {
        includeSource: ["src/**/*.ts"],
    },
});
