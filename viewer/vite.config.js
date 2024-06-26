import { defineConfig } from "vite";
import { createReadStream } from "node:fs";
import { viteStaticCopy } from "vite-plugin-static-copy";
import solid from "vite-plugin-solid";

const wasmInterceptor = {
    name: "wasm-interceptor-plugin",

    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            // Add COOP and COEP to enable crossOriginIsolated mode.
            // Needed for accurate performance.now() and memory stuff
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

            if (req.url.endsWith("/laz-perf.wasm")) {
                console.log(">>> WASM", req.url);
                res.setHeader("Content-Type", "application/wasm");
                createReadStream("./public/laz-perf.wasm").pipe(res);
            } else {
                next();
            }
        });
    },
};

export default defineConfig((x) => ({
    clearScreen: false,
    build: { chunkSizeWarningLimit: 800 },
    plugins: [
        solid(),
        wasmInterceptor,
        x.command === "build"
            ? viteStaticCopy({
                  targets: [
                      { src: "./public/laz-perf.wasm", dest: "./assets" },
                      { src: "./public/lion_takanawa.copc.laz", dest: "./assets" },
                  ],
              })
            : [],
    ],
    base: "",
    test: {
        includeSource: ["src/**/*.ts"],
    },
}));
