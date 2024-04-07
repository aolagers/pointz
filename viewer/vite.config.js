import { defineConfig } from "vite";
import { createReadStream } from "node:fs";

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
                createReadStream("./dist/laz-perf.wasm").pipe(res);
            } else {
                next();
            }
        });
    },
};

export default defineConfig((x) => ({
    clearScreen: false,
    build: { chunkSizeWarningLimit: 800 },
    plugins: [wasmInterceptor],
    base: "",
    test: {
        includeSource: ["src/**/*.ts"],
    },
}));
