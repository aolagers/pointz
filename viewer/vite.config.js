import { defineConfig } from "vite";
import { createReadStream } from "node:fs";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { buildSync } from "esbuild";
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
                // console.log(">>> WASM", req.url);
                res.setHeader("Content-Type", "application/wasm");
                createReadStream("./public/laz-perf.wasm").pipe(res);
            } else if (req.url.endsWith("/service-worker.js")) {
                createReadStream("./dist/service-worker.js").pipe(res);
            } else {
                next();
            }
        });
    },
};

const serviceWorkerBuilder = {
    name: "service-worker-builder",
    enforce: "post",
    transformIndexHtml() {
        console.log(">>> Building service worker");
        buildSync({
            entryPoints: ["service-worker.ts"],
            outfile: "dist/service-worker.js",
            bundle: true,
            minify: true,
            sourcemap: false,
        });
    },
};

const PORT = 5173;
export default defineConfig((x) => ({
    clearScreen: false,
    build: { chunkSizeWarningLimit: 800 },
    plugins: [
        solid(),
        serviceWorkerBuilder,
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
